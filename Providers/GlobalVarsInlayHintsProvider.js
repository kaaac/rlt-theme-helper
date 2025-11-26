const vscode = require('vscode');
const path = require('path');
const getGlobalVars = require('./getGlobalVars');
const { getLocalizedString } = require('./getLocalizations');

/**
 * Inlay Hints Provider for Global Variables
 * Shows resolved values of global variables inline in the editor
 */
class GlobalVarsInlayHintsProvider {
    
    constructor() {
        this.globalVars = {};
        this.updateGlobalVars();
        
        // Watch for changes in global_vars.json
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/globals/global_vars.json');
        this.fileWatcher.onDidChange(() => this.updateGlobalVars());
        this.fileWatcher.onDidCreate(() => this.updateGlobalVars());
        this.fileWatcher.onDidDelete(() => this.globalVars = {});
    }

    updateGlobalVars() {
        this.globalVars = getGlobalVars();
    }

    /**
     * Get the path to global_vars.json file
     * @returns {string|null}
     */
    getGlobalVarsPath() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const folderPath = workspaceFolders[0].uri.fsPath;
            return path.join(folderPath, 'globals', 'global_vars.json');
        }
        return null;
    }

    /**
     * Get the path to the active localization file
     * @returns {string|null}
     */
    getLocalizationFilePath() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return null;
        }

        const folderPath = workspaceFolders[0].uri.fsPath;
        const localizationsPath = path.join(folderPath, 'localizations');
        const fs = require('fs');

        if (!fs.existsSync(localizationsPath)) {
            return null;
        }

        const files = fs.readdirSync(localizationsPath)
            .filter(file => file.endsWith('.json'));

        if (files.length === 0) {
            return null;
        }

        if (files.length === 1) {
            return path.join(localizationsPath, files[0]);
        }

        // Try to find the default localization file
        const themeDescPath = path.join(folderPath, 'theme_description.json');
        if (fs.existsSync(themeDescPath)) {
            try {
                const content = fs.readFileSync(themeDescPath, 'utf-8');
                const removeCommentsFromJSON = require('./removeCommentsFromJSON');
                let parsedContent;
                
                try {
                    parsedContent = JSON.parse(content);
                } catch (error) {
                    const contentWithoutComments = removeCommentsFromJSON(content);
                    parsedContent = JSON.parse(contentWithoutComments);
                }

                if (parsedContent.DefaultLocalizationId) {
                    // Try to find file with matching ID
                    for (const file of files) {
                        const filePath = path.join(localizationsPath, file);
                        const locContent = fs.readFileSync(filePath, 'utf-8');
                        let locParsed;
                        
                        try {
                            locParsed = JSON.parse(locContent);
                        } catch (error) {
                            const contentWithoutComments = removeCommentsFromJSON(locContent);
                            locParsed = JSON.parse(contentWithoutComments);
                        }

                        if (locParsed.ID === parsedContent.DefaultLocalizationId) {
                            return filePath;
                        }
                    }
                }
            } catch (error) {
                // Continue to fallback
            }
        }

        // Fallback: english.json
        const englishFile = files.find(f => f.toLowerCase() === 'english.json');
        if (englishFile) {
            return path.join(localizationsPath, englishFile);
        }

        // Last resort: first file
        return path.join(localizationsPath, files[0]);
    }

    /**
     * Provide inlay hints for the document
     * @param {vscode.TextDocument} document 
     * @param {vscode.Range} range 
     * @param {vscode.CancellationToken} token 
     * @returns {vscode.ProviderResult<vscode.InlayHint[]>}
     */
    provideInlayHints(document, range, token) {
        const hints = [];
        const text = document.getText();

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
                try {
                    const fullMatch = match[0];
                    const variableExpression = match[1];
                    const startPos = match.index;
                    const endPos = startPos + fullMatch.length;
                    
                    // Check if position is within the requested range
                    const matchStart = document.positionAt(startPos);
                    const matchEnd = document.positionAt(endPos);
                    
                    if (!range.contains(new vscode.Range(matchStart, matchEnd))) {
                        continue;
                    }

                    // Resolve the variable value
                    const resolvedValue = this.resolveVariable(variableExpression, fullMatch);
                    
                    if (resolvedValue !== null) {
                        // Find the end of the line (after closing quote and optional comma)
                        const line = document.lineAt(matchStart.line);
                        const lineText = line.text;
                        
                        // Find the position after the closing quote (and optional comma) on this line
                        let hintPosition = matchEnd;
                        const afterMatch = lineText.substring(matchEnd.character);
                        // Match closing quote and optional comma/whitespace
                        const quoteMatch = afterMatch.match(/^[^"]*"[\s,]*/);
                        
                        if (quoteMatch) {
                            // Position right after the closing quote and comma (if present)
                            hintPosition = new vscode.Position(
                                matchStart.line,
                                matchEnd.character + quoteMatch[0].length
                            );
                        }
                        
                        // Create inlay hint at the end of the value (after closing quote and comma)
                        const hint = new vscode.InlayHint(
                            hintPosition,
                            this.formatHintLabel(resolvedValue),
                            vscode.InlayHintKind.Type
                        );
                        
                        hint.paddingLeft = true;
                        
                        // Create tooltip with clickable link
                        const isLocalization = fullMatch.startsWith('[');
                        const filePath = isLocalization ? this.getLocalizationFilePath() : this.getGlobalVarsPath();
                        const fileName = isLocalization ? 'localization file' : 'global_vars.json';
                        
                        if (filePath) {
                            const tooltip = new vscode.MarkdownString();
                            tooltip.appendMarkdown(`**Resolved from ${fileName}:**\n\n\`${resolvedValue}\`\n\n`);
                            tooltip.appendMarkdown(`[Change here: ${path.basename(filePath)}](${vscode.Uri.file(filePath).toString()})`);
                            tooltip.isTrusted = true;
                            hint.tooltip = tooltip;
                        } else {
                            hint.tooltip = `Resolved from ${fileName}: ${resolvedValue}`;
                        }
                        
                        hints.push(hint);
                    }
                } catch (error) {
                    // Silently skip invalid patterns
                    continue;
                }
            }
        }

        return hints;
    }

    /**
     * Resolve variable value from global vars or localizations
     * Supports nested variables like {some{value}} or {some{nice}value}
     * Supports localization keys like [KeyName]
     * @param {string} expression 
     * @param {string} fullMatch - The full matched string including brackets
     * @returns {string|null}
     */
    resolveVariable(expression, fullMatch) {
        // Check if this is a localization key [Key]
        if (fullMatch.startsWith('[') && fullMatch.endsWith(']')) {
            return getLocalizedString(expression);
        }
        
        // Remove double braces if present
        expression = expression.replace(/^\{|\}$/g, '');
        
        // Check if expression contains nested variables
        const nestedVarPattern = /\{([a-zA-Z0-9._]+)\}/g;
        let resolvedExpression = expression;
        let match;
        let maxIterations = 10; // Prevent infinite loops
        let iterations = 0;
        
        // Resolve nested variables first
        while ((match = nestedVarPattern.exec(resolvedExpression)) !== null && iterations < maxIterations) {
            const nestedVar = match[1];
            const nestedValue = this.getValueFromGlobalVars(nestedVar);
            
            if (nestedValue !== null) {
                resolvedExpression = resolvedExpression.replace(match[0], nestedValue);
                // Reset regex to search again from the beginning
                nestedVarPattern.lastIndex = 0;
            }
            iterations++;
        }
        
        // Now resolve the final expression
        return this.getValueFromGlobalVars(resolvedExpression);
    }

    /**
     * Get value from global vars using dot notation
     * @param {string} key 
     * @returns {string|null}
     */
    getValueFromGlobalVars(key) {
        if (!this.globalVars || Object.keys(this.globalVars).length === 0) {
            return null;
        }

        // Try direct key first
        if (this.globalVars.hasOwnProperty(key)) {
            return String(this.globalVars[key]);
        }

        // Try dot notation (e.g., "Item.Color")
        const parts = key.split('.');
        let current = this.globalVars;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
                current = current[part];
            } else {
                return null;
            }
        }
        
        return current !== null && current !== undefined ? String(current) : null;
    }

    /**
     * Format the hint label with color indicator if applicable
     * @param {string} value 
     * @returns {string | vscode.InlayHintLabelPart[]}
     */
    formatHintLabel(value) {
        const trimmedValue = value.trim();
        
        // Check if value is a color
        if (this.isColor(trimmedValue)) {
            // For colors, we'll show a colored box + value
            // Unfortunately, InlayHint doesn't support colored text directly,
            // so we'll just add a color indicator emoji
            const colorEmoji = this.getColorEmoji(trimmedValue);
            return `${colorEmoji} ${trimmedValue}`;
        }
        
        return `= ${trimmedValue}`;
    }

    /**
     * Check if value is a color
     * @param {string} value 
     * @returns {boolean}
     */
    isColor(value) {
        // Hex format with or without #
        if (/^#?[0-9a-fA-F]{6,8}$/.test(value)) {
            return true;
        }
        
        // R,G,B or R,G,B,A format
        if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*\d{1,3})?$/.test(value)) {
            return true;
        }
        
        return false;
    }

    /**
     * Get a color indicator emoji (using a colored square)
     * @param {string} colorValue 
     * @returns {string}
     */
    getColorEmoji(colorValue) {
        // Return a generic color indicator
        // We can't show the actual color in the text, but the ColorPicker will handle that
        return '🎨';
    }

    dispose() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }
}

module.exports = GlobalVarsInlayHintsProvider;
