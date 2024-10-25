const vscode = require('vscode');

function rgbaToHex(r, g, b, a = 1) {
    const toHex = (n) => {
        const hex = n.toString(16).toUpperCase();
        return hex.length === 1 ? '0' + hex : hex;
    };
    const rHex = toHex(r);
    const gHex = toHex(g);
    const bHex = toHex(b);
    return `#${rHex}${gHex}${bHex}`;
}

function parseColor(colorValue) {
    console.log(colorValue)
    if (colorValue.length === 9) {
        return `#${colorValue.slice(3, 9)}`; // Ignore alpha for background-color, use the last 6 characters
    }

    // Hexadecimal without alpha (#RRGGBB or #RGB)
    if (colorValue.length === 7 || colorValue.length === 4) {
        return colorValue;
    }

    // RGBA NOT WORKING CURRENTLY
    //const rgbaMatch = colorValue.match(/^rgba?\((\d{1,3}),\s?(\d{1,3}),\s?(\d{1,3})(?:,\s?(0|1|0?\.\d+))?\)$/);
    const rgbaMatch = colorValue.match(/^(\d{1,3}),(\d{1,3}),(\d{1,3})(?:,(\d{1,3}))?$/);
    if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1], 10);
        const g = parseInt(rgbaMatch[2], 10);
        const b = parseInt(rgbaMatch[3], 10);
        return rgbaToHex(r, g, b);
    }
    // Return the color as is if no conversion is needed
    return colorValue;
}

function provideHover(document, position, token) {
    //const range = document.getWordRangeAtPosition(position, /#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|\brgba?\((\d{1,3},\s?){2}\d{1,3}(,\s?(0|1|0?\.\d+))?\)|\bhsl\(\d{1,3},\s?\d{1,3}%,\s?\d{1,3}%\)/);
    const range = document.getWordRangeAtPosition(
        position,
        /#[0-9a-fA-F]{8}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|\b(\d{1,3}\s*,\s*){2}\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\b/
    );
    if (!range){
        return;
    }

    const word = document.getText(range);
    const colorValue = word.trim();
    const parsedColor = parseColor(colorValue);

    const colorMarkdown = new vscode.MarkdownString(undefined, true);

    colorMarkdown.appendMarkdown(`<span style="background-color:${parsedColor};">______</span>`);
    colorMarkdown.isTrusted = true;
    colorMarkdown.supportHtml = true;

    return new vscode.Hover(colorMarkdown, range);
}

module.exports = {
    provideHover
};