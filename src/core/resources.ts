import type * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import { getThemeContext, ThemeContext } from './themeContext';
import { enclosingObjects, getIgnoringCase, parseJsonTree } from './json';
import { collectEnclosingDefinitions, collectNames, FileInfo, NameEntry, NameIndex } from './names';

export type ResourceLevel = 'Layer' | 'Layout' | 'Theme';

export interface ReferenceKind {
    /** Referencing property, e.g. "Style" */
    key: string;
    /** Defining property, e.g. "StyleName" */
    property: string;
    /** Resource folder name at theme / layout / layer level */
    folder: string;
    label: string;
    /** Block property holding inline definitions, e.g. "Styles" */
    inlineArray?: string;
}

const STYLE: Omit<ReferenceKind, 'key'> = { property: 'StyleName', folder: 'styles', label: 'Style', inlineArray: 'Styles' };

/**
 * Properties that reference a named theme resource (styles.md, components.md, triggers.md)
 */
export const REFERENCE_KINDS: ReferenceKind[] = [
    { key: 'Style', ...STYLE },
    { key: 'StyleBasedOn', ...STYLE },
    { key: 'Component', property: 'ComponentName', folder: 'components', label: 'Component', inlineArray: 'Components' },
    { key: 'Trigger', property: 'TriggerName', folder: 'triggers', label: 'Trigger' }
];

export interface Reference {
    kind: ReferenceKind;
    name: string;
    /** Offset and length of the string value node (with quotes) */
    offset: number;
    length: number;
}

/**
 * Resource levels of a file, nearest first: layer folder (layouts/<layout>/layer...), layout folder, theme root.
 */
export function resourceLevels(theme: ThemeContext, fsPath: string): { level: ResourceLevel, dir: string }[] {
    const parts = theme.relativePath(fsPath).split('/');
    const levels: { level: ResourceLevel, dir: string }[] = [];
    if (parts[0] === 'layouts' && parts.length >= 3) {
        const layoutDir = path.join(theme.root, 'layouts', parts[1]);
        if (parts.length >= 4 && /^layer/i.test(parts[2])) {
            levels.push({ level: 'Layer', dir: path.join(layoutDir, parts[2]) });
        }
        levels.push({ level: 'Layout', dir: layoutDir });
    }
    levels.push({ level: 'Theme', dir: theme.root });
    return levels;
}

/**
 * Child directory by name, ignoring letter case (docs use both "triggers" and "Triggers")
 */
export function findChildDirectory(parent: string, name: string): string | null {
    try {
        const entry = fs.readdirSync(parent, { withFileTypes: true })
            .find(child => child.isDirectory() && child.name.toLowerCase() === name.toLowerCase());
        return entry ? path.join(parent, entry.name) : null;
    } catch {
        return null;
    }
}

/**
 * All names of a resource kind available at `offset` of the document, in the renderer's lookup order
 * (the first entry of a name wins): enclosing blocks → layer → layout → theme.
 */
export function availableNames(document: vscode.TextDocument, kind: ReferenceKind, offset: number, tree = parseJsonTree(document.getText())): NameIndex {
    const theme = getThemeContext(document);
    const names: NameIndex = new Map();
    const file: FileInfo = { fsPath: document.uri.fsPath, source: theme.relativePath(document.uri.fsPath), text: document.getText() };

    if (kind.inlineArray) {
        collectEnclosingDefinitions(enclosingObjects(tree, offset), kind.inlineArray, kind.property, file, names);
    } else {
        collectNames(tree, kind.property, file, 'Local', names);
    }

    const addAll = (index: NameIndex) => {
        for (const [name, entry] of index) {
            if (!names.has(name)) {
                names.set(name, entry);
            }
        }
    };

    for (const { level, dir } of resourceLevels(theme, document.uri.fsPath)) {
        const folder = findChildDirectory(dir, kind.folder);
        if (folder) {
            addAll(theme.getNameIndex(folder, kind.property, level));
        }
        // Theme-level styles can also live in a single styles.json
        const singleFile = path.join(dir, `${kind.folder}.json`);
        if (level === 'Theme' && fs.existsSync(singleFile)) {
            addAll(theme.getNameIndex(singleFile, kind.property, level));
        }
    }

    return names;
}

/**
 * Resource reference (Style, StyleBasedOn, Component, Trigger value) at the offset, if any
 */
export function referenceAt(text: string, offset: number, tree = parseJsonTree(text)): Reference | null {
    const node = tree && jsonc.findNodeAtOffset(tree, offset, true);
    const property = node?.parent;
    if (!node || node.type !== 'string' || property?.type !== 'property' || property.children?.[1] !== node) {
        return null;
    }
    const kind = REFERENCE_KINDS.find(candidate => candidate.key === property.children?.[0]?.value);
    return kind ? { kind, name: node.value, offset: node.offset, length: node.length } : null;
}

/**
 * Definition of a referenced name, following the renderer's lookup order
 */
export function resolveReference(document: vscode.TextDocument, reference: Reference, tree = parseJsonTree(document.getText())): NameEntry | null {
    return getIgnoringCase(availableNames(document, reference.kind, reference.offset, tree), reference.name) ?? null;
}
