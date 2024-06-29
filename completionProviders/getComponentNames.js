const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

function removeCommentsFromJSON(jsonString) {
    return jsonString
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');
}

function extractComponentsFromCurrentFile(json, componentNames) {
    if (Array.isArray(json)) {
        json.forEach(item => extractComponentsFromCurrentFile(item, componentNames));
    } else if (typeof json === 'object' && json !== null) {
        for (const key in json) {
            if (key === 'Components' && Array.isArray(json[key])) {
                json[key].forEach(component => {
                    if (component.ComponentName && typeof component.ComponentName === 'string') {
                        componentNames.set(component.ComponentName, {
                            name: component.ComponentName,
                            details: 'Local'
                        });
                    }
                });
            } else {
                extractComponentsFromCurrentFile(json[key], componentNames);
            }
        }
    }
}

function extractComponentNames(json, componentNames) {
    if (Array.isArray(json)) {
        json.forEach(item => extractComponentNames(item, componentNames));
    } else if (typeof json === 'object' && json !== null) {
        for (const key in json) {
            if (key === 'ComponentName' && typeof json[key] === 'string') {
                if (!componentNames.has(json[key])) {
                    componentNames.set(json[key], {
                        name: json[key],
                        details: 'Global'
                    });
                }
            } else {
                extractComponentNames(json[key], componentNames);
            }
        }
    }
}

async function getComponentNames() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const componentNames = new Map();

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'json') {
        const content = editor.document.getText();
        const json = JSON.parse(removeCommentsFromJSON(content));
        extractComponentsFromCurrentFile(json, componentNames);
    }

    if (workspaceFolders) {
        const folderPath = workspaceFolders[0].uri.fsPath;
        const componentsFolderPath = path.join(folderPath, 'components');
        if (fs.existsSync(componentsFolderPath)) {
            const files = fs.readdirSync(componentsFolderPath);
            for (const file of files) {
                const filePath = path.join(componentsFolderPath, file);
                if (path.extname(filePath) === '.json') {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const json = JSON.parse(removeCommentsFromJSON(content));
                    extractComponentNames(json, componentNames);
                }
            }
        }
    }

    return Array.from(componentNames.values());
}

module.exports = getComponentNames;