const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const extractPropertyNames = require('./extractPropertyNames');
const extractPropertyNamesFromCurrentFile = require('./extractPropertyNamesFromCurrentFile');
const removeCommentsFromJSON = require('./removeCommentsFromJSON');

function scanDirectoryRecursively(dirPath, folderPath, directoryName, propertyNames, propertyName) {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Rekurencyjnie skanuj podfoldery
            scanDirectoryRecursively(fullPath, folderPath, directoryName, propertyNames, propertyName);
        } else if (stat.isFile() && path.extname(fullPath) === '.json') {
            const content = fs.readFileSync(fullPath, 'utf8');
            const json = JSON.parse(removeCommentsFromJSON(content));
            const relativePath = path.relative(folderPath, fullPath).replace(/\\/g, '/');
            
            // Sprawdź czy plik zawiera pojedynczy styl/trigger (nie tablicę)
            const isSingleItem = !Array.isArray(json) && typeof json === 'object' && json !== null;
            
            // Jeśli to pojedynczy item, dodaj również ścieżkę względną
            if (isSingleItem) {
                // Usuń folder bazowy (styles/triggers) i rozszerzenie .json
                const pathWithoutBase = relativePath.substring(directoryName.length + 1);
                const pathWithoutExtension = pathWithoutBase.replace(/\.json$/, '');
                const relativePathReference = '/' + pathWithoutExtension.replace(/\\/g, '/');
                
                // Dodaj ścieżkę względną jako opcję
                if (!propertyNames.has(relativePathReference)) {
                    propertyNames.set(relativePathReference, {
                        name: relativePathReference,
                        details: 'Path reference',
                        source: relativePath,
                        isPath: true
                    });
                }
            }
            
            extractPropertyNames(json, propertyNames, propertyName, relativePath);
        }
    }
}

async function getPropertyNames(propertyName, directoryName){
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const propertyNames = new Map();
    const editor = vscode.window.activeTextEditor;
    if(editor && editor.document.languageId === 'json'){
        const content = editor.document.getText();
        const json = JSON.parse(removeCommentsFromJSON(content));
        const currentFilePath = editor.document.uri.fsPath;
        const workspacePath = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
        const relativePath = workspacePath ? path.relative(workspacePath, currentFilePath).replace(/\\/g, '/') : currentFilePath;
        extractPropertyNamesFromCurrentFile(json, propertyNames, propertyName, relativePath);
    }
    if(workspaceFolders){
        const folderPath = workspaceFolders[0].uri.fsPath;
        const propertiesFolderPath = path.join(folderPath, directoryName);
        if(fs.existsSync(propertiesFolderPath)){
            scanDirectoryRecursively(propertiesFolderPath, folderPath, directoryName, propertyNames, propertyName);
        }
    }
    return Array.from(propertyNames.values());
}

module.exports = getPropertyNames;