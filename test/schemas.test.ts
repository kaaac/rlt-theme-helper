import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import Ajv, { ValidateFunction } from 'ajv';
import { parseJson } from '../src/core/json';
import { globToRegExp } from '../src/extension';
import { REPO_ROOT } from './helpers';

const SCHEMAS = path.join(REPO_ROOT, 'json_schemas');

function schemaFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        return entry.isDirectory() ? schemaFiles(fullPath) : entry.name.endsWith('.json') ? [fullPath] : [];
    });
}

const toId = (file: string) => 'file:///' + file.split(path.sep).join('/');

// VS Code evaluates schema patterns without the unicode flag
const regExp = Object.assign((pattern: string, flags: string) => new RegExp(pattern, flags.replace('u', '')), { code: 'new RegExp' });
const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true, code: { regExp } });
for (const file of schemaFiles(SCHEMAS)) {
    const schema = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete schema.$schema;
    ajv.addSchema({ ...schema, $id: toId(file) });
}

function validator(schemaFile: string): ValidateFunction {
    const validate = ajv.getSchema(toId(path.join(SCHEMAS, schemaFile)));
    assert.ok(validate, `schema ${schemaFile} not found`);
    return validate;
}

function assertValid(schemaFile: string, value: unknown) {
    const validate = validator(schemaFile);
    assert.ok(validate(value), `expected valid for ${schemaFile}: ${JSON.stringify(value)}\n${ajv.errorsText(validate.errors)}`);
}

function assertInvalid(schemaFile: string, value: unknown) {
    assert.ok(!validator(schemaFile)(value), `expected invalid for ${schemaFile}: ${JSON.stringify(value)}`);
}

