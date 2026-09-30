import * as vscode from 'vscode';
import * as path from 'path';
import { getThemeContext, onDidChangeTheme } from '../core/themeContext';
import { resolveGlobalVariable, resolveLocalizationKey, variableKey } from '../core/variables';
import { isColorValue } from '../core/colors';
import { parseJsonTree } from '../core/json';
import { DocumentVariables, describeSource, findVariableSource } from '../core/variableScope';

// Patterns for variable references
// (variables live inside JSON strings, so they never span quotes or lines)
const PATTERNS = [
    // {VariableName} or {Variable.Property} or {Variable.Nested.Property}
    /\{([a-zA-Z0-9._]+)\}/g,
    // {{VariableName}}
    /\{\{([^}"\n]+)\}\}/g,
    // {Variable{NestedVar}}, {{Variable}OtherPart} or {some{nice}value}
    /\{([^}"\n]*\{[^}"\n]+\}[^}"\n]*)\}/g,
    // [LocalizationKey] - localization strings
    /\[([a-zA-Z0-9._]+)\]/g
];

/**
 * Inlay Hints Provider for Global Variables
 * Shows resolved values of global variables and localization keys inline in the editor
 */
export class GlobalVarsInlayHintsProvider implements vscode.InlayHintsProvider {

    // Re-render hints when global_vars.json or localizations change
    readonly onDidChangeInlayHints: vscode.Event<void> = (listener, thisArgs, disposables) =>
        onDidChangeTheme(() => listener.call(thisArgs), null, disposables);

    provideInlayHints(document: vscode.TextDocument, range: vscode.Range): vscode.InlayHint[] {
        const hints: vscode.InlayHint[] = [];
        const seen = new Set<string>();
        const text = document.getText();
        const theme = getThemeContext(document);
        const variables = new DocumentVariables(document, parseJsonTree(text));

        for (const source of PATTERNS) {
            const pattern = new RegExp(source.source, 'g');
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(text)) !== null) {
                const fullMatch = match[0];
                const startOffset = match.index;
                const endOffset = startOffset + fullMatch.length;

                // Several patterns can match the same reference
                const key = `${startOffset}:${endOffset}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);

                const matchStart = document.positionAt(startOffset);
                const matchEnd = document.positionAt(endOffset);
                if (!range.contains(new vscode.Range(matchStart, matchEnd))) {
                    continue;
                }

                const isLocalization = fullMatch.startsWith('[');
                let resolvedValue: string | null;
                let filePath: string | undefined;
                let fileName: string;
                if (isLocalization) {
                    const localization = theme.getLocalization();
                    resolvedValue = resolveLocalizationKey(match[1], localization);
                    filePath = localization?.path;
                    fileName = 'localization file';
                } else {
                    // Block Vars, vars/ folders and global_vars.json, as the renderer resolves them
                    const values = variables.valuesAt(startOffset);
                    resolvedValue = resolveGlobalVariable(match[1], values);
                    const found = findVariableSource(variables.sourcesAt(startOffset), variableKey(match[1], values));
                    filePath = found?.source.fsPath;
                    fileName = found ? describeSource(found.source) : 'variables';
                }

                if (resolvedValue === null) {
                    continue;
                }

                // Place the hint after the closing quote (and optional comma) of the value
                const afterMatch = document.lineAt(matchStart.line).text.substring(matchEnd.character);
                const quoteMatch = afterMatch.match(/^[^"]*"[\s,]*/);
                const hintPosition = quoteMatch
                    ? new vscode.Position(matchStart.line, matchEnd.character + quoteMatch[0].length)
                    : matchEnd;

                const hint = new vscode.InlayHint(hintPosition, formatHintLabel(resolvedValue), vscode.InlayHintKind.Type);
                hint.paddingLeft = true;

                const tooltip = new vscode.MarkdownString();
                tooltip.appendMarkdown(`**Resolved from ${fileName}:**\n\n\`${resolvedValue}\`\n\n`);
                if (filePath) {
                    tooltip.appendMarkdown(`[Change here: ${path.basename(filePath)}](${vscode.Uri.file(filePath).toString()})`);
                    tooltip.isTrusted = true;
                }
                hint.tooltip = tooltip;

                hints.push(hint);
            }
        }

        return hints;
    }
}

/**
 * Hint label, with a color indicator for color values
 * (InlayHint can't render colored text, the color picker shows the actual color)
 */
export function formatHintLabel(value: string): string {
    const trimmedValue = value.trim();
    return isColorValue(trimmedValue) ? `🎨 ${trimmedValue}` : `= ${trimmedValue}`;
}
