import type * as vscode from 'vscode';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import { getThemeContext } from './themeContext';
import { enclosingObjects, isPlainObject } from './json';
import { findChildDirectory, resourceLevels } from './resources';

export type VariableLevel = 'Block' | 'Public' | 'Localization' | 'Layer' | 'Layout' | 'Theme' | 'Global';

export interface VariableSource {
    level: VariableLevel;
    fsPath: string;
    values: Record<string, unknown>;
    /** Block Vars: offset of the Vars object in the document */
    offset?: number;
}

/**
 * Variables from files, highest priority first (variables.md):
 * public properties → localization Vars → layer vars/ → layout vars/ → theme vars/ → globals/global_vars.json
 */
export function fileVariableSources(document: vscode.TextDocument): VariableSource[] {
    const theme = getThemeContext(document);
    const sources: VariableSource[] = [
        { level: 'Public', fsPath: theme.publicPropertiesPath, values: theme.getPublicPropertyDefaults() }
    ];
    const localization = theme.getLocalization();
    if (localization) {
        sources.push({ level: 'Localization', fsPath: localization.path, values: localization.vars });
    }
    for (const { level, dir } of resourceLevels(theme, document.uri.fsPath)) {
        const varsDir = findChildDirectory(dir, 'vars');
        for (const file of varsDir ? theme.getVariableFiles(varsDir) : []) {
            sources.push({ level, fsPath: file.fsPath, values: file.values });
        }
    }
    sources.push({ level: 'Global', fsPath: theme.globalVarsPath, values: theme.getGlobalVars() });
    return sources;
}

/**
 * `Vars` of the blocks enclosing the offset, nearest (highest priority) first
 */
export function blockVariableSources(document: vscode.TextDocument, tree: jsonc.Node | undefined, offset: number): VariableSource[] {
    const sources: VariableSource[] = [];
    for (const objectNode of enclosingObjects(tree, offset)) {
        const varsNode = objectNode.children?.find(child => child.children?.[0]?.value === 'Vars')?.children?.[1];
        const values = varsNode ? jsonc.getNodeValue(varsNode) : undefined;
        if (varsNode && isPlainObject(values)) {
            sources.push({ level: 'Block', fsPath: document.uri.fsPath, values, offset: varsNode.offset });
        }
    }
    return sources;
}

/**
 * Variable lookup for many positions of one document: file sources are read once,
 * merged variables are cached per combination of enclosing block Vars.
 */
export class DocumentVariables {
    private readonly fileSources: VariableSource[];
    private readonly mergedCache = new Map<string, Record<string, unknown>>();

    constructor(private readonly document: vscode.TextDocument, private readonly tree: jsonc.Node | undefined) {
        this.fileSources = fileVariableSources(document);
    }

    /** Sources at the offset, highest priority first */
    sourcesAt(offset: number): VariableSource[] {
        return [...blockVariableSources(this.document, this.tree, offset), ...this.fileSources];
    }

    /** Effective variables at the offset */
    valuesAt(offset: number): Record<string, unknown> {
        const sources = this.sourcesAt(offset);
        const key = sources.filter(source => source.level === 'Block').map(source => source.offset).join(',');
        let merged = this.mergedCache.get(key);
        if (!merged) {
            merged = mergeVariables(sources);
            this.mergedCache.set(key, merged);
        }
        return merged;
    }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    for (const [key, value] of Object.entries(source)) {
        const current = target[key];
        target[key] = isPlainObject(current) && isPlainObject(value) ? deepMerge({ ...current }, value) : value;
    }
    return target;
}

/**
 * Effective variables: sources merged from the lowest to the highest priority
 */
export function mergeVariables(sources: VariableSource[]): Record<string, unknown> {
    return [...sources].reverse().reduce<Record<string, unknown>>((merged, source) => deepMerge(merged, source.values), {});
}

function hasOwn(object: unknown, key: string): boolean {
    return isPlainObject(object) && Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Highest priority source defining `key` (flat key "Theme.Background" or dot path), with the JSON path inside it
 */
export function findVariableSource(sources: VariableSource[], key: string): { source: VariableSource, jsonPath: string[] } | null {
    for (const source of sources) {
        if (hasOwn(source.values, key)) {
            return { source, jsonPath: [key] };
        }
        const parts = key.split('.');
        let current: unknown = source.values;
        if (parts.every(part => hasOwn(current, part) && (current = (current as Record<string, unknown>)[part], true))) {
            return { source, jsonPath: parts };
        }
    }
    return null;
}

export interface VariableReference {
    type: 'variable' | 'localization' | 'public';
    /** Variable expression without the outer braces (e.g. "Colors.{Team}"), localization key or public property name */
    expression: string;
}

/**
 * `{Variable}` or `[LocalizationKey]` under the cursor, inside a JSON string.
 * For nested variables the innermost reference containing the cursor wins.
 */
export function variableReferenceAt(text: string, offset: number, tree: jsonc.Node | undefined): VariableReference | null {
    const node = tree && jsonc.findNodeAtOffset(tree, offset, true);
    if (!node || node.type !== 'string') {
        return null;
    }
    const raw = text.substring(node.offset + 1, node.offset + node.length - 1);
    const cursor = offset - (node.offset + 1);
    const containing = (pattern: RegExp) => [...raw.matchAll(pattern)]
        .filter(match => match.index !== undefined && cursor >= match.index && cursor <= match.index + match[0].length)
        .sort((a, b) => a[0].length - b[0].length)[0];

    const localization = containing(/\[([a-zA-Z0-9._]+)\]/g);
    if (localization) {
        return { type: 'localization', expression: localization[1] };
    }
    const publicProperty = containing(/<([a-zA-Z0-9_]+)>/g);
    if (publicProperty) {
        return { type: 'public', expression: publicProperty[1] };
    }
    const variable = containing(/\{([a-zA-Z0-9._]+)\}/g) || containing(/\{([^}"]*\{[^}"]+\}[^}"]*)\}/g);
    return variable ? { type: 'variable', expression: variable[1] } : null;
}

/**
 * Short human readable name of a source for tooltips
 */
export function describeSource(source: VariableSource): string {
    switch (source.level) {
        case 'Block': return 'block Vars';
        case 'Public': return 'public property default';
        case 'Localization': return `${path.basename(source.fsPath)} Vars`;
        default: return `${path.basename(source.fsPath)} (${source.level.toLowerCase()})`;
    }
}
