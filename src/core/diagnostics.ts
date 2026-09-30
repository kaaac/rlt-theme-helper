import type * as vscode from 'vscode';
import * as jsonc from 'jsonc-parser';
import { getThemeContext } from './themeContext';
import { parseJsonTree } from './json';
import { availableNames, REFERENCE_KINDS } from './resources';
import { DocumentVariables, findVariableSource } from './variableScope';

export interface ThemeProblem {
    /** Offset and length of the unknown name in the document */
    offset: number;
    length: number;
    message: string;
    code: 'unknown-style' | 'unknown-component' | 'unknown-trigger' | 'unknown-variable';
    /** Similar existing name, offered as a quick fix */
    suggestion?: string;
}

// Names that are data, not variables (expressions.md, data-objects.md)
const DATA_ROOTS = new Set([
    'Item', 'ParentItem', 'ItemIndex', 'ParentItemIndex', 'ColumnIndex',
    'LayoutInfo', 'Season', 'Session', 'Event', 'Standings', 'Events', 'Lineups', 'Statistics', 'DriverInfo',
    'Penalty', 'Penalties', 'DeepRatings', 'Teammates', 'TeamStandingsMultiseason', 'TeamStatistics',
    'TeamsStatistics', 'DriverStatistics', 'DriversStatistics', 'TrackStatistics', 'TracksStatistics'
]);

// In these properties `{X}` is a member of the collection items, not a variable
const MEMBER_PROPERTIES = /^(SortMember|OrderBy\d*|OrderByDescending\d*|FilterMember)$/;

// A single variable name in braces (no dots, converters or nested expressions)
const VARIABLE = /\{([A-Za-z_][A-Za-z0-9_ ]*)\}/g;

const CODES: Record<string, ThemeProblem['code']> = {
    StyleName: 'unknown-style',
    ComponentName: 'unknown-component',
    TriggerName: 'unknown-trigger'
};

/**
 * Unknown style / component / trigger names and variables in a theme document.
 * Conservative: anything that might be defined at runtime (component parameters, trigger-set variables,
 * names differing only in letter case) is not reported.
 */
export function findThemeProblems(document: vscode.TextDocument): ThemeProblem[] {
    const theme = getThemeContext(document);
    if (!theme.isTheme) {
        return [];
    }
    const text = document.getText();
    const tree = parseJsonTree(text);
    if (!tree) {
        return [];
    }

    const problems: ThemeProblem[] = [];
    const variables = new DocumentVariables(document, tree);
    let declared: Set<string> | undefined;

    const visit = (node: jsonc.Node): void => {
        if (node.type === 'property') {
            const [keyNode, valueNode] = node.children || [];
            if (valueNode?.type === 'string') {
                checkReference(keyNode.value, valueNode);
                if (!MEMBER_PROPERTIES.test(keyNode.value)) {
                    checkVariables(valueNode);
                }
            }
        } else if (node.type === 'string' && node.parent?.type === 'array') {
            checkVariables(node);
        }
        node.children?.forEach(visit);
    };

    const checkReference = (key: string, valueNode: jsonc.Node) => {
        const kind = REFERENCE_KINDS.find(candidate => candidate.key === key);
        const name = valueNode.value as string;
        if (!kind || !name || /[{<]/.test(name)) {
            return;
        }
        const names = availableNames(document, kind, valueNode.offset, tree);
        if (names.has(name) || hasCaseInsensitive(names.keys(), name)) {
            return;
        }
        problems.push({
            offset: valueNode.offset + 1,
            length: name.length,
            message: `${kind.label} '${name}' not found in the enclosing blocks, layer, layout or theme ${kind.folder}`,
            code: CODES[kind.property],
            suggestion: closest(name, names.keys())
        });
    };

    const checkVariables = (valueNode: jsonc.Node) => {
        const raw = text.substring(valueNode.offset + 1, valueNode.offset + valueNode.length - 1);
        for (const match of raw.matchAll(VARIABLE)) {
            const name = match[1];
            if (DATA_ROOTS.has(name) || match.index === undefined) {
                continue;
            }
            const offset = valueNode.offset + 1 + match.index + 1;
            const sources = variables.sourcesAt(offset);
            if (findVariableSource(sources, name)) {
                continue;
            }
            declared ??= theme.getDeclaredVariableNames();
            const known = [...Object.keys(variables.valuesAt(offset)), ...declared];
            if (declared.has(name) || hasCaseInsensitive(known, name)) {
                continue;
            }
            problems.push({
                offset,
                length: name.length,
                message: `Variable '${name}' is not defined (block Vars, public properties, localization Vars, vars/ folders or global_vars.json)`,
                code: 'unknown-variable',
                suggestion: closest(name, known)
            });
        }
    };

    visit(tree);
    return problems;
}

function hasCaseInsensitive(names: Iterable<string>, name: string): boolean {
    const lower = name.toLowerCase();
    for (const candidate of names) {
        if (candidate.toLowerCase() === lower) {
            return true;
        }
    }
    return false;
}

/**
 * Most similar name (edit distance 1-2, ignoring case), for "did you mean" quick fixes
 */
export function closest(name: string, candidates: Iterable<string>): string | undefined {
    let best: string | undefined;
    let bestDistance = 3;
    for (const candidate of candidates) {
        if (candidate === name || candidate.startsWith('/')) continue;
        const distance = editDistance(name.toLowerCase(), candidate.toLowerCase(), bestDistance);
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }
    return best;
}

function editDistance(a: string, b: string, limit: number): number {
    if (Math.abs(a.length - b.length) >= limit) {
        return limit;
    }
    let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previous = current;
    }
    return previous[b.length];
}
