"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Component = exports.ComponentProvider = void 0;
exports.askUserForPath = askUserForPath;
exports.setMcStasPath = setMcStasPath;
exports.activateComponentViewer = activateComponentViewer;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function askUserForPath() {
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
async function setMcStasPath() {
    let rootPath = await askUserForPath();
    if (rootPath) {
        await vscode.workspace.getConfiguration().update('componentViewer.rootPath', rootPath, vscode.ConfigurationTarget.Global);
    }
    else {
        vscode.window.showWarningMessage('No path selected for Component Viewer.');
        return;
    }
}
async function activateComponentViewer(context) {
    let rootPath = vscode.workspace.getConfiguration().get('componentViewer.rootPath');
    if (!rootPath) {
        rootPath = await askUserForPath();
        if (rootPath) {
            await vscode.workspace.getConfiguration().update('componentViewer.rootPath', rootPath, vscode.ConfigurationTarget.Global);
        }
        else {
            vscode.window.showWarningMessage('No path selected for Component Viewer.');
            return;
        }
    }
    vscode.window.registerTreeDataProvider('Component_viewer', new ComponentProvider(rootPath));
}
class ComponentProvider {
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);
        treeItem.command = {
            command: 'vs-for-mcstas.openCompDialog',
            title: 'Open .comp file',
            arguments: [element.fullPath]
        };
        return treeItem;
    }
    getChildren(element) {
        if (!this.workspaceRoot) {
            vscode.window.showInformationMessage('No folder found');
            return Promise.resolve([]);
        }
        const dirPath = element ? element.fullPath : this.workspaceRoot;
        return Promise.resolve(this.getComponentsInDirectory(dirPath));
    }
    getComponentsInDirectory(dirPath) {
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
            }
            else {
                // Inside folders: show folders + .comp files only
                return entry.isDirectory || entry.name.endsWith('.comp');
            }
        })
            .map(entry => new Component(entry.name, entry.fullPath, entry.isDirectory
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None));
        return items;
    }
    pathExists(p) {
        try {
            fs.accessSync(p);
        }
        catch (err) {
            return false;
        }
        return true;
    }
}
exports.ComponentProvider = ComponentProvider;
class Component extends vscode.TreeItem {
    label;
    fullPath;
    collapsibleState;
    constructor(label, fullPath, collapsibleState) {
        super(label, collapsibleState);
        this.label = label;
        this.fullPath = fullPath;
        this.collapsibleState = collapsibleState;
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
exports.Component = Component;
//# sourceMappingURL=componentProvider.js.map