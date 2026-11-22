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
import { resolvePythonServer } from './detectPythonServer';



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
			"The extension installs its Python language server into its own virtual environment, using python3 (3.9 or newer) from PATH. If that failed:\n" +
			"▶ Install Python 3.9 or newer and make sure python3 is on PATH when VS Code starts.\n" +
			"▶ Or install the server yourself: pipx install \"git+https://github.com/Lomholy/VS_for_McStas#subdirectory=server/python\"\n" +
			"After installation, restart VS Code."
		);
	});


	console.log(context.subscriptions);



	// The language server is the Python package in server/python, run from PATH or from the extension's own venv
	const pythonServer = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Window, title: 'McStas Language Server: setting up' },
		() => resolvePythonServer(
			context.globalStorageUri.fsPath,
			context.asAbsolutePath(path.join('server', 'python')),
			context.extension.packageJSON.version,
			(m) => console.log(`[mcstas] ${m}`)
		)
	);

	if (!pythonServer) {
		vscode.window.showWarningMessage(
			'McStas Language Server: Could not install the Python language server. Hover and completion will not work until python3 (3.9 or newer) is on PATH, or mcstas-language-server is installed.',
			'Installation Help'
		).then(btn => {
			if (btn === 'Installation Help') {
				vscode.commands.executeCommand('mcstas.openPythonServerHelp');
			}
		});
	}

	const serverOptions: ServerOptions = {
		command: pythonServer ?? 'mcstas-language-server',
		transport: TransportKind.stdio,
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

	// Create the language client and start the client.
	client = new LanguageClient(
		"mcinstr language-server-id",
		"mcstas-language-server language server name",
		serverOptions,
		clientOptions
	);

	client.start();

	// clang-format is looked up on the first format request, and again after a failed lookup
	const styleFilePath = path.join(context.extensionPath, 'media', '.clang-format');
	let clangFormat: Promise<string | null> | undefined;
	const provider = vscode.languages.registerDocumentFormattingEditProvider('mccode', {
		provideDocumentFormattingEdits: async (doc) => {
			clangFormat ??= detectClangFormat({
				userPath: vscode.workspace.getConfiguration('mcstas.formatter').get<string>('clangFormatPath')?.trim() || undefined,
				log: (m) => console.log(`[mcstas] ${m}`)
			});
			const found = await clangFormat;
			if (!found) {
				clangFormat = undefined;
				vscode.window.showWarningMessage(
					'McStas Formatter: Could not find "clang-format". If you are using conda/mamba, ensure the environment is active or set mcstas.formatter.clangFormatPath.',
					'Installation Help'
				).then(btn => {
					if (btn === 'Installation Help') {
						vscode.commands.executeCommand('mcstas.openClangFormatHelp');
					}
				});
				return [];
			}
			setFormatterConfig({ clangFormatPath: found, styleFilePath });

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