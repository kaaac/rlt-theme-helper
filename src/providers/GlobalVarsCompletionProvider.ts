import * as vscode from 'vscode';
import { parseJsonTree } from '../core/json';
import { describeSource, DocumentVariables, findVariableSource } from '../core/variableScope';

/**
 * Completion of variable names after `"{`: block Vars, vars/ folders and global_vars.json available at the cursor
 */
export class GlobalVarsCompletionProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
		const linePrefix = document.lineAt(position).text.substring(0, position.character);
		if (!linePrefix.endsWith('"{')) {
			return undefined;
		}
		const offset = document.offsetAt(position);
		const variables = new DocumentVariables(document, parseJsonTree(document.getText()));
		const sources = variables.sourcesAt(offset);

		return Object.entries(variables.valuesAt(offset)).map(([key, value]) => {
			const completionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
			const found = findVariableSource(sources, key);
			const shown = typeof value === 'object' ? JSON.stringify(value) : String(value);
			completionItem.detail = `${shown.length > 60 ? shown.slice(0, 57) + '...' : shown}${found ? `  (${describeSource(found.source)})` : ''}`;
			return completionItem;
		});
	}
}
