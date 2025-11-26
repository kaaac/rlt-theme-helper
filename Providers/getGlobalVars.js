const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const removeCommentsFromJSON = require('./removeCommentsFromJSON');

function getGlobalVars(){
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if(workspaceFolders){
		const folderPath = workspaceFolders[0].uri.fsPath;
		const filePath = path.join(folderPath, 'globals', 'global_vars.json');
		if(fs.existsSync(filePath)){
			try {
				const content = fs.readFileSync(filePath, 'utf-8');
				
				// Try to parse as-is first
				try {
					return JSON.parse(content);
				} catch (firstError) {
					// If it fails, try removing comments
					const contentWithoutComments = removeCommentsFromJSON(content);
					try {
						const result = JSON.parse(contentWithoutComments);
						
						// Show warning about comments
						vscode.window.showWarningMessage(
							'global_vars.json contains comments. While this works, standard JSON does not support comments. Consider removing them.',
							'OK'
						);
						
						return result;
					} catch (secondError) {
						// Still failed after removing comments
						vscode.window.showErrorMessage(
							`Failed to parse global_vars.json: ${secondError.message}`,
							'Open File'
						).then(selection => {
							if (selection === 'Open File') {
								vscode.workspace.openTextDocument(filePath).then(doc => {
									vscode.window.showTextDocument(doc);
								});
							}
						});
						return {};
					}
				}
			} catch (error) {
				console.error('Error reading global_vars.json:', error);
				return {};
			}
		}
	}
	return {};
}


module.exports = getGlobalVars;