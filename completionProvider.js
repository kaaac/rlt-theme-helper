const vscode = require('vscode');
console.log("FindMe");

function getConverterNames(text) {
    const regex = /Converter=([^,]+),/g;
    const converterNames = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        const converterName = match[1].trim();
        if (!converterNames.includes(converterName)) {
            converterNames.push(converterName);
        }
    }

    return converterNames;
}


function provideCompletionItems(document, position) {
    const range = document.getWordRangeAtPosition(position);
    const start = range ? range.start : position;

    const textBeforeCursor = document.getText(new vscode.Range(start.with(undefined, 0), position));


    if (textBeforeCursor.includes("Converter=")) {
        const suggestions = getSuggestions(converterDescriptions);
        return suggestions.map(suggestion => new vscode.CompletionItem(suggestion));
    }

    return [];
}

function getSuggestions(descriptions) {
    const converterNames = [];
    descriptions.forEach(description => {
        const converterName = getConverterNames(description);
        converterNames.push(converterName);
    });
    return converterNames;
}

const converterDescriptions = [
    "Converter=EnumEquals, Converts enum values",
    "Converter=NumberToText, Converts numbers to text"
];


function activate(context) {
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'json' }, 
            {
                provideCompletionItems
            },
            '.'
        )
    );
}

module.exports = {
    provideCompletionItems: provideCompletionItems
};

exports.activate = activate;