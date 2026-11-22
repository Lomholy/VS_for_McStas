import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveCompPathFromConda } from '../componentProvider';
import { findCondaRunner, inCondaEnv } from '../condaEnv';

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
async function waitFor<T>(get: () => Thenable<T>, ok: (v: T) => boolean, timeoutMs: number): Promise<T> {
	const start = Date.now();
	let value = await get();
	while (!ok(value) && Date.now() - start < timeoutMs) {
		await new Promise(r => setTimeout(r, 1000));
		value = await get();
	}
	return value;
}

suite('Extension', () => {
	let doc: vscode.TextDocument;

	suiteSetup(async function () {
		this.timeout(30000);
		const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcstas-test-')), 'test.instr');
		fs.writeFileSync(file, INSTR);
		doc = await vscode.workspace.openTextDocument(file);
		await vscode.window.showTextDocument(doc);
		await vscode.extensions.getExtension(EXTENSION_ID)!.activate();
	});

	test('opens .instr files as mccode', () => {
		assert.strictEqual(doc.languageId, 'mccode');
	});

	test('registers every command declared in package.json', async () => {
		const declared: { command: string }[] = vscode.extensions.getExtension(EXTENSION_ID)!.packageJSON.contributes.commands;
		const registered = new Set(await vscode.commands.getCommands(true));
		assert.deepStrictEqual(declared.map(c => c.command).filter(c => !registered.has(c)), []);
	});

	test('language server answers hover on a component type', async function () {
		this.timeout(240000);
		const line = INSTR.split('\n').findIndex(l => l.includes('Source_simple('));
		const position = new vscode.Position(line, INSTR.split('\n')[line].indexOf('Source_simple') + 2);
		const hovers = await waitFor(
			() => vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', doc.uri, position),
			h => h.length > 0,
			200000
		);
		const text = hovers.flatMap(h => h.contents).map(c => (c as vscode.MarkdownString).value ?? String(c)).join('\n');
		assert.ok(text.includes('Source\\_simple'), text);
		assert.ok(text.includes('radius'), text);
	});

	test('language server completes component names', async function () {
		this.timeout(60000);
		const position = new vscode.Position(2, 'COMPONENT origin = Ar'.length);
		const list = await waitFor(
			() => vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', doc.uri, position),
			l => l.items.length > 0,
			50000
		);
		assert.ok(list.items.some(i => (typeof i.label === 'string' ? i.label : i.label.label) === 'Arm'));
	});

	test('language server completes component parameters inside the parentheses', async function () {
		this.timeout(60000);
		const labelsAt = async (position: vscode.Position) => {
			const list = await waitFor(
				() => vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', doc.uri, position),
				l => l.items.length > 0,
				50000
			);
			return list.items.map(i => (typeof i.label === 'string' ? i.label : i.label.label));
		};

		// Inside the existing Source_simple( ... ) call, at the start of its parameter line
		const existing = await labelsAt(new vscode.Position(5, 2));
		console.log('inside Source_simple():', existing.slice(0, 10).join(', '));
		assert.ok(existing.includes('yheight'), existing.slice(0, 20).join(', '));

		// A component call being typed, sent to the server as an edit
		const line = 'COMPONENT mon = PSD_monitor(';
		const edit = new vscode.WorkspaceEdit();
		edit.insert(doc.uri, new vscode.Position(8, 0), line + '\n');
		assert.ok(await vscode.workspace.applyEdit(edit));
		const typed = await labelsAt(new vscode.Position(8, line.length));
		console.log('after PSD_monitor(:', typed.slice(0, 10).join(', '));
		assert.ok(typed.includes('nx'), typed.slice(0, 20).join(', '));
	});

	test('after "name =" offers the instrument variables, not the component parameters', async function () {
		this.timeout(60000);
		const valueLabels = async (source: string, line: number, character: number) => {
			const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcstas-value-')), 'value.instr');
			fs.writeFileSync(file, source);
			const valueDoc = await vscode.workspace.openTextDocument(file);
			await vscode.window.showTextDocument(valueDoc);
			const list = await vscode.commands.executeCommand<vscode.CompletionList>(
				'vscode.executeCompletionItemProvider', valueDoc.uri, new vscode.Position(line, character), '=');
			return list.items.map(i => (typeof i.label === 'string' ? i.label : i.label.label));
		};
		const withParams = await valueLabels('DEFINE INSTRUMENT v(L=1)\nTRACE\nCOMPONENT s = Source_simple(radius = \n', 2, 37);
		assert.deepStrictEqual(withParams, ['L']);
		// Nothing to offer: no word-based suggestions from the open documents either
		const withoutParams = await valueLabels('DEFINE INSTRUMENT v()\nTRACE\nCOMPONENT s = Source_simple(radius = \n', 2, 37);
		assert.deepStrictEqual(withoutParams, []);
	});

	test('reads .comp files from the chosen conda environment', async () => {
		const env = fs.mkdtempSync(path.join(os.tmpdir(), 'mcstas-env-'));
		const comp = path.join(env, 'share', 'mcstas', 'resources', 'sources', 'Source_simple.comp');
		fs.mkdirSync(path.dirname(comp), { recursive: true });
		fs.writeFileSync(comp, 'DEFINE COMPONENT Source_simple\n');
		const config = vscode.workspace.getConfiguration('mcstas');
		await config.update('condaEnvironment', env, vscode.ConfigurationTarget.Global);
		try {
			assert.strictEqual(resolveCompPathFromConda('sources', 'Source_simple'), comp);
			assert.strictEqual(resolveCompPathFromConda('sources', 'Not_a_component'), undefined);
		} finally {
			await config.update('condaEnvironment', undefined, vscode.ConfigurationTarget.Global);
		}
	});

	test('runs McStas commands in the chosen conda environment', async () => {
		const command = 'mcrun "test.instr" L=1';
		assert.strictEqual(inCondaEnv(command), command);

		// A fake conda install: <root>/condabin/conda and the environment <root>/envs/mcstas
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcstas-conda-'));
		const env = path.join(root, 'envs', 'mcstas');
		fs.mkdirSync(env, { recursive: true });
		fs.mkdirSync(path.join(root, 'condabin'));
		fs.writeFileSync(path.join(root, 'condabin', process.platform === 'win32' ? 'conda.bat' : 'conda'), '');
		const config = vscode.workspace.getConfiguration('mcstas');
		await config.update('condaEnvironment', env, vscode.ConfigurationTarget.Global);
		try {
			const wrapped = inCondaEnv(command);
			const runner = findCondaRunner(env);
			assert.ok(runner && fs.existsSync(runner), String(runner));
			assert.ok(wrapped.includes(`"${runner}" run`), wrapped);
			assert.ok(wrapped.endsWith(` -p "${env}" ${command}`), wrapped);
		} finally {
			await config.update('condaEnvironment', undefined, vscode.ConfigurationTarget.Global);
		}
	});
});
