const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const extractPropertyNames = require('./extractPropertyNames');
const extractPropertyNamesFromCurrentFile = require('./extractPropertyNamesFromCurrentFile');
const removeCommentsFromJSON = require('./removeCommentsFromJSON');

async function getPropertyNames(propertyName, directoryName){
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const propertyNames = new Map();
    const editor = vscode.window.activeTextEditor;
    if(editor && editor.document.languageId === 'json'){
        const content = editor.document.getText();
        const json = JSON.parse(removeCommentsFromJSON(content));
        extractPropertyNamesFromCurrentFile(json, propertyNames, propertyName);
    }
    if(workspaceFolders){
        const folderPath = workspaceFolders[0].uri.fsPath;
        const propertiesFolderPath = path.join(folderPath, directoryName);
        if(fs.existsSync(propertiesFolderPath)){
            const files = fs.readdirSync(propertiesFolderPath);
            for (const file of files) {
                const filePath = path.join(propertiesFolderPath, file);
                if(path.extname(filePath) === '.json'){
                    const content = fs.readFileSync(filePath, 'utf8');
                    const json = JSON.parse(removeCommentsFromJSON(content));
                    extractPropertyNames(json, propertyNames, propertyName);
                }
            }
        }
    }
    return Array.from(propertyNames.values());
}

module.exports = getPropertyNames;