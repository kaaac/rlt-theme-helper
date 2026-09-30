import { Localization } from './themeContext';

const NESTED_VARIABLE = /\{([a-zA-Z0-9._]+)\}/g;
const MAX_NESTING = 10;

function hasOwn(object: object, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Look up a primitive value by key: first as a flat key ("Theme.Background"), then as a dot path.
 * Objects are not values, they return null.
 */
function lookupValue(source: unknown, key: string): string | null {
    if (!source || typeof source !== 'object') {
        return null;
    }

    let value: unknown;
    if (hasOwn(source, key)) {
        value = (source as Record<string, unknown>)[key];
    } else {
        value = source;
        for (const part of key.split('.')) {
            if (value && typeof value === 'object' && hasOwn(value, part)) {
                value = (value as Record<string, unknown>)[part];
            } else {
                return null;
            }
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
