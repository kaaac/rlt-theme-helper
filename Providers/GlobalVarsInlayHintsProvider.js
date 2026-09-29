const vscode = require('vscode');
const path = require('path');
const { getThemeContext, onDidChangeTheme } = require('../core/themeContext');
const { resolveGlobalVariable, resolveLocalizationKey } = require('../core/variables');
const { isColorValue } = require('../core/colors');

/**
 * Inlay Hints Provider for Global Variables
 * Shows resolved values of global variables and localization keys inline in the editor
 */
class GlobalVarsInlayHintsProvider {

    constructor() {
        // Re-render hints when global_vars.json or localizations change
        this.onDidChangeInlayHints = onDidChangeTheme;
    }

    /**
     * Provide inlay hints for the document
     * @param {vscode.TextDocument} document
     * @param {vscode.Range} range
     * @returns {vscode.ProviderResult<vscode.InlayHint[]>}
     */
    provideInlayHints(document, range) {
        const hints = [];
        const seen = new Set();
        const text = document.getText();
        const theme = getThemeContext(document);

        // Patterns for variable references
        const patterns = [
            // {VariableName} or {Variable.Property} or {Variable.Nested.Property}
            /\{([a-zA-Z0-9._]+)\}/g,
            // {{VariableName}}
            /\{\{([^}]+)\}\}/g,
            // {Variable{NestedVar}} or {{Variable}OtherPart}
            /\{([^}]*\{[^}]+\}[^}]*)\}/g,
            // Mixed patterns like {some{nice}value}
            /\{([a-zA-Z0-9._]*\{[^}]+\}[a-zA-Z0-9._]*)\}/g,
            // [LocalizationKey] - localization strings
            /\[([a-zA-Z0-9._]+)\]/g
        ];

        for (const pattern of patterns) {
            let match;
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

                const hint = new vscode.InlayHint(hintPosition, this.formatHintLabel(resolvedValue), vscode.InlayHintKind.Type);
                hint.paddingLeft = true;

                const filePath = isLocalization ? (localization && localization.path) : theme.globalVarsPath;
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

    /**
     * Format the hint label with a color indicator if applicable
     * @param {string} value
     * @returns {string}
     */
    formatHintLabel(value) {
        const trimmedValue = value.trim();
        // InlayHint can't render colored text, the color picker shows the actual color
        return isColorValue(trimmedValue) ? `🎨 ${trimmedValue}` : `= ${trimmedValue}`;
    }
}

module.exports = GlobalVarsInlayHintsProvider;
