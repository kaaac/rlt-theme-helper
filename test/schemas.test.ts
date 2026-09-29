import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import Ajv, { ValidateFunction } from 'ajv';
import { parseJson } from '../src/core/json';
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
