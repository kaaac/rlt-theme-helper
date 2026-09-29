const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const jsonc = require('jsonc-parser');
const { getThemeContext } = require('../core/themeContext');
const { parseJsonTree } = require('../core/json');

/**
 * Command to add a new global variable
 * Inserts variable reference at cursor position and adds the variable to global_vars.json
 * (comments and formatting of global_vars.json are preserved)
 */
async function addGlobalVariable() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found');
        return;
    }

    const globalVarsPath = getThemeContext(editor.document).globalVarsPath;

    // Selected text (without quotes) becomes the variable value
    const selection = editor.selection;
    const hasSelection = !selection.isEmpty;
    const defaultValue = hasSelection ? editor.document.getText(selection).replace(/^["']|["']$/g, '') : '';

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

    const variableReference = `{${variableName}}`;
    await editor.edit(editBuilder => {
        if (hasSelection) {
            editBuilder.replace(selection, variableReference);
        } else {
            editBuilder.insert(editor.selection.active, variableReference);
        }
    });

    if (!fs.existsSync(globalVarsPath)) {
        fs.mkdirSync(path.dirname(globalVarsPath), { recursive: true });
        fs.writeFileSync(globalVarsPath, '{\n}\n', 'utf-8');
    }

    const document = await vscode.workspace.openTextDocument(globalVarsPath);
    const propertyPath = variableName.split('.');
    const text = document.getText();

    let edits;
    try {
        edits = jsonc.modify(text, propertyPath, defaultValue, { formattingOptions: detectFormatting(text) });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add '${variableName}' to global_vars.json: ${error.message}`);
        return;
    }

    const workspaceEdit = new vscode.WorkspaceEdit();
    for (const edit of edits) {
        const range = new vscode.Range(document.positionAt(edit.offset), document.positionAt(edit.offset + edit.length));
        workspaceEdit.replace(document.uri, range, edit.content);
    }
    await vscode.workspace.applyEdit(workspaceEdit);
    await document.save();

    // Show global_vars.json with the new value selected
    const globalVarsEditor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
    const valueNode = jsonc.findNodeAtLocation(parseJsonTree(document.getText()), propertyPath);
    if (valueNode) {
        // Inside the quotes
        const start = document.positionAt(valueNode.offset + 1);
        const end = document.positionAt(valueNode.offset + valueNode.length - 1);
        globalVarsEditor.selection = new vscode.Selection(start, end);
        globalVarsEditor.revealRange(new vscode.Range(start, end), vscode.TextEditorRevealType.InCenter);
    }

    const message = hasSelection
        ? `Global variable '${variableName}' added with value: ${defaultValue}`
        : `Global variable '${variableName}' added successfully!`;
    vscode.window.showInformationMessage(message);
}

/**
 * Keep the file's existing indentation style.
 * @param {string} text
 */
function detectFormatting(text) {
    const indent = text.match(/^([ \t]+)\S/m);
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    if (indent && indent[1].startsWith('\t')) {
        return { insertSpaces: false, tabSize: 4, eol };
    }
    return { insertSpaces: true, tabSize: indent ? indent[1].length : 2, eol };
}

module.exports = addGlobalVariable;
