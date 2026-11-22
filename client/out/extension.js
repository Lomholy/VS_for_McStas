"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const createTemplateInstr_1 = require("./createTemplateInstr");
const dialogue_1 = require("./dialogue");
const mrunCommand_1 = require("./mrunCommand");
const path = require("path");
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
const componentProvider_1 = require("./componentProvider"); // assuming this file is componentProvider.ts
const mcdisplayCommand_1 = require("./mcdisplayCommand");
const mcplotCommand_1 = require("./mcplotCommand");
const global_params_1 = require("./global_params");
const formatter_1 = require("./formatter");
const formatConfig_1 = require("./formatConfig");
const detectPythonServer_1 = require("./detectPythonServer");
let client;
async function activate(context) {
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
    vscode.commands.registerCommand('mcstas.openClangFormatHelp', () => {
        vscode.window.showInformationMessage("To install clang-format:\n" +
            "▶ macOS: brew install clang-format\n" +
            "▶ Ubuntu/Debian: sudo apt install clang-format\n" +
            "▶ Windows: Install LLVM from https://llvm.org\n" +
            "After installation, restart VS Code.");
    });
    vscode.commands.registerCommand('mcstas.openPythonServerHelp', () => {
        vscode.window.showInformationMessage("The extension installs its Python language server into its own virtual environment, using python3 (3.9 or newer) from PATH. If that failed:\n" +
            "▶ Install Python 3.9 or newer and make sure python3 is on PATH when VS Code starts.\n" +
            "▶ Or install the server yourself: pipx install \"git+https://github.com/Lomholy/VS_for_McStas#subdirectory=server/python\"\n" +
            "After installation, restart VS Code.");
    });
    console.log(context.subscriptions);
    // The language server is the Python package in server/python, run from PATH or from the extension's own venv
    const pythonServer = await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: 'McStas Language Server: setting up' }, () => (0, detectPythonServer_1.resolvePythonServer)(context.globalStorageUri.fsPath, context.asAbsolutePath(path.join('server', 'python')), context.extension.packageJSON.version, (m) => console.log(`[mcstas] ${m}`)));
    if (!pythonServer) {
        vscode.window.showWarningMessage('McStas Language Server: Could not install the Python language server. Hover and completion will not work until python3 (3.9 or newer) is on PATH, or mcstas-language-server is installed.', 'Installation Help').then(btn => {
            if (btn === 'Installation Help') {
                vscode.commands.executeCommand('mcstas.openPythonServerHelp');
            }
        });
    }
    const serverOptions = {
        command: pythonServer ?? 'mcstas-language-server',
        transport: node_1.TransportKind.stdio,
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for all documents by default
        documentSelector: [
            { scheme: 'file', language: 'mccode' },
        ],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher("**/.clientrc"),
        },
    };
    // Create the language client and start the client.
    client = new node_1.LanguageClient("mcinstr language-server-id", "mcstas-language-server language server name", serverOptions, clientOptions);
    // Check for clang-format on system
    const cfg = vscode.workspace.getConfiguration('mcstas.formatter');
    const userPath = cfg.get('clangFormatPath')?.trim() || undefined;
    const found = await (0, formatConfig_1.detectClangFormat)({
        userPath,
        // If you want to try a specific env name first (optional):
        // condaEnvName: 'myenv',
        log: (m) => console.log(`[mcstas] ${m}`)
    });
    if (!found) {
        vscode.window.showWarningMessage('McStas Formatter: Could not find "clang-format". If you are using conda/mamba, ensure the environment is active or set mcstas.formatter.clangFormatPath.', 'Installation Help').then(btn => {
            if (btn === 'Installation Help') {
                vscode.commands.executeCommand('mcstas.openClangFormatHelp');
            }
        });
    }
    const clangFormatResolved = found ?? (userPath || 'clang-format');
    const styleFilePath = path.join(context.extensionPath, 'media', '.clang-format');
    (0, formatConfig_1.setFormatterConfig)({ clangFormatPath: clangFormatResolved, styleFilePath });
    // Start the language server client, and add the formatter.
    client.start();
    let provider = vscode.languages.registerDocumentFormattingEditProvider('mccode', {
        provideDocumentFormattingEdits: async (doc) => {
            const fullRange = new vscode.Range(new vscode.Position(0, 0), doc.lineAt(doc.lineCount - 1).range.end);
            const formatted = await (0, formatter_1.formatMetaLanguage)(doc.getText(), doc.fileName);
            return [vscode.TextEdit.replace(fullRange, formatted)];
        }
    });
    context.subscriptions.push(provider);
}
function deactivate() {
    console.log("Deactivating extension");
    if (!client) {
        return undefined;
    }
    return client.stop();
}
//# sourceMappingURL=extension.js.map