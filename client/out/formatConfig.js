"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectClangFormat = detectClangFormat;
exports.setFormatterConfig = setFormatterConfig;
exports.getFormatterConfig = getFormatterConfig;
const child_process = require("child_process");
const path = require("path");
const fs = require("fs/promises");
// Cache the resolved path per-session to avoid repeated lookups
let cachedClangFormatPath;
function isWindows() {
    return process.platform === 'win32';
}
async function fileExists(p) {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
}
function execFileSafe(cmd, args) {
    try {
        child_process.execFileSync(cmd, args, { stdio: 'ignore' });
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
// Try a list of candidates
function tryCandidates(candidates, log) {
    for (const c of candidates) {
        const found = testCandidate(c, log);
        if (found)
            return found;
    }
    return null;
}
/**
 * Build platform-specific executable names to probe.
 */
function exeNames() {
    if (isWindows()) {
        // Some conda packages produce "clang-format.exe", others also allow "clang-format"
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
 * Try `conda run -n <env> clang-format --version` and similar for mamba/micromamba.
 * If it succeeds, we still return the command name (we can't easily resolve a path),
 * but that’s okay—invocation will succeed using that tool.
 */
function tryCondaRun(condaEnvName, log) {
    const runners = [
        { cmd: 'conda', args: ['run'] },
        { cmd: 'mamba', args: ['run'] },
        { cmd: 'micromamba', args: ['run'] },
    ];
    const names = exeNames();
    for (const r of runners) {
        for (const exe of names) {
            const args = ['-n', condaEnvName ?? '', exe, '--version'].filter(Boolean);
            try {
                child_process.execFileSync(r.cmd, [...r.args, ...args], { stdio: 'ignore' });
                log?.(`Found via ${r.cmd} run ${condaEnvName ? `-n ${condaEnvName}` : ''}: ${exe}`);
                // We return the plain name; subsequent invocations should use the same runner logic OR
                // we can store a special token to re-run through conda. For simplicity, return the exe.
                return exe;
            }
            catch {
                // ignore; try next runner
            }
        }
    }
    return null;
}
/**
 * Probe typical conda prefixes:
 * - CONDA_PREFIX: active prefix path
 * - MAMBA_ROOT_PREFIX + envs/<name>
 * - CONDA_PREFIXes in PATH-like variables
 */
async function tryCondaPrefixBins(log) {
    const candidates = [];
    const prefixVars = [
        process.env.CONDA_PREFIX,
        process.env.MAMBA_ROOT_PREFIX, // often base install
    ].filter(Boolean);
    const pathSep = path.sep;
    const binNames = isWindows() ? ['Library\\bin', 'Scripts', 'bin'] : ['bin'];
    for (const prefix of prefixVars) {
        for (const binRel of binNames) {
            for (const exe of exeNames()) {
                candidates.push(path.join(prefix, binRel, exe));
            }
        }
    }
    // Conda also stores environments under <base>/envs/<envname>
    // Try the default env variables to derive a path:
    const envName = process.env.CONDA_DEFAULT_ENV || process.env.MAMBA_DEFAULT_ENV;
    const base = process.env.CONDA_PREFIX || process.env.MAMBA_ROOT_PREFIX;
    if (envName && base) {
        const envDir = path.join(base, 'envs', envName);
        for (const binRel of binNames) {
            for (const exe of exeNames()) {
                candidates.push(path.join(envDir, binRel, exe));
            }
        }
    }
    // Micromamba sometimes uses MAMBA_ROOT_PREFIX/envs/<env>/bin
    const mambaRoot = process.env.MAMBA_ROOT_PREFIX;
    if (mambaRoot) {
        const envsDir = path.join(mambaRoot, 'envs');
        // We can heuristically scan envs dir to add a few likely paths (bounded to avoid perf issues)
        try {
            const items = await fs.readdir(envsDir, { withFileTypes: true });
            const some = items.filter(d => d.isDirectory()).slice(0, 10); // limit breadth
            for (const d of some) {
                for (const binRel of binNames) {
                    for (const exe of exeNames()) {
                        candidates.push(path.join(envsDir, d.name, binRel, exe));
                    }
                }
            }
        }
        catch {
            // ignore
        }
    }
    // Filter to those that exist
    const existing = [];
    for (const c of candidates) {
        if (await fileExists(c))
            existing.push(c);
    }
    return tryCandidates(existing, log);
}
/**
 * Main detection: combines user hint, PATH, conda/mamba/micromamba probing.
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
    // 2) Fast PATH probe
    const pathFound = tryPathFirst(log);
    if (pathFound) {
        cachedClangFormatPath = pathFound;
        return pathFound;
    }
    // 3) If a conda env name is provided, try "conda/mamba/micromamba run -n <env>"
    const runFound = tryCondaRun(options.condaEnvName, log);
    if (runFound) {
        cachedClangFormatPath = runFound;
        return runFound;
    }
    // 4) Probe environment prefixes for a direct binary path
    const prefixFound = await tryCondaPrefixBins(log);
    if (prefixFound) {
        cachedClangFormatPath = prefixFound;
        return prefixFound;
    }
    // 5) On Windows, also try the common LLVM location
    if (isWindows()) {
        const common = path.join('C:\\', 'Program Files', 'LLVM', 'bin', 'clang-format.exe');
        const found = testCandidate(common, log);
        if (found) {
            cachedClangFormatPath = found;
            return found;
        }
    }
    // If nothing found
    cachedClangFormatPath = null;
    log?.('clang-format not found via PATH or conda/mamba/micromamba probing.');
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