import * as vscode from 'vscode';
import { createTemplateInstr } from './createTemplateInstr';
import {openCompDialog} from './dialogue'
import { getWebviewHtml } from './mcrunView';
import { mcrunCommand } from './mrunCommand';
import { ComponentProvider, Component } from './componentProvider'; // assuming this file is componentProvider.ts

export function activate(context: vscode.ExtensionContext) {
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
	context.subscriptions.push(
	vscode.commands.registerCommand('mcstas.createNewInstr', async () => {
		createTemplateInstr(context);
	})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mcstas.mcrun', async () => {
			mcrunCommand();
	})
	);

	vscode.commands.registerCommand('mcstas.mcdisplay', () => {
		vscode.window.showInformationMessage('Hellop from mcdisp!');
	});
	vscode.commands.registerCommand('mcstas.mcplot', () => {
		vscode.window.showInformationMessage('Hello from mcplot!');
	});
	
	console.log(context.subscriptions);
}

export function deactivate() {}

async function askUserForPath(): Promise<string | undefined> {
	const folders = await vscode.window.showOpenDialog({
		canSelectFolders: true,
		canSelectFiles: false,
		canSelectMany: false,
		openLabel: 'Select a folder for Component Viewer'
	});

	if (folders && folders.length > 0) {
		return folders[0].fsPath;
	}
	return undefined;
}

async function activateComponentViewer(context: vscode.ExtensionContext) {
	let rootPath = vscode.workspace.getConfiguration().get<string>('componentViewer.rootPath');

	if (!rootPath) {
		rootPath = await askUserForPath();

		if (rootPath) {
			await vscode.workspace.getConfiguration().update('componentViewer.rootPath', rootPath, vscode.ConfigurationTarget.Global);
		} else {
			vscode.window.showWarningMessage('No path selected for Component Viewer.');
			return;
		}
	}

	vscode.window.registerTreeDataProvider(
		'Component_viewer',
		new ComponentProvider(rootPath)
	);
}




  