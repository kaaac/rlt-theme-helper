const vscode = require('vscode');
const path = require('path');
const { getThemeContext } = require('../core/themeContext');
const { parseJson } = require('../core/json');
const { collectNames } = require('../core/names');

/**
 * Properties that reference a named theme element, and where those elements are defined.
 */
const NAME_KINDS = [
    { key: 'Component', property: 'ComponentName', directory: 'components', label: 'Component', kind: vscode.CompletionItemKind.Value, showDefinition: false },
    { key: 'Style', property: 'StyleName', directory: 'styles', label: 'Style', kind: vscode.CompletionItemKind.Color, showDefinition: true },
    { key: 'Trigger', property: 'TriggerName', directory: 'triggers', label: 'Trigger', kind: vscode.CompletionItemKind.Event, showDefinition: true }
];

/**
 * Completion for "Component", "Style" and "Trigger" values:
 * names defined in the current file (Local) and in the theme's components/, styles/, triggers/ (Global).
 */
class NameCompletionProvider {
    provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const keyPrefix = linePrefix.trim().split(':')[0].trim();
        const nameKind = NAME_KINDS.find(candidate => keyPrefix.endsWith(`"${candidate.key}"`));
        if (!nameKind) {
            return undefined;
        }

        const theme = getThemeContext(document);

        // Local names first, so they win over global ones with the same name
        const names = new Map();
        const { value } = parseJson(document.getText());
        collectNames(value, nameKind.property, theme.relativePath(document.uri.fsPath), 'Local', names);
        for (const [name, entry] of theme.getNameIndex(nameKind.directory, nameKind.property)) {
            if (!names.has(name)) {
                names.set(name, entry);
            }
        }

        return Array.from(names.values(), entry => this.createItem(entry, nameKind, theme));
    }

    createItem(entry, nameKind, theme) {
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

module.exports = NameCompletionProvider;
