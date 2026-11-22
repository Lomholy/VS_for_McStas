import * as vscode from 'vscode';
import { createTemplateInstr } from './createTemplateInstr';
import { openCompDialog } from './dialogue'
import { mcrunCommand } from './mrunCommand';
import * as fs from "fs";
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

	const installationGuide = vscode.Uri.parse('https://github.com/Lomholy/VS_for_McStas/blob/main/installation.md#vs-code');
	const showWarningWithGuide = (message: string) => {
		vscode.window.showWarningMessage(message, 'Installation Guide').then(btn => {
			if (btn === 'Installation Guide') {
				vscode.env.openExternal(installationGuide);
			}
		});
	};


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
		showWarningWithGuide(
			'McStas Language Server: Could not install the Python language server. Hover and completion will not work until python3 (3.9 or newer) is on PATH, or mcstas-language-server is installed.'
		);
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
	// The language server's Python package depends on clang-format, so pip puts it next to the server executable
	const bundledClangFormat = pythonServer && fs.existsSync(pythonServer)
		? path.join(path.dirname(fs.realpathSync(pythonServer)), process.platform === 'win32' ? 'clang-format.exe' : 'clang-format')
		: undefined;
	let clangFormat: Promise<string | null> | undefined;
	const provider = vscode.languages.registerDocumentFormattingEditProvider('mccode', {
		provideDocumentFormattingEdits: async (doc) => {
			clangFormat ??= detectClangFormat({
				userPath: vscode.workspace.getConfiguration('mcstas.formatter').get<string>('clangFormatPath')?.trim() || undefined,
				bundledPath: bundledClangFormat,
				log: (m) => console.log(`[mcstas] ${m}`)
			});
			const found = await clangFormat;
			if (!found) {
				clangFormat = undefined;
				showWarningWithGuide(
					'McStas Formatter: Could not find "clang-format". It is installed together with the language server, so check that the language server is installed, or set mcstas.formatter.clangFormatPath.'
				);
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