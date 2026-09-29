import * as vscode from 'vscode';
import { getThemeContext } from '../core/themeContext';

export class GlobalVarsCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
		const linePrefix = document.lineAt(position).text.substring(0, position.character);
		if (!linePrefix.endsWith('"{')) {
			return undefined;
		}
		const globalVars = getThemeContext(document).getGlobalVars();

		return Object.entries(globalVars).map(([key, value]) => {
			const completionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
			completionItem.detail = `Global Variable Value: ${value}`;
			return completionItem;
		});
	}
}
