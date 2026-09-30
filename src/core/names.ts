import * as fs from 'fs';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import { parseJsonTree, positionAtOffset } from './json';

export interface NameEntry {
    name: string;
    /** Where the name is defined: 'Local', 'Layer', 'Layout', 'Theme', optionally '... (Styles property)' or 'Path reference' */
    details: string;
    /** File path relative to the theme root */
    source: string;
    /** Absolute path of the defining file */
    fsPath: string;
    /** Position of the name value (for path references: start of the file) */
    line: number;
    character: number;
    definition?: unknown;
    isPath?: boolean;
}

export type NameIndex = Map<string, NameEntry>;

export interface FileInfo {
    fsPath: string;
    /** Path relative to the theme root */
    source: string;
    text: string;
}

function propertyValue(objectNode: jsonc.Node, key: string): jsonc.Node | undefined {
    const property = objectNode.children?.find(child => child.children?.[0]?.value === key);
    return property?.children?.[1];
}

/**
 * Collect every string value of `property` (e.g. StyleName, TriggerName, ComponentName) from a syntax tree.
 * For StyleName, styles defined inline in a `Styles` array are labelled separately.
 * The first occurrence of a name wins.
 */
export function collectNames(tree: jsonc.Node | undefined, property: string, file: FileInfo, scope: string, names: NameIndex): void {
    const add = (valueNode: jsonc.Node, details: string, definitionNode: jsonc.Node) => {
        const name = valueNode.value as string;
        if (!names.has(name)) {
            names.set(name, { name, details, source: file.source, fsPath: file.fsPath, ...positionAtOffset(file.text, valueNode.offset), definition: jsonc.getNodeValue(definitionNode) });
        }
    };

    const walk = (node: jsonc.Node | undefined, inlineStyles: boolean): void => {
        if (!node) return;
        if (node.type === 'object') {
            const nameNode = propertyValue(node, property);
            if (nameNode?.type === 'string') {
                add(nameNode, inlineStyles ? `${scope} (Styles property)` : scope, node);
            }
            for (const child of node.children || []) {
                const [key, value] = child.children || [];
                walk(value, key?.value === 'Styles' && property === 'StyleName');
            }
        } else if (node.type === 'array') {
            node.children?.forEach(child => walk(child, inlineStyles));
        }
    };

    walk(tree, false);
}

/**
 * Names defined in `Styles` / `Components` arrays of the blocks enclosing a position (nearest block first).
 */
export function collectEnclosingDefinitions(enclosing: jsonc.Node[], arrayKey: string, property: string, file: FileInfo, names: NameIndex): void {
    for (const objectNode of enclosing) {
        const definitions = propertyValue(objectNode, arrayKey);
        for (const item of definitions?.type === 'array' ? definitions.children || [] : []) {
            const nameNode = item.type === 'object' ? propertyValue(item, property) : undefined;
            if (nameNode?.type === 'string' && !names.has(nameNode.value)) {
                names.set(nameNode.value, {
                    name: nameNode.value, details: `Local (${arrayKey} property)`, source: file.source, fsPath: file.fsPath,
                    ...positionAtOffset(file.text, nameNode.offset), definition: jsonc.getNodeValue(item)
                });
            }
        }
    }
}

function readFileInfo(fsPath: string, themeRoot: string): FileInfo | null {
    try {
        return { fsPath, source: path.relative(themeRoot, fsPath).replace(/\\/g, '/'), text: fs.readFileSync(fsPath, 'utf8') };
    } catch {
        return null;
    }
}

/**
 * Index names defined in one JSON file (e.g. theme-level styles.json).
 */
export function scanNameFile(fsPath: string, themeRoot: string, property: string, scope: string): NameIndex {
    const names: NameIndex = new Map();
    const file = readFileInfo(fsPath, themeRoot);
    if (file) {
        collectNames(parseJsonTree(file.text), property, file, scope, names);
    }
    return names;
}

/**
 * Scan a resource directory (e.g. `<layout>/styles/`) recursively and index all names defined there.
 * Files that hold a single object can also be referenced by path (`/folder/file`, relative to the directory).
 * Unreadable files are skipped, they don't break the whole index.
 */
export function scanNameDirectory(baseDir: string, themeRoot: string, property: string, scope: string): NameIndex {
    const names: NameIndex = new Map();

    const scan = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scan(fullPath);
                continue;
            }
            if (!entry.isFile() || path.extname(entry.name) !== '.json') {
                continue;
            }
            const file = readFileInfo(fullPath, themeRoot);
            if (!file) {
                continue;
            }
            const tree = parseJsonTree(file.text);

            if (tree?.type === 'object') {
                const reference = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/').replace(/\.json$/, '');
                if (!names.has(reference)) {
                    names.set(reference, {
                        name: reference, details: `${scope} path reference`, source: file.source, fsPath: fullPath,
                        line: 0, character: 0, definition: jsonc.getNodeValue(tree), isPath: true
                    });
                }
            }

            collectNames(tree, property, file, scope, names);
        }
    };

    scan(baseDir);
    return names;
}
