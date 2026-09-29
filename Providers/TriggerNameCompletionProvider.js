const vscode = require('vscode');
const getPropertyNames = require('./getPropertyNames');

class TriggerNameCompletionProvider {
    async provideCompletionItems(document, position, token, context) {
        const line = document.lineAt(position);
        const lineText = line.text.substring(0, position.character);
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        const keyPrefix = linePrefix.trim().split(':')[0].trim();

        if (!keyPrefix.endsWith('"Trigger"')) {
            return undefined;
        }

        try {
            const componentNames = await getPropertyNames('TriggerName', 'triggers')
            const completionItems = componentNames.map(component => {
                const item = new vscode.CompletionItem(component.name, vscode.CompletionItemKind.Event);
                item.detail = component.details + " Trigger";
                
                const markdown = new vscode.MarkdownString();
                
                if (component.source) {
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, component.source);
                        markdown.appendMarkdown(`Trigger defined in [${component.source}](${absolutePath})\n\n`);
                    }
                }
                
                // Dodaj definicję triggera
                if (component.definition && !component.isPath) {
                    markdown.appendMarkdown('**Definition:**\n');
                    markdown.appendCodeblock(JSON.stringify(component.definition, null, 2), 'json');
                }
                
                markdown.isTrusted = true;
                item.documentation = markdown;
                
                return item;
            });
            return completionItems;
        } catch (error) {
            //console.error('Error fetching component names:', error);
            return undefined;
        }
    }
}

module.exports = TriggerNameCompletionProvider;
