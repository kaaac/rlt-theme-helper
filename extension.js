
const vscode = require('vscode');
const ComponentNameCompletionProvider = require('./completionProviders/ComponentNameCompletionProvider');
const GlobalVarsCompletionProvider = require('./completionProviders/GlobalVarsCompletionProvider');
const DataConvertersCompletionProvider = require('./completionProviders/DataConvertersCompletionProvider');
const StyleNameCompletionProvider = require('./completionProviders/StyleNameCompletionProvider');
const { showSnippets } = require('./completionProviders/SnippetCommandProvider');
//const SnippetCompletionProvider = require('./completionProviders/SnippetCompletionProvider');
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

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
	//const snippetProvider = vscode.languages.registerCompletionItemProvider('json', new SnippetCompletionProvider(), 'r');
	//context.subscriptions.push(snippetProvider);

	let disposable = vscode.commands.registerCommand('extension.showSnippets', showSnippets);
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
		const filePath = editor.document.uri.fsPath;			
		const extensionId = 'kaaac.rlt-theme-helper';
		const extensionConfig = vscode.extensions.getExtension(extensionId).packageJSON.contributes;
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

	console.log('Congratulations, your extension "rlt-theme-helper" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	//let disposable = vscode.commands.registerCommand('rlt-theme-helper.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		//vscode.window.showInformationMessage('Hello World from RLT Theme Helper!');
	//});

	//context.subscriptions.push(disposable);
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
