"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcdisplayCommand = mcdisplayCommand;
const vscode = require("vscode");
const path = require("path");
const mcrunView_1 = require("./mcrunView");
function mcdisplayCommand() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }
    const file = editor.document;
    const text = file.getText();
    const match = text.match(/DEFINE INSTRUMENT\s+(\w+)\s*\(([^)]*)\)/s);
    if (!match) {
        vscode.window.showErrorMessage('Could not find instrument definition.');
        return;
    }
    const instrName = match[1];
    const paramString = match[2];
    const paramRegex = /(?:int|string)?\s*(\w+)\s*=\s*([^,]+)(?:,|$)/g;
    const params = [];
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramString)) !== null) {
        params.push({
            name: paramMatch[1],
            defaultValue: paramMatch[2].trim().replace(/^"|"$/g, '')
        });
    }
    const panel = vscode.window.createWebviewPanel('mcstasDisplay', `Display McStas: ${instrName}`, vscode.ViewColumn.One, { enableScripts: true });
    panel.webview.html = (0, mcrunView_1.getWebviewHtml)(instrName, params);
    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'run') {
            const values = message.values;
            const args = Object.entries(values)
                .map(([k, v]) => `${k}=${/^\d+(\.\d+)?$/.test(v) ? v : `"${v}"`}`)
                .join(' ');
            // mcdisplay reads the file from disk and writes its output next to it
            if (file.isDirty && !(await file.save())) {
                return;
            }
            const terminal = vscode.window.createTerminal({ name: 'McStas Display', cwd: path.dirname(file.uri.fsPath) });
            terminal.show();
            terminal.sendText(`mcdisplay "${path.basename(file.uri.fsPath)}" ${args}`);
        }
    });
}
//# sourceMappingURL=mcdisplayCommand.js.map