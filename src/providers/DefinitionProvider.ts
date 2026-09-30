import * as vscode from 'vscode';
import * as fs from 'fs';
import * as jsonc from 'jsonc-parser';
import { getThemeContext } from '../core/themeContext';
import { enclosingObjects, parseJsonTree, positionOfPath, TextPosition } from '../core/json';
import { referenceAt, resolveReference } from '../core/resources';
import { blockVariableSources, fileVariableSources, findVariableSource, mergeVariables, variableReferenceAt } from '../core/variableScope';
import { variableKey } from '../core/variables';

export interface DefinitionTarget extends TextPosition {
    fsPath: string;
}

/**
 * Definition of what's under the cursor:
 * Style / StyleBasedOn / Component / Trigger names, {Variables} and [LocalizationKeys]
 */
export function findDefinition(document: vscode.TextDocument, position: vscode.Position): DefinitionTarget | null {
    const text = document.getText();
    const offset = document.offsetAt(position);
    const tree = parseJsonTree(text);

    const reference = referenceAt(text, offset, tree);
    if (reference) {
        const entry = resolveReference(document, reference, tree);
        return entry ? { fsPath: entry.fsPath, line: entry.line, character: entry.character } : null;
    }

    const variable = variableReferenceAt(text, offset, tree);
    if (!variable) {
        return null;
    }

    const locate = (fsPath: string, jsonPath: jsonc.JSONPath): DefinitionTarget | null => {
        let targetText: string;
        try {
            targetText = fsPath === document.uri.fsPath ? text : fs.readFileSync(fsPath, 'utf8');
        } catch {
            return null;
        }
        const target = positionOfPath(targetText, jsonPath);
        return target ? { fsPath, ...target } : null;
    };

    // Public property: the item with this Name in public_properties.json
    const locatePublicProperty = (name: string): DefinitionTarget | null => {
        const fsPath = getThemeContext(document).publicPropertiesPath;
        let publicText: string;
        try {
            publicText = fs.readFileSync(fsPath, 'utf8');
        } catch {
            return null;
        }
        const properties = jsonc.findNodeAtLocation(parseJsonTree(publicText) ?? { type: 'null', offset: 0, length: 0 }, ['Properties']);
        const index = (properties?.children || []).findIndex(item => jsonc.findNodeAtLocation(item, ['Name'])?.value === name);
        return index >= 0 ? locate(fsPath, ['Properties', index, 'Name']) : null;
    };

    if (variable.type === 'localization') {
        const localization = getThemeContext(document).getLocalization();
        if (!localization) return null;
        return locate(localization.path, ['Strings', variable.expression])
            ?? locate(localization.path, ['Strings', ...variable.expression.split('.')]);
    }
    if (variable.type === 'public') {
        return locatePublicProperty(variable.expression);
    }

    const sources = [...blockVariableSources(document, tree, offset), ...fileVariableSources(document)];
    const key = variableKey(variable.expression, mergeVariables(sources));
    const found = findVariableSource(sources, key);
    if (!found) {
        return null;
    }
    if (found.source.level === 'Public') {
        return locatePublicProperty(found.jsonPath[0]);
    }
    if (found.source.level === 'Localization') {
        return locate(found.source.fsPath, ['Vars', ...found.jsonPath]);
    }
    if (found.source.level !== 'Block') {
        return locate(found.source.fsPath, found.jsonPath);
    }
    // Block Vars: the nearest enclosing block whose Vars define the key
    for (const objectNode of enclosingObjects(tree, offset)) {
        const target = positionOfPath(text, ['Vars', ...found.jsonPath], objectNode);
        if (target) {
            return { fsPath: document.uri.fsPath, ...target };
        }
    }
    return null;
}

export class DefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.Location | undefined {
        const target = findDefinition(document, position);
        return target
            ? new vscode.Location(vscode.Uri.file(target.fsPath), new vscode.Position(target.line, target.character))
            : undefined;
    }
}
