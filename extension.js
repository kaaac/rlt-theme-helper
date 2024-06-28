
const vscode = require('vscode');
//const getComponentNames = require('./completionProviders/getComponentNames');
//const getGlobalVars = require('./completionProviders/getGlobalVars');
const ComponentNameCompletionProvider = require('./completionProviders/ComponentNameCompletionProvider');
const GlobalVarsCompletionProvider = require('./completionProviders/GlobalVarsCompletionProvider');
//const path = require('path');
//const fs = require('fs');

//function removeCommentsFromJSON(jsonString) {
//    
//    return jsonString
//        .replace(/\/\*[\s\S]*?\*\//g, '')
//        .replace(/\/\/.*/g, '');
//}

//function getComponentNames(){
//	const workspaceFolders = vscode.workspace.workspaceFolders;
//	const componentNames = [];
//
//	if(workspaceFolders){
//		const folderPath = workspaceFolders[0].uri.fsPath;
//		const componentsFolderPath = path.join(folderPath, 'components');
//		if(fs.existsSync(componentsFolderPath)){
//			const files = fs.readdirSync(componentsFolderPath);
//			files.forEach(file => {
//				const filePath = path.join(componentsFolderPath, file);
//				console.log(`We are here ${file}`);
//				if(path.extname(filePath) === '.json'){
//					const content = fs.readFileSync(filePath, 'utf8');
//					const json = JSON.parse(removeCommentsFromJSON(content));
//					if (json.ComponentName){
//						componentNames.push(json.ComponentName);
//					}
//				}
//			});
//		}
//	}
//	return componentNames;
//}

//class ComponentNameCompletionProvider {
//	provideCompletionItems(document, position, token, context){
//		const linePrefix = document.lineAt(position).text.substr(0, position.character);
//		const keyPrefix = linePrefix.trim().split(':')[0].trim();
//
//		if(!keyPrefix.endsWith('"Component"')){
//			return undefined;
//		}
//
//		const componentNames = getComponentNames();
//		const completionItems = [];
//
//		componentNames.forEach(name => {
//			const completionItem = new vscode.CompletionItem(name, vscode.CompletionItemKind.Value);
//			completionItem.detail = "Component";
//			completionItems.push(completionItem);
//		});
//
//		return completionItems;
//	}
//}


//class GlobalVarsCompletionProvider {
//	provideCompletionItems(document, position, token, context){
//		const linePrefix = document.lineAt(position).text.substr(0, position.character);
//		if (!linePrefix.endsWith('"{')){
//			return undefined;
//		}
//		const globalVars = getGlobalVars();
//		const completionItems = [];
//
//		for(const key in globalVars){
//			const completionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Variable);
//			completionItem.detail = `Value: ${globalVars[key]}`;
//			completionItems.push(completionItem);
//		}
//		return completionItems;
//	}
//}


//console.log("FindMe");

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	const globalVarsProvider = new GlobalVarsCompletionProvider();
	const globalVarsProviderDisposable = vscode.languages.registerCompletionItemProvider(
        { scheme: 'file', language: 'json' },
        globalVarsProvider,
        '"'
    );
	context.subscriptions.push(globalVarsProviderDisposable);

	const componentNameProvider = new ComponentNameCompletionProvider();
	const componentNameProviderDisposable = vscode.languages.registerCompletionItemProvider(
		{ scheme: 'file', language: 'json'},
		componentNameProvider,
		'"'
	);
	context.subscriptions.push(componentNameProviderDisposable);

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
	let disposable = vscode.commands.registerCommand('rlt-theme-helper.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		//vscode.window.showInformationMessage('Hello World from RLT Theme Helper!');
	});

	context.subscriptions.push(disposable);
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
