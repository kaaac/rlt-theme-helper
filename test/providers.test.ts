import * as assert from 'assert';
import type * as vscode from 'vscode';
import { NameCompletionProvider } from '../src/providers/NameCompletionProvider';
import { ItemPropertyCompletionProvider, cleanBindingExpression } from '../src/providers/ItemPropertyCompletionProvider';
import { ColorPickerProvider } from '../src/providers/ColorPickerProvider';
import { GlobalVarsInlayHintsProvider } from '../src/providers/GlobalVarsInlayHintsProvider';
import { GlobalVarsCompletionProvider } from '../src/providers/GlobalVarsCompletionProvider';
import { DataConvertersCompletionProvider } from '../src/providers/DataConvertersCompletionProvider';
import { createVariableEdits, validateVariableName } from '../src/providers/addGlobalVariableCommand';
import { globToRegExp } from '../src/extension';
import { Color, Position, Range } from './mocks/vscode';
import { API_MODELS, documentWithCursor, labels, themeDocument } from './helpers';
import * as jsonc from 'jsonc-parser';

describe('NameCompletionProvider', () => {
    const provider = new NameCompletionProvider();

    it('suggests local and global styles, local first', () => {
        const { document, position } = documentWithCursor('layouts/results/new.json',
            '{ "Styles": [ { "StyleName": "LocalStyle" } ], "Items": [ { "Style": "|" } ] }');
        const items = provider.provideCompletionItems(document, position) || [];
        const names = labels(items);
        assert.strictEqual(names[0], 'LocalStyle');
        for (const expected of ['TextBase', 'Header', 'Small', '/text/base']) {
            assert.ok(names.includes(expected), `missing ${expected}`);
        }
        assert.strictEqual(items[0].detail, 'Local (Styles property) Style');
    });

    it('works while the current document is incomplete', () => {
        const { document, position } = documentWithCursor('layouts/results/new.json',
            '{ "Items": [ { "BlockType": "text",\n "Style": "|');
        assert.ok(labels(provider.provideCompletionItems(document, position)).includes('Header'));
    });

    it('suggests components and triggers', () => {
        const component = documentWithCursor('layouts/results/new.json', '{ "Component": "|" }');
        assert.ok(labels(provider.provideCompletionItems(component.document, component.position)).includes('DriverRow'));

        const trigger = documentWithCursor('layouts/results/new.json', '{ "Trigger": "|" }');
        assert.ok(labels(provider.provideCompletionItems(trigger.document, trigger.position)).includes('Highlight'));
    });

    it('ignores other properties', () => {
        const { document, position } = documentWithCursor('layouts/results/new.json', '{ "Source": "|" }');
        assert.strictEqual(provider.provideCompletionItems(document, position), undefined);
    });
});

