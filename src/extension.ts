import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {openCompDialog} from './dialogue'
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
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (!workspaceFolders || workspaceFolders.length === 0) {
		  vscode.window.showErrorMessage('No workspace folder is open.');
		  return;
		}
  
		const workspaceRoot = workspaceFolders[0].uri.fsPath;
  
		// Define your source file path (adjust accordingly)
		const rootPath = path.join(context.extensionPath, 'src', 'template.instr');
		const destPath = path.join(workspaceRoot, 'template.instr');
		

		try {
			await fs.promises.copyFile(rootPath, destPath);
			vscode.window.showInformationMessage(`File copied to ${destPath}`);
		
			// Switch to Explorer view
			await vscode.commands.executeCommand('workbench.view.explorer');
		
			// Open the new file in the editor
			const fileUri = vscode.Uri.file(destPath);
			const doc = await vscode.workspace.openTextDocument(fileUri);
			await vscode.window.showTextDocument(doc, { preview: false });
		
		  } catch (error) {
			vscode.window.showErrorMessage(`Failed to copy file: ${error}`);
		  }
	})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('mcstas.mcrun', async () => {
		  const editor = vscode.window.activeTextEditor;
		  if (!editor) {
			vscode.window.showErrorMessage('No active editor found.');
			return;
		  }
	
		  const fileUri = editor.document.uri;
		  const fileName = path.basename(fileUri.fsPath);
		  if (!fileName.endsWith('.instr')) {
			vscode.window.showErrorMessage('The current file is not a .instr file.');
			return;
		  }
	
		  const fileContent = editor.document.getText();
		  // Match: DEFINE INSTRUMENT name(params...)
		  const defineMatch = fileContent.match(/DEFINE\s+INSTRUMENT\s+(\w+)\s*\(([^)]*)\)/s);
		  if (!defineMatch) {
			vscode.window.showErrorMessage('No DEFINE INSTRUMENT(...) block found.');
			return;
		  }
		  const instrName = defineMatch[1];
		  const paramBlock = defineMatch[2];
	
		 
		// Split by commas (ignoring commas inside strings)
		const paramRegex = /(?:int|string|float|double)?\s*(\w+)\s*=\s*("[^"]*"|[^,]*)/g;
		const inputs: Record<string, string> = {};

		let match;
		while ((match = paramRegex.exec(paramBlock)) !== null) {
			const paramName = match[1].trim();
			const defaultValue = match[2].trim().replace(/^"|"$/g, '');
		
			const input = await vscode.window.showInputBox({
				prompt: `Enter value for ${paramName}`,
				value: defaultValue,
			});
	
			if (input === undefined) {
				vscode.window.showWarningMessage('Operation cancelled.');
				return;
			}
	
			inputs[paramName] = input;
			}
	
			const args = Object.entries(inputs)
			.map(([key, value]) => {
				const quoted = /^\d+(\.\d+)?$/.test(value) ? value : `"${value}"`;
				return `${key}=${quoted}`;
			})
			.join(' ');
	
			const terminal = vscode.window.createTerminal('McStas Simulation');
			terminal.show();
			terminal.sendText(`mcrun ${fileName} ${args}`);
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



function getWebviewHtml(instrName: string, params: { name: string; defaultValue: string }[]): string {
	const inputs = params
	  .map(
		p => `
		  <label for="${p.name}">${p.name}</label>
		  <input id="${p.name}" name="${p.name}" value="${p.defaultValue}" />
		`
	  )
	  .join('<br><br>');
  
	return `
	  <!DOCTYPE html>
	  <html lang="en">
	  <head>
		<meta charset="UTF-8" />
		<style>
		  body { font-family: sans-serif; padding: 1rem; }
		  input { width: 100%; padding: 0.4rem; margin-top: 0.2rem; }
		  button { margin-top: 1rem; padding: 0.5rem 1rem; font-weight: bold; }
		</style>
	  </head>
	  <body>
		<h2>Run McStas Simulation: ${instrName}</h2>
		<form id="paramForm">
		  ${inputs}
		  <button type="submit">Run Simulation</button>
		</form>
  
		<script>
		  const vscode = acquireVsCodeApi();
		  document.getElementById('paramForm').addEventListener('submit', (e) => {
			e.preventDefault();
			const form = e.target;
			const values = {};
			for (const el of form.elements) {
			  if (el.name) values[el.name] = el.value;
			}
			vscode.postMessage({ command: 'run', values });
		  });
		</script>
	  </body>
	  </html>
	`;
  }