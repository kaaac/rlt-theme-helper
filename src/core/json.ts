import * as fs from 'fs';
import * as jsonc from 'jsonc-parser';

const PARSE_OPTIONS: jsonc.ParseOptions = { allowTrailingComma: true, disallowComments: false };

export interface ParsedJson {
    value: unknown;
    errors: jsonc.ParseError[];
}

export interface JsonFile extends ParsedJson {
    text: string;
}

export type StringNode = jsonc.Node & { value: string };

/**
 * Error-tolerant JSON parse (comments, trailing commas, incomplete documents).
 * Always returns the best-effort value, never throws.
 */
export function parseJson(text: string): ParsedJson {
    const errors: jsonc.ParseError[] = [];
    const value: unknown = jsonc.parse(text, errors, PARSE_OPTIONS);
    return { value, errors };
}

/**
 * Error-tolerant syntax tree, used to find the JSON path at a cursor offset.
 */
export function parseJsonTree(text: string): jsonc.Node | undefined {
    return jsonc.parseTree(text, [], PARSE_OPTIONS);
}

/**
 * Object nodes that contain `offset`, nearest first. Works on incomplete documents.
 */
export function enclosingObjects(tree: jsonc.Node | undefined, offset: number): jsonc.Node[] {
    if (!tree) {
        return [];
    }
    let node = jsonc.findNodeAtOffset(tree, offset, true) || jsonc.findNodeAtOffset(tree, offset - 1, true);
    const objects: jsonc.Node[] = [];
    for (; node; node = node.parent) {
        if (node.type === 'object') {
            objects.push(node);
        }
    }
    return objects;
}

/**
 * String node at a property path inside an object node, e.g. ['TableOptions', 'ItemsSource'].
 */
export function stringNodeAt(objectNode: jsonc.Node, propertyPath: jsonc.JSONPath): StringNode | null {
    const node = jsonc.findNodeAtLocation(objectNode, propertyPath);
    return node && node.type === 'string' ? node as StringNode : null;
}

/**
 * Read and parse a JSON file from disk.
 * @returns null when the file is missing or unreadable
 */
export function readJsonFile(filePath: string): JsonFile | null {
    let text: string;
    try {
        text = fs.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
    return { ...parseJson(text), text };
}

/**
 * Human readable description of the first parse error.
 */
export function describeParseError(errors: jsonc.ParseError[], text: string): string {
    const error = errors[0];
    if (!error) return '';
    const line = text.substring(0, error.offset).split('\n').length;
    return `${jsonc.printParseErrorCode(error.error)} at line ${line}`;
}

export interface TextPosition {
    line: number;
    character: number;
}

/**
 * Line and character of an offset in a text
 */
export function positionAtOffset(text: string, offset: number): TextPosition {
    const before = text.substring(0, offset);
    const line = before.split('\n').length - 1;
    return { line, character: offset - (before.lastIndexOf('\n') + 1) };
}

/**
 * Position of the property at `jsonPath` (e.g. ['Colors', 'Red']) inside `root`, or null
 */
export function positionOfPath(text: string, jsonPath: jsonc.JSONPath, root: jsonc.Node | undefined = parseJsonTree(text)): TextPosition | null {
    const node = root && jsonc.findNodeAtLocation(root, jsonPath);
    // Point at the property key rather than its value
    const target = node?.parent?.type === 'property' ? node.parent : node;
    return target ? positionAtOffset(text, target.offset) : null;
}

/**
 * Key of `object` matching `key`: exact first, then ignoring letter case (the renderer resolves names case-insensitively
 * in practice — published themes reference e.g. "FIA_penalty_separator" defined as "fia_penalty_separator").
 */
export function findOwnKey(object: unknown, key: string): string | undefined {
    if (!isPlainObject(object)) {
        return undefined;
    }
    if (Object.prototype.hasOwnProperty.call(object, key)) {
        return key;
    }
    const lower = key.toLowerCase();
    return Object.keys(object).find(candidate => candidate.toLowerCase() === lower);
}

/**
 * Map entry matching `key`: exact first, then ignoring letter case
 */
export function getIgnoringCase<T>(map: Map<string, T>, key: string): T | undefined {
    const exact = map.get(key);
    if (exact !== undefined) {
        return exact;
    }
    const lower = key.toLowerCase();
    for (const [candidate, value] of map) {
        if (candidate.toLowerCase() === lower) {
            return value;
        }
    }
    return undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