describe('ItemPropertyCompletionProvider', () => {
    const provider = new ItemPropertyCompletionProvider(API_MODELS);
    const complete = (relativePath: string, text: string) => {
        const { document, position } = documentWithCursor(relativePath, text);
        return labels(provider.provideCompletionItems(document, position));
    };

    it('uses the ItemsSource of the enclosing table', () => {
        const names = complete('layouts/results/new.json',
            '{ "TableOptions": { "ItemsSource": "{Session.Drivers}", "Columns": [ { "Template": { "Source": "{Item.|}" } } ] } }');
        assert.ok(names.includes('Position'));
        assert.ok(names.includes('Stints'));
    });

    it('uses the nearest ItemsSource in nested item stacks', () => {
        const names = complete('layouts/results/new.json',
            '{ "TableOptions": { "ItemsSource": "{Session.Drivers}" }, "Items": [ { "ItemStackOptions": { "ItemSource": "{Item.Stints}", "ItemTemplate": { "Source": "{Item.|');
        assert.ok(names.includes('Laps'));
        assert.ok(!names.includes('Stints'));
    });

    it('treats Item inside an ItemSource expression as the outer item', () => {
        const names = complete('layouts/results/new.json',
            '{ "TableOptions": { "ItemsSource": "{Session.Drivers}", "Columns": [ { "Template": { "ItemStackOptions": { "ItemSource": "{Item.|}" } } } ] } }');
        assert.ok(names.includes('Stints'));
    });

    it('navigates nested properties and fallback classes', () => {
        const names = complete('layouts/results/new.json',
            '{ "TableOptions": { "ItemsSource": "{Session.Drivers}" }, "Source": "{Item.Driver.|}" }');
        assert.ok(names.includes('Name'));
    });

    it('finds the ItemsSource of a component through its usage in layouts', () => {
        const names = complete('components/driver_row.json',
            '{ "ComponentName": "DriverRow", "Items": [ { "Source": "{Item.|}" } ] }');
        assert.ok(names.includes('Position'));
    });

    it('resolves ParentItem to the item of the outer iteration', () => {
        const names = complete('layouts/results/new.json',
            '{ "TableOptions": { "ItemsSource": "{Session.Drivers}" }, "Items": [ { "ItemStackOptions": { "ItemSource": "{Item.Stints}", "ItemTemplate": { "Source": "{ParentItem.|');
        assert.ok(names.includes('Position'));
        assert.ok(names.includes('Stints'));
    });

    it('resolves relative sources through the outer item class', () => {
        const names = complete('layouts/results/new.json',
            '{ "TableOptions": { "ItemsSource": "{Session.Drivers}" }, "Items": [ { "ItemStackOptions": { "ItemSource": "{Item.Stints}", "ItemTemplate": { "ItemStackOptions": { "ItemSource": "{Item.LapDetails}", "ItemTemplate": { "Source": "{Item.|');
        assert.ok(names.length > 0);
        assert.ok(!names.includes('LapDetails'));
    });

    it('follows the source chain of a component used in a nested iteration', () => {
        const names = complete('components/stint_cell.json', '{ "ComponentName": "StintCell", "Source": "{Item.|}" }');
        assert.ok(names.includes('Laps'));
        assert.ok(names.includes('LapDetails'));
    });

    it('completes root objects, including multiseason statistics', () => {
        assert.ok(complete('layouts/results/new.json', '{ "Source": "{Session.|}" }').includes('Track'));
        assert.ok(complete('layouts/results/new.json', '{ "Source": "{DriverStatistics.|}" }').includes('SeasonsCount'));
    });

    it('picks the class of DriverInfo from the layout RenderType', () => {
        const inDriverSession = complete('layouts/driver_session/layer1.json', '{ "Source": "{DriverInfo.|}" }');
        assert.ok(inDriverSession.length > 0);
        assert.ok(!inDriverSession.includes('DriverSeason'));
        assert.ok(complete('layouts/results/new.json', '{ "Source": "{DriverInfo.|}" }').includes('DriverSeason'));
    });

    it('completes Item in a canvas repeated with ItemStackOptions (charts)', () => {
        const names = complete('layouts/results/new.json',
            '{ "BlockType": "canvas", "ItemStackOptions": { "ItemSource": "{Session.Drivers}", "ItemTemplate": { "BlockType": "shape", "ShapeOptions": { "Points": "{Item.|');
        assert.ok(names.includes('LapPositions'));
    });

    it('completes polyline PointX / PointY with the properties of the Points items', () => {
        const names = complete('layouts/results/new.json',
            '{ "BlockType": "canvas", "ItemStackOptions": { "ItemSource": "{Session.Drivers}", "ItemTemplate": { "BlockType": "shape", "ShapeOptions": { "Points": "{Item.LapPositions}", "PointX": "|" } } } }');
        assert.deepStrictEqual(names, ['Lap', 'Position', 'IsEstimated']);
    });

    it('does not treat ParentItem as a root object', () => {
        assert.deepStrictEqual(complete('layouts/results/new.json', '{ "Source": "{MySession.|}" }'), []);
    });

    it('returns nothing without an ItemsSource', () => {
        assert.deepStrictEqual(complete('layouts/results/new.json', '{ "Source": "{Item.|}" }'), []);
    });

    it('extracts the binding path from expressions', () => {
        assert.strictEqual(cleanBindingExpression('{Session.Drivers}'), 'Session.Drivers');
        assert.strictEqual(cleanBindingExpression('<{DriverVar.Driver.LeagueRoles}>'), 'DriverVar.Driver.LeagueRoles');
        assert.strictEqual(cleanBindingExpression('{Item.Laps, Converter=NumberZeroToEmpty}'), 'Item.Laps');
    });
});

