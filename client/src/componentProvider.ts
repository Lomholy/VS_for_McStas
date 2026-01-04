import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type ComponentData = {
    name: string;
    category: string;
};



function resolveCompPathFromConda(category: string, compName: string): string | undefined {
  for (const envPrefix of getCandidateCondaEnvs()) {
	
    const p = path.join(envPrefix, 'share', 'mcstas', 'resources', category, `${compName}.comp`);
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return undefined;
}

/**
 * Collect candidate Conda environment prefixes to test.
 * 1) Active env via CONDA_PREFIX
 * 2) Known env directories: ~/.conda/envs, ~/miniconda3/envs, ~/anaconda3/envs
 *    (we add each subfolder as an env prefix)
 */
function getCandidateCondaEnvs(): string[] {
  const candidates: string[] = [];

  // 1) Active environment
  const active = process.env.CONDA_PREFIX;
  if (active && fs.existsSync(active)) {
    candidates.push(active);
  }

  // 2) Common envs directories
  const home = os.homedir();
  const envDirs = [
    path.join(home, '.conda', 'envs'),
    path.join(home, 'miniconda3', 'envs'),
	path.join(home, 'miniforge3', 'envs'),
    path.join(home, 'anaconda3', 'envs'),
    path.join(home, 'mambaforge', 'envs'),
    path.join(home, 'micromamba', 'envs'),
  ];

  for (const envDir of envDirs) {
    if (!fs.existsSync(envDir)) continue;

    try {
      for (const entry of fs.readdirSync(envDir)) {
        const envPath = path.join(envDir, entry);
        // We consider any directory in envs/ as a potential env prefix
        if (fs.existsSync(envPath) && fs.statSync(envPath).isDirectory()) {
          candidates.push(envPath);
        }
      }
    } catch {
      /* keep it minimal: ignore errors */
    }
  }

  // De-dupe while preserving order
  return Array.from(new Set(candidates));
}

export async function activateComponentViewer(context: vscode.ExtensionContext) {
    const jsonPath = context.asAbsolutePath('./server/src/methods/textDocument/mcstas-comps.json');
    vscode.window.registerTreeDataProvider('Component_viewer', new ComponentProvider(jsonPath, context));
}

class ComponentProvider implements vscode.TreeDataProvider<Component> {
    private _onDidChangeTreeData = new vscode.EventEmitter<Component | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private data: Record<string, ComponentData[]> = {};

    constructor(private jsonFile: string, private ctx: vscode.ExtensionContext) {
        this.loadData();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: Component): vscode.TreeItem {
        return element;
    }

    getChildren(element?: Component): Thenable<Component[]> {
        if (!element) {
            // Root level: categories
            return Promise.resolve(Object.keys(this.data).map(cat =>
                new Component(cat, vscode.TreeItemCollapsibleState.Collapsed)
            ));
        } else {
            // Category level: components
            const comps = this.data[element.label] || [];
            return Promise.resolve(comps.map(comp => {
                // Try to resolve fullPath (optional)

			const fullPath = resolveCompPathFromConda(comp.category, comp.name);
			const item = new Component(comp.name, vscode.TreeItemCollapsibleState.None, fullPath);
			item.command = {
  				command: 'vs-for-mcstas.openCompDialog',
  				title: 'Open Component',
  				arguments: [fullPath ?? comp.name] // prefer fullPath when available, fallback to name
				};
			return item;
            }));
        }
    }

    private loadData() {
        const raw = fs.readFileSync(this.jsonFile, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, any>;
        this.data = {};

        for (const key of Object.keys(parsed)) {
            const comp = parsed[key];
            const category = comp.category || 'Uncategorized';
            if (!this.data[category]) this.data[category] = [];
            this.data[category].push({ name: comp.name, category });
        }
    }
}

export class Component extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly fullPath?: string // ✅ Optional now
    ) {
        super(label, collapsibleState);
        this.contextValue = 'compFile';
        this.tooltip = this.fullPath ?? this.label;

        if (this.fullPath) {
            this.resourceUri = vscode.Uri.file(this.fullPath);
            if (fs.existsSync(this.fullPath)) {
                const stat = fs.statSync(this.fullPath);
                this.iconPath = stat.isDirectory()
                    ? vscode.ThemeIcon.Folder
                    : vscode.ThemeIcon.File;
            }
        } else {
            this.iconPath = vscode.ThemeIcon.File; // Default icon if no path
        }
    }
}

