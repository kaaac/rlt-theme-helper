const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

function removeCommentsFromJSON(jsonString) {
    
    return jsonString
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');
}

function getComponentNames(){
	const workspaceFolders = vscode.workspace.workspaceFolders;
	const componentNames = [];

	if(workspaceFolders){
		const folderPath = workspaceFolders[0].uri.fsPath;
		const componentsFolderPath = path.join(folderPath, 'components');
		if(fs.existsSync(componentsFolderPath)){
			const files = fs.readdirSync(componentsFolderPath);
			files.forEach(file => {
				const filePath = path.join(componentsFolderPath, file);
				if(path.extname(filePath) === '.json'){
					const content = fs.readFileSync(filePath, 'utf8');
					const json = JSON.parse(removeCommentsFromJSON(content));
					if (json.ComponentName){
						componentNames.push({
                            name: json.ComponentName,
                            details: 'Global'
                        });
					}
				}
			});
		}
	}
	return componentNames;
}

module.exports = getComponentNames;