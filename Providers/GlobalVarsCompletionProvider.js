const vscode = require('vscode');
const getGlobalVars = require('./getGlobalVars');

class GlobalVarsCompletionProvider {
	provideCompletionItems(document, position, token, context){
		const linePrefix = document.lineAt(position).text.substr(0, position.character);
		if (!linePrefix.endsWith('"{')){
			return undefined;
		}
		const globalVars = getGlobalVars();
		const completionItems = [];

		for(const key in globalVars){
			const completionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
			completionItem.detail = `Global Variable Value: ${globalVars[key]}`;
			completionItems.push(completionItem);
		}
		return completionItems;
	}
}
module.exports = GlobalVarsCompletionProvider;