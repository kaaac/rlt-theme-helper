const vscode = require('vscode');

const HEX_COLOR = /^#?[0-9a-fA-F]{6,8}$/;
const RGB_COLOR = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d{1,3}))?$/;

// Keywords that suggest a layout value (e.g. "10,5,10,5" padding), not a color
const LAYOUT_KEYWORDS = [
    'margin', 'padding', 'spacing', 'gap', 'offset', 'indent', 'size', 'width', 'height',
    'radius', 'border', 'thickness', 'distance', 'position', 'coordinate'
];

/**
 * @param {string} value
 * @returns {boolean} true for #RRGGBB, #AARRGGBB (with or without #), R,G,B and R,G,B,A
 */
function isColorValue(value) {
    const trimmed = value.trim();
    return HEX_COLOR.test(trimmed) || RGB_COLOR.test(trimmed);
}

/**
 * @param {string} name property or variable name
 * @returns {boolean}
 */
function isLayoutName(name) {
    const lowerName = name.toLowerCase();
    return LAYOUT_KEYWORDS.some(keyword => lowerName.includes(keyword));
}

/**
 * Parse RLT hex without the # prefix: AARRGGBB (alpha first) or RRGGBB.
 * @param {string} hex
 * @returns {vscode.Color|null}
 */
function parseHexDigits(hex) {
    const byte = (index) => parseInt(hex.substring(index, index + 2), 16) / 255;
    if (hex.length === 8) {
        return new vscode.Color(byte(2), byte(4), byte(6), byte(0));
    }
    if (hex.length === 6) {
        return new vscode.Color(byte(0), byte(2), byte(4), 1);
    }
    return null;
}

/**
 * Parse "R,G,B" or "R,G,B,A" (0-255 each).
 * @param {string} value
 * @returns {vscode.Color|null}
 */
function parseRgb(value) {
    const match = value.trim().match(RGB_COLOR);
    if (!match) {
        return null;
    }
    const [r, g, b] = [match[1], match[2], match[3]].map(Number);
    const a = match[4] !== undefined ? Number(match[4]) : 255;
    if (r > 255 || g > 255 || b > 255 || a > 255) {
        return null;
    }
    return new vscode.Color(r / 255, g / 255, b / 255, a / 255);
}

/**
 * Parse any supported color value.
 * @param {string} value
 * @returns {vscode.Color|null}
 */
function parseColorValue(value) {
    const trimmed = value.trim();
    if (HEX_COLOR.test(trimmed)) {
        return parseHexDigits(trimmed.replace(/^#/, ''));
    }
    return parseRgb(trimmed);
}

module.exports = {
    isColorValue,
    isLayoutName,
    parseHexDigits,
    parseRgb,
    parseColorValue
};
