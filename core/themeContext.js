const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { readJsonFile, describeParseError } = require('./json');
const { scanNameDirectory } = require('./names');

const THEME_MARKER = 'theme_description.json';
const GLOBAL_VARS = 'globals/global_vars.json';
const LOCALIZATIONS = 'localizations';

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInside(fsPath, root) {
    const relative = path.relative(root, fsPath);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Everything the providers need to know about one theme (the folder holding theme_description.json).
 * Data is read lazily from disk and cached until a file in the theme changes.
 */
class ThemeContext {
    /** @param {string} root */
    constructor(root) {
        this.root = root;
        this.rootUri = vscode.Uri.file(root);
        this._globalVars = undefined;
        this._localization = undefined;
        /** @type {Map<string, Map<string, import('./names').NameEntry>>} */
        this._nameIndexes = new Map();
    }

    get globalVarsPath() {
        return path.join(this.root, GLOBAL_VARS);
    }

    /** @param {string} fsPath */
    relativePath(fsPath) {
        return path.relative(this.root, fsPath).replace(/\\/g, '/');
    }

    /** @param {string} relativePath */
    uriFor(relativePath) {
        return vscode.Uri.joinPath(this.rootUri, relativePath);
    }

    /** @returns {Object} parsed globals/global_vars.json, {} when missing */
    getGlobalVars() {
        if (this._globalVars === undefined) {
            this._globalVars = this._loadGlobalVars();
        }
        return this._globalVars;
    }

    /** @returns {{ path: string, strings: Object } | null} the theme's default localization */
    getLocalization() {
        if (this._localization === undefined) {
            this._localization = this._loadLocalization();
        }
        return this._localization;
    }

    /**
     * Names defined in a theme directory, e.g. ('styles', 'StyleName').
     * @param {string} dirName
     * @param {string} property
     */
    getNameIndex(dirName, property) {
        const key = `${dirName}/${property}`;
        if (!this._nameIndexes.has(key)) {
            this._nameIndexes.set(key, scanNameDirectory(this.root, dirName, property));
        }
        return this._nameIndexes.get(key);
    }

    /**
     * Drop cached data affected by a change of `fsPath`.
     * @param {string} fsPath
     */
    invalidate(fsPath) {
        const relative = this.relativePath(fsPath);
        const topDir = relative.split('/')[0];

        if (relative === GLOBAL_VARS) {
            this._globalVars = undefined;
        }
        if (topDir === LOCALIZATIONS || relative === THEME_MARKER) {
            this._localization = undefined;
        }
        for (const key of this._nameIndexes.keys()) {
            if (key.startsWith(`${topDir}/`)) {
                this._nameIndexes.delete(key);
            }
        }
    }

    _loadGlobalVars() {
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

    _loadLocalization() {
        const dir = path.join(this.root, LOCALIZATIONS);
        let fileNames;
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

        let chosen = null;
        if (files.length === 1) {
            chosen = files[0];
        } else {
            const description = readJsonFile(path.join(this.root, THEME_MARKER));
            const defaultId = description && isPlainObject(description.value) ? description.value.DefaultLocalizationId : null;
            chosen = (defaultId && files.find(file => isPlainObject(file.value) && file.value.ID === defaultId))
                || files.find(file => file.name.toLowerCase() === 'english.json')
                || files[0];
        }

        const strings = isPlainObject(chosen.value) && isPlainObject(chosen.value.Strings) ? chosen.value.Strings : {};
        return { path: chosen.path, strings };
    }
}

/** @type {Map<string, ThemeContext>} theme root -> context */
const contexts = new Map();
/** @type {Map<string, string>} directory -> theme root */
const rootByDirectory = new Map();
const onDidChangeThemeEmitter = new vscode.EventEmitter();

/**
 * Theme root for a file: the closest parent directory containing theme_description.json.
 * Falls back to the workspace folder (or the file's directory) when there is none.
 * @param {string} fsPath
 */
function findThemeRoot(fsPath) {
    const startDir = path.dirname(fsPath);
    const cached = rootByDirectory.get(startDir);
    if (cached) {
        return cached;
    }

    let root = null;
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

/**
 * @param {vscode.TextDocument | vscode.Uri} documentOrUri
 * @returns {ThemeContext}
 */
function getThemeContext(documentOrUri) {
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
 * Watch theme JSON files and invalidate cached data when they change.
 * @param {vscode.ExtensionContext} extensionContext
 */
function registerThemeWatcher(extensionContext) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.json');

    const onChange = (uri) => {
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
    };

    watcher.onDidChange(onChange);
    watcher.onDidCreate(onChange);
    watcher.onDidDelete(onChange);

    extensionContext.subscriptions.push(watcher, onDidChangeThemeEmitter);
}

module.exports = {
    getThemeContext,
    registerThemeWatcher,
    /** Fires after a JSON file in the workspace changed and caches were invalidated */
    onDidChangeTheme: onDidChangeThemeEmitter.event
};
