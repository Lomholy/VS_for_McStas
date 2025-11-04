"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcplotCommand = mcplotCommand;
const vscode = require("vscode");
async function mcplotCommand() {
    // Prompt user to pick a folder
    const folderUris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        canSelectFolders: true,
        canSelectFiles: false,
        openLabel: 'Select simulation output folder'
    });
    if (!folderUris || folderUris.length === 0) {
        vscode.window.showInformationMessage('No folder selected.');
        return;
    }
    const folderPath = folderUris[0].fsPath;
    // Launch mcplot with the selected folder
    const terminal = vscode.window.createTerminal('McStas Plot');
    terminal.show();
    terminal.sendText(`mcplot "${folderPath}"`);
}
//# sourceMappingURL=mcplotCommand.js.map