import * as vscode from 'vscode';
import * as path from 'path';
import { getThemeContext, onDidChangeTheme } from '../core/themeContext';
import { resolveGlobalVariable, resolveLocalizationKey } from '../core/variables';
import { isColorValue } from '../core/colors';

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
                const localization = isLocalization ? theme.getLocalization() : null;
                const resolvedValue = isLocalization
                    ? resolveLocalizationKey(match[1], localization)
                    : resolveGlobalVariable(match[1], theme.getGlobalVars());

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

                const filePath = isLocalization ? localization?.path : theme.globalVarsPath;
                const fileName = isLocalization ? 'localization file' : 'global_vars.json';
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
