import * as vscode from 'vscode';
import { registerThemeWatcher } from './core/themeContext';
import { GlobalVarsCompletionProvider } from './providers/GlobalVarsCompletionProvider';
import { DataConvertersCompletionProvider } from './providers/DataConvertersCompletionProvider';
import { NameCompletionProvider } from './providers/NameCompletionProvider';
import { ItemPropertyCompletionProvider } from './providers/ItemPropertyCompletionProvider';
import { ColorPickerProvider } from './providers/ColorPickerProvider';
import { GlobalVarsInlayHintsProvider } from './providers/GlobalVarsInlayHintsProvider';
import { DefinitionProvider } from './providers/DefinitionProvider';
import { ReferenceHoverProvider } from './providers/ReferenceHoverProvider';
import { registerThemeDiagnostics } from './providers/ThemeDiagnostics';
import { showSnippets } from './providers/SnippetCommandProvider';
import { addGlobalVariable } from './providers/addGlobalVariableCommand';

const JSON_FILES: vscode.DocumentSelector = { scheme: 'file', language: 'json' };

export function activate(context: vscode.ExtensionContext): void {
	registerThemeWatcher(context);

	const providers = [
		new GlobalVarsCompletionProvider(),
		new NameCompletionProvider(),
		new DataConvertersCompletionProvider()
	];
	for (const provider of providers) {
		context.subscriptions.push(vscode.languages.registerCompletionItemProvider(JSON_FILES, provider, '"'));
	}

	// Item.Property completion is triggered on '.', polyline PointX / PointY values on '"'
	const itemPropertyProvider = new ItemPropertyCompletionProvider(context.asAbsolutePath('api_models'));
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(JSON_FILES, itemPropertyProvider, '.', '"'),
		itemPropertyProvider
	);

	context.subscriptions.push(
		vscode.languages.registerColorProvider(JSON_FILES, new ColorPickerProvider()),
		vscode.languages.registerInlayHintsProvider(JSON_FILES, new GlobalVarsInlayHintsProvider()),
		// Go to definition (F12 / Ctrl+Click) and hover for styles, components, triggers and variables
		vscode.languages.registerDefinitionProvider(JSON_FILES, new DefinitionProvider()),
		vscode.languages.registerHoverProvider(JSON_FILES, new ReferenceHoverProvider())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('rlt-theme-helper.showSnippets', showSnippets),
		vscode.commands.registerCommand('rlt-theme-helper.addGlobalVariable', addGlobalVariable)
	);

	registerThemeDiagnostics(context);
	registerStatusBar(context);
}

interface JsonValidation {
	fileMatch?: string | string[];
}

/**
 * Status bar item telling whether the active JSON file is covered by one of the extension's schemas.
 */
function registerStatusBar(context: vscode.ExtensionContext): void {
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBarItem.text = '$(rlt-iconbar-G)  RLT';
	context.subscriptions.push(statusBarItem);

	const jsonValidation: JsonValidation[] = context.extension.packageJSON.contributes.jsonValidation || [];
	const schemaPatterns = jsonValidation
		.flatMap(schema => Array.isArray(schema.fileMatch) ? schema.fileMatch : [schema.fileMatch])
		.filter((fileMatch): fileMatch is string => Boolean(fileMatch))
		.map(globToRegExp);

	const refresh = (editor: vscode.TextEditor | undefined) => {
		if (!editor || editor.document.languageId !== 'json') {
			statusBarItem.hide();
			return;
		}

		const filePath = editor.document.uri.fsPath;
		if (schemaPatterns.some(pattern => pattern.test(filePath))) {
			statusBarItem.tooltip = 'This file is supported by RLT Theme Helper extension!';
			statusBarItem.text = '$(rlt-iconbar-G)  RLT';
		} else {
			statusBarItem.tooltip = 'This file is not supported by RLT Theme Helper.\nAre you sure it is a correct RLT theme file?';
			statusBarItem.text = '$(rlt-iconbar-G)! RLT';
		}
		statusBarItem.show();
	};

	refresh(vscode.window.activeTextEditor);
	vscode.window.onDidChangeActiveTextEditor(refresh, null, context.subscriptions);
	vscode.workspace.onDidOpenTextDocument((document) => {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document === document) {
			refresh(editor);
		}
	}, null, context.subscriptions);
}

/**
 * Convert a jsonValidation fileMatch glob to a RegExp matching the end of a file path.
 * Supports `**`, `*` and `?`; matches both `/` and `\` separators.
 */
export function globToRegExp(glob: string): RegExp {
	const separator = '[\\\\/]';
	let source = '';
	for (let i = 0; i < glob.length; i++) {
		const char = glob[i];
		if (char === '*' && glob[i + 1] === '*') {
			i++;
			if (glob[i + 1] === '/') {
				i++;
				source += `(?:.*${separator})?`;
			} else {
				source += '.*';
			}
		} else if (char === '*') {
			source += '[^\\\\/]*';
		} else if (char === '?') {
			source += '[^\\\\/]';
		} else if (char === '/') {
			source += separator;
		} else {
			source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
		}
	}
	return new RegExp(`(?:^|${separator})${source}$`, 'i');
}

export function deactivate(): void {}
