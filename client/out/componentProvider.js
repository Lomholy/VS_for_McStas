"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Component = void 0;
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
function resolveCompPathFromConda(category, compName) {
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
    const jsonPath = context.asAbsolutePath('./server/src/methods/textDocument/mcstas-comps.json');
    vscode.window.registerTreeDataProvider('Component_viewer', new ComponentProvider(jsonPath, context));
}
class ComponentProvider {
    constructor(jsonFile, ctx) {
        this.jsonFile = jsonFile;
        this.ctx = ctx;
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
            // Root level: categories
            return Promise.resolve(Object.keys(this.data).map(cat => {
                const item = new Component(cat, vscode.TreeItemCollapsibleState.Collapsed);
                // Set a category icon explicitly
                item.iconPath = getCategoryIcon(cat);
                return item;
            }));
        }
        else {
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
    loadData() {
        const raw = fs.readFileSync(this.jsonFile, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = {};
        for (const key of Object.keys(parsed)) {
            const comp = parsed[key];
            const category = comp.category || 'Uncategorized';
            if (!this.data[category])
                this.data[category] = [];
            this.data[category].push({ name: comp.name, category });
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