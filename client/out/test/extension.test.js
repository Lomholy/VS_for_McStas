"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vscode = require("vscode");
const EXTENSION_ID = 'lomholy.vs-for-mcstas';
const INSTR = `DEFINE INSTRUMENT test(L=1)
TRACE
COMPONENT origin = Arm()
AT (0, 0, 0) ABSOLUTE
COMPONENT src = Source_simple(
  radius = 0.1
)
AT (0, 0, 1) RELATIVE origin
END
`;
// Retries `get` until `ok` accepts its result; the language server may still be installing
async function waitFor(get, ok, timeoutMs) {
    const start = Date.now();
    let value = await get();
    while (!ok(value) && Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 1000));
        value = await get();
    }
    return value;
}
suite('Extension', () => {
    let doc;
    suiteSetup(async function () {
        this.timeout(30000);
        const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcstas-test-')), 'test.instr');
        fs.writeFileSync(file, INSTR);
        doc = await vscode.workspace.openTextDocument(file);
        await vscode.window.showTextDocument(doc);
        await vscode.extensions.getExtension(EXTENSION_ID).activate();
    });
    test('opens .instr files as mccode', () => {
        assert.strictEqual(doc.languageId, 'mccode');
    });
    test('registers every command declared in package.json', async () => {
        const declared = vscode.extensions.getExtension(EXTENSION_ID).packageJSON.contributes.commands;
        const registered = new Set(await vscode.commands.getCommands(true));
        assert.deepStrictEqual(declared.map(c => c.command).filter(c => !registered.has(c)), []);
    });
    test('language server answers hover on a component type', async function () {
        this.timeout(240000);
        const line = INSTR.split('\n').findIndex(l => l.includes('Source_simple('));
        const position = new vscode.Position(line, INSTR.split('\n')[line].indexOf('Source_simple') + 2);
        const hovers = await waitFor(() => vscode.commands.executeCommand('vscode.executeHoverProvider', doc.uri, position), h => h.length > 0, 200000);
        const text = hovers.flatMap(h => h.contents).map(c => c.value ?? String(c)).join('\n');
        assert.ok(text.includes('Source\\_simple'), text);
        assert.ok(text.includes('radius'), text);
    });
    test('language server completes component names', async function () {
        this.timeout(60000);
        const position = new vscode.Position(2, 'COMPONENT origin = Ar'.length);
        const list = await waitFor(() => vscode.commands.executeCommand('vscode.executeCompletionItemProvider', doc.uri, position), l => l.items.length > 0, 50000);
        assert.ok(list.items.some(i => (typeof i.label === 'string' ? i.label : i.label.label) === 'Arm'));
    });
});
//# sourceMappingURL=extension.test.js.map