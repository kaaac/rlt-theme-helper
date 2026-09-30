import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as jsonc from 'jsonc-parser';
import { readJsonFile, describeParseError, isPlainObject, parseJsonTree } from './json';
import { scanNameDirectory, scanNameFile, NameIndex } from './names';

const THEME_MARKER = 'theme_description.json';
const GLOBAL_VARS = 'globals/global_vars.json';
const LOCALIZATIONS = 'localizations';
const PUBLIC_PROPERTIES = 'globals/public_properties.json';

export interface Localization {
    path: string;
    strings: Record<string, unknown>;
    vars: Record<string, unknown>;
}

export interface VariableFile {
    fsPath: string;
    values: Record<string, unknown>;
}

function isInside(fsPath: string, root: string): boolean {
    const relative = path.relative(root, fsPath);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Everything the providers need to know about one theme (the folder holding theme_description.json).
 * Data is read lazily from disk and cached until a file in the theme changes.
 */
export class ThemeContext {
    readonly rootUri: vscode.Uri;
    private globalVars: Record<string, unknown> | undefined;
    private localization: Localization | null | undefined;
    /** Cached indexes of resource directories/files, invalidated when a file inside `location` changes */
    private readonly resourceCache = new Map<string, { location: string, value: unknown }>();

    constructor(readonly root: string) {
        this.rootUri = vscode.Uri.file(root);
    }

    get globalVarsPath(): string {
        return path.join(this.root, GLOBAL_VARS);
    }

    relativePath(fsPath: string): string {
        return path.relative(this.root, fsPath).replace(/\\/g, '/');
    }

    uriFor(relativePath: string): vscode.Uri {
        return vscode.Uri.joinPath(this.rootUri, relativePath);
    }

    /** Parsed globals/global_vars.json, {} when missing */
    getGlobalVars(): Record<string, unknown> {
        if (this.globalVars === undefined) {
            this.globalVars = this.loadGlobalVars();
        }
        return this.globalVars;
    }

    /** The theme's default localization */
    getLocalization(): Localization | null {
        if (this.localization === undefined) {
            this.localization = this.loadLocalization();
        }
        return this.localization;
    }

    /**
     * Names defined in a resource directory (e.g. `<layout>/styles`) or a single file (theme-level `styles.json`)
     * @param location absolute directory or .json file path
     * @param property defining property, e.g. 'StyleName'
     * @param scope label of the resource level, e.g. 'Theme'
     */
    getNameIndex(location: string, property: string, scope: string): NameIndex {
        return this.cached(location, `names|${property}|${scope}`, () => location.endsWith('.json')
            ? scanNameFile(location, this.root, property, scope)
            : scanNameDirectory(location, this.root, property, scope));
    }

    /** True when the root is a real theme (has theme_description.json), not a fallback folder */
    get isTheme(): boolean {
        return fs.existsSync(path.join(this.root, THEME_MARKER));
    }

    /**
     * Variable names declared where their value can't be resolved statically:
     * keys of any `Vars` / `ComponentOptions.Vars` object (component parameters passed at usage)
     * and variables set by triggers (`Var` / `ComponentVar`), across the whole theme.
     */
    getDeclaredVariableNames(): Set<string> {
        return this.cached(this.root, 'declared-vars', () => {
            const names = new Set<string>();
            const visit = (node: jsonc.Node | undefined): void => {
                if (!node) return;
                if (node.type === 'property') {
                    const [key, value] = node.children || [];
                    if (key?.value === 'Vars' && value?.type === 'object') {
                        for (const property of value.children || []) {
                            names.add(property.children?.[0]?.value);
                        }
                    } else if ((key?.value === 'Var' || key?.value === 'ComponentVar') && value?.type === 'string') {
                        names.add(value.value);
                    }
                }
                node.children?.forEach(visit);
            };
            const scan = (dir: string) => {
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
                    } else if (entry.name.endsWith('.json')) {
                        const file = readJsonFile(fullPath);
                        if (file) {
                            visit(parseJsonTree(file.text));
                        }
                    }
                }
            };
            scan(this.root);
            return names;
        });
    }

    /** Variable files in a `vars` directory (any subfolder, root object of key-value pairs) */
    getVariableFiles(dir: string): VariableFile[] {
        return this.cached(dir, 'vars', () => {
            const files: VariableFile[] = [];
            const scan = (current: string) => {
                let entries: fs.Dirent[];
                try {
                    entries = fs.readdirSync(current, { withFileTypes: true });
                } catch {
                    return;
                }
                for (const entry of entries) {
                    const fullPath = path.join(current, entry.name);
                    if (entry.isDirectory()) {
                        scan(fullPath);
                    } else if (entry.name.endsWith('.json')) {
                        const file = readJsonFile(fullPath);
                        if (file && isPlainObject(file.value)) {
                            files.push({ fsPath: fullPath, values: file.value });
                        }
                    }
                }
            };
            scan(dir);
            return files;
        });
    }

    /** Drop cached data affected by a change of `fsPath` */
    invalidate(fsPath: string): void {
        const relative = this.relativePath(fsPath);
        const topDir = relative.split('/')[0];

        if (relative === GLOBAL_VARS) {
            this.globalVars = undefined;
        }
        if (topDir === LOCALIZATIONS || relative === THEME_MARKER) {
            this.localization = undefined;
        }
        for (const [key, entry] of this.resourceCache) {
            if (fsPath === entry.location || isInside(fsPath, entry.location)) {
                this.resourceCache.delete(key);
            }
        }
    }

    private cached<T>(location: string, kind: string, load: () => T): T {
        const key = `${kind}|${location}`;
        let entry = this.resourceCache.get(key);
        if (!entry) {
            entry = { location, value: load() };
            this.resourceCache.set(key, entry);
        }
        return entry.value as T;
    }

    private loadGlobalVars(): Record<string, unknown> {
        const file = readJsonFile(this.globalVarsPath);
        if (!file) {
            return {};
        }
        if (file.errors.length > 0) {
            const filePath = this.globalVarsPath;
            vscode.window.showErrorMessage(
                `global_vars.json has syntax errors (${describeParseError(file.errors, file.text)}). Variable hints may be incomplete.`,
                'Open File'
            ).then(selection => {
                if (selection === 'Open File') {
                    vscode.window.showTextDocument(vscode.Uri.file(filePath));
                }
            });
        }
        return isPlainObject(file.value) ? file.value : {};
    }

    private loadLocalization(): Localization | null {
        const dir = path.join(this.root, LOCALIZATIONS);
        let fileNames: string[];
        try {
            fileNames = fs.readdirSync(dir).filter(name => name.endsWith('.json'));
        } catch {
            return null;
        }
        if (fileNames.length === 0) {
            return null;
        }

        const files = fileNames.map(name => {
            const filePath = path.join(dir, name);
            const file = readJsonFile(filePath);
            return { name, path: filePath, value: file ? file.value : null };
        });

        let chosen = files[0];
        if (files.length > 1) {
            const description = readJsonFile(path.join(this.root, THEME_MARKER));
            const defaultId = description && isPlainObject(description.value) ? description.value.DefaultLocalizationId : null;
            const byId = typeof defaultId === 'string'
                ? files.find(file => isPlainObject(file.value) && file.value.Id === defaultId)
                : undefined;
            chosen = byId
                || files.find(file => file.name.toLowerCase() === 'english.json')
                || files[0];
        }

        const strings = isPlainObject(chosen.value) && isPlainObject(chosen.value.Strings) ? chosen.value.Strings : {};
        const vars = isPlainObject(chosen.value) && isPlainObject(chosen.value.Vars) ? chosen.value.Vars : {};
        return { path: chosen.path, strings, vars };
    }

    get publicPropertiesPath(): string {
        return path.join(this.root, PUBLIC_PROPERTIES);
    }

    /**
     * Public properties (globals/public_properties.json) by name, with their default value
     * (null when the property has no DefaultValue — it's still a defined variable)
     */
    getPublicPropertyDefaults(): Record<string, unknown> {
        return this.cached(this.publicPropertiesPath, 'public', () => {
            const file = readJsonFile(this.publicPropertiesPath);
            const properties = file && isPlainObject(file.value) && Array.isArray(file.value.Properties) ? file.value.Properties : [];
            const defaults: Record<string, unknown> = {};
            for (const property of properties) {
                if (isPlainObject(property) && typeof property.Name === 'string') {
                    defaults[property.Name] = 'DefaultValue' in property ? property.DefaultValue : null;
                }
            }
            return defaults;
        });
    }
}

