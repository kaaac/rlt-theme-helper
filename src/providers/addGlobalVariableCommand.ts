import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as jsonc from 'jsonc-parser';
import { getThemeContext } from '../core/themeContext';
import { parseJsonTree } from '../core/json';

/**
 * Command to add a new global variable
 * Inserts variable reference at cursor position and adds the variable to global_vars.json
 * (comments and formatting of global_vars.json are preserved)
 */
export async function addGlobalVariable(): Promise<void> {
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
        placeHolder: 'e.g., PrimaryColor, ThemeBackground',
        validateInput: validateVariableName
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
    const propertyPath = [variableName];

    let edits: jsonc.Edit[];
    try {
        edits = createVariableEdits(document.getText(), propertyPath, defaultValue);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to add '${variableName}' to global_vars.json: ${(error as Error).message}`);
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
    const tree = parseJsonTree(document.getText());
    const valueNode = tree && jsonc.findNodeAtLocation(tree, propertyPath);
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

export function validateVariableName(value: string): string | null {
    if (!value) {
        return 'Variable name cannot be empty';
    }
    // variables.md: variable names must not contain spaces or dots
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        return 'Variable name can only contain letters, numbers and underscores';
    }
    return null;
}

/**
 * Edits that set `propertyPath` to `value` in global_vars.json text, keeping comments and indentation.
 */
export function createVariableEdits(text: string, propertyPath: string[], value: string): jsonc.Edit[] {
    return jsonc.modify(text, propertyPath, value, { formattingOptions: detectFormatting(text) });
}

/**
 * Keep the file's existing indentation style.
 */
function detectFormatting(text: string): jsonc.FormattingOptions {
    const indent = text.match(/^([ \t]+)\S/m);
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    if (indent && indent[1].startsWith('\t')) {
        return { insertSpaces: false, tabSize: 4, eol };
    }
    return { insertSpaces: true, tabSize: indent ? indent[1].length : 2, eol };
}
