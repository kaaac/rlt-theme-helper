import * as assert from 'assert';
import * as path from 'path';
import type * as vscode from 'vscode';
import { findDefinition } from '../src/providers/DefinitionProvider';
import { ReferenceHoverProvider } from '../src/providers/ReferenceHoverProvider';
import { NameCompletionProvider } from '../src/providers/NameCompletionProvider';
import { GlobalVarsInlayHintsProvider } from '../src/providers/GlobalVarsInlayHintsProvider';
import { Position, Range } from './mocks/vscode';
import { documentWithCursor, labels, SAMPLE_THEME, themeDocument } from './helpers';

/** Definition as "relative/path.json:line" (1-based line) */
function definition(relativePath: string, text: string): string | null {
    const { document, position } = documentWithCursor(relativePath, text);
    const target = findDefinition(document, position);
    return target ? `${path.relative(SAMPLE_THEME, target.fsPath).replace(/\\/g, '/')}:${target.line + 1}` : null;
}

describe('Go to definition', () => {
    it('finds styles in the theme, and the layout-level style first inside that layout', () => {
        assert.strictEqual(definition('layouts/results/new.json', '{ "Style": "Hea|der" }'), 'styles/common.json:2');
        assert.strictEqual(definition('layouts/driver_session/layer1.json', '{ "Style": "Hea|der" }'), 'layouts/driver_session/styles/header.json:2');
    });

    it('finds StyleBasedOn, path references, components and triggers', () => {
        assert.strictEqual(definition('styles/new.json', '{ "StyleName": "X", "StyleBasedOn": "Text|Base" }'), 'styles/text/base.json:2');
        assert.strictEqual(definition('layouts/results/new.json', '{ "Style": "/text/ba|se" }'), 'styles/text/base.json:1');
        assert.strictEqual(definition('layouts/results/new.json', '{ "Component": "Driver|Row" }'), 'components/driver_row.json:2');
        assert.strictEqual(definition('layouts/results/new.json', '{ "Trigger": "High|light" }'), 'triggers/highlight.json:2');
    });

    it('finds styles defined in enclosing blocks of the same file', () => {
        assert.strictEqual(definition('layouts/results/new.json',
            '{\n  "Styles": [ { "StyleName": "Inline" } ],\n  "Items": [ { "Style": "Inl|ine" } ]\n}'), 'layouts/results/new.json:2');
    });

    it('falls back to names differing only in letter case', () => {
        assert.strictEqual(definition('layouts/results/new.json', '{ "Style": "hea|der" }'), 'styles/common.json:2');
        assert.strictEqual(definition('layouts/results/new.json', '{ "Color": "{prim|ary}" }'), 'globals/global_vars.json:3');
    });

    it('returns nothing for unknown names and other properties', () => {
        assert.strictEqual(definition('layouts/results/new.json', '{ "Style": "Miss|ing" }'), null);
        assert.strictEqual(definition('layouts/results/new.json', '{ "Name": "Hea|der" }'), null);
    });

    it('finds variables in global_vars, vars/ folders and block Vars', () => {
        assert.strictEqual(definition('layouts/results/new.json', '{ "Color": "{Prim|ary}" }'), 'globals/global_vars.json:3');
        assert.strictEqual(definition('layouts/driver_session/layer1.json', '{ "Color": "{Prim|ary}" }'), 'layouts/driver_session/vars/session.json:2');
        assert.strictEqual(definition('layouts/results/new.json', '{ "Text": "{Theme|Var}" }'), 'vars/theme.json:2');
        assert.strictEqual(definition('layouts/results/new.json',
            '{\n  "Vars": { "Local": "x" },\n  "Items": [ { "Text": "{Lo|cal}" } ]\n}'), 'layouts/results/new.json:2');
    });

    it('finds public properties ({Name} and <Name>) and localization Vars', () => {
        assert.strictEqual(definition('layouts/results/new.json', '{ "RenderIf": "{Show|Winner}" }'), 'globals/public_properties.json:4');
        assert.strictEqual(definition('layouts/results/new.json', '{ "RenderIf": "<Show|Winner>" }'), 'globals/public_properties.json:4');
        assert.strictEqual(definition('layouts/results/new.json', '{ "Text": "{Loc|Var}" }'), 'localizations/polish.json:9');
    });

    it('finds nested variables and localization keys', () => {
        assert.strictEqual(definition('layouts/results/new.json', '{ "Color": "{Col|ors.{TeamName}}" }'), 'globals/global_vars.json:7');
        assert.strictEqual(definition('layouts/results/new.json', '{ "Color": "{Colors.{Team|Name}}" }'), 'globals/global_vars.json:5');
        assert.strictEqual(definition('layouts/results/new.json', '{ "Text": "[TIT|LE]" }'), 'localizations/polish.json:5');
    });
});

describe('Reference hover', () => {
    const hover = (relativePath: string, text: string) => {
        const { document, position } = documentWithCursor(relativePath, text);
        const result = new ReferenceHoverProvider().provideHover(document, position);
        return result ? (result.contents as unknown as { value: string }).value : null;
    };

    it('shows where a style is defined, its StyleBasedOn chain and definition', () => {
        const value = hover('layouts/results/new.json', '{ "Style": "Sm|all" }');
        assert.ok(value);
        assert.match(value, /\*\*Style\*\* `Small` · Theme/);
        assert.match(value, /\[styles\/common\.json:3\]\(file:\/\/\/.*#L3\)/);
        assert.match(value, /Based on: `Header` → `TextBase`/);
        assert.match(value, /"FontSize": 8/);
    });

    it('tells when a name is not found', () => {
        assert.match(hover('layouts/results/new.json', '{ "Component": "Miss|ing" }') ?? '', /not found/);
    });
});

describe('Resource lookup order', () => {
    const complete = (relativePath: string, text: string) => {
        const { document, position } = documentWithCursor(relativePath, text);
        return new NameCompletionProvider().provideCompletionItems(document, position) || [];
    };

    it('offers layer and layout resources only inside that layer / layout', () => {
        const inLayer = complete('layouts/driver_session/layer2-overlay/main.json', '{ "Style": "|" }');
        assert.strictEqual(inLayer.find(item => item.label === 'OverlayOnly')?.detail, 'Layer Style');
        assert.strictEqual(inLayer.find(item => item.label === 'Header')?.detail, 'Layout Style');

        const elsewhere = complete('layouts/results/new.json', '{ "Style": "|" }');
        assert.ok(!labels(elsewhere).includes('OverlayOnly'));
        assert.strictEqual(elsewhere.find(item => item.label === 'Header')?.detail, 'Theme Style');
    });

    it('offers inline definitions of enclosing blocks only', () => {
        const names = labels(complete('layouts/results/new.json',
            '{ "Styles": [ { "StyleName": "Outer" } ], "Items": [ { "Styles": [ { "StyleName": "Sibling" } ] }, { "Style": "|" } ] }'));
        assert.ok(names.includes('Outer'));
        assert.ok(!names.includes('Sibling'));
    });
});

describe('Variable scope in inlay hints', () => {
    const hintsIn = (relativePath: string, text: string) => {
        const document = themeDocument(relativePath, text);
        const range = new Range(new Position(0, 0), document.positionAt(text.length) as unknown as Position) as unknown as vscode.Range;
        return new GlobalVarsInlayHintsProvider().provideInlayHints(document, range).map(hint => hint.label);
    };

    it('resolves block Vars and vars/ folders before global_vars.json', () => {
        assert.deepStrictEqual(hintsIn('layouts/results/new.json', '{ "Vars": { "Local": "Hello" }, "Text": "{Local}" }'), ['= Hello']);
        assert.deepStrictEqual(hintsIn('layouts/driver_session/layer1.json', '{ "Color": "{Primary}" }'), ['🎨 #FF00FF00']);
        assert.deepStrictEqual(hintsIn('layouts/results/new.json', '{ "Color": "{Primary}" }'), ['🎨 #FF112233']);
        assert.deepStrictEqual(hintsIn('layouts/results/new.json', '{ "Vars": { "Primary": "#FF0000FF" }, "Color": "{Primary}" }'), ['🎨 #FF0000FF']);
        assert.deepStrictEqual(hintsIn('layouts/results/new.json', '{ "RenderIf": "{ShowWinner}", "Text": "{LocVar}" }'), ['= true', '= z lokalizacji']);
    });
});
