import * as vscode from 'vscode';
import { availableNames, ReferenceKind, REFERENCE_KINDS } from '../core/resources';
import { NameEntry } from '../core/names';

const COMPLETION_KINDS: Record<string, vscode.CompletionItemKind> = {
    ComponentName: vscode.CompletionItemKind.Value,
    StyleName: vscode.CompletionItemKind.Color,
    TriggerName: vscode.CompletionItemKind.Event
};

/**
 * Completion for "Component", "Style", "StyleBasedOn" and "Trigger" values:
 * names available at the cursor in the renderer's lookup order (enclosing blocks → layer → layout → theme).
 */
export class NameCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
        // Key of the string value being typed, also when other properties precede it on the line
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const key = linePrefix.match(/"(\w+)"\s*:\s*"[^"]*$/)?.[1];
        const kind = REFERENCE_KINDS.find(candidate => candidate.key === key);
        if (!kind) {
            return undefined;
        }

        const names = availableNames(document, kind, document.offsetAt(position));
        return Array.from(names.values(), entry => createItem(entry, kind));
    }
}

function createItem(entry: NameEntry, kind: ReferenceKind): vscode.CompletionItem {
    const item = new vscode.CompletionItem(entry.name, COMPLETION_KINDS[kind.property]);
    item.detail = `${entry.details} ${kind.label}`;

    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.appendMarkdown(`${kind.label} defined in [${entry.source}:${entry.line + 1}](${vscode.Uri.file(entry.fsPath).toString()}#L${entry.line + 1})\n\n`);
    if (kind.property !== 'ComponentName' && entry.definition !== undefined && !entry.isPath) {
        markdown.appendMarkdown('**Definition:**\n');
        markdown.appendCodeblock(JSON.stringify(entry.definition, null, 2), 'json');
    }
    item.documentation = markdown;

    return item;
}
