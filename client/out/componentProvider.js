"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Component = void 0;
exports.resolveCompPathFromConda = resolveCompPathFromConda;
exports.activateComponentViewer = activateComponentViewer;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
function getCategoryIcon(label) {
    const key = label.toLowerCase();
    const map = {
        'sources': 'symbol-variable',
        'optics': 'mirror', // fallback will handle if 'mirror' isn't available in some versions
        'samples': 'beaker',
        'uncategorized': 'question',
        'monitors': 'eye',
        'misc': 'gear',
        'contrib': 'account',
        'obsolete': 'trash',
        'union': 'combine',
    };
    const iconName = map[key] ?? 'folder';
    return new vscode.ThemeIcon(iconName);
}
// The environment chosen with "Choose McStas Conda Environment", or undefined for the automatic search
function chosenCondaEnv() {
    return vscode.workspace.getConfiguration('mcstas').get('condaEnvironment')?.trim() || undefined;
}
function hasMcStasResources(envPrefix) {
    return fs.existsSync(path.join(envPrefix, 'share', 'mcstas', 'resources'));
}
function resolveCompPathFromConda(category, compName) {
    const chosen = chosenCondaEnv();
    for (const envPrefix of chosen ? [chosen] : getCandidateCondaEnvs()) {
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
function getCandidateCondaEnvs() {
    const candidates = [];
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
        if (!fs.existsSync(envDir))
            continue;
        try {
            for (const entry of fs.readdirSync(envDir)) {
                const envPath = path.join(envDir, entry);
                // We consider any directory in envs/ as a potential env prefix
                if (fs.existsSync(envPath) && fs.statSync(envPath).isDirectory()) {
                    candidates.push(envPath);
                }
            }
        }
        catch {
            /* keep it minimal: ignore errors */
        }
    }
    // De-dupe while preserving order
    return Array.from(new Set(candidates));
}
async function activateComponentViewer(context) {
    const jsonPath = context.asAbsolutePath('./server/python/src/mcstas_ls/data/mcstas-comps.json');
    const provider = new ComponentProvider(jsonPath);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('Component_viewer', provider), vscode.commands.registerCommand('mcstas.chooseCondaEnvironment', chooseCondaEnvironment), vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('mcstas.condaEnvironment')) {
            provider.refresh();
        }
    }));
}
// Lets the user pick the conda environment used to find .comp files; stored in the user settings
async function chooseCondaEnvironment() {
    const current = chosenCondaEnv();
    const items = [
        { label: '$(search) Automatic', description: 'Search the active and the usual conda environments', value: '' },
        ...getCandidateCondaEnvs().filter(hasMcStasResources).map(env => ({
            label: `$(package) ${path.basename(env)}`, description: env, value: env,
        })),
        { label: '$(folder) Browse...', description: 'Choose an environment folder', browse: true },
    ];
    for (const item of items) {
        if (!item.browse && (item.value || undefined) === current) {
            item.detail = 'Current setting';
        }
    }
    const picked = await vscode.window.showQuickPick(items, {
        title: 'Conda environment with McStas (used by "Open Component File")',
    });
    if (!picked) {
        return;
    }
    let value = picked.value;
    if (picked.browse) {
        const folder = await vscode.window.showOpenDialog({
            canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
            openLabel: 'Use this environment',
        });
        if (!folder) {
            return;
        }
        value = folder[0].fsPath;
        if (!hasMcStasResources(value)) {
            vscode.window.showWarningMessage(`${value} has no share/mcstas/resources folder, so it does not look like a McStas environment. The setting was not changed.`);
            return;
        }
    }
    await vscode.workspace.getConfiguration('mcstas').update('condaEnvironment', value || undefined, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(value ? `McStas components are now read from ${value}.` : 'McStas components are found automatically again.');
}
class ComponentProvider {
    constructor(jsonFile) {
        this.jsonFile = jsonFile;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.data = {};
        this.loadData();
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            // Root level: categories → sort alphabetically (case-insensitive)
            const categories = Object.keys(this.data)
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            return Promise.resolve(categories.map(cat => {
                const item = new Component(cat, vscode.TreeItemCollapsibleState.Collapsed);
                item.iconPath = getCategoryIcon(cat);
                return item;
            }));
        }
        else {
            // Category level: components → sort alphabetically by name (case-insensitive)
            const comps = (this.data[element.label] || [])
                .slice() // don’t mutate original
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            return Promise.resolve(comps.map(comp => {
                const fullPath = resolveCompPathFromConda(comp.category, comp.name);
                const item = new Component(comp.name, vscode.TreeItemCollapsibleState.None, fullPath);
                item.command = {
                    command: 'vs-for-mcstas.openCompDialog',
                    title: 'Open Component',
                    arguments: [fullPath ?? comp.name]
                };
                return item;
            }));
        }
    }
    loadData() {
        const raw = fs.readFileSync(this.jsonFile, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {};
        for (const key of Object.keys(parsed)) {
            const comp = parsed[key];
            const category = comp.category || 'Uncategorized';
            if (!this.data[category])
                this.data[category] = [];
            // Components without data are stored as a string, so fall back to the key
            this.data[category].push({ name: comp.name ?? key, category });
        }
    }
}
class Component extends vscode.TreeItem {
    constructor(label, collapsibleState, fullPath // ✅ Optional now
    ) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.fullPath = fullPath;
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
        }
        else {
            this.iconPath = vscode.ThemeIcon.File; // Default icon if no path
        }
    }
}
exports.Component = Component;
//# sourceMappingURL=componentProvider.js.map