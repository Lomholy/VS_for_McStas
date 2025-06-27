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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const createTemplateInstr_1 = require("./createTemplateInstr");
const dialogue_1 = require("./dialogue");
const mrunCommand_1 = require("./mrunCommand");
const componentProvider_1 = require("./componentProvider"); // assuming this file is componentProvider.ts
const mcdisplayCommand_1 = require("./mcdisplayCommand");
const mcplotCommand_1 = require("./mcplotCommand");
const global_params_1 = require("./global_params");
function activate(context) {
    (0, global_params_1.setExtensionRootPath)(context.extensionPath);
    (0, componentProvider_1.activateComponentViewer)(context); // Read the component tree
    context.subscriptions.push(// Allow user to insert a component
    vscode.commands.registerCommand('vs-for-mcstas.openCompDialog', dialogue_1.openCompDialog));
    vscode.commands.registerCommand('mcstas.openCompFile', async (resource) => {
        // Allow user to open each component file
        // Make sure it is a proper file URI
        const fileUri = vscode.Uri.file(resource.fullPath);
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    });
    vscode.commands.registerCommand('mcstas.createNewInstr', async () => {
        (0, createTemplateInstr_1.createTemplateInstr)(context);
    });
    vscode.commands.registerCommand('mcstas.mcrun', async () => {
        (0, mrunCommand_1.mcrunCommand)();
    });
    vscode.commands.registerCommand('mcstas.mcdisplay', () => {
        (0, mcdisplayCommand_1.mcdisplayCommand)();
    });
    vscode.commands.registerCommand('mcstas.mcplot', () => {
        (0, mcplotCommand_1.mcplotCommand)();
    });
    vscode.commands.registerCommand('mcstas.chooseMcStasResourceFolder', () => {
        (0, componentProvider_1.setMcStasPath)();
    });
    console.log(context.subscriptions);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map