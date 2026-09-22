import * as child_process from 'child_process';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

const execFileAsync = promisify(execFileCb);

/**
 * Finds a Python interpreter that has the `mcstas_ls` package (the pygls
 * server in server/python) installed, using the same PATH -> conda/mamba
 * run -> conda env prefix probing strategy as detectClangFormat in
 * formatConfig.ts.
 *
 * detectPythonServerCommand() only looks; it does not install anything.
 * installPythonServer() (below) does the actual `pip install`, from the
 * server/python directory bundled with this extension, into whichever
 * interpreter looks like the best target -- this is plan step 4 in
 * server/python/PLAN.md.
 */

export type DetectPythonServerOptions = {
  // Optional conda/mamba env name to try explicitly (mirrors the
  // componentViewer.condaEnv setting, reused here rather than adding a new
  // config surface).
  condaEnvName?: string;
  log?: (msg: string) => void;
};

export type PythonServerCommand = {
  command: string;
  args: string[];
};

const SERVER_MODULE_ARGS = ['-m', 'mcstas_ls.server'];

// Cache the resolved command per-session to avoid repeated probing.
let cached: PythonServerCommand | null | undefined;

function isWindows() {
  return process.platform === 'win32';
}

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

function canImportServer(pythonExe: string): boolean {
  try {
    child_process.execFileSync(pythonExe, ['-c', 'import mcstas_ls.server'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function pythonExeNames(): string[] {
  return isWindows() ? ['python.exe', 'python3.exe', 'python'] : ['python3', 'python'];
}

/**
 * Try PATH quickly: run each candidate name directly.
 */
function tryPathFirst(log?: (m: string) => void): string | null {
  for (const name of pythonExeNames()) {
    if (canImportServer(name)) {
      log?.(`Found mcstas_ls on PATH via: ${name}`);
      return name;
    }
  }
  return null;
}

/**
 * Try `conda run -n <env> python -c "import mcstas_ls.server"` and similar
 * for mamba/micromamba.
 */
function tryCondaRun(condaEnvName: string | undefined, log?: (m: string) => void): PythonServerCommand | null {
  if (!condaEnvName) return null;

  const runners = ['conda', 'mamba', 'micromamba'];
  for (const runner of runners) {
    for (const exe of pythonExeNames()) {
      try {
        child_process.execFileSync(
          runner,
          ['run', '-n', condaEnvName, exe, '-c', 'import mcstas_ls.server'],
          { stdio: 'ignore' }
        );
        log?.(`Found mcstas_ls via ${runner} run -n ${condaEnvName}: ${exe}`);
        return { command: runner, args: ['run', '-n', condaEnvName, '--no-capture-output', exe, ...SERVER_MODULE_ARGS] };
      } catch {
        // try next runner/exe combination
      }
    }
  }
  return null;
}

/**
 * Probe conda/mamba environment prefixes for a direct interpreter path:
 * active env via CONDA_PREFIX, then envs/ directories under common conda
 * install locations.
 */
async function getCandidateCondaEnvPrefixes(): Promise<string[]> {
  const candidates: string[] = [];

  const active = process.env.CONDA_PREFIX;
  if (active && await fileExists(active)) {
    candidates.push(active);
  }

  const home = os.homedir();
  const envDirs = [
    path.join(home, '.conda', 'envs'),
    path.join(home, 'miniconda3', 'envs'),
    path.join(home, 'miniforge3', 'envs'),
    path.join(home, 'anaconda3', 'envs'),
    path.join(home, 'mambaforge', 'envs'),
    path.join(home, 'micromamba', 'envs'),
  ];

  for (const envDir of envDirs) {
    if (!(await fileExists(envDir))) continue;
    try {
      const entries = await fs.readdir(envDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) candidates.push(path.join(envDir, entry.name));
      }
    } catch {
      // ignore unreadable envs directories
    }
  }

  return Array.from(new Set(candidates));
}

async function tryCondaPrefixBins(log?: (m: string) => void): Promise<string | null> {
  const binRel = isWindows() ? ['python.exe'] : [path.join('bin', 'python3'), path.join('bin', 'python')];

  for (const prefix of await getCandidateCondaEnvPrefixes()) {
    for (const rel of binRel) {
      const candidate = path.join(prefix, rel);
      if (await fileExists(candidate) && canImportServer(candidate)) {
        log?.(`Found mcstas_ls at: ${candidate}`);
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Main detection: combines PATH probing and conda/mamba/micromamba
 * probing. Returns a {command, args} pair ready to hand to
 * vscode-languageclient's ServerOptions, or null if no interpreter with
 * mcstas_ls installed could be found.
 */
export async function detectPythonServerCommand(
  options: DetectPythonServerOptions = {}
): Promise<PythonServerCommand | null> {
  if (cached !== undefined) {
    return cached;
  }

  const log = options.log;

  const pathFound = tryPathFirst(log);
  if (pathFound) {
    cached = { command: pathFound, args: SERVER_MODULE_ARGS };
    return cached;
  }

  const condaRunFound = tryCondaRun(options.condaEnvName, log);
  if (condaRunFound) {
    cached = condaRunFound;
    return cached;
  }

  const prefixFound = await tryCondaPrefixBins(log);
  if (prefixFound) {
    cached = { command: prefixFound, args: SERVER_MODULE_ARGS };
    return cached;
  }

  cached = null;
  log?.('Python mcstas-language-server (mcstas_ls) not found on PATH or via conda/mamba/micromamba.');
  return null;
}

function isPythonExecutable(name: string): boolean {
  try {
    child_process.execFileSync(name, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Runs `pip <args>` via some invocation shape (bare interpreter, or `conda run -n env`). */
type PipInvoker = (pipArgs: string[]) => Promise<{ stdout: string; stderr: string }>;

function bareInvoker(pythonExe: string): PipInvoker {
  return (pipArgs) => execFileAsync(pythonExe, ['-m', 'pip', ...pipArgs]);
}

function condaRunInvoker(runner: string, condaEnvName: string, exe: string): PipInvoker {
  return (pipArgs) => execFileAsync(runner, ['run', '-n', condaEnvName, exe, '-m', 'pip', ...pipArgs]);
}

async function getPipMajorVersion(invoke: PipInvoker): Promise<number | null> {
  try {
    const { stdout } = await invoke(['--version']);
    const match = stdout.match(/pip (\d+)\./);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Old pip (roughly <23, seen as low as the pip 21.2.4 Apple ships with the
 * Xcode Command Line Tools' python3) can silently mis-handle a
 * pyproject.toml-only project like server/python's: instead of failing, it
 * builds and installs an empty package literally named "UNKNOWN" with none
 * of the actual code or declared dependencies, and pip itself reports
 * success. Upgrading pip first avoids this whole failure class -- cheap
 * (a single small wheel) next to the source install that follows it.
 */
async function ensureModernPip(invoke: PipInvoker, upgradeArgs: string[], log?: (m: string) => void): Promise<void> {
  const major = await getPipMajorVersion(invoke);
  if (major === null || major >= 23) return;

  log?.(`pip ${major}.x is old enough to mis-handle pyproject.toml-only metadata (can silently install an empty "UNKNOWN" package instead of failing) -- upgrading pip first.`);
  try {
    await invoke(['install', ...upgradeArgs, '--upgrade', 'pip']);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log?.(`Could not upgrade pip (continuing anyway): ${message.split('\n')[0]}`);
  }
}

/**
 * Run `pip install [--user] <sourcePath>` via `invoke`. Not `-e` (editable):
 * end users just need the package usable, not a live link back into the
 * extension's install directory (which would also complicate extension
 * updates/uninstalls). Contributors installing for development still use
 * `-e` themselves, per server/python/README.md.
 *
 * `--user` is tried first when `tryUserFlag` is set (a bare PATH
 * interpreter, where it avoids needing elevated permissions for a system
 * Python's global site-packages), then retried without it if pip rejects
 * `--user` outright, which happens inside some virtualenvs.
 */
async function installViaInvoker(invoke: PipInvoker, sourcePath: string, tryUserFlag: boolean, log?: (m: string) => void): Promise<boolean> {
  const installArgs = tryUserFlag ? ['--user'] : [];
  await ensureModernPip(invoke, installArgs, log);

  try {
    log?.(`Running: pip install ${installArgs.join(' ')} ${sourcePath}`.replace(/\s+/g, ' '));
    await invoke(['install', ...installArgs, sourcePath]);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (tryUserFlag && /--user/i.test(message)) {
      return installViaInvoker(invoke, sourcePath, false, log);
    }
    log?.(`pip install failed: ${message.split('\n')[0]}`);
    return false;
  }
}

async function pipInstall(pythonExe: string, sourcePath: string, tryUserFlag: boolean, log?: (m: string) => void): Promise<boolean> {
  return installViaInvoker(bareInvoker(pythonExe), sourcePath, tryUserFlag, log);
}

async function pipInstallViaCondaRun(runner: string, condaEnvName: string, sourcePath: string, log?: (m: string) => void): Promise<boolean> {
  for (const exe of pythonExeNames()) {
    // A missing runner/exe combination fails fast in ensureModernPip's
    // version probe, so this loop still moves on to the next exe quickly.
    if (await installViaInvoker(condaRunInvoker(runner, condaEnvName, exe), sourcePath, false, log)) {
      return true;
    }
  }
  return false;
}

/**
 * If no interpreter already has mcstas_ls installed, attempts to
 * `pip install` it from `serverSourcePath` (server/python, bundled with
 * this extension) into whichever interpreter looks like the intended
 * target, then re-checks with detectPythonServerCommand. Order of
 * preference: an explicitly configured conda/mamba env, then a bare PATH
 * interpreter, then any discovered conda env prefix.
 *
 * This can take a while -- pip building a source distribution in an
 * isolated build environment is not instant -- so callers should wrap this
 * in a progress notification rather than call it on the fast path.
 *
 * A pip install can still fail for reasons this can't safely work around,
 * most notably PEP 668 "externally-managed-environment" errors on modern
 * system Pythons (Homebrew, Debian/Ubuntu). This deliberately does not
 * pass `--break-system-packages` to force past that -- it's there to
 * protect the system Python installation, and the right fix is a
 * virtualenv or conda env, which callers should be told about on failure.
 */
export async function installPythonServer(
  serverSourcePath: string,
  options: DetectPythonServerOptions = {}
): Promise<PythonServerCommand | null> {
  const log = options.log;

  if (options.condaEnvName) {
    for (const runner of ['conda', 'mamba', 'micromamba']) {
      if (await pipInstallViaCondaRun(runner, options.condaEnvName, serverSourcePath, log)) {
        cached = undefined;
        const found = await detectPythonServerCommand(options);
        if (found) {
          log?.(`Installed mcstas_ls into conda/mamba env "${options.condaEnvName}" via ${runner}`);
          return found;
        }
      }
    }
  }

  for (const name of pythonExeNames()) {
    if (!isPythonExecutable(name)) continue;
    log?.(`Installing mcstas_ls into ${name} via pip...`);
    if (await pipInstall(name, serverSourcePath, true, log)) {
      cached = undefined;
      const found = await detectPythonServerCommand(options);
      if (found) return found;
    }
  }

  const binRel = isWindows() ? ['python.exe'] : [path.join('bin', 'python3'), path.join('bin', 'python')];
  for (const prefix of await getCandidateCondaEnvPrefixes()) {
    for (const rel of binRel) {
      const candidate = path.join(prefix, rel);
      if (!(await fileExists(candidate))) continue;
      log?.(`Installing mcstas_ls into ${candidate} via pip...`);
      if (await pipInstall(candidate, serverSourcePath, false, log)) {
        cached = undefined;
        const found = await detectPythonServerCommand(options);
        if (found) return found;
      }
    }
  }

  cached = null;
  log?.('Could not install mcstas_ls into any Python interpreter.');
  return null;
}
