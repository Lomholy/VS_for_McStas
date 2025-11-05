"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findEnvsWithMcStasAndFlask = findEnvsWithMcStasAndFlask;
exports.hasAnyEnvWithMcStasAndFlask = hasAnyEnvWithMcStasAndFlask;
exports.specificEnvHasMcStasAndFlask = specificEnvHasMcStasAndFlask;
const child_process_1 = require("child_process");
const path = require("path");
function which(cmd) {
    const probe = (0, child_process_1.spawnSync)(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
    return probe.status === 0;
}
function getCondaExe() {
    if (process.env.CONDA_EXE?.trim())
        return { exe: process.env.CONDA_EXE.trim(), kind: 'conda' };
    if (process.env.MAMBA_EXE?.trim())
        return { exe: process.env.MAMBA_EXE.trim(), kind: 'mamba' };
    if (process.env.MICROMAMBA_EXE?.trim())
        return { exe: process.env.MICROMAMBA_EXE.trim(), kind: 'micromamba' };
    if (which('conda'))
        return { exe: 'conda', kind: 'conda' };
    if (which('mamba'))
        return { exe: 'mamba', kind: 'mamba' };
    if (which('micromamba'))
        return { exe: 'micromamba', kind: 'micromamba' };
    return null;
}
/** List environments with `conda env list --json` */
function listCondaEnvs() {
    const conda = getCondaExe();
    if (!conda)
        return [];
    const out = (0, child_process_1.spawnSync)(conda.exe, ['env', 'list', '--json'], { encoding: 'utf8' });
    if (out.status !== 0)
        return [];
    try {
        const parsed = JSON.parse(out.stdout);
        const base = parsed.default_prefix;
        return (parsed.envs || []).map((p) => ({
            name: base && p === base ? 'base' : path.basename(p),
            path: p,
        }));
    }
    catch {
        return [];
    }
}
/** Load `conda list --json -p <env>` and return a Set of package names (lowercased). */
function loadEnvPackageSet(envPath, condaExe) {
    const out = (0, child_process_1.spawnSync)(condaExe, ['list', '--json', '-p', envPath], { encoding: 'utf8' });
    if (out.status !== 0)
        return null;
    try {
        const pkgs = JSON.parse(out.stdout);
        const s = new Set();
        for (const p of pkgs) {
            if (p?.name)
                s.add(p.name.toLowerCase());
        }
        return s;
    }
    catch {
        return null;
    }
}
/** Check that ALL required package names are present in the env's `conda list` JSON. */
function envHasAllPackages(envPath, required, condaExe) {
    const namesLC = required.map((n) => n.toLowerCase());
    const pkgSet = loadEnvPackageSet(envPath, condaExe);
    if (!pkgSet)
        return false;
    return namesLC.every((n) => pkgSet.has(n));
}
/** Find all envs that contain BOTH `mcstas` (Conda package) and `flask` (Conda or pip). */
function findEnvsWithMcStasAndFlask(required = ['mcstas', 'flask']) {
    const conda = getCondaExe();
    if (!conda)
        return [];
    const envs = listCondaEnvs();
    const matches = [];
    for (const env of envs) {
        if (envHasAllPackages(env.path, required, conda.exe)) {
            matches.push(env);
        }
    }
    return matches;
}
/** Fast boolean: is there at least one env with both? */
function hasAnyEnvWithMcStasAndFlask(required = ['mcstas', 'flask']) {
    const conda = getCondaExe();
    if (!conda)
        return false;
    for (const env of listCondaEnvs()) {
        if (envHasAllPackages(env.path, required, conda.exe))
            return true; // short‑circuit
    }
    return false;
}
/** Optional: check a specific env by prefix path directly */
function specificEnvHasMcStasAndFlask(envPrefix, required = ['mcstas', 'flask']) {
    const conda = getCondaExe();
    if (!conda)
        return false;
    return envHasAllPackages(envPrefix, required, conda.exe);
}
// /**
//  * Find environments that have the **Conda package** 'mcstas' and a **Python-importable** 'flask'.
//  * - `mcstasNames` lets you provide alternative Conda package names if needed.
//  * - `flaskImportName` defaults to 'flask'.
//  */
// export function findEnvsWithMcStasAndFlask(
//   mcstasNames: string[] = ['mcstas'],
//   flaskImportName = 'flask'
// ): CondaEnvInfo[] {
//   const conda = getCondaExe();
//   if (!conda) return [];
//   const envs = listCondaEnvs();
//   const matches: CondaEnvInfo[] = [];
//   for (const env of envs) {
//     console.log(env.name);
//     const hasMcStas = mcstasNames.some((name) => envHasCondaPackage(env.path, name, conda.exe));
//     if (!hasMcStas) continue;
//     console.log("Has McStas!");
//     const hasFlask = envCanImport(env.path, flaskImportName, conda.exe);
//     if (hasFlask) {
//         matches.push(env)
//         console.log("And also has flask!")
//     };
//   }
//   return matches;
// }
// /** Boolean convenience: is there at least one env that satisfies the condition? */
// export function hasAnyEnvWithMcStasAndFlask(
//   mcstasNames: string[] = ['mcstas'],
//   flaskImportName = 'flask'
// ): boolean {
//   return findEnvsWithMcStasAndFlask(mcstasNames, flaskImportName).length > 0;
// }
//# sourceMappingURL=checkCondaEnv.js.map