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
exports.createTemplateInstr = createTemplateInstr;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
async function createTemplateInstr(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return;
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    // Define your source file path (adjust accordingly)
    const rootPath = path.join(context.extensionPath, 'media', 'template.instr');
    let destPath = path.join(workspaceRoot, 'template.instr');
    if (fs.existsSync(destPath)) {
        const extension = path.extname(rootPath);
        const baseName = path.basename(rootPath, extension);
        let counter = 1;
        // Create a new name for the file (template_copy.instr, template_copy(1).instr, etc.)
        while (fs.existsSync(destPath)) {
            destPath = path.join(workspaceRoot, `${baseName}_copy${counter}${extension}`);
            counter++;
        }
    }
    try {
        await fs.promises.copyFile(rootPath, destPath);
        vscode.window.showInformationMessage(`File copied to ${destPath}`);
        // Switch to Explorer view
        await vscode.commands.executeCommand('workbench.view.explorer');
        // Open the new file in the editor
        const fileUri = vscode.Uri.file(destPath);
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, { preview: false });
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to copy file: ${error}`);
    }
}
//# sourceMappingURL=createTemplateInstr.js.map