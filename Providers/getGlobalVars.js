const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

function getGlobalVars(){
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if(workspaceFolders){
		const folderPath = workspaceFolders[0].uri.fsPath;
		const filePath = path.join(folderPath, 'globals', 'global_vars.json');
		if(fs.existsSync(filePath)){
			const content = fs.readFileSync(filePath, 'utf-8');
			return JSON.parse(content);
		}
	}
	return {};
}


module.exports = getGlobalVars;