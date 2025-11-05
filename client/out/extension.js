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
const child_process_1 = require("child_process");
const node_1 = require("vscode-languageclient/node");
const componentProvider_1 = require("./componentProvider"); // assuming this file is componentProvider.ts
const mcdisplayCommand_1 = require("./mcdisplayCommand");
const mcplotCommand_1 = require("./mcplotCommand");
const checkCondaEnv_1 = require("./checkCondaEnv");
const global_params_1 = require("./global_params");
let flaskProcess;
let client;
function activate(context) {
    let condaEnv = vscode.workspace.getConfiguration().get('componentViewer.condaEnv');
    if (condaEnv === "") {
        const envs = (0, checkCondaEnv_1.findEnvsWithMcStasAndFlask)();
        if (envs.length) {
            console.log('Found matching environments:');
            for (const e of envs) {
                console.log(`- ${e.name} (${e.path})`);
            }
        }
        else {
            console.log('No Conda env found with mcstas (Conda pkg) and Flask (importable).');
        }
        // Choose environment as what we use for conda runs:
        vscode.workspace.getConfiguration().update('componentViewer.condaEnv', envs[0].name, vscode.ConfigurationTarget.Global);
        condaEnv = vscode.workspace.getConfiguration().get('componentViewer.condaEnv');
    }
    const serverPath = path.join(__dirname, '../../server/src', 'server.py');
    console.log(serverPath);
    const condaExe = process.env.CONDA_EXE || 'conda'; // falls back to PATH
    const cwd = path.dirname(serverPath); // or your workspace root
    const args = [
        'run',
        '--no-capture-output', // stream logs through to your extension
        '-n', condaEnv, // environment name
        'python', // interpreter inside that env
        serverPath // your Flask entrypoint
    ];
    const flaskProcess = (0, child_process_1.spawn)(condaExe, args, {
        cwd,
        env: { ...process.env, FLASK_ENV: 'development' }, // optional
        shell: process.platform === 'win32', // resolve conda.bat on Windows
    });
    flaskProcess.stdout.on('data', d => console.log(`[flask] ${d.toString()}`));
    flaskProcess.stderr.on('data', d => console.error(`[flask] ${d.toString()}`));
    flaskProcess.on('error', err => console.error('Failed to start Flask:', err));
    flaskProcess.on('exit', (code, signal) => console.log(`Flask exited: code=${code}, signal=${signal}`));
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
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"));
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions = {
        run: { module: serverModule, transport: node_1.TransportKind.stdio },
        debug: {
            module: serverModule,
            transport: node_1.TransportKind.stdio,
        },
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
    // Start the client. This will also launch the server
    client.start();
}
function deactivate() {
    console.log("Deactivating extension");
    if (!client) {
        return undefined;
    }
    if (flaskProcess) {
        flaskProcess.kill();
        flaskProcess = undefined;
    }
    return client.stop();
}
//# sourceMappingURL=extension.js.map