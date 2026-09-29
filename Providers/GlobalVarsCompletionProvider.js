const vscode = require('vscode');
const { getThemeContext } = require('../core/themeContext');

class GlobalVarsCompletionProvider {
	provideCompletionItems(document, position){
		const linePrefix = document.lineAt(position).text.substring(0, position.character);
		if (!linePrefix.endsWith('"{')){
			return undefined;
		}
		const globalVars = getThemeContext(document).getGlobalVars();
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