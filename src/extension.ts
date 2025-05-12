import * as vscode from 'vscode';
import { createTemplateInstr } from './createTemplateInstr';
import {openCompDialog} from './dialogue'
import { mcrunCommand } from './mrunCommand';
import { ComponentProvider, Component, activateComponentViewer, setMcStasPath} from './componentProvider'; // assuming this file is componentProvider.ts
import { mcdisplayCommand } from './mcdisplayCommand';
import { mcplotCommand } from './mcplotCommand';

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
}

export function deactivate() {}




  