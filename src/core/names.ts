import * as fs from 'fs';
import * as path from 'path';
import { readJsonFile, isPlainObject } from './json';

export interface NameEntry {
    name: string;
    /** 'Global', 'Local', '... (Styles property)' or 'Path reference' */
    details: string;
    /** File path relative to the theme root */
    source: string;
    definition?: Record<string, unknown>;
    isPath?: boolean;
}

export type NameIndex = Map<string, NameEntry>;

/**
 * Collect every string value of `property` (e.g. StyleName, TriggerName, ComponentName) from a parsed JSON value.
 * For StyleName, styles defined inline in a `Styles` array are labelled separately.
 * The first occurrence of a name wins.
 */
export function collectNames(json: unknown, property: string, source: string, scope: 'Global' | 'Local', names: NameIndex): void {
    const add = (name: string, details: string, definition: Record<string, unknown>) => {
        if (!names.has(name)) {
            names.set(name, { name, details, source, definition });
        }
    };

    const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (!isPlainObject(node)) {
            return;
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === property && typeof value === 'string') {
                add(value, scope, node);
            } else if (key === 'Styles' && property === 'StyleName' && Array.isArray(value)) {
                for (const style of value) {
                    if (isPlainObject(style) && typeof style[property] === 'string') {
                        add(style[property] as string, `${scope} (Styles property)`, style);
                    }
                }
                walk(value);
            } else {
                walk(value);
            }
        }
    };

    walk(json);
}

/**
 * Scan a theme directory (e.g. `styles/`) recursively and index all names defined there.
 * Files that hold a single object can also be referenced by path (`/folder/file`).
 * Unreadable files are skipped, they don't break the whole index.
 */
export function scanNameDirectory(themeRoot: string, dirName: string, property: string): NameIndex {
    const names: NameIndex = new Map();
    const baseDir = path.join(themeRoot, dirName);

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
            const file = readJsonFile(fullPath);
            if (!file) {
                continue;
            }
            const source = path.relative(themeRoot, fullPath).replace(/\\/g, '/');

            if (isPlainObject(file.value)) {
                const reference = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/').replace(/\.json$/, '');
                if (!names.has(reference)) {
                    names.set(reference, { name: reference, details: 'Path reference', source, isPath: true });
                }
            }

            collectNames(file.value, property, source, 'Global', names);
        }
    };

    scan(baseDir);
    return names;
}
