const vscode = require('vscode');
const getComponentNames = require('./getComponentNames');
class ComponentNameCompletionProvider {
	provideCompletionItems(document, position, token, context){
		const linePrefix = document.lineAt(position).text.substr(0, position.character);
		const keyPrefix = linePrefix.trim().split(':')[0].trim();

		if(!keyPrefix.endsWith('"Component"')){
			return undefined;
		}

		const componentNames = getComponentNames();
		const completionItems = [];

		componentNames.forEach(component => {
			const completionItem = new vscode.CompletionItem(component.name, vscode.CompletionItemKind.Value);
			completionItem.detail = component.details + " Component";
			completionItems.push(completionItem);
		});

		return completionItems;
	}
}

module.exports = ComponentNameCompletionProvider;