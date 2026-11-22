"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const formatter_1 = require("../formatter");
suite('Formatter %/# escaping', () => {
    const block = [
        '  #define CHECK(v, n) \\',
        '    if (n > 0) {        \\',
        '      exit(1);          \\',
        '    }',
        '  double x = 1;',
        '  %include "file"',
        '',
    ].join('\n');
    test('escapes each directive, continuation lines included, into one placeholder', () => {
        const saved = [];
        const escaped = (0, formatter_1.escapePrecompilerLines)(block, saved);
        assert.strictEqual(escaped, '  //__ESC__PRE0\n  double x = 1;\n  //__ESC__PRE1\n');
        assert.strictEqual(saved.length, 2);
    });
    test('restores the original text when the indent is unchanged', () => {
        const saved = [];
        assert.strictEqual((0, formatter_1.unescapePrecompilerLines)((0, formatter_1.escapePrecompilerLines)(block, saved), saved), block);
    });
    test('moves continuation lines with the directive when its indent changes', () => {
        const saved = [];
        const escaped = (0, formatter_1.escapePrecompilerLines)(block, saved);
        const reindented = escaped.replace(/^ {2}/gm, '    ');
        const restored = (0, formatter_1.unescapePrecompilerLines)(reindented, saved);
        assert.ok(restored.startsWith('    #define CHECK(v, n) \\\n      if (n > 0) {'));
    });
});
//# sourceMappingURL=formatter.test.js.map