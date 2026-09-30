import { Localization } from './themeContext';
import { findOwnKey } from './json';

const NESTED_VARIABLE = /\{([a-zA-Z0-9._]+)\}/g;
const MAX_NESTING = 10;

/**
 * Look up a primitive value by key: first as a flat key ("Theme.Background"), then as a dot path.
 * Keys match ignoring letter case when there is no exact match. Objects are not values, they return null.
 */
function lookupValue(source: unknown, key: string): string | null {
    if (!source || typeof source !== 'object') {
        return null;
    }

    let value: unknown;
    const flatKey = findOwnKey(source, key);
    if (flatKey !== undefined) {
        value = (source as Record<string, unknown>)[flatKey];
    } else {
        value = source;
        for (const part of key.split('.')) {
            const partKey = findOwnKey(value, part);
            if (partKey === undefined) {
                return null;
            }
            value = (value as Record<string, unknown>)[partKey];
        }
    }

    if (value === null || value === undefined || typeof value === 'object') {
        return null;
    }
    return String(value);
}

/**
 * Resolve a global variable expression (the text between the outer braces),
 * including nested references like `{Colors.{Team}}`.
 */
export function resolveGlobalVariable(expression: string, globalVars: Record<string, unknown>): string | null {
    return lookupValue(globalVars, variableKey(expression, globalVars));
}

/**
 * Variable name an expression refers to after substituting nested references:
 * `Colors.{Team}` with Team = "Red" -> "Colors.Red"
 */
export function variableKey(expression: string, variables: Record<string, unknown>): string {
    let resolved = stripOuterBraces(expression);
    const pattern = new RegExp(NESTED_VARIABLE.source, 'g');
    let match: RegExpExecArray | null;
    let iterations = 0;

    while ((match = pattern.exec(resolved)) !== null && iterations < MAX_NESTING) {
        const nestedValue = lookupValue(variables, match[1]);
        if (nestedValue !== null) {
            resolved = resolved.replace(match[0], nestedValue);
            pattern.lastIndex = 0;
        }
        iterations++;
    }

    return resolved;
}

/**
 * "{Primary}" -> "Primary", but "Colors.{Team}" and "{A}.{B}" stay as they are.
 */
function stripOuterBraces(expression: string): string {
    if (!expression.startsWith('{') || !expression.endsWith('}')) {
        return expression;
    }
    const inner = expression.slice(1, -1);
    let depth = 0;
    for (const char of inner) {
        depth += char === '{' ? 1 : char === '}' ? -1 : 0;
        if (depth < 0) {
            return expression;
        }
    }
    return depth === 0 ? inner : expression;
}

/**
 * Resolve a `[Key]` localization reference against the theme's default localization.
 */
export function resolveLocalizationKey(key: string, localization: Localization | null): string | null {
    return localization ? lookupValue(localization.strings, key) : null;
}
