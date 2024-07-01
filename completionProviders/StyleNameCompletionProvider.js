const vscode = require('vscode');
const getPropertyNames = require('./getPropertyNames');

class StyleNameCompletionProvider {
    async provideCompletionItems(document, position, token, context) {
        const line = document.lineAt(position);
        const lineText = line.text.substring(0, position.character);
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const keyPrefix = linePrefix.trim().split(':')[0].trim();

        if (!keyPrefix.endsWith('"Style"')) {
            return undefined;
        }

        try {
            const componentNames = await getPropertyNames('StyleName', 'styles')
            const completionItems = componentNames.map(component => {
                const item = new vscode.CompletionItem(component.name, vscode.CompletionItemKind.Value);
                item.detail = component.details + " Style";
                return item;
            });
            return completionItems;
        } catch (error) {
            //console.error('Error fetching component names:', error);
            return undefined;
        }
    }
}

module.exports = StyleNameCompletionProvider;