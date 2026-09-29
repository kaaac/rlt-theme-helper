import * as assert from 'assert';
import * as path from 'path';
import { parseJson, parseJsonTree, enclosingObjects, stringNodeAt, readJsonFile, describeParseError } from '../src/core/json';
import { collectNames, scanNameDirectory, NameIndex } from '../src/core/names';
import { resolveGlobalVariable, resolveLocalizationKey } from '../src/core/variables';
import { isColorValue, isLayoutName, parseColorValue, parseHexDigits, parseRgb } from '../src/core/colors';
import { findThemeRoot, getThemeContext, handleFileChange } from '../src/core/themeContext';

import { SAMPLE_THEME, themeUri } from './helpers';

describe('core/json', () => {
    it('parses comments, trailing commas and // inside strings', () => {
        const { value } = parseJson('{\n  // comment\n  "Url": "http://example.com",\n  "A": 1,\n}');
        assert.deepStrictEqual(value, { Url: 'http://example.com', A: 1 });
    });

    it('returns a best-effort value for incomplete documents', () => {
        const { value, errors } = parseJson('{ "ComponentName": "Row", "Items": [ { "Text": "{Item.');
        assert.strictEqual((value as Record<string, unknown>).ComponentName, 'Row');
        assert.ok(errors.length > 0);
    });

    it('finds enclosing objects nearest first, in an incomplete document', () => {
        const text = '{ "TableOptions": { "ItemsSource": "{Session.Drivers}" }, "Items": [ { "TableOptions": { "ItemsSource": "{Item.Stints}" }, "Items": [ { "Text": "{Item.';
        const objects = enclosingObjects(parseJsonTree(text), text.length);
        const sources = objects.map(node => stringNodeAt(node, ['TableOptions', 'ItemsSource'])?.value ?? null);
        assert.deepStrictEqual(sources, [null, '{Item.Stints}', '{Session.Drivers}']);
    });

    it('reads files and describes syntax errors', () => {
        assert.strictEqual(readJsonFile(path.join(SAMPLE_THEME, 'missing.json')), null);
        const broken = readJsonFile(path.join(SAMPLE_THEME, 'styles', 'broken.json'));
        assert.ok(broken && broken.errors.length > 0);
        assert.match(describeParseError(broken.errors, broken.text), /at line \d+/);
    });
});

describe('core/names', () => {
    it('collects names, inline styles labelled separately, first occurrence wins', () => {
        const names: NameIndex = new Map();
        const json = {
            StyleName: 'Outer',
            Styles: [{ StyleName: 'Inline' }],
            Items: [{ StyleName: 'Outer' }, { StyleName: 'Nested' }]
        };
        collectNames(json, 'StyleName', 'file.json', 'Local', names);
        assert.deepStrictEqual([...names.keys()], ['Outer', 'Inline', 'Nested']);
        assert.strictEqual(names.get('Inline')?.details, 'Local (Styles property)');
    });

    it('does not mix component names into style names', () => {
        const names: NameIndex = new Map();
        collectNames({ Components: [{ ComponentName: 'Row', StyleName: 'RowStyle' }] }, 'StyleName', 'f.json', 'Local', names);
        assert.deepStrictEqual([...names.keys()], ['RowStyle']);
    });

    it('scans a theme directory, adds path references and survives a broken file', () => {
        const names = scanNameDirectory(SAMPLE_THEME, 'styles', 'StyleName');
        for (const expected of ['TextBase', 'Header', 'Small', '/text/base']) {
            assert.ok(names.has(expected), `missing ${expected}`);
        }
        assert.strictEqual(names.get('/text/base')?.isPath, true);
        assert.strictEqual(names.get('Header')?.source, 'styles/common.json');
        // Array files can't be referenced by path
        assert.ok(!names.has('/common'));
    });
});

