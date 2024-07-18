const vscode = require('vscode');
const snippets = require('./Snippets');

class SnippetCompletionProvider {
    provideCompletionItems(document,position,token,context){
        const line = document.lineAt(position);
        const linePrefix = line.text.substr(0, position.character);

        const matchingSnippets = Object.keys(snippets).filter(prefix => linePrefix.endsWith(prefix));

        if (matchingSnippets.length === 0){
            return undefined;
        }

        return matchingSnippets.map(snippetKey => {
            const snippet = snippets[snippetKey];
            const completionItem = new vscode.CompletionItem(snippet.prefix, vscode.CompletionItemKind.Snippet);
            completionItem.insertText = new vscode.SnippetString(snippet.body.join('\n'));
            completionItem.detail = snippet.description;
            return completionItem;
        });
    }
}

module.exports = SnippetCompletionProvider;