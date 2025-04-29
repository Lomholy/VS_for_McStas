import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ComponentProvider implements vscode.TreeDataProvider<Component> {
	constructor(private workspaceRoot: string) {}

	private _onDidChangeTreeData: vscode.EventEmitter<Component | undefined | void> = new vscode.EventEmitter<Component | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<Component | undefined | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Component): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);

		treeItem.command = {
            command: 'vs-for-mcstas.openCompDialog',
            title: 'Open .comp file',
            arguments: [element.fullPath]
        };
		return treeItem;
	}

	getChildren(element?: Component): Thenable<Component[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No folder found');
			return Promise.resolve([]);
		}

		const dirPath = element ? element.fullPath : this.workspaceRoot;

		return Promise.resolve(this.getComponentsInDirectory(dirPath));
	}

	private getComponentsInDirectory(dirPath: string): Component[] {
		if (!this.pathExists(dirPath)) {
			return [];
		}
	
		const entries = fs.readdirSync(dirPath);
	
		const items = entries.map(name => {
			const fullPath = path.join(dirPath, name);
			const stat = fs.statSync(fullPath);
	
			return { name, fullPath, isDirectory: stat.isDirectory() };
		})
		.filter(entry => {
			// Always ignore 'data' and 'examples' folders
			if (entry.isDirectory && (entry.name === 'data' || entry.name === 'examples')) {
				return false;
			}
			// If we are at the root level, show only folders
			if (dirPath === this.workspaceRoot) {
				return entry.isDirectory;
			} else {
				// Inside folders: show folders + .comp files only
				return entry.isDirectory || entry.name.endsWith('.comp');
			}
		})
		.map(entry => new Component(
			entry.name,
			entry.fullPath,
			entry.isDirectory
				? vscode.TreeItemCollapsibleState.Collapsed
				: vscode.TreeItemCollapsibleState.None
		));
	
		return items;
	}

	private pathExists(p: string): boolean {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}
		return true;
	}
}

export class Component extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly fullPath: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(label, collapsibleState);
		this.contextValue = 'compFile'; // <- very important
		this.tooltip = this.fullPath;
		this.resourceUri = vscode.Uri.file(this.fullPath);

		if (fs.existsSync(this.fullPath)) {
			const stat = fs.statSync(this.fullPath);
			this.iconPath = stat.isDirectory()
				? vscode.ThemeIcon.Folder
				: vscode.ThemeIcon.File;
		}
	}
}







