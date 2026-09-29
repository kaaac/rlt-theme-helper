const fs = require('fs');
const path = require('path');
const { readJsonFile } = require('./json');

/**
 * @typedef {Object} NameEntry
 * @property {string} name
 * @property {string} details   'Global', 'Local', '... (Styles property)' or 'Path reference'
 * @property {string} source    file path relative to the theme root
 * @property {Object} [definition]
 * @property {boolean} [isPath]
 */

/**
 * Collect every string value of `property` (e.g. StyleName, TriggerName, ComponentName) from a parsed JSON value.
 * For StyleName, styles defined inline in a `Styles` array are labelled separately.
 * The first occurrence of a name wins.
 * @param {any} json
 * @param {string} property
 * @param {string} source
 * @param {string} scope 'Global' or 'Local'
 * @param {Map<string, NameEntry>} names
 */
function collectNames(json, property, source, scope, names) {
    const add = (name, details, definition) => {
        if (!names.has(name)) {
            names.set(name, { name, details, source, definition });
        }
    };

    const walk = (node) => {
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (typeof node !== 'object' || node === null) {
            return;
        }
        for (const key in node) {
            const value = node[key];
            if (key === property && typeof value === 'string') {
                add(value, scope, node);
            } else if (key === 'Styles' && property === 'StyleName' && Array.isArray(value)) {
                for (const style of value) {
                    if (style && typeof style[property] === 'string') {
                        add(style[property], `${scope} (Styles property)`, style);
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
 * @param {string} themeRoot
 * @param {string} dirName
 * @param {string} property
 * @returns {Map<string, NameEntry>}
 */
function scanNameDirectory(themeRoot, dirName, property) {
    const names = new Map();
    const baseDir = path.join(themeRoot, dirName);

    const scan = (dir) => {
        let entries;
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

            if (file.value && typeof file.value === 'object' && !Array.isArray(file.value)) {
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

module.exports = {
    collectNames,
    scanNameDirectory
};
