"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTemplateInstr = createTemplateInstr;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
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