describe('core/variables', () => {
    const globalVars = {
        Primary: '#FF112233',
        'Flat.Key': 'flat',
        TeamName: 'Red',
        Colors: { Red: 'FFFF0000' },
        Nested: { Object: { Deep: 'value' } }
    };

    it('resolves flat keys, dot paths and nested references', () => {
        assert.strictEqual(resolveGlobalVariable('Primary', globalVars), '#FF112233');
        assert.strictEqual(resolveGlobalVariable('Flat.Key', globalVars), 'flat');
        assert.strictEqual(resolveGlobalVariable('Colors.Red', globalVars), 'FFFF0000');
        assert.strictEqual(resolveGlobalVariable('Colors.{TeamName}', globalVars), 'FFFF0000');
        assert.strictEqual(resolveGlobalVariable('{Primary}', globalVars), '#FF112233');
    });

    it('returns null for objects and missing keys', () => {
        assert.strictEqual(resolveGlobalVariable('Nested.Object', globalVars), null);
        assert.strictEqual(resolveGlobalVariable('Missing', globalVars), null);
    });

    it('resolves localization keys', () => {
        const localization = { path: 'x.json', strings: { TITLE: 'Results', Group: { Key: 'Nested' } } };
        assert.strictEqual(resolveLocalizationKey('TITLE', localization), 'Results');
        assert.strictEqual(resolveLocalizationKey('Group.Key', localization), 'Nested');
        assert.strictEqual(resolveLocalizationKey('TITLE', null), null);
    });
});

describe('core/colors', () => {
    const rgba = (value: string) => {
        const color = parseColorValue(value);
        return color && [color.red, color.green, color.blue, color.alpha].map(v => Math.round(v * 255));
    };

    it('parses RLT hex (alpha first), plain hex and R,G,B(,A)', () => {
        assert.deepStrictEqual(rgba('#80FF0000'), [255, 0, 0, 128]);
        assert.deepStrictEqual(rgba('00FF00'), [0, 255, 0, 255]);
        assert.deepStrictEqual(rgba('10, 20, 30'), [10, 20, 30, 255]);
        assert.deepStrictEqual(rgba('10,20,30,40'), [10, 20, 30, 40]);
    });

    it('rejects invalid values', () => {
        assert.strictEqual(parseRgb('300,0,0'), null);
        assert.strictEqual(parseHexDigits('12345'), null);
        assert.strictEqual(isColorValue('Red'), false);
        assert.strictEqual(isColorValue(' #FF0000 '), true);
    });

    it('recognizes layout property names', () => {
        assert.ok(isLayoutName('HeaderPadding'));
        assert.ok(isLayoutName('MarginRight'));
        assert.ok(!isLayoutName('Foreground'));
    });
});

describe('core/themeContext', () => {
    const fileInTheme = (...parts: string[]) => path.join(SAMPLE_THEME, ...parts);

    it('finds the theme root from nested files', () => {
        assert.strictEqual(findThemeRoot(fileInTheme('layouts', 'results', 'layer1-main.json')), SAMPLE_THEME);
        assert.strictEqual(findThemeRoot(fileInTheme('theme_description.json')), SAMPLE_THEME);
    });

    it('loads global variables with comments and trailing commas', () => {
        const vars = getThemeContext(themeUri('x.json')).getGlobalVars();
        assert.strictEqual(vars.Website, 'http://example.com/results');
        assert.strictEqual(vars.HeaderPadding, '10,10,10,10');
    });

    it('picks the localization matching DefaultLocalizationId', () => {
        const localization = getThemeContext(themeUri('x.json')).getLocalization();
        assert.ok(localization);
        assert.strictEqual(path.basename(localization.path), 'polish.json');
        assert.strictEqual(localization.strings.TITLE, 'Wyniki');
    });

    it('caches name indexes and invalidates them per directory', () => {
        const theme = getThemeContext(themeUri('x.json'));
        const styles = theme.getNameIndex('styles', 'StyleName');
        const triggers = theme.getNameIndex('triggers', 'TriggerName');
        assert.strictEqual(theme.getNameIndex('styles', 'StyleName'), styles);

        handleFileChange(themeUri('styles', 'common.json'));
        assert.notStrictEqual(theme.getNameIndex('styles', 'StyleName'), styles);
        assert.strictEqual(theme.getNameIndex('triggers', 'TriggerName'), triggers);
    });
});
