const vscode = require('vscode');
const snippets = require('./Snippets');

function showSnippets(){
    const items = Object.keys(snippets).map(key => {
        return {
            label: key,
            description: snippets[key].description,
            snippet: snippets[key]
        };
    });
    vscode.window.showQuickPick(items, {placeHolder: 'Select a snippet' }).then(selected => {
        if(selected){
            const editor = vscode.window.activeTextEditor;
            if(editor){
                editor.insertSnippet(new vscode.SnippetString(selected.snippet.body.join('\n')));
            }
        }
    });
}

module.exports = {
    showSnippets
}