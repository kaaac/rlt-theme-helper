const vscode = require('vscode');
const { registerThemeWatcher } = require('./core/themeContext');
const GlobalVarsCompletionProvider = require('./Providers/GlobalVarsCompletionProvider');
const DataConvertersCompletionProvider = require('./Providers/DataConvertersCompletionProvider');
const NameCompletionProvider = require('./Providers/NameCompletionProvider');
const ItemPropertyCompletionProvider = require('./Providers/ItemPropertyCompletionProvider');
const ColorPickerProvider = require('./Providers/ColorPickerProvider');
const GlobalVarsInlayHintsProvider = require('./Providers/GlobalVarsInlayHintsProvider');
const { showSnippets } = require('./Providers/SnippetCommandProvider');
const addGlobalVariable = require('./Providers/addGlobalVariableCommand');

const JSON_FILES = { scheme: 'file', language: 'json' };

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	registerThemeWatcher(context);

	const providers = [
		new GlobalVarsCompletionProvider(),
		new NameCompletionProvider(),
		new DataConvertersCompletionProvider()
	];
	for (const provider of providers) {
		context.subscriptions.push(vscode.languages.registerCompletionItemProvider(JSON_FILES, provider, '"'));
	}

	// Item.Property completion is triggered on '.'
	const itemPropertyProvider = new ItemPropertyCompletionProvider();
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(JSON_FILES, itemPropertyProvider, '.'),
		itemPropertyProvider
	);

	context.subscriptions.push(
		vscode.languages.registerColorProvider(JSON_FILES, new ColorPickerProvider()),
		vscode.languages.registerInlayHintsProvider(JSON_FILES, new GlobalVarsInlayHintsProvider())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('rlt-theme-helper.showSnippets', showSnippets),
		vscode.commands.registerCommand('rlt-theme-helper.addGlobalVariable', addGlobalVariable)
	);

	registerStatusBar(context);
}

/**
 * Status bar item telling whether the active JSON file is covered by one of the extension's schemas.
 * @param {vscode.ExtensionContext} context
 */
function registerStatusBar(context) {
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBarItem.text = '$(rlt-iconbar-G)  RLT';
	context.subscriptions.push(statusBarItem);

	const jsonValidation = context.extension.packageJSON.contributes.jsonValidation || [];
	const schemaPatterns = jsonValidation
		.flatMap(schema => Array.isArray(schema.fileMatch) ? schema.fileMatch : [schema.fileMatch])
		.filter(Boolean)
		.map(globToRegExp);

	const refresh = (editor) => {
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
 * @param {string} glob
 */
function globToRegExp(glob) {
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

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate,
	globToRegExp
};
