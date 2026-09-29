const NESTED_VARIABLE = /\{([a-zA-Z0-9._]+)\}/g;
const MAX_NESTING = 10;

/**
 * Look up a primitive value by key: first as a flat key ("Theme.Background"), then as a dot path.
 * Objects are not values, they return null.
 * @param {Object} source
 * @param {string} key
 * @returns {string|null}
 */
function lookupValue(source, key) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    let value;
    if (Object.prototype.hasOwnProperty.call(source, key)) {
        value = source[key];
    } else {
        value = source;
        for (const part of key.split('.')) {
            if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, part)) {
                value = value[part];
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
 * @param {string} expression
 * @param {Object} globalVars
 * @returns {string|null}
 */
function resolveGlobalVariable(expression, globalVars) {
    let resolved = expression.replace(/^\{|\}$/g, '');
    const pattern = new RegExp(NESTED_VARIABLE.source, 'g');
    let match;
    let iterations = 0;

    while ((match = pattern.exec(resolved)) !== null && iterations < MAX_NESTING) {
        const nestedValue = lookupValue(globalVars, match[1]);
        if (nestedValue !== null) {
            resolved = resolved.replace(match[0], nestedValue);
            pattern.lastIndex = 0;
        }
        iterations++;
    }

    return lookupValue(globalVars, resolved);
}

/**
 * Resolve a `[Key]` localization reference against the theme's default localization.
 * @param {string} key
 * @param {{ strings: Object } | null} localization
 * @returns {string|null}
 */
function resolveLocalizationKey(key, localization) {
    return localization ? lookupValue(localization.strings, key) : null;
}

module.exports = {
    resolveGlobalVariable,
    resolveLocalizationKey
};