describe('ColorPickerProvider', () => {
    const provider = new ColorPickerProvider();
    const colorsIn = (text: string) => {
        const document = themeDocument('layouts/results/new.json', text);
        return provider.provideDocumentColors(document).map(info => document.getText(info.range));
    };

    it('finds hex, RGB and variable / localization colors', () => {
        const found = colorsIn([
            '{',
            '  "Foreground": "#FF112233",',
            '  "Background": "80FF0000",',
            '  "Fill": "10,20,30",',
            '  "Accent": "{Primary}",',
            '  "Team": "{Colors.{TeamName}}",',
            '  "Label": "[ACCENT]"',
            '}'
        ].join('\n'));
        for (const expected of ['#FF112233', '80FF0000', '10,20,30', '{Primary}', '{Colors.{TeamName}}', '[ACCENT]']) {
            assert.ok(found.includes(expected), `missing ${expected}`);
        }
    });

    it('finds a variable that is the only one in a multi-line object', () => {
        assert.deepStrictEqual(colorsIn('{\n  "Items": [\n    {\n      "Foreground": "{Primary}"\n    }\n  ]\n}'), ['{Primary}']);
    });

    it('skips layout values', () => {
        assert.deepStrictEqual(colorsIn('{ "Padding": "10,10,10,10", "Margin": "{HeaderPadding}" }'), []);
    });

    it('offers RLT formats and keeps variables read-only', () => {
        const document = themeDocument('layouts/results/new.json', '{ "Foreground": "#FF112233", "Accent": "{Primary}" }');
        const [hex, variable] = provider.provideDocumentColors(document);
        const color = new Color(1, 0, 0, 0.5) as unknown as vscode.Color;

        const hexFormats = provider.provideColorPresentations(color, { document, range: hex.range }).map(p => p.label);
        assert.deepStrictEqual(hexFormats, ['#80FF0000', '255,0,0,128']);

        const variableFormats = provider.provideColorPresentations(color, { document, range: variable.range }).map(p => p.label);
        assert.deepStrictEqual(variableFormats, ['{Primary}']);
    });
});

describe('GlobalVarsInlayHintsProvider', () => {
    const provider = new GlobalVarsInlayHintsProvider();
    const hintsIn = (text: string) => {
        const document = themeDocument('layouts/results/new.json', text);
        const range = new Range(new Position(0, 0), document.positionAt(text.length) as unknown as Position) as unknown as vscode.Range;
        return provider.provideInlayHints(document, range).map(hint => hint.label);
    };

    it('shows resolved global variables and localization keys', () => {
        assert.deepStrictEqual(hintsIn('{ "Source": "{Website}" }'), ['= http://example.com/results']);
        assert.deepStrictEqual(hintsIn('{ "Source": "[TITLE]" }'), ['= Wyniki']);
        assert.deepStrictEqual(hintsIn('{ "Color": "{Primary}" }'), ['🎨 #FF112233']);
    });

    it('shows one hint per reference and nothing for objects or unknown keys', () => {
        assert.deepStrictEqual(hintsIn('{ "Color": "{Colors.{TeamName}}" }'), ['= Red', '🎨 FFFF0000']);
        assert.deepStrictEqual(hintsIn('{ "A": "{Nested.Object}", "B": "{Missing}", "C": "[MISSING]" }'), []);
    });
});

describe('Global variable and converter completion', () => {
    it('suggests global variables after "{', () => {
        const { document, position } = documentWithCursor('layouts/results/new.json', '{ "Source": "{|" }');
        assert.ok(labels(new GlobalVarsCompletionProvider().provideCompletionItems(document, position)).includes('Primary'));
    });

    it('suggests converters after Converter=', () => {
        const { document, position } = documentWithCursor('layouts/results/new.json', '{ "Source": "{Item.Laps, Converter=|" }');
        assert.ok(labels(new DataConvertersCompletionProvider().provideCompletionItems(document, position)).includes('NumberZeroToEmpty'));
    });
});

describe('Add Global Variable', () => {
    it('adds a variable, keeping comments and tab indentation', () => {
        const text = '{\n\t// team colors\n\t"Primary": "#FF0000"\n}\n';
        const result = jsonc.applyEdits(text, createVariableEdits(text, ['Accent'], '00FF00'));
        assert.ok(result.includes('// team colors'));
        assert.ok(result.includes('\t"Accent": "00FF00"'));
    });

    it('validates variable names (no spaces or dots)', () => {
        assert.strictEqual(validateVariableName('ThemeBackground_2'), null);
        assert.ok(validateVariableName(''));
        assert.ok(validateVariableName('has space'));
        assert.ok(validateVariableName('Theme.Background'));
    });
});

describe('Status bar schema matching', () => {
    const matches = (glob: string, filePath: string) => globToRegExp(glob).test(filePath);

    it('matches jsonValidation globs on Windows and POSIX paths', () => {
        assert.ok(matches('components/**/*.json', 'C:\\theme\\components\\cards\\row.json'));
        assert.ok(matches('components/*.json', '/theme/components/row.json'));
        assert.ok(matches('layer*.json', 'C:\\theme\\layouts\\results\\layer1-main.json'));
        assert.ok(matches('theme_description.json', '/theme/theme_description.json'));
    });

    it('does not match other files', () => {
        assert.ok(!matches('layer*.json', '/theme/player.json'));
        assert.ok(!matches('styles/*.json', '/theme/styles/text/base.json'));
    });
});
