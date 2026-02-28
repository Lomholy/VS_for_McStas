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
import { detectClangFormat } from './detectClang';



let client: LanguageClient;
export async function activate(context: vscode.ExtensionContext) {
	const serverPath = path.join(__dirname, '../../server/src', 'server.py');
	console.log(serverPath)

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


	console.log(context.subscriptions);



	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join("server", "out", "server.js")
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.stdio },
		debug: {
			module: serverModule,
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

	// Create the language client and start the client.
	client = new LanguageClient(
		"mcinstr language-server-id",
		"mcstas-language-server language server name",
		serverOptions,
		clientOptions
	);

	// Start the Language server client. This will also launch the server
	client.start();
	let provider = vscode.languages.registerDocumentFormattingEditProvider('mccode', {
		provideDocumentFormattingEdits: async (doc) => {
			const fullRange = new vscode.Range(
				new vscode.Position(0, 0),
				doc.lineAt(doc.lineCount - 1).range.end
			);

			const formatted = await formatMetaLanguage(doc.getText(), doc.fileName, context);

			return [vscode.TextEdit.replace(fullRange, formatted)];
		}
	});

	// Check for clang-format on system
	const cfg = vscode.workspace.getConfiguration('mcstas.formatter');
	const userPath = cfg.get<string>('clangFormatPath')?.trim() || undefined;

	const found = await detectClangFormat(userPath);
	if (!found) {
		vscode.window.showWarningMessage(
			'McStas Formatter: "clang-format" was not found on your system. ' +
			'Formatting will not work until installed. Click for installation help.',
			'Show Instructions'
		).then(action => {
			if (action === 'Show Instructions') {
				vscode.commands.executeCommand('mcstas.openClangFormatHelp');
			}
		});
	}


	context.subscriptions.push(provider);
}

export function deactivate(): Thenable<void> | undefined {
	console.log("Deactivating extension")
	if (!client) {
		return undefined;
	}
	return client.stop();
}