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
exports.mcdisplayCommand = mcdisplayCommand;
const vscode = __importStar(require("vscode"));
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