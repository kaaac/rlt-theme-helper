import * as vscode from 'vscode';
import * as path from 'path';
import { getThemeContext, ThemeContext } from '../core/themeContext';
import { parseJson } from '../core/json';
import { collectNames, NameEntry, NameIndex } from '../core/names';

interface NameKind {
    /** Property that references the name, e.g. "Style" */
    key: string;
    /** Property that defines the name, e.g. "StyleName" */
    property: string;
    /** Theme directory with global definitions */
    directory: string;
    label: string;
    kind: vscode.CompletionItemKind;
    showDefinition: boolean;
}

/**
 * Properties that reference a named theme element, and where those elements are defined.
 */
const NAME_KINDS: NameKind[] = [
    { key: 'Component', property: 'ComponentName', directory: 'components', label: 'Component', kind: vscode.CompletionItemKind.Value, showDefinition: false },
    { key: 'Style', property: 'StyleName', directory: 'styles', label: 'Style', kind: vscode.CompletionItemKind.Color, showDefinition: true },
    { key: 'Trigger', property: 'TriggerName', directory: 'triggers', label: 'Trigger', kind: vscode.CompletionItemKind.Event, showDefinition: true }
];

/**
 * Completion for "Component", "Style" and "Trigger" values:
 * names defined in the current file (Local) and in the theme's components/, styles/, triggers/ (Global).
 */
export class NameCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
        // Key of the string value being typed, also when other properties precede it on the line
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const key = linePrefix.match(/"(\w+)"\s*:\s*"[^"]*$/)?.[1];
        const nameKind = NAME_KINDS.find(candidate => candidate.key === key);
        if (!nameKind) {
            return undefined;
        }

        const theme = getThemeContext(document);

        // Local names first, so they win over global ones with the same name
        const names: NameIndex = new Map();
        const { value } = parseJson(document.getText());
        collectNames(value, nameKind.property, theme.relativePath(document.uri.fsPath), 'Local', names);
        for (const [name, entry] of theme.getNameIndex(nameKind.directory, nameKind.property)) {
            if (!names.has(name)) {
                names.set(name, entry);
            }
        }

        return Array.from(names.values(), entry => this.createItem(entry, nameKind, theme));
    }

    private createItem(entry: NameEntry, nameKind: NameKind, theme: ThemeContext): vscode.CompletionItem {
        const item = new vscode.CompletionItem(entry.name, nameKind.kind);
        item.detail = `${entry.details} ${nameKind.label}`;

        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        if (entry.source) {
            const uri = path.isAbsolute(entry.source) ? vscode.Uri.file(entry.source) : theme.uriFor(entry.source);
            markdown.appendMarkdown(`${nameKind.label} defined in [${entry.source}](${uri})\n\n`);
        }
        if (nameKind.showDefinition && entry.definition && !entry.isPath) {
            markdown.appendMarkdown('**Definition:**\n');
            markdown.appendCodeblock(JSON.stringify(entry.definition, null, 2), 'json');
        }
        item.documentation = markdown;

        return item;
    }
}