/** theme root -> context */
const contexts = new Map<string, ThemeContext>();
/** directory -> theme root */
const rootByDirectory = new Map<string, string>();
const onDidChangeThemeEmitter = new vscode.EventEmitter<vscode.Uri>();

/** Fires after a JSON file in the workspace changed and caches were invalidated */
export const onDidChangeTheme = onDidChangeThemeEmitter.event;

/**
 * Theme root for a file: the closest parent directory containing theme_description.json.
 * Falls back to the workspace folder (or the file's directory) when there is none.
 */
export function findThemeRoot(fsPath: string): string {
    const startDir = path.dirname(fsPath);
    const cached = rootByDirectory.get(startDir);
    if (cached) {
        return cached;
    }

    let root: string | null = null;
    for (let dir = startDir; ; dir = path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, THEME_MARKER))) {
            root = dir;
            break;
        }
        if (path.dirname(dir) === dir) {
            break;
        }
    }
    if (!root) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
        root = workspaceFolder ? workspaceFolder.uri.fsPath : startDir;
    }

    rootByDirectory.set(startDir, root);
    return root;
}

export function getThemeContext(documentOrUri: vscode.TextDocument | vscode.Uri): ThemeContext {
    const uri = documentOrUri instanceof vscode.Uri ? documentOrUri : documentOrUri.uri;
    const root = findThemeRoot(uri.fsPath);
    let context = contexts.get(root);
    if (!context) {
        context = new ThemeContext(root);
        contexts.set(root, context);
    }
    return context;
}

/**
 * Invalidate cached data after `uri` changed on disk.
 */
export function handleFileChange(uri: vscode.Uri): void {
    if (path.basename(uri.fsPath) === THEME_MARKER) {
        // A theme appeared or disappeared, theme roots may be different now
        rootByDirectory.clear();
    }
    for (const context of contexts.values()) {
        if (isInside(uri.fsPath, context.root)) {
            context.invalidate(uri.fsPath);
        }
    }
    onDidChangeThemeEmitter.fire(uri);
}

/**
 * Watch theme JSON files and invalidate cached data when they change.
 */
export function registerThemeWatcher(extensionContext: vscode.ExtensionContext): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.json');
    watcher.onDidChange(handleFileChange);
    watcher.onDidCreate(handleFileChange);
    watcher.onDidDelete(handleFileChange);
    extensionContext.subscriptions.push(watcher, onDidChangeThemeEmitter);
}
