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

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
