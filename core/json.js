const fs = require('fs');
const jsonc = require('jsonc-parser');

const PARSE_OPTIONS = { allowTrailingComma: true, disallowComments: false };

/**
 * Error-tolerant JSON parse (comments, trailing commas, incomplete documents).
 * Always returns the best-effort value, never throws.
 * @param {string} text
 * @returns {{ value: any, errors: jsonc.ParseError[] }}
 */
function parseJson(text) {
    const errors = [];
    const value = jsonc.parse(text, errors, PARSE_OPTIONS);
    return { value, errors };
}

/**
 * Error-tolerant syntax tree, used to find the JSON path at a cursor offset.
 * @param {string} text
 * @returns {jsonc.Node | undefined}
 */
function parseJsonTree(text) {
    return jsonc.parseTree(text, [], PARSE_OPTIONS);
}

/**
 * Object nodes that contain `offset`, nearest first. Works on incomplete documents.
 * @param {jsonc.Node | undefined} tree
 * @param {number} offset
 * @returns {jsonc.Node[]}
 */
function enclosingObjects(tree, offset) {
    if (!tree) {
        return [];
    }
    let node = jsonc.findNodeAtOffset(tree, offset, true) || jsonc.findNodeAtOffset(tree, offset - 1, true);
    const objects = [];
    for (; node; node = node.parent) {
        if (node.type === 'object') {
            objects.push(node);
        }
    }
    return objects;
}

/**
 * String node at a property path inside an object node, e.g. ['TableOptions', 'ItemsSource'].
 * @param {jsonc.Node} objectNode
 * @param {(string|number)[]} propertyPath
 * @returns {jsonc.Node|null} node with `value`, `offset` and `length`
 */
function stringNodeAt(objectNode, propertyPath) {
    const node = jsonc.findNodeAtLocation(objectNode, propertyPath);
    return node && node.type === 'string' ? node : null;
}

/**
 * Read and parse a JSON file from disk.
 * @param {string} filePath
 * @returns {{ value: any, errors: jsonc.ParseError[], text: string } | null} null when the file is missing or unreadable
 */
function readJsonFile(filePath) {
    let text;
    try {
        text = fs.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
    return { ...parseJson(text), text };
}

/**
 * Human readable description of the first parse error.
 * @param {jsonc.ParseError[]} errors
 * @param {string} text
 */
function describeParseError(errors, text) {
    const error = errors[0];
    if (!error) return '';
    const line = text.substring(0, error.offset).split('\n').length;
    return `${jsonc.printParseErrorCode(error.error)} at line ${line}`;
}

module.exports = {
    parseJson,
    parseJsonTree,
    enclosingObjects,
    stringNodeAt,
    readJsonFile,
    describeParseError
};
