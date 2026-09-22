import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

/**
 * Finds a Python interpreter that has the `mcstas_ls` package (the pygls
 * server in server/python) installed, using the same PATH -> conda/mamba
 * run -> conda env prefix probing strategy as detectClangFormat in
 * formatConfig.ts.
 *
 * This does not install `mcstas_ls` anywhere -- see server/python/README.md
 * for `pip install -e ".[dev]"`. Packaging/bundling it for end users is
 * step 4 in server/python/PLAN.md, not yet done.
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
