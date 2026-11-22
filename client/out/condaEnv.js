"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chosenCondaEnv = chosenCondaEnv;
exports.findCondaRunner = findCondaRunner;
exports.inCondaEnv = inCondaEnv;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const isWindows = process.platform === 'win32';
// The environment chosen with "Choose McStas Conda Environment", or undefined for the automatic search
function chosenCondaEnv() {
    return vscode.workspace.getConfiguration('mcstas').get('condaEnvironment')?.trim() || undefined;
}
function onPath(name) {
    const exts = isWindows ? ['.exe', '.bat', ''] : [''];
    return (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
        .flatMap(dir => exts.map(ext => path.join(dir, name + ext)));
}
// conda, mamba or micromamba to run commands in `env`: the shell-exported ones first,
// then the conda of the install the environment belongs to, then PATH
function findCondaRunner(env) {
    const root = path.basename(path.dirname(env)) === 'envs' ? path.dirname(path.dirname(env)) : env;
    const candidates = [
        process.env.CONDA_EXE,
        process.env.MAMBA_EXE,
        path.join(root, 'condabin', isWindows ? 'conda.bat' : 'conda'),
        ...['conda', 'micromamba', 'mamba'].flatMap(onPath),
    ];
    return candidates.find((c) => !!c && fs.existsSync(c));
}
/**
 * Wraps a shell command so it runs in the chosen conda environment (`<runner> run -p <env> <command>`),
 * which also runs the environment's activation scripts (e.g. setting MCSTAS). Returns the command
 * unchanged when no environment is chosen or no conda/mamba/micromamba is found.
 */
function inCondaEnv(command) {
    const env = chosenCondaEnv();
    const runner = env && findCondaRunner(env);
    if (!env || !runner) {
        return command;
    }
    // conda buffers the output of `conda run` unless told not to; micromamba streams and rejects the flag
    const noCapture = path.basename(runner).toLowerCase().startsWith('conda') ? ' --no-capture-output' : '';
    const call = isWindows && /pwsh|powershell/i.test(vscode.env.shell) ? `& "${runner}"` : `"${runner}"`;
    return `${call} run${noCapture} -p "${env}" ${command}`;
}
//# sourceMappingURL=condaEnv.js.map