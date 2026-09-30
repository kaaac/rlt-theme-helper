import * as assert from 'assert';
import * as path from 'path';
import type * as vscode from 'vscode';
import { closest, findThemeProblems } from '../src/core/diagnostics';
import { SuggestionQuickFix } from '../src/providers/ThemeDiagnostics';
import { createDocument, Position, Range, Uri } from './mocks/vscode';
import { REPO_ROOT, themeDocument } from './helpers';

/** Problems as "code name -> suggestion" */
function problems(relativePath: string, text: string): string[] {
    const document = themeDocument(relativePath, text);
    return findThemeProblems(document).map(problem =>
        `${problem.code} ${document.getText().substr(problem.offset, problem.length)}${problem.suggestion ? ` -> ${problem.suggestion}` : ''}`);
}

describe('Theme diagnostics', () => {
    it('reports unknown style, component and trigger names with a suggestion', () => {
        assert.deepStrictEqual(problems('layouts/results/new.json',
            '{ "Items": [ { "Style": "Heade" }, { "Component": "DriverRo" }, { "Trigger": "Highlght" }, { "Style": "Nothing" } ] }'),
            ['unknown-style Heade -> Header', 'unknown-component DriverRo -> DriverRow', 'unknown-trigger Highlght -> Highlight', 'unknown-style Nothing']);
    });

    it('accepts names defined at any level, in enclosing blocks, by path or differing only in letter case', () => {
        assert.deepStrictEqual(problems('layouts/driver_session/layer2-overlay/main.json',
            '{ "Styles": [ { "StyleName": "Inline" } ], "Items": [ { "Style": "Inline" }, { "Style": "OverlayOnly" }, { "Style": "/text/base" }, { "Style": "header" }, { "StyleBasedOn": "TextBase" } ] }'),
            []);
    });

    it('skips references that are expressions', () => {
        assert.deepStrictEqual(problems('layouts/results/new.json', '{ "Style": "<RowStyle>", "Component": "{ComponentName}" }'), ['unknown-variable ComponentName']);
    });

    it('reports unknown variables with a suggestion', () => {
        assert.deepStrictEqual(problems('layouts/results/new.json', '{ "Color": "{Primry}", "Text": "{Nope} and {Website}" }'),
            ['unknown-variable Primry -> Primary', 'unknown-variable Nope']);
    });

    it('accepts variables from every level, component parameters, public properties without a default, data roots and case variants', () => {
        assert.deepStrictEqual(problems('layouts/results/new.json', JSON.stringify({
            Vars: { Local: 1 },
            Items: [{
                Text: '{Local} {ThemeVar} {ShowWinner} {NoDefault} {LocVar} {RowParam} {ItemIndex} {primary}',
                Color: '{Colors.{TeamName}}'
            }]
        })), []);
    });

    it('skips members in sort and filter properties', () => {
        assert.deepStrictEqual(problems('layouts/results/new.json',
            '{ "ItemStackOptions": { "SortMember": "{Points}", "OrderBy": "{Position}", "OrderByDescending2": "{Wins}", "FilterMember": "{IsReserve}" } }'), []);
    });

    it('ignores JSON files outside a theme', () => {
        const document = createDocument(path.join(REPO_ROOT, 'test', 'not-a-theme.json'), '{ "Style": "Unknown", "Text": "{Nope}" }');
        assert.deepStrictEqual(findThemeProblems(document as unknown as vscode.TextDocument), []);
    });

    it('suggests the closest name within two edits, ignoring case and path references', () => {
        assert.strictEqual(closest('DarkBleu', ['DarkBlue', 'LightBlue']), 'DarkBlue');
        assert.strictEqual(closest('Something', ['Other']), undefined);
        assert.strictEqual(closest('text', ['/text']), undefined);
    });
});

describe('Suggestion quick fix', () => {
    it('replaces the unknown name with the suggestion', () => {
        const document = themeDocument('layouts/results/new.json', '{ "Style": "Heade" }');
        const range = new Range(new Position(0, 12), new Position(0, 17));
        const diagnostic = { source: 'RLT', message: "Style 'Heade' not found. Did you mean 'Header'?", range };
        const actions = new SuggestionQuickFix().provideCodeActions(document, range as unknown as vscode.Range,
            { diagnostics: [diagnostic] } as unknown as vscode.CodeActionContext);
        assert.strictEqual(actions.length, 1);
        assert.strictEqual(actions[0].title, "Change to 'Header'");
        const edit = actions[0].edit as unknown as { replacements: { uri: Uri, text: string }[] };
        assert.strictEqual(edit.replacements[0].text, 'Header');
    });
});
