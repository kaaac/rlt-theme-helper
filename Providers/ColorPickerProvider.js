const vscode = require('vscode');
const getGlobalVars = require('./getGlobalVars');
const { getLocalizedString } = require('./getLocalizations');

/**
 * Color Picker Provider for RLT Theme Helper
 * Supports formats:
 * - #RRGGBB (hex without alpha)
 * - #AARRGGBB (hex with alpha)
 * - R,G,B (comma-separated RGB)
 * - R,G,B,A (comma-separated RGBA)
 * - Global variables that resolve to colors
 */
class ColorPickerProvider {
    
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
     * Provide all color decorations for the document
     * @param {vscode.TextDocument} document 
     * @param {vscode.CancellationToken} token 
     * @returns {vscode.ProviderResult<vscode.ColorInformation[]>}
     */
    provideDocumentColors(document, token) {
        const colors = [];
        const text = document.getText();
        
        // Regex patterns for different color formats
        const patterns = [
            // #AARRGGBB (8 chars) - RLT format with alpha first
            {
                regex: /#[0-9a-fA-F]{8}\b/g,
                parser: (match, startPos) => this.parseHexWithAlpha(match, startPos, document)
            },
            // #RRGGBB (6 chars) - standard hex
            {
                regex: /#[0-9a-fA-F]{6}\b/g,
                parser: (match, startPos) => this.parseHex(match, startPos, document)
            },
            // #RGB (3 chars) - shorthand hex
            {
                regex: /#[0-9a-fA-F]{3}\b/g,
                parser: (match, startPos) => this.parseShortHex(match, startPos, document)
            },
            // AARRGGBB or RRGGBB without # - only in color-related properties
            {
                regex: /(?:"(?:Color|Foreground|Background|BorderColor|BackgroundColor|FillColor|StrokeColor)"\s*:\s*")([0-9a-fA-F]{6,8})(?=")/g,
                parser: (match, startPos) => this.parseHexWithoutHash(match, startPos, document)
            },
            // R,G,B or R,G,B,A - comma-separated format (but NOT for Padding/Margin)
            {
                regex: /"([^"]+)"\s*:\s*"?(\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*\d{1,3})?)"?/g,
                parser: (match, startPos) => this.parseRGBAWithPropertyCheck(match, startPos, document)
            },
            // Global variables that might contain colors
            {
                regex: /\{([a-zA-Z0-9._]+)\}|\{\{([^}]+)\}\}|\{([^}]*\{[^}]+\}[^}]*)\}/g,
                parser: (match, startPos) => this.parseGlobalVariable(match, startPos, document)
            },
            // Localization keys that might contain colors [Key]
            {
                regex: /\[([a-zA-Z0-9._]+)\]/g,
                parser: (match, startPos) => this.parseLocalizationKey(match, startPos, document)
            }
        ];

        // Find all colors using each pattern
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.regex.exec(text)) !== null) {
                try {
                    const colorInfo = pattern.parser(match, match.index);
                    if (colorInfo) {
                        colors.push(colorInfo);
                    }
                } catch (error) {
                    // Silently ignore errors - might be a variable or reference
                    continue;
                }
            }
        }

        return colors;
    }

    /**
     * Provide color presentations (formats) for the color picker
     * @param {vscode.Color} color 
     * @param {Object} context 
     * @param {vscode.CancellationToken} token 
     * @returns {vscode.ProviderResult<vscode.ColorPresentation[]>}
     */
    provideColorPresentations(color, context, token) {
        try {
            const presentations = [];
            
            // Get the original format
            const originalText = context.document.getText(context.range);
        
        // Check if this is a global variable or localization key (read-only)
        if (originalText.match(/^\{[^}]+\}$/) || originalText.match(/^\[[^\]]+\]$/)) {
            // For global variables and localization keys, only return the original value (read-only)
            presentations.push(new vscode.ColorPresentation(originalText));
            return presentations;
        }
        
        const hasHashPrefix = originalText.startsWith('#');
        
        // Generate different format options
        
        if (hasHashPrefix) {
            // Formats with # prefix
            
            // 1. #AARRGGBB (RLT format with alpha first)
            const hexAlphaFirst = this.colorToHexAlphaFirst(color);
            presentations.push(new vscode.ColorPresentation(hexAlphaFirst));
            
            // 2. #RRGGBB (standard hex without alpha)
            if (color.alpha === 1) {
                const hex = this.colorToHex(color);
                presentations.push(new vscode.ColorPresentation(hex));
            }
        } else {
            // Formats without # prefix (for Color/Foreground/Background properties)
            
            // 1. AARRGGBB (RLT format with alpha first, no #)
            const hexAlphaFirstNoHash = this.colorToHexAlphaFirst(color).substring(1);
            presentations.push(new vscode.ColorPresentation(hexAlphaFirstNoHash));
            
            // 2. RRGGBB (standard hex without alpha, no #)
            if (color.alpha === 1) {
                const hexNoHash = this.colorToHex(color).substring(1);
                presentations.push(new vscode.ColorPresentation(hexNoHash));
            }
        }
        
        // 3. R,G,B,A (comma-separated with alpha)
        const rgba = this.colorToRGBA(color);
        presentations.push(new vscode.ColorPresentation(rgba));
        
        // 4. R,G,B (comma-separated without alpha - only if alpha is 1)
        if (color.alpha === 1) {
            const rgb = this.colorToRGB(color);
            presentations.push(new vscode.ColorPresentation(rgb));
        }

        return presentations;
        } catch (error) {
            console.error('[RLT Color Picker] Error in provideColorPresentations:', error);
            return [];
        }
    }

    // === PARSERS ===

    /**
     * Parse #AARRGGBB format (alpha first - RLT format)
     */
    parseHexWithAlpha(match, startPos, document) {
        const hex = match[0];
        const a = parseInt(hex.substring(1, 3), 16) / 255;
        const r = parseInt(hex.substring(3, 5), 16) / 255;
        const g = parseInt(hex.substring(5, 7), 16) / 255;
        const b = parseInt(hex.substring(7, 9), 16) / 255;
        
        const range = new vscode.Range(
            document.positionAt(startPos),
            document.positionAt(startPos + hex.length)
        );
        
        return new vscode.ColorInformation(range, new vscode.Color(r, g, b, a));
    }

    /**
     * Parse #RRGGBB format
     */
    parseHex(match, startPos, document) {
        const hex = match[0];
        const r = parseInt(hex.substring(1, 3), 16) / 255;
        const g = parseInt(hex.substring(3, 5), 16) / 255;
        const b = parseInt(hex.substring(5, 7), 16) / 255;
        
        const range = new vscode.Range(
            document.positionAt(startPos),
            document.positionAt(startPos + hex.length)
        );
        
        return new vscode.ColorInformation(range, new vscode.Color(r, g, b, 1));
    }

    /**
     * Parse #RGB format (shorthand)
     */
    parseShortHex(match, startPos, document) {
        const hex = match[0];
        const r = parseInt(hex[1] + hex[1], 16) / 255;
        const g = parseInt(hex[2] + hex[2], 16) / 255;
        const b = parseInt(hex[3] + hex[3], 16) / 255;
        
        const range = new vscode.Range(
            document.positionAt(startPos),
            document.positionAt(startPos + hex.length)
        );
        
        return new vscode.ColorInformation(range, new vscode.Color(r, g, b, 1));
    }

    /**
     * Parse AARRGGBB or RRGGBB format without # (in Color/Foreground/Background properties)
     */
    parseHexWithoutHash(match, startPos, document) {
        // match[1] contains the captured hex value (without quotes)
        const hex = match[1];
        
        // Calculate the actual position of the hex value (after the property name and ": ")
        const hexStartPos = match.index + match[0].indexOf(hex);
        
        let r, g, b, a;
        
        if (hex.length === 8) {
            // AARRGGBB format
            a = parseInt(hex.substring(0, 2), 16) / 255;
            r = parseInt(hex.substring(2, 4), 16) / 255;
            g = parseInt(hex.substring(4, 6), 16) / 255;
            b = parseInt(hex.substring(6, 8), 16) / 255;
        } else if (hex.length === 6) {
            // RRGGBB format
            r = parseInt(hex.substring(0, 2), 16) / 255;
            g = parseInt(hex.substring(2, 4), 16) / 255;
            b = parseInt(hex.substring(4, 6), 16) / 255;
            a = 1;
        } else {
            // Invalid length, skip
            return null;
        }
        
        const range = new vscode.Range(
            document.positionAt(hexStartPos),
            document.positionAt(hexStartPos + hex.length)
        );
        
        return new vscode.ColorInformation(range, new vscode.Color(r, g, b, a));
    }

    /**
     * Parse R,G,B or R,G,B,A format with property name check
     * Excludes Padding and Margin properties
     */
    parseRGBAWithPropertyCheck(match, startPos, document) {
        const propertyName = match[1];
        const colorValue = match[2];
        
        // Exclude layout properties (margin, padding, spacing, size, etc.)
        if (this.isLayoutProperty(propertyName)) {
            return null;
        }
        
        // Parse the color value
        const parts = colorValue.split(',').map(s => s.trim());
        
        if (parts.length < 3 || parts.length > 4) {
            return null;
        }
        
        const r = parseInt(parts[0]) / 255;
        const g = parseInt(parts[1]) / 255;
        const b = parseInt(parts[2]) / 255;
        const a = parts[3] ? parseInt(parts[3]) / 255 : 1;
        
        // Validate ranges
        if (r > 1 || g > 1 || b > 1 || a > 1) {
            return null;
        }
        
        // Find the position of the color value (not the property name)
        const valueStartPos = match.index + match[0].indexOf(colorValue);
        
        const range = new vscode.Range(
            document.positionAt(valueStartPos),
            document.positionAt(valueStartPos + colorValue.length)
        );
        
        return new vscode.ColorInformation(range, new vscode.Color(r, g, b, a));
    }

    /**
     * Parse R,G,B or R,G,B,A format (helper method)
     */
    parseRGBA(match, startPos, document) {
        const r = parseInt(match[1]) / 255;
        const g = parseInt(match[2]) / 255;
        const b = parseInt(match[3]) / 255;
        const a = match[4] ? parseInt(match[4]) / 255 : 1;
        
        // Validate ranges
        if (r > 1 || g > 1 || b > 1 || a > 1) {
            return null;
        }
        
        const range = new vscode.Range(
            document.positionAt(startPos),
            document.positionAt(startPos + match[0].length)
        );
        
        return new vscode.ColorInformation(range, new vscode.Color(r, g, b, a));
    }

    /**
     * Parse global variable that might contain a color
     */
    parseGlobalVariable(match, startPos, document) {
        const fullMatch = match[0];
        const variableExpression = match[1] || match[2] || match[3];
        
        if (!variableExpression) {
            return null;
        }

        // Exclude variables with margin/padding/spacing/size in the name
        if (this.isLayoutProperty(variableExpression)) {
            return null;
        }

        // Resolve the variable value
        const resolvedValue = this.resolveVariable(variableExpression);
        
        if (!resolvedValue || !this.isColorValue(resolvedValue)) {
            return null;
        }

        // Parse the resolved color value
        const color = this.parseColorValue(resolvedValue);
        
        if (!color) {
            return null;
        }

        const range = new vscode.Range(
            document.positionAt(startPos),
            document.positionAt(startPos + fullMatch.length)
        );
        
        return new vscode.ColorInformation(range, color);
    }

    /**
     * Parse localization key that might contain a color
     */
    parseLocalizationKey(match, startPos, document) {
        const fullMatch = match[0];
        const key = match[1];
        
        if (!key) {
            return null;
        }

        // Check if the key name suggests it's a layout property
        if (this.isLayoutProperty(key)) {
            return null;
        }

        // Resolve the localization key
        const resolvedValue = getLocalizedString(key);
        
        if (!resolvedValue || !this.isColorValue(resolvedValue)) {
            return null;
        }

        // Parse the resolved color value
        const color = this.parseColorValue(resolvedValue);
        
        if (!color) {
            return null;
        }

        const range = new vscode.Range(
            document.positionAt(startPos),
            document.positionAt(startPos + fullMatch.length)
        );
        
        return new vscode.ColorInformation(range, color);
    }

    /**
     * Resolve variable value from global vars
     * @param {string} expression 
     * @returns {string|null}
     */
    resolveVariable(expression) {
        // Remove double braces if present
        expression = expression.replace(/^\{|\}$/g, '');
        
        // Check if expression contains nested variables
        const nestedVarPattern = /\{([a-zA-Z0-9._]+)\}/g;
        let resolvedExpression = expression;
        let match;
        let maxIterations = 10;
        let iterations = 0;
        
        // Resolve nested variables first
        while ((match = nestedVarPattern.exec(resolvedExpression)) !== null && iterations < maxIterations) {
            const nestedVar = match[1];
            const nestedValue = this.getValueFromGlobalVars(nestedVar);
            
            if (nestedValue !== null) {
                resolvedExpression = resolvedExpression.replace(match[0], nestedValue);
                nestedVarPattern.lastIndex = 0;
            }
            iterations++;
        }
        
        return this.getValueFromGlobalVars(resolvedExpression);
    }

    /**
     * Get value from global vars
     * @param {string} key 
     * @returns {string|null}
     */
    getValueFromGlobalVars(key) {
        if (!this.globalVars || Object.keys(this.globalVars).length === 0) {
            return null;
        }

        if (this.globalVars.hasOwnProperty(key)) {
            const value = this.globalVars[key];
            // Only return primitive values (string, number, boolean)
            if (typeof value === 'object' && value !== null) {
                return null;
            }
            return String(value);
        }

        // Try dot notation
        const parts = key.split('.');
        let current = this.globalVars;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
                current = current[part];
            } else {
                return null;
            }
        }
        
        // Only return primitive values (string, number, boolean)
        if (typeof current === 'object' && current !== null) {
            return null;
        }
        
        return current !== null && current !== undefined ? String(current) : null;
    }

    /**
     * Check if value is a color
     * @param {string} value 
     * @returns {boolean}
     */
    isColorValue(value) {
        const trimmed = value.trim();
        
        // Hex format
        if (/^#?[0-9a-fA-F]{6,8}$/.test(trimmed)) {
            return true;
        }
        
        // R,G,B or R,G,B,A format
        if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*\d{1,3})?$/.test(trimmed)) {
            return true;
        }
        
        return false;
    }

    /**
     * Check if property/variable name suggests it's a layout property (not a color)
     * @param {string} name 
     * @returns {boolean}
     */
    isLayoutProperty(name) {
        const lowerName = name.toLowerCase();
        
        // Keywords that suggest layout properties, not colors
        const layoutKeywords = [
            'margin',
            'padding',
            'spacing',
            'gap',
            'offset',
            'indent',
            'size',
            'width',
            'height',
            'radius',
            'border',
            'thickness',
            'distance',
            'position',
            'coordinate'
        ];
        
        return layoutKeywords.some(keyword => lowerName.includes(keyword));
    }

    /**
     * Parse color value string to vscode.Color
     * @param {string} colorValue 
     * @returns {vscode.Color|null}
     */
    parseColorValue(colorValue) {
        const trimmed = colorValue.trim();
        
        // Hex format with or without #
        if (/^#?[0-9a-fA-F]{6,8}$/.test(trimmed)) {
            const hex = trimmed.startsWith('#') ? trimmed.substring(1) : trimmed;
            
            if (hex.length === 8) {
                // AARRGGBB
                const a = parseInt(hex.substring(0, 2), 16) / 255;
                const r = parseInt(hex.substring(2, 4), 16) / 255;
                const g = parseInt(hex.substring(4, 6), 16) / 255;
                const b = parseInt(hex.substring(6, 8), 16) / 255;
                return new vscode.Color(r, g, b, a);
            } else if (hex.length === 6) {
                // RRGGBB
                const r = parseInt(hex.substring(0, 2), 16) / 255;
                const g = parseInt(hex.substring(2, 4), 16) / 255;
                const b = parseInt(hex.substring(4, 6), 16) / 255;
                return new vscode.Color(r, g, b, 1);
            }
        }
        
        // R,G,B or R,G,B,A format
        const rgbaMatch = trimmed.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d{1,3}))?$/);
        if (rgbaMatch) {
            const r = parseInt(rgbaMatch[1]) / 255;
            const g = parseInt(rgbaMatch[2]) / 255;
            const b = parseInt(rgbaMatch[3]) / 255;
            const a = rgbaMatch[4] ? parseInt(rgbaMatch[4]) / 255 : 1;
            
            if (r <= 1 && g <= 1 && b <= 1 && a <= 1) {
                return new vscode.Color(r, g, b, a);
            }
        }
        
        return null;
    }

    // === FORMATTERS ===

    /**
     * Convert color to #AARRGGBB format (RLT format - alpha first)
     */
    colorToHexAlphaFirst(color) {
        const a = Math.round(color.alpha * 255).toString(16).padStart(2, '0').toUpperCase();
        const r = Math.round(color.red * 255).toString(16).padStart(2, '0').toUpperCase();
        const g = Math.round(color.green * 255).toString(16).padStart(2, '0').toUpperCase();
        const b = Math.round(color.blue * 255).toString(16).padStart(2, '0').toUpperCase();
        return `#${a}${r}${g}${b}`;
    }

    /**
     * Convert color to #RRGGBB format
     */
    colorToHex(color) {
        const r = Math.round(color.red * 255).toString(16).padStart(2, '0').toUpperCase();
        const g = Math.round(color.green * 255).toString(16).padStart(2, '0').toUpperCase();
        const b = Math.round(color.blue * 255).toString(16).padStart(2, '0').toUpperCase();
        return `#${r}${g}${b}`;
    }

    /**
     * Convert color to R,G,B,A format
     */
    colorToRGBA(color) {
        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);
        const a = Math.round(color.alpha * 255);
        return `${r},${g},${b},${a}`;
    }

    /**
     * Convert color to R,G,B format (no alpha)
     */
    colorToRGB(color) {
        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);
        return `${r},${g},${b}`;
    }

    /**
     * Dispose resources
     */
    dispose() {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }
}

module.exports = ColorPickerProvider;
