import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readJsonFile, describeParseError, isPlainObject } from './json';
import { scanNameDirectory, NameIndex } from './names';

const THEME_MARKER = 'theme_description.json';
const GLOBAL_VARS = 'globals/global_vars.json';
const LOCALIZATIONS = 'localizations';

export interface Localization {
    path: string;
    strings: Record<string, unknown>;
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
    private readonly nameIndexes = new Map<string, NameIndex>();

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

    /** Names defined in a theme directory, e.g. ('styles', 'StyleName') */
    getNameIndex(dirName: string, property: string): NameIndex {
        const key = `${dirName}/${property}`;
        let index = this.nameIndexes.get(key);
        if (!index) {
            index = scanNameDirectory(this.root, dirName, property);
            this.nameIndexes.set(key, index);
        }
        return index;
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
        for (const key of this.nameIndexes.keys()) {
            if (key.startsWith(`${topDir}/`)) {
                this.nameIndexes.delete(key);
            }
        }
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
        return { path: chosen.path, strings };
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
