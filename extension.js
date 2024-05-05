// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

//const completionProvider = require('./completionProvider');
const vscode = require('vscode');


//console.log("FindMe");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	//context.subscriptions.push(
    //    vscode.languages.registerCodeActionsProvider('json', {
    //        provideCodeActions: (document, range, context, token) => {
    //            const actions = [];
	//			
    //            // Sprawdź, czy w kontekście jest informacja o błędzie
    //            if (context.diagnostics && context.diagnostics.length > 0) {
    //                // Iteruj przez każdy błąd w kontekście
    //                for (const diagnostic of context.diagnostics) {
	//					if (diagnostic.code === 2) {
	//						const textInRange = document.getText(diagnostic.range)
	//						let jsonObjectInRange;
	//						try {
	//							jsonObjectInRange = JSON.parse(textInRange);
	//						} catch (error) {
	//							vscode.window.showErrorMessage('Error parsing json: ' + error);
	//						}
	//						if ('Template' in jsonObjectInRange) {
	//							vscode.window.showErrorMessage('Template in jsonObjectIRange');
	//							actions.push({
	//								title: 'Replace Template with ItemTemplate',
	//								command: {
	//									title: 'Replace Template with ItemTemplate',
	//									command: 'extension.replaceDeprecatedProperties',
	//									arguments: [document, diagnostic.range]
	//								}
	//							});
	//						}
	//					}
	//				}
    //            }
    //            //return actions;
    //        }
    //    })
    //);

 // Rejestruj komendę do obsługi quick fixa
	 context.subscriptions.push(
	    vscode.commands.registerCommand('extension.replaceDeprecatedProperties', (document, range) => {
	        // Pobierz aktywny edytor
	        const editor = vscode.window.activeTextEditor;
	        if (!editor) {
	            return; // Brak aktywnego edytora
	        }
		
	        // Pobierz tekst w obszarze, który należy zmienić
	        const textToReplace = editor.document.getText(range);
		
	        // Jeśli tekst do zmiany to "Template", zamień go na "ItemTemplate"
	        if (textToReplace === 'Template') {
	            // Wstaw "ItemTemplate" w miejsce "Template"
	            editor.edit(editBuilder => {
	                editBuilder.replace(range, 'ItemTemplate');
	            });
	        } else {
	            vscode.window.showErrorMessage('Unexpected deprecated property');
	        }
	    })
	);

	console.log('Congratulations, your extension "rlt-theme-helper" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('rlt-theme-helper.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		//vscode.window.showInformationMessage('Hello World from RLT Theme Helper!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