describe('JSON schemas', () => {
    it('are strict JSON and compile with all references resolved', () => {
        for (const file of schemaFiles(SCHEMAS)) {
            const text = fs.readFileSync(file, 'utf8');
            assert.doesNotThrow(() => JSON.parse(text), `${path.relative(SCHEMAS, file)} is not valid JSON`);
            assert.ok(ajv.getSchema(toId(file)), `${path.relative(SCHEMAS, file)} does not compile`);
        }
    });

    it('package.json points jsonValidation to existing schemas', () => {
        const pkg = parseJson(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).value as { contributes: { jsonValidation: { url: string }[] } };
        for (const { url } of pkg.contributes.jsonValidation) {
            assert.ok(fs.existsSync(path.join(REPO_ROOT, url)), `missing ${url}`);
        }
    });

    describe('layout_description.json', () => {
        it('accepts all documented render types', () => {
            for (const renderType of ['RaceResults', 'DeepRatingsSeason', 'Teammates', 'TeamStandingsMultiseason', 'TeamStatistics',
                'TeamsStatistics', 'DriverStatistics', 'DriversStatistics', 'TrackStatistics', 'TracksStatistics']) {
                assertValid('layout_description.json', { RenderType: renderType });
            }
            assertInvalid('layout_description.json', { RenderType: 'Unknown' });
        });

        it('accepts RenderCaptions as an object and IsShowsAsSegmentQual', () => {
            assertValid('layout_description.json', {
                RenderType: 'QualResults',
                RenderCaptions: { QualSegment: 'Render segment' },
                IsShowsAsSegmentQual: false
            });
        });

        it('checks RenderDataType against the RenderType', () => {
            assertValid('layout_description.json', { RenderType: 'DriverSessionStatistics', RenderDataType: 'AttackRating' });
            assertValid('layout_description.json', { RenderType: 'DriverSeasonStatistics', RenderDataType: 'AvgPoints' });
            assertInvalid('layout_description.json', { RenderType: 'DriverSessionStatistics', RenderDataType: 'AvgPoints' });
        });
    });

    describe('blocks', () => {
        it('accept expressions and public properties in numeric, boolean and enum properties', () => {
            assertValid('schema_layer.json', {
                BlockRoot: {
                    BlockType: 'stack',
                    Orientation: '{RowOrientation}',
                    Spacing: '<RowSpacing>',
                    HorizontalAlignment: '{Align}',
                    MarginTop: '{26, Converter=NumberMultiply, Parameter={Session.DriversCount, Converter=NumberSubtract, Parameter=20}}',
                    ColorizeBackground: { Enabled: '{IsColored}', Color: '{Primary}' },
                    Items: [{ BlockType: 'text', TextOptions: { Text: 'x', Wrap: '<WrapText>', RotateAroundCenter: true } }]
                }
            });
        });

        it('reject plain invalid values', () => {
            assertInvalid('schema_layer.json', { BlockRoot: { BlockType: 'stack', Orientation: 'Diagonal' } });
            assertInvalid('schema_layer.json', { BlockRoot: { BlockType: 'stack', Spacing: 'wide' } });
        });

        it('accept documented block and options properties', () => {
            assertValid('schema_layer.json', {
                BlockRoot: {
                    BlockType: 'stack',
                    RenderForce: true, MinWidth: 100, MinHeight: '{H}', PositionZ: 2,
                    DefaultBackgroundImage: 'bg.png', BackgroundImageFitMode: 'Cover',
                    Vars: { Color: '#FFFFFFFF' },
                    PanelOptions: { Orientation: 'Vertical', VerticalDirection: 'BottomToTop', Spacing: 4 },
                    Colorize: { Enabled: true, ColorImage: 'mask.png', ColorImageMode: 'Alpha' },
                    Items: [
                        { BlockType: 'image', ImageOptions: { Path: 'a.png', DefaultPath: 'b.png', Rotation: 90, RotateAroundCenter: true } },
                        { BlockType: 'shape', ShapeOptions: { ShapeType: 'ellipse', Rotation: 45, RotateAroundCenter: true } },
                        { BlockType: 'table', TableOptions: { ItemsSource: '{Session.Drivers}', Columns: [{ MultiColumnLimit: 5, MultiColumnIndexStart: 0, MultiColumnIndexEnd: '<End>' }] } }
                    ]
                }
            });
            assertInvalid('schema_layer.json', { BlockRoot: { BlockType: 'stack', BackgroundImageFitMode: 'Fill' } });
        });

        it('accept grid rows and columns without all fields', () => {
            assertValid('schema_layer.json', {
                BlockRoot: { BlockType: 'grid', GridOptions: { Rows: [{ IsStretchHeight: true }], Cols: [{ Width: 100 }] } }
            });
        });

        it('accept documented trigger definitions', () => {
            assertValid('schema_layer.json', {
                BlockRoot: {
                    BlockType: 'text',
                    Triggers: [
                        { TriggerName: 'Highlight', Condition: true, Setters: [{ Property: 'Opacity', Value: 0.5 }] },
                        { Condition: '{Item.Position}', ConditionValue: 1.5, Property: 'TextOptions', Value: { Foreground: '#FFFF0000', ColorizeRating: { IsEnabled: true } } }
                    ]
                }
            });
        });
    });

    describe('charts (0.9.9)', () => {
        it('accept the documented line chart and bar chart examples', () => {
            // Examples from block-types-and-block-options.md (Charts)
            assertValid('schema_layer.json', { BlockRoot: {
                BlockType: 'canvas',
                ItemStackOptions: {
                    ItemSource: '{Session.Drivers}',
                    Reverse: true,
                    ItemTemplate: {
                        BlockType: 'shape', Width: 1400, Height: 720,
                        ShapeOptions: {
                            ShapeType: 'polyline', Points: '{Item.LapPositions}', PointX: 'Lap', PointY: 'Position',
                            Scale: { XMin: 0, XMax: '{Session.LeaderLapsCount}', YMin: 1, YMax: '{Session.DriversCount}', InvertY: true, Inset: 18 },
                            Stroke: { Color: '{Item.Team.Color}', Thickness: 4, LineJoin: 'round' },
                            Markers: { Shape: 'ellipse', Size: 6 }, MissingData: 'connect', Smoothing: 'curve'
                        }
                    }
                }
            } });
            assertValid('schema_layer.json', { BlockRoot: {
                BlockType: 'canvas',
                ItemStackOptions: {
                    ItemSource: '{Session.Drivers}',
                    ItemTemplate: {
                        BlockType: 'canvas',
                        Items: [
                            { BlockType: 'shape', Width: 900, Height: 200, ShapeOptions: {
                                ShapeType: 'rectangle', X1: '{ItemIndex}', X2: '{ItemIndex}', Y1: 0, Y2: '{Item.DriverPoints.FloatValue}', GapX: 8, Fill: '{Item.Team.Color}',
                                Scale: { XMin: 0, XMax: '{Session.DriversCount, Converter=NumberSubtract, Parameter=1}', YMin: 0, YMax: 30, BandX: true } } },
                            { BlockType: 'text', Source: '{Item.DriverPoints.Value}', PlotPosition: {
                                X: '{ItemIndex}', Y: '{Item.DriverPoints.FloatValue}', AreaWidth: 900, AreaHeight: 200, AnchorY: 'Bottom', OffsetY: -4,
                                Scale: { XMin: 0, XMax: 10, YMin: 0, YMax: 30, BandX: true } } }
                        ]
                    }
                }
            } });
        });

        it('reject invalid chart values', () => {
            const shape = (options: object) => ({ BlockRoot: { BlockType: 'shape', ShapeOptions: options } });
            assertInvalid('schema_layer.json', shape({ ShapeType: 'triangle' }));
            assertInvalid('schema_layer.json', shape({ ShapeType: 'line', Stroke: { DashStyle: 'wavy' } }));
            assertInvalid('schema_layer.json', shape({ ShapeType: 'polyline', MissingData: 'skip' }));
        });
    });

    describe('resource files', () => {
        it('style files: one style (name optional) or an array of named styles, with block properties', () => {
            assertValid('schema_style_file.json', { BlockType: 'text', TextOptions: { FontSize: 12 }, StyleBasedOn: 'Base' });
            assertValid('schema_style_file.json', [{ StyleName: 'Header', BlockType: 'text', FontSize: 20 }]);
            assertInvalid('schema_style_file.json', [{ BlockType: 'text' }]);
            assertInvalid('schema_style_file.json', { StyleName: 'Bad', BlockType: 'text', TextOptions: { FontStyle: 'Heavy' } });
        });

        it('inline Styles of blocks require names', () => {
            assertValid('schema_layer.json', { BlockRoot: { BlockType: 'stack', Styles: [{ StyleName: 'Row', BlockType: 'stack', Spacing: 4 }] } });
            assertInvalid('schema_layer.json', { BlockRoot: { BlockType: 'stack', Styles: [{ BlockType: 'stack' }] } });
        });

        it('trigger files: one trigger or an array of triggers', () => {
            assertValid('schema_trigger_file.json', { TriggerName: 'Highlight', Condition: '{Item.IsFastest}', Property: 'Opacity', Value: 50 });
            assertValid('schema_trigger_file.json', [{ TriggerName: 'A', Condition: true, Setters: [{ Property: 'Opacity', Value: 50 }] }]);
            assertInvalid('schema_trigger_file.json', { TriggerName: 'A', Unknown: 1 });
        });

        it('variable files: primitive values, names without dots', () => {
            assertValid('global_vars.json', { Primary: '#FF112233', Size: 12.5, Enabled: true, 'GridRed Bull': 1 });
            assertInvalid('global_vars.json', { 'Theme.Background': '000000' });
            assertInvalid('global_vars.json', { Colors: { Red: 'FF0000' } });
        });

        it('are mapped to theme folders at any level', () => {
            const pkg = parseJson(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).value as { contributes: { jsonValidation: { fileMatch: string | string[], url: string }[] } };
            const schemaFor = (filePath: string) => pkg.contributes.jsonValidation
                .find(entry => ([] as string[]).concat(entry.fileMatch).some(glob => globToRegExp(glob).test(filePath)))?.url;
            assert.strictEqual(schemaFor('/theme/styles/text/base.json'), './json_schemas/schema_style_file.json');
            assert.strictEqual(schemaFor('/theme/styles.json'), './json_schemas/schema_style_file.json');
            assert.strictEqual(schemaFor('/theme/layouts/results/styles/a.json'), './json_schemas/schema_style_file.json');
            assert.strictEqual(schemaFor('/theme/layouts/results/layer2-overlay/triggers/t.json'), './json_schemas/schema_trigger_file.json');
            assert.strictEqual(schemaFor('/theme/layouts/results/vars/v.json'), './json_schemas/global_vars.json');
            assert.strictEqual(schemaFor('/theme/layouts/results/layer2-overlay/main.json'), './json_schemas/schema_layer.json');
            assert.strictEqual(schemaFor('/theme/layouts/results/layer1-main.json'), './json_schemas/schema_layer.json');
        });
    });

    describe('components', () => {
        it('allow a single-file component without ComponentName, but require it in arrays', () => {
            assertValid('schema_component.json', { BlockType: 'stack', Items: [] });
            assertValid('schema_component.json', [{ ComponentName: 'Row', BlockType: 'stack' }]);
            assertInvalid('schema_component.json', [{ BlockType: 'stack' }]);
        });
    });

    describe('theme_description.json', () => {
        it('accepts any version string and documented logotype behaviours', () => {
            assertValid('theme_description.json', {
                ThemeId: 'me.my_theme', Name: 'My theme', Author: 'me', Version: '1.2',
                LogotypeBehaviours: [
                    { Category: 'Team', Variant: 'alternativedark', SetVariantByDefault: true },
                    { Category: 'Nation', Variant: 'Outline' }
                ]
            });
        });

        it('rejects removed and unknown logotype values', () => {
            const theme = (behaviour: object) => ({ ThemeId: 'me.my_theme', Name: 'n', Author: 'a', LogotypeBehaviours: [behaviour] });
            assertInvalid('theme_description.json', theme({ Category: 'Season' }));
            assertInvalid('theme_description.json', theme({ Category: 'Team', Variant: 'Grayed' }));
            assertInvalid('theme_description.json', theme({ Variant: 'dark' }));
        });
    });
});
