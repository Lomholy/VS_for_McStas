import * as vscode from 'vscode';
import * as path from 'path';
import { getWebviewHtml } from './mcrunView';
export function mcrunCommand() {
    const editor = vscode.window.activeTextEditor;
        if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }

    const fileName = path.basename(editor.document.uri.fsPath);
    const fileContent = editor.document.getText();

    const defineMatch = fileContent.match(/DEFINE\s+INSTRUMENT\s+(\w+)\s*\(([^)]*)\)/s);
    if (!defineMatch) {
        vscode.window.showErrorMessage('No DEFINE INSTRUMENT(...) block found.');
        return;
    }

    const instrName = defineMatch[1];
    const paramBlock = defineMatch[2];

    const paramRegex = /(?:int|string|float|double)?\s*(\w+)\s*=\s*("[^"]*"|[^,]*)/g;
    const params: { name: string; defaultValue: string }[] = [];
    let match;
    while ((match = paramRegex.exec(paramBlock)) !== null) {
        params.push({
        name: match[1].trim(),
        defaultValue: match[2].trim().replace(/^"|"$/g, ''),
        });
    }

    const panel = vscode.window.createWebviewPanel(
        'mcstasParameters',
        `Run McStas: ${instrName}`,
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getWebviewHtml(instrName, params);

    panel.webview.onDidReceiveMessage(async (message: any) => {
        if (message.command === 'run') {
        const values = message.values as Record<string, string>;
    
        const args = Object.entries(values)
            .map(([k, v]) => `${k}=${/^\d+(\.\d+)?$/.test(v) ? v : `"${v}"`}`)
            .join(' ');
    
        const terminal = vscode.window.createTerminal('McStas Simulation');
        terminal.show();
        terminal.sendText(`mcrun ${fileName} ${args}`);
        }
    });
}