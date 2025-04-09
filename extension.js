
const vscode = require('vscode');
const EXTENSION_ID = 'kaaac.rlt-theme-helper';
const ComponentNameCompletionProvider = require('./Providers/ComponentNameCompletionProvider');
const GlobalVarsCompletionProvider = require('./Providers/GlobalVarsCompletionProvider');
const DataConvertersCompletionProvider = require('./Providers/DataConvertersCompletionProvider');
const StyleNameCompletionProvider = require('./Providers/StyleNameCompletionProvider');
const { showSnippets } = require('./Providers/SnippetCommandProvider');
const { provideHover } = require('./Providers/hoverColorProvider');

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



	const myCustomIcon = "$(rlt-iconbar-A)";
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
	statusBarItem.text = myCustomIcon;
	statusBarItem.tooltip = "RLT Theme Helper is active!"
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	refreshStatusBarIcon(vscode.window.activeTextEditor);

    vscode.window.onDidChangeActiveTextEditor((editor) => {
		refreshStatusBarIcon(editor);
    });

	function refreshStatusBarIcon(editor){
		if (!editor) {
			statusBarItem.hide();
			return;
		}
		const filePath = editor.document.uri.fsPath;
		const extensionConfig = vscode.extensions.getExtension(EXTENSION_ID).packageJSON.contributes;
		if (extensionConfig && extensionConfig.jsonValidation) {
			const jsonValidation = extensionConfig.jsonValidation;
			const matchedSchema = getMatchedSchema(filePath, jsonValidation);
			if (matchedSchema) {
                statusBarItem.tooltip = 'This file is supported by extension!';
				statusBarItem.text = '$(rlt-iconbar-G)  RLT'
            } else {
                statusBarItem.tooltip = 'Sorry! This file is not supported by extension.\nAre you sure you sure it is correct file?';
				statusBarItem.text = '$(rlt-iconbar-G)! RLT'
            }
		}
	}

	context.subscriptions.push(
		vscode.languages.registerHoverProvider(
			{ language: 'json', scheme: 'file'},
			{ provideHover }
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
