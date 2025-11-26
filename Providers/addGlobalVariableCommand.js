const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const removeCommentsFromJSON = require('./removeCommentsFromJSON');

/**
 * Command to add a new global variable
 * Inserts variable reference at cursor position and opens global_vars.json
 */
async function addGlobalVariable() {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    // Get the workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const folderPath = workspaceFolders[0].uri.fsPath;
    const globalVarsPath = path.join(folderPath, 'globals', 'global_vars.json');

    // Get selected text (if any)
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    const hasSelection = !selection.isEmpty;
    
    // Remove quotes from selected text if present
    const defaultValue = hasSelection ? selectedText.replace(/^["']|["']$/g, '') : '';

    // Ask for variable name
    const variableName = await vscode.window.showInputBox({
        prompt: 'Enter global variable name',
        placeHolder: 'e.g., PrimaryColor, Theme.Background',
        validateInput: (value) => {
            if (!value) {
                return 'Variable name cannot be empty';
            }
            if (!/^[a-zA-Z0-9._]+$/.test(value)) {
                return 'Variable name can only contain letters, numbers, dots, and underscores';
            }
            return null;
        }
    });

    if (!variableName) {
        return; // User cancelled
    }

    // Insert or replace with variable reference
    const variableReference = `{${variableName}}`;
    
    await editor.edit(editBuilder => {
        if (hasSelection) {
            // Replace selection with variable reference
            editBuilder.replace(selection, variableReference);
        } else {
            // Insert at cursor position
            editBuilder.insert(editor.selection.active, variableReference);
        }
    });

    // Ensure globals directory exists
    const globalsDir = path.dirname(globalVarsPath);
    if (!fs.existsSync(globalsDir)) {
        fs.mkdirSync(globalsDir, { recursive: true });
    }

    // Read or create global_vars.json
    let globalVars = {};
    let hasComments = false;
    let originalContent = '';
    
    if (fs.existsSync(globalVarsPath)) {
        try {
            originalContent = fs.readFileSync(globalVarsPath, 'utf-8');
            
            try {
                globalVars = JSON.parse(originalContent);
            } catch (error) {
                // Try removing comments
                hasComments = true;
                const contentWithoutComments = removeCommentsFromJSON(originalContent);
                globalVars = JSON.parse(contentWithoutComments);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to parse global_vars.json: ${error.message}`);
            return;
        }
    }

    // Add new variable with empty value or selected text
    setNestedProperty(globalVars, variableName, defaultValue);

    // Write back to file
    try {
        const newContent = JSON.stringify(globalVars, null, 2);
        fs.writeFileSync(globalVarsPath, newContent, 'utf-8');
        
        if (hasComments) {
            vscode.window.showWarningMessage(
                'Comments were removed from global_vars.json during the update.',
                'OK'
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to write global_vars.json: ${error.message}`);
        return;
    }

    // Open global_vars.json
    const document = await vscode.workspace.openTextDocument(globalVarsPath);
    const globalVarsEditor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);

    // Find the position of the new variable and place cursor inside the quotes
    const text = globalVarsEditor.document.getText();
    const searchPattern = new RegExp(`"${escapeRegex(variableName)}"\\s*:\\s*"([^"]*)"`);
    const match = searchPattern.exec(text);
    
    if (match) {
        const valueStart = match.index + match[0].indexOf('"', match[0].indexOf(':')) + 1;
        const valueEnd = valueStart + match[1].length;
        
        const startPos = globalVarsEditor.document.positionAt(valueStart);
        const endPos = globalVarsEditor.document.positionAt(valueEnd);
        
        // Select the value so user can immediately start typing or see what was inserted
        globalVarsEditor.selection = new vscode.Selection(startPos, endPos);
        globalVarsEditor.revealRange(
            new vscode.Range(startPos, endPos),
            vscode.TextEditorRevealType.InCenter
        );
    }

    const message = hasSelection 
        ? `Global variable '${variableName}' added with value: ${defaultValue}`
        : `Global variable '${variableName}' added successfully!`;
    
    vscode.window.showInformationMessage(message);
}

/**
 * Set a nested property in an object using dot notation
 * @param {Object} obj 
 * @param {string} path 
 * @param {any} value 
 */
function setNestedProperty(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
}

/**
 * Escape special regex characters
 * @param {string} str 
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = addGlobalVariable;
