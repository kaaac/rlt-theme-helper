import * as assert from 'assert';
import snippets from '../src/providers/snippets';
import { DATA_CONVERTER_NAMES } from '../src/providers/DataConvertersCompletionProvider';

/**
 * Snippet body as it looks right after insertion with default values:
 * choices -> first option, ${n:default} -> default, value placeholders -> null, other placeholders -> nothing.
 */
function expand(body: string[]): string {
    return body.join('\n')
        .replace(/\$\{\d+\|([^,|]*)[^}]*\}/g, '$1')
        .replace(/\$\{\d+:([^}]*)\}/g, '$1')
        .replace(/:\s*\$\d+/g, ': null')
        .replace(/\$\d+/g, '');
}

describe('Snippets', () => {
    for (const [name, snippet] of Object.entries(snippets)) {
        it(`"${name}" inserts strict JSON`, () => {
            const text = expand(snippet.body);
            assert.doesNotThrow(() => JSON.parse(text), `invalid JSON:\n${text}`);
        });
    }

    it('use lowercase block types', () => {
        for (const snippet of Object.values(snippets)) {
            const blockType = snippet.body.join('\n').match(/"BlockType"\s*:\s*"([a-z]*[A-Z][^"]*)"/);
            assert.strictEqual(blockType, null, `uppercase BlockType ${blockType?.[1]}`);
        }
    });
});

describe('Data converters', () => {
    it('include all converters from the manual', () => {
        for (const name of ['StringToLowerString', 'NumberIsZero', 'NumberIsNotZero', 'NumberToSignedString', 'GetStringLength', 'MaxStringLength', 'DateCustomFormat']) {
            assert.ok(DATA_CONVERTER_NAMES.includes(name), `missing ${name}`);
        }
        assert.strictEqual(new Set(DATA_CONVERTER_NAMES).size, DATA_CONVERTER_NAMES.length, 'duplicate converter');
    });
});
