import * as vscode from 'vscode';
import { isPlainObject, parseJsonTree } from '../core/json';
import { availableNames, referenceAt } from '../core/resources';
import { NameEntry } from '../core/names';

const MAX_DEFINITION_LINES = 25;
const MAX_INHERITANCE = 10;

/**
 * Hover for Style / StyleBasedOn / Component / Trigger values: where the name is defined, a link and the definition
 */
export class ReferenceHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
        const text = document.getText();
        const tree = parseJsonTree(text);
        const reference = referenceAt(text, document.offsetAt(position), tree);
        if (!reference) {
            return undefined;
        }

        const names = availableNames(document, reference.kind, reference.offset, tree);
        const entry = names.get(reference.name);
        const range = new vscode.Range(document.positionAt(reference.offset), document.positionAt(reference.offset + reference.length));
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        if (!entry) {
            markdown.appendMarkdown(`**${reference.kind.label}** \`${reference.name}\` — not found in the enclosing blocks, layer, layout or theme ${reference.kind.folder}`);
            return new vscode.Hover(markdown, range);
        }

        markdown.appendMarkdown(`**${reference.kind.label}** \`${entry.name}\` · ${entry.details}\n\n`);
        markdown.appendMarkdown(`[${entry.source}:${entry.line + 1}](${fileLink(entry)})\n\n`);

        if (reference.kind.property === 'StyleName') {
            const chain = inheritanceChain(entry, names);
            if (chain.length > 1) {
                markdown.appendMarkdown(`Based on: ${chain.slice(1).map(name => `\`${name}\``).join(' → ')}\n\n`);
            }
        }

        if (entry.definition !== undefined) {
            markdown.appendCodeblock(truncate(JSON.stringify(entry.definition, null, 2)), 'json');
        }
        return new vscode.Hover(markdown, range);
    }
}

/**
 * Style names from the style up through StyleBasedOn (stops on unknown or repeated names)
 */
export function inheritanceChain(entry: NameEntry, names: Map<string, NameEntry>): string[] {
    const chain = [entry.name];
    let current: NameEntry | undefined = entry;
    while (current && chain.length <= MAX_INHERITANCE) {
        const parent: unknown = isPlainObject(current.definition) ? current.definition.StyleBasedOn : undefined;
        if (typeof parent !== 'string' || chain.includes(parent)) {
            break;
        }
        chain.push(parent);
        current = names.get(parent);
    }
    return chain;
}

function fileLink(entry: NameEntry): string {
    return `${vscode.Uri.file(entry.fsPath).toString()}#L${entry.line + 1}`;
}

function truncate(json: string): string {
    const lines = json.split('\n');
    return lines.length > MAX_DEFINITION_LINES ? [...lines.slice(0, MAX_DEFINITION_LINES), '  …'].join('\n') : json;
}
