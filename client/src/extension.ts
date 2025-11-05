import * as vscode from 'vscode';
import { createTemplateInstr } from './createTemplateInstr';
import {openCompDialog} from './dialogue'
import { mcrunCommand } from './mrunCommand';
import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { ComponentProvider, Component, activateComponentViewer, setMcStasPath} from './componentProvider'; // assuming this file is componentProvider.ts
import { mcdisplayCommand } from './mcdisplayCommand';
import { mcplotCommand } from './mcplotCommand';
import { findEnvsWithMcStasAndFlask } from './checkCondaEnv';
import { setExtensionRootPath } from './global_params';



let flaskProcess: ReturnType<typeof spawn> | undefined;
let client: LanguageClient;
export function activate(context: vscode.ExtensionContext) {
	let condaEnv:string = vscode.workspace.getConfiguration().get('componentViewer.condaEnv');
	if (condaEnv===""){
		const envs = findEnvsWithMcStasAndFlask();
		if (envs.length) {
		console.log('Found matching environments:');
		for (const e of envs) {
			console.log(`- ${e.name} (${e.path})`);
		
		}
		} else {

		vscode.window.showWarningMessage(
			"Component Viewer: No Conda environment was found that contains both 'mcstas' and 'flask'. " +
			"Install both packages in any Conda environment (via conda or pip inside the env). "
		)
			console.log('No Conda env found with mcstas (Conda pkg) and Flask (importable).');
		}
		// Choose environment as what we use for conda runs:
		vscode.workspace.getConfiguration().update('componentViewer.condaEnv', envs[0].name, vscode.ConfigurationTarget.Global);
		condaEnv = vscode.workspace.getConfiguration().get('componentViewer.condaEnv');
	}
	vscode.window.showInformationMessage(
    `Component Viewer: Using Conda environment '${condaEnv}'. ` +
    `You can change this later in Settings → "componentViewer.condaEnv".`
  	);
	
	const serverPath = path.join(__dirname, '../../server/src', 'server.py');
	console.log(serverPath)
	
	const condaExe = process.env.CONDA_EXE || 'conda'; // falls back to PATH
	const cwd = path.dirname(serverPath); // or your workspace root

	const args = [
	'run',
	'--no-capture-output', // stream logs through to your extension
	'-n', condaEnv,        // environment name
	'python',              // interpreter inside that env
	serverPath             // your Flask entrypoint
	];
	try{
		const flaskProcess: ChildProcessWithoutNullStreams = spawn(condaExe, args, {
		cwd,
		env: { ...process.env, FLASK_ENV: 'development' }, // optional
		shell: process.platform === 'win32', // resolve conda.bat on Windows
		});	

		flaskProcess.stdout.on('data', d => console.log(`[flask] ${d.toString()}`));
		flaskProcess.stderr.on('data', d => console.error(`[flask] ${d.toString()}`));
		flaskProcess.on('error', err => console.error('Failed to start Flask:', err));
		flaskProcess.on('exit', (code, signal) => console.log(`Flask exited: code=${code}, signal=${signal}`));
	}
	catch{
		// Catch is literally just to hope that it is our own flask server
		
	}
		
	
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
	vscode.commands.registerCommand('mcstas.chooseMcStasResourceFolder', () => {
		setMcStasPath();
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

  // Start the client. This will also launch the server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
	console.log("Deactivating extension")
  if (!client) {
    return undefined;
  }

  if (flaskProcess) {
    flaskProcess.kill();
    flaskProcess = undefined;
  }

  return client.stop();
}