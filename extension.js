
const vscode = require('vscode');
const EXTENSION_ID = 'kaaac.rlt-theme-helper';
const ComponentNameCompletionProvider = require('./Providers/ComponentNameCompletionProvider');
const GlobalVarsCompletionProvider = require('./Providers/GlobalVarsCompletionProvider');
const DataConvertersCompletionProvider = require('./Providers/DataConvertersCompletionProvider');
const StyleNameCompletionProvider = require('./Providers/StyleNameCompletionProvider');
const ColorPickerProvider = require('./Providers/ColorPickerProvider');
const GlobalVarsInlayHintsProvider = require('./Providers/GlobalVarsInlayHintsProvider');
const RLTDocumentSymbolProvider = require('./Providers/RLTDocumentSymbolProvider');
const { showSnippets } = require('./Providers/SnippetCommandProvider');
const addGlobalVariable = require('./Providers/addGlobalVariableCommand');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	const providers = [
		new GlobalVarsCompletionProvider(),
		new ComponentNameCompletionProvider(),
		new DataConvertersCompletionProvider(),
		new StyleNameCompletionProvider()
	]
	for (const provider of providers){
		context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: 'file', language: 'json'}, provider, '"'));
	}

	let disposable = vscode.commands.registerCommand('rlt-theme-helper.showSnippets', showSnippets);
	context.subscriptions.push(disposable);

	let addGlobalVarDisposable = vscode.commands.registerCommand('rlt-theme-helper.addGlobalVariable', addGlobalVariable);
	context.subscriptions.push(addGlobalVarDisposable);



	const myCustomIcon = "$(rlt-iconbar-A)";
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBarItem.text = myCustomIcon;
	statusBarItem.tooltip = "RLT Theme Helper is active!"
	context.subscriptions.push(statusBarItem);

	// Initial update
	refreshStatusBarIcon(vscode.window.activeTextEditor);

	// Update on editor change
    vscode.window.onDidChangeActiveTextEditor((editor) => {
		refreshStatusBarIcon(editor);
    }, null, context.subscriptions);

	// Update on document change (e.g., when file is saved with new name)
	vscode.workspace.onDidOpenTextDocument((document) => {
		if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === document) {
			refreshStatusBarIcon(vscode.window.activeTextEditor);
		}
	}, null, context.subscriptions);

	function refreshStatusBarIcon(editor){
		if (!editor) {
			statusBarItem.hide();
			return;
		}

		// Only show for JSON files
		if (editor.document.languageId !== 'json') {
			statusBarItem.hide();
			return;
		}

		const filePath = editor.document.uri.fsPath;
		const extensionConfig = vscode.extensions.getExtension(EXTENSION_ID).packageJSON.contributes;
		
		if (extensionConfig && extensionConfig.jsonValidation) {
			const jsonValidation = extensionConfig.jsonValidation;
			const matchedSchema = getMatchedSchema(filePath, jsonValidation);
			
			if (matchedSchema) {
                statusBarItem.tooltip = 'This file is supported by RLT Theme Helper extension!';
				statusBarItem.text = '$(rlt-iconbar-G)  RLT';
				statusBarItem.show();
            } else {
                statusBarItem.tooltip = 'This file is not supported by RLT Theme Helper.\nAre you sure it is a correct RLT theme file?';
				statusBarItem.text = '$(rlt-iconbar-G)! RLT';
				statusBarItem.show();
            }
		} else {
			statusBarItem.hide();
		}
	}

	// Register Color Picker Provider
	const colorPickerProvider = new ColorPickerProvider();
	context.subscriptions.push(
		vscode.languages.registerColorProvider(
			{ language: 'json', scheme: 'file' },
			colorPickerProvider
		)
	);
	context.subscriptions.push(colorPickerProvider);

	// Register Global Variables Inlay Hints Provider
	const inlayHintsProvider = new GlobalVarsInlayHintsProvider();
	context.subscriptions.push(
		vscode.languages.registerInlayHintsProvider(
			{ language: 'json', scheme: 'file' },
			inlayHintsProvider
		)
	);
	context.subscriptions.push(inlayHintsProvider);

	// Register RLT Document Symbol Provider (for Outline view)
	const symbolProvider = new RLTDocumentSymbolProvider();
	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider(
			{ language: 'json', scheme: 'file' },
			symbolProvider
		)
	);

	console.log('Congratulations, your extension "rlt-theme-helper" is now active!');

}


function getMatchedSchema(filePath, jsonValidation) {
    
    for (const schema of jsonValidation) {
		if (schema.fileMatch) {
			if (Array.isArray(schema.fileMatch)) {
				for (const fileMatch of schema.fileMatch) {
					const regex = new RegExp(fileMatch.replace(/\//g, '[\\/\\\\]').replace(/\*{2}/g, '.*').replace(/\*{1}/g, '[^\\/\\\\]*'));
					if(regex.test(filePath) == true) {return schema;}
				}
			} else {
				const regex = new RegExp(schema.fileMatch.replace(/\//g, '[\\/\\\\]').replace(/\*{2}/g, '.*').replace(/\*{1}/g, '[^\\/\\\\]*'));
				if(regex.test(filePath) == true){
					return schema;
				}
			}
		}
	}

    return null; // If no match found
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
