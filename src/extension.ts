import * as vscode from 'vscode';
import {openCompDialog} from './dialogue'
import { ComponentProvider } from './componentProvider'; // assuming this file is componentProvider.ts

export function activate(context: vscode.ExtensionContext) {
	activateComponentViewer(context);
	context.subscriptions.push(
        vscode.commands.registerCommand('vs-for-mcstas.openCompDialog', openCompDialog)
    );
	console.log('Congratulations, your extension "vs-for-mcstas" is now active!');

	const disposable = vscode.commands.registerCommand('vs-for-mcstas.addcomponent', () => {
		vscode.window.showInformationMessage(`Running command!`);
	});

	context.subscriptions.push(disposable);
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

// // The module 'vscode' contains the VS Code extensibility API
// // Import the module and reference it with the alias vscode in your code below
// import * as vscode from 'vscode';

// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed
// export function activate(context: vscode.ExtensionContext) {
// 	activateComponentViewer(context)
// 	// Use the console to output diagnostic information (console.log) and errors (console.error)
// 	// This line of code will only be executed once when your extension is activated
// 	console.log('Congratulations, your extension "vs-for-mcstas" is now active!');

// 	// The command has been defined in the package.json file
// 	// Now provide the implementation of the command with registerCommand
// 	// The commandId parameter must match the command field in package.json
// 	// const disposable = vscode.commands.registerCommand('vs-for-mcstas.helloWorld', () => {
// 	// 	// The code you place here will be executed every time your command is executed
// 	// 	// Display a message box to the user
// 	// 	vscode.window.showInformationMessage('VS_for_McStas rocks!');
// 	// });
// 	const disposable = vscode.commands.registerCommand('vs-for-mcstas.addcomponent', () => {

// 		vscode.window.showInformationMessage(`Running command!`);
// 		});

// 	context.subscriptions.push(disposable);
// }
// // This method is called when your extension is deactivated
// export function deactivate() {}

// async function askUserForPath(): Promise<string | undefined> {
// 	const folders = await vscode.window.showOpenDialog({
// 	  canSelectFolders: true,
// 	  canSelectFiles: false,
// 	  canSelectMany: false,
// 	  openLabel: 'Select a folder for Component Viewer'
// 	});
  
// 	if (folders && folders.length > 0) {
// 	  return folders[0].fsPath;
// 	}
	
// 	return undefined;
//   }

// async function activateComponentViewer(context: vscode.ExtensionContext) {
// 	let rootPath = vscode.workspace.getConfiguration().get<string>('componentViewer.rootPath');

// 	if (!rootPath) {
// 		rootPath = await askUserForPath();

// 		if (rootPath) {
// 		await vscode.workspace.getConfiguration().update('componentViewer.rootPath', rootPath, vscode.ConfigurationTarget.Global);
// 		} else {
// 		vscode.window.showWarningMessage('No path selected for Component Viewer.');
// 		return;
// 		}
// 	}

// 	vscode.window.registerTreeDataProvider(
// 		'Component_viewer',
// 		new ComponentProvider(rootPath)
// 	);
// }




// import * as fs from 'fs';
// import * as path from 'path';


// export class ComponentProvider implements vscode.TreeDataProvider<Component> {
//   constructor(private workspaceRoot: string) {}

//   getTreeItem(element: Component): vscode.TreeItem {
//     return element;
//   }

//   getChildren(element?: Component): Thenable<Component[]> {
//     if (!this.workspaceRoot) {
//       vscode.window.showInformationMessage('No Component in empty workspace');
//       return Promise.resolve([]);
//     }

//     if (element) {
//       return Promise.resolve(
//         this.getCompsInPath(
//           path.join(this.workspaceRoot, 'node_modules', element.label, 'package.json')
//         )
//       );
//     } else {
//       const compPath = path.join(this.workspaceRoot, 'package.json');
//       if (this.pathExists(compPath)) {
//         return Promise.resolve(this.getCompsInPath(compPath));
//       } else {
//         vscode.window.showInformationMessage('Workspace has no package.json');
//         return Promise.resolve([]);
//       }
//     }
//   }
// 	private pathExists(p: string): boolean {
//     try {
// 		fs.accessSync(p);
// 		} catch (err) {
// 		return false;
// 		}
// 		return true;
// 	}

//   /**
//    * Given the path to package.json, read all its dependencies and devDependencies.
//    */
//   private getCompsInPath(compPath: string): Component[] {
//     if (this.pathExists(compPath)) {
// 		console.log(compPath);
//       const toDep = (moduleName: string, version: string): Component => {
//         if (this.pathExists(path.join(this.workspaceRoot, 'node_modules', moduleName))) {
//           return new Component(
//             moduleName,
//             version,
//             vscode.TreeItemCollapsibleState.Collapsed
//           );
//         } else {
//           return new Component(moduleName, version, vscode.TreeItemCollapsibleState.None);
//         }
//       };

//       const packageJson = JSON.parse(fs.readFileSync(compPath, 'utf-8'));

//       const deps = packageJson.dependencies
//         ? Object.keys(packageJson.dependencies).map(dep =>
//             toDep(dep, packageJson.dependencies[dep])
//           )
//         : [];
//       const devDeps = packageJson.devDependencies
//         ? Object.keys(packageJson.devDependencies).map(dep =>
//             toDep(dep, packageJson.devDependencies[dep])
//           )
//         : [];
//       return deps.concat(devDeps);
//     } else {
//       return [];
//     }
//   }
// }

// class Component extends vscode.TreeItem {
// 	constructor(
// 		public readonly label: string,
// 		private version: string,
// 		public readonly collapsibleState: vscode.TreeItemCollapsibleState
// 	) {
// 		super(label, collapsibleState);
// 		this.tooltip = `${this.label}-${this.version}`;
// 		this.description = this.version;
// 	}

// 	// iconPath = {
// 	// 	light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
// 	// 	dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
// 	// };
// }




// class Dependency extends vscode.TreeItem {
//   constructor(
//     public readonly label: string,
//     private version: string,
//     public readonly collapsibleState: vscode.TreeItemCollapsibleState
//   ) {
//     super(label, collapsibleState);
//     this.tooltip = `${this.label}-${this.version}`;
//     this.description = this.version;
//   }

// //   iconPath = {
// //     light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
// //     dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
// //   };
// }

// const rootPath =
//   vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
//     ? vscode.workspace.workspaceFolders[0].uri.fsPath
//     : undefined;
// vscode.window.createTreeView('nodeDependencies', {
// 	treeDataProvider: new NodeDependenciesProvider(rootPath)
//   });