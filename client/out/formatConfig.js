"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectClangFormat = detectClangFormat;
exports.setFormatterConfig = setFormatterConfig;
exports.getFormatterConfig = getFormatterConfig;
const child_process = require("child_process");
const path = require("path");
// Cache the resolved path per-session to avoid repeated lookups
let cachedClangFormatPath;
function isWindows() {
    return process.platform === 'win32';
}
// A bare `--version` invocation should return almost instantly. Without a
// timeout, execFileSync blocks the whole extension host event loop
// indefinitely if the spawned process ever hangs -- e.g. a PATH entry that
// isn't really the tool it claims to be, or (concretely seen on macOS) a
// `python3` shim that pops up a blocking "install Command Line Tools"
// dialog and waits forever for a click that never comes. That can present
// as the whole debug session becoming unresponsive and getting torn down
// well before this function would ever return on its own.
const PROBE_TIMEOUT_MS = 5000;
function execFileSafe(cmd, args) {
    try {
        child_process.execFileSync(cmd, args, { stdio: 'ignore', timeout: PROBE_TIMEOUT_MS });
        return true;
    }
    catch {
        return false;
    }
}
// Try executing and return the path if it works
function testCandidate(candidate, log) {
    const exe = candidate;
    if (execFileSafe(exe, ['--version'])) {
        log?.(`clang-format detected at: ${exe}`);
        return exe;
    }
    return null;
}
/**
 * Build platform-specific executable names to probe.
 */
function exeNames() {
    if (isWindows()) {
        // Windows builds are named "clang-format.exe", but some also answer to "clang-format"
        return ['clang-format.exe', 'clang-format'];
    }
    return ['clang-format'];
}
/**
 * Try PATH quickly.
 */
function tryPathFirst(log) {
    // Just attempt to run by name; if it works, we're done.
    const names = exeNames();
    for (const n of names) {
        const ok = execFileSafe(n, ['--version']);
        if (ok) {
            log?.(`Found on PATH: ${n}`);
            return n;
        }
    }
    return null;
}
/**
 * Main detection: user setting, the copy installed with the language server, PATH, and on Windows the default LLVM install.
 */
async function detectClangFormat(options = {}) {
    if (cachedClangFormatPath !== undefined) {
        return cachedClangFormatPath;
    }
    const log = options.log;
    // 1) Respect explicit user path first
    if (options.userPath) {
        const found = testCandidate(options.userPath, log);
        if (found) {
            cachedClangFormatPath = found;
            return found;
        }
    }
    // 2) The copy installed with the language server
    if (options.bundledPath) {
        const found = testCandidate(options.bundledPath, log);
        if (found) {
            cachedClangFormatPath = found;
            return found;
        }
    }
    // 3) Fast PATH probe
    const pathFound = tryPathFirst(log);
    if (pathFound) {
        cachedClangFormatPath = pathFound;
        return pathFound;
    }
    // 4) On Windows, also try the common LLVM location
    if (isWindows()) {
        const common = path.join('C:\\', 'Program Files', 'LLVM', 'bin', 'clang-format.exe');
        const found = testCandidate(common, log);
        if (found) {
            cachedClangFormatPath = found;
            return found;
        }
    }
    // Not cached, so a later call looks again
    log?.('clang-format not found.');
    return null;
}
let clangFormatPathGlobal = 'clang-format';
let styleFilePathGlobal = '';
function setFormatterConfig(p) {
    clangFormatPathGlobal = p.clangFormatPath;
    styleFilePathGlobal = p.styleFilePath;
}
function getFormatterConfig() {
    return { clangFormatPath: clangFormatPathGlobal, styleFilePath: styleFilePathGlobal };
}
//# sourceMappingURL=formatConfig.js.map