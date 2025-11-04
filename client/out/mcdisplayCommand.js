"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcdisplayCommand = mcdisplayCommand;
const vscode = require("vscode");
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
            const terminal = vscode.window.createTerminal('McStas Display');
            terminal.show();
            terminal.sendText(`mcdisplay ${file.fileName} ${args}`);
        }
    });
}
//# sourceMappingURL=mcdisplayCommand.js.map