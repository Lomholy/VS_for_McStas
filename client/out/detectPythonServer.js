"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePythonServer = resolvePythonServer;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = require("path");
const fs = require("fs/promises");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const isWindows = process.platform === 'win32';
const EXE = isWindows ? 'mcstas-language-server.exe' : 'mcstas-language-server';
const VENV_TIMEOUT_MS = 60 * 1000;
const PIP_TIMEOUT_MS = 3 * 60 * 1000;
async function fileExists(p) {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
}
async function findOnPath(name) {
    for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
        if (dir && await fileExists(path.join(dir, name)))
            return path.join(dir, name);
    }
    return null;
}
/**
 * Returns the language server executable: one on PATH (pipx, uv tool, a
 * manual venv), else one in a private venv under storageDir. The venv is
 * created, or rebuilt when `version` changes, from serverSourcePath with the
 * first python3/python that can build it. Returns null if none can.
 */
async function resolvePythonServer(storageDir, serverSourcePath, version, log = () => { }) {
    const onPath = await findOnPath(EXE);
    if (onPath) {
        log(`Using language server on PATH: ${onPath}`);
        return onPath;
    }
    const venv = path.join(storageDir, 'venv');
    const bin = path.join(venv, isWindows ? 'Scripts' : 'bin');
    const server = path.join(bin, EXE);
    const stamp = path.join(venv, 'mcstas_ls.version');
    const installed = await fs.readFile(stamp, 'utf8').catch(() => null);
    if (installed === version && await fileExists(server))
        return server;
    await fs.mkdir(storageDir, { recursive: true });
    for (const python of isWindows ? ['py', 'python'] : ['python3', 'python']) {
        try {
            log(`Creating ${venv} with ${python}`);
            await execFileAsync(python, ['-m', 'venv', '--clear', venv], { timeout: VENV_TIMEOUT_MS });
            // Upgrading pip first: old pip (e.g. 21.x from Apple's python3) installs pyproject-only projects as an empty "UNKNOWN" package
            await execFileAsync(path.join(bin, 'python'), ['-m', 'pip', 'install', '--upgrade', 'pip'], { timeout: PIP_TIMEOUT_MS });
            await execFileAsync(path.join(bin, 'python'), ['-m', 'pip', 'install', serverSourcePath], { timeout: PIP_TIMEOUT_MS });
            if (await fileExists(server)) {
                await fs.writeFile(stamp, version);
                return server;
            }
        }
        catch (err) {
            log(`${python} failed: ${(err instanceof Error ? err.message : String(err)).split('\n')[0]}`);
        }
    }
    return null;
}
//# sourceMappingURL=detectPythonServer.js.map