import * as vscode from 'vscode';
import { getThemeContext } from '../core/themeContext';
import { resolveGlobalVariable, resolveLocalizationKey } from '../core/variables';
import { isColorValue, isLayoutName, parseHexDigits, parseRgb, parseColorValue } from '../core/colors';
import { parseJsonTree } from '../core/json';
import { DocumentVariables } from '../core/variableScope';

/** Where in a regex match the color value is, and its parsed color */
interface ColorMatch {
    offset: number;
    length: number;
    color: vscode.Color | null;
}

interface ColorPattern {
    regex: RegExp;
    parse: (match: RegExpExecArray) => ColorMatch | null;
}

/**
 * Color Picker Provider for RLT Theme Helper
 * Supports formats:
 * - #RRGGBB (hex without alpha)
 * - #AARRGGBB (hex with alpha)
 * - R,G,B (comma-separated RGB)
 * - R,G,B,A (comma-separated RGBA)
 * - Global variables and localization keys that resolve to colors
 */
export class ColorPickerProvider implements vscode.DocumentColorProvider {

    provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
        const colors: vscode.ColorInformation[] = [];
        const text = document.getText();
        const theme = getThemeContext(document);
        const variables = new DocumentVariables(document, parseJsonTree(text));

        const patterns: ColorPattern[] = [
            // #AARRGGBB (8 chars) - RLT format with alpha first
            {
                regex: /#[0-9a-fA-F]{8}\b/g,
                parse: (match) => ({ offset: 0, length: match[0].length, color: parseHexDigits(match[0].substring(1)) })
            },
            // #RRGGBB (6 chars) - standard hex
            {
                regex: /#[0-9a-fA-F]{6}\b/g,
                parse: (match) => ({ offset: 0, length: match[0].length, color: parseHexDigits(match[0].substring(1)) })
            },
            // #RGB (3 chars) - shorthand hex
            {
                regex: /#[0-9a-fA-F]{3}\b/g,
                parse: (match) => {
                    const [r, g, b] = match[0].substring(1);
                    return { offset: 0, length: match[0].length, color: parseHexDigits(r + r + g + g + b + b) };
                }
            },
            // AARRGGBB or RRGGBB without # - only in color-related properties
            {
                regex: /(?:"(?:Color|Foreground|Background|BorderColor|BackgroundColor|FillColor|StrokeColor)"\s*:\s*")([0-9a-fA-F]{6,8})(?=")/g,
                parse: (match) => {
                    const hex = match[1];
                    return { offset: match[0].length - hex.length, length: hex.length, color: parseHexDigits(hex) };
                }
            },
            // R,G,B or R,G,B,A - comma-separated format (but NOT for Padding/Margin)
            {
                regex: /"([^"]+)"\s*:\s*"?(\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*\d{1,3})?)"?/g,
                parse: (match) => {
                    if (isLayoutName(match[1])) return null;
                    const value = match[2];
                    return { offset: match[0].indexOf(value, match[1].length + 2), length: value.length, color: parseRgb(value) };
                }
            },
            // Global variables that might contain colors: {Var}, {{Var}}, {Var{Nested}}
            // (variables live inside JSON strings, so they never span quotes or lines)
            {
                regex: /\{([a-zA-Z0-9._]+)\}|\{\{([^}"\n]+)\}\}|\{([^}"\n]*\{[^}"\n]+\}[^}"\n]*)\}/g,
                parse: (match) => {
                    const expression = match[1] || match[2] || match[3];
                    if (!expression || isLayoutName(expression)) return null;
                    return this.resolvedColor(match, resolveGlobalVariable(expression, variables.valuesAt(match.index)));
                }
            },
            // Localization keys that might contain colors [Key]
            {
                regex: /\[([a-zA-Z0-9._]+)\]/g,
                parse: (match) => {
                    if (isLayoutName(match[1])) return null;
                    return this.resolvedColor(match, resolveLocalizationKey(match[1], theme.getLocalization()));
                }
            }
        ];

        for (const pattern of patterns) {
            let match: RegExpExecArray | null;
            while ((match = pattern.regex.exec(text)) !== null) {
                const result = pattern.parse(match);
                if (!result || !result.color) {
                    continue;
                }
                const start = match.index + result.offset;
                const range = new vscode.Range(document.positionAt(start), document.positionAt(start + result.length));
                colors.push(new vscode.ColorInformation(range, result.color));
            }
        }

        return colors;
    }

    /**
     * Color of a whole `{var}` / `[Key]` match when its resolved value is a color.
     */
    private resolvedColor(match: RegExpExecArray, resolvedValue: string | null): ColorMatch | null {
        if (!resolvedValue || !isColorValue(resolvedValue)) {
            return null;
        }
        return { offset: 0, length: match[0].length, color: parseColorValue(resolvedValue) };
    }

    provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument, range: vscode.Range }): vscode.ColorPresentation[] {
        const originalText = context.document.getText(context.range);

        // Global variables and localization keys are read-only here
        if (/^\{[^}]+\}$/.test(originalText) || /^\[[^\]]+\]$/.test(originalText)) {
            return [new vscode.ColorPresentation(originalText)];
        }

        const opaque = color.alpha === 1;
        const prefix = originalText.startsWith('#') ? '#' : '';
        const formats = [
            // #AARRGGBB (RLT format with alpha first), without # in Color/Foreground/Background properties
            prefix + colorToHexAlphaFirst(color),
            opaque && prefix + colorToHex(color),
            colorToRGBA(color),
            opaque && colorToRGB(color)
        ];

        return formats.filter((label): label is string => Boolean(label)).map(label => new vscode.ColorPresentation(label));
    }
}

// === FORMATTERS ===

function toHexByte(value: number): string {
    return Math.round(value * 255).toString(16).padStart(2, '0').toUpperCase();
}

/** AARRGGBB (RLT format - alpha first) */
export function colorToHexAlphaFirst(color: vscode.Color): string {
    return toHexByte(color.alpha) + colorToHex(color);
}

/** RRGGBB */
export function colorToHex(color: vscode.Color): string {
    return toHexByte(color.red) + toHexByte(color.green) + toHexByte(color.blue);
}

/** R,G,B,A */
export function colorToRGBA(color: vscode.Color): string {
    return `${colorToRGB(color)},${Math.round(color.alpha * 255)}`;
}

/** R,G,B */
export function colorToRGB(color: vscode.Color): string {
    return [color.red, color.green, color.blue].map(value => Math.round(value * 255)).join(',');
}
