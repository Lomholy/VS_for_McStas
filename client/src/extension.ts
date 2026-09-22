import * as vscode from 'vscode';
import { createTemplateInstr } from './createTemplateInstr';
import { openCompDialog } from './dialogue'
import { mcrunCommand } from './mrunCommand';
import * as path from "path";
import { workspace } from "vscode";
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from "vscode-languageclient/node";
import { Component, activateComponentViewer } from './componentProvider'; // assuming this file is componentProvider.ts
import { mcdisplayCommand } from './mcdisplayCommand';
import { mcplotCommand } from './mcplotCommand';
import { setExtensionRootPath } from './global_params';
import { formatMetaLanguage } from './formatter';
import { detectClangFormat, setFormatterConfig } from './formatConfig';
import { detectPythonServerCommand, installPythonServer } from './detectPythonServer';



let client: LanguageClient;
export async function activate(context: vscode.ExtensionContext) {
	setExtensionRootPath(context.extensionPath);
	activateComponentViewer(context); // Read the component tree
	context.subscriptions.push(// Allow user to insert a component
		vscode.commands.registerCommand('vs-for-mcstas.openCompDialog', openCompDialog)
	);

	vscode.commands.registerCommand('mcstas.openCompFile', async (resource: Component) => {
		// Allow user to open each component file
		// Make sure it is a proper file URI
		const fileUri = vscode.Uri.file(resource.fullPath);
		try {
			const document = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(document);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to open file: ${error}`);
		}
	});

	vscode.commands.registerCommand('mcstas.createNewInstr', async () => {
		createTemplateInstr(context);
	})

	vscode.commands.registerCommand('mcstas.mcrun', async () => {
		mcrunCommand();
	})

	vscode.commands.registerCommand('mcstas.mcdisplay', () => {
		mcdisplayCommand();
	});

	vscode.commands.registerCommand('mcstas.mcplot', () => {
		mcplotCommand();
	});

	vscode.commands.registerCommand('mcstas.openClangFormatHelp', () => {
		vscode.window.showInformationMessage(
			"To install clang-format:\n" +
			"▶ macOS: brew install clang-format\n" +
			"▶ Ubuntu/Debian: sudo apt install clang-format\n" +
			"▶ Windows: Install LLVM from https://llvm.org\n" +
			"After installation, restart VS Code."
		);
	});

	vscode.commands.registerCommand('mcstas.openPythonServerHelp', () => {
		vscode.window.showInformationMessage(
			"This extension normally installs its Python language server (mcstas_ls) automatically the first time it can't find one. If that failed:\n" +
			"▶ Most likely cause: pip refused to install outside a virtualenv or conda env (\"externally-managed-environment\", common on Homebrew/Debian/Ubuntu Python). Create a virtualenv or conda env, activate it (or set componentViewer.condaEnv to it), and restart VS Code.\n" +
			"▶ To install manually instead: cd server/python (in the VS_for_McStas source, or wherever it was installed), then run: pip install \".[dev]\"\n" +
			"Make sure the same Python environment is on PATH, or active as a conda/mamba env, when VS Code starts.\n" +
			"After installation, restart VS Code."
		);
	});


	console.log(context.subscriptions);



	// The language server is implemented in Python (server/python), using
	// pygls. Find an interpreter that has the mcstas_ls package installed --
	// same PATH -> conda/mamba run -> conda env prefix probing strategy as
	// detectClangFormat below, reusing componentViewer.condaEnv rather than
	// adding a new setting. If none is found, install mcstas_ls (from the
	// server/python bundled with this extension) rather than just asking
	// the user to do it themselves.
	const componentViewerCfg = vscode.workspace.getConfiguration('componentViewer');
	const condaEnvName = componentViewerCfg.get<string>('condaEnv')?.trim() || undefined;
	const pythonServerLog = (m: string) => console.log(`[mcstas] ${m}`);

	let pythonServerCommand = await detectPythonServerCommand({
		condaEnvName,
		log: pythonServerLog
	});

	if (!pythonServerCommand) {
		const serverSourcePath = context.asAbsolutePath(path.join('server', 'python'));
		pythonServerCommand = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'McStas Language Server: installing Python package (pip install)...' },
			() => installPythonServer(serverSourcePath, { condaEnvName, log: pythonServerLog })
		);

		if (pythonServerCommand) {
			vscode.window.showInformationMessage('McStas Language Server: installed the Python package successfully.');
		}
	}

	if (!pythonServerCommand) {
		vscode.window.showWarningMessage(
			'McStas Language Server: Could not find or install a Python interpreter with "mcstas_ls". Hover and completion will not work until one is found. If you are using conda/mamba, ensure the environment is active or set componentViewer.condaEnv. On some systems (Homebrew/Debian/Ubuntu Python), pip refuses to install outside a virtualenv or conda env ("externally-managed-environment") -- create one and activate it, or point componentViewer.condaEnv at it.',
			'Installation Help'
		).then(btn => {
			if (btn === 'Installation Help') {
				vscode.commands.executeCommand('mcstas.openPythonServerHelp');
			}
		});
	}

	// Fall back to a bare "python3 -m mcstas_ls.server" even when detection
	// didn't confirm the package is importable, mirroring the clang-format
	// fallback below: it may still work via a PATH/shell setup detection
	// didn't probe (e.g. a shell profile VS Code doesn't inherit).
	const resolvedServerCommand = pythonServerCommand ?? { command: 'python3', args: ['-m', 'mcstas_ls.server'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { command: resolvedServerCommand.command, args: resolvedServerCommand.args, transport: TransportKind.stdio },
		debug: {
			command: resolvedServerCommand.command,
			args: resolvedServerCommand.args,
			transport: TransportKind.stdio,
		},
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for all documents by default
		documentSelector: [
			{ scheme: 'file', language: 'mccode' },
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
		},
	};

	// Create the language client and start it immediately. Hover and
	// completion depend on this, so it must not sit behind unrelated setup
	// like clang-format detection below -- that used to run first and could
	// add several subprocess probes' worth of delay before the client even
	// started, let alone finished its own initialize handshake.
	client = new LanguageClient(
		"mcinstr language-server-id",
		"mcstas-language-server language server name",
		serverOptions,
		clientOptions
	);
	client.start();

	// Check for clang-format on system
	const cfg = vscode.workspace.getConfiguration('mcstas.formatter');
	const userPath = cfg.get<string>('clangFormatPath')?.trim() || undefined;


	const found = await detectClangFormat({
		userPath,
		// If you want to try a specific env name first (optional):
		// condaEnvName: 'myenv',
		log: (m) => console.log(`[mcstas] ${m}`)
	});

	if (!found) {
		vscode.window.showWarningMessage(
			'McStas Formatter: Could not find "clang-format". If you are using conda/mamba, ensure the environment is active or set mcstas.formatter.clangFormatPath.',
			'Installation Help'
		).then(btn => {
			if (btn === 'Installation Help') {
				vscode.commands.executeCommand('mcstas.openClangFormatHelp');
			}
		});
	}
	const clangFormatResolved = found ?? (userPath || 'clang-format');
	const styleFilePath = path.join(context.extensionPath, 'media', '.clang-format');
	setFormatterConfig({ clangFormatPath: clangFormatResolved, styleFilePath });
	let provider = vscode.languages.registerDocumentFormattingEditProvider('mccode', {
		provideDocumentFormattingEdits: async (doc) => {
			const fullRange = new vscode.Range(
				new vscode.Position(0, 0),
				doc.lineAt(doc.lineCount - 1).range.end
			);

			const formatted = await formatMetaLanguage(doc.getText(), doc.fileName);

			return [vscode.TextEdit.replace(fullRange, formatted)];
		}
	});





	context.subscriptions.push(provider);
}

export function deactivate(): Thenable<void> | undefined {
	console.log("Deactivating extension")
	if (!client) {
		return undefined;
	}
	return client.stop();
}