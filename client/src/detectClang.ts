
import * as vscode from 'vscode'
import * as child_process from 'child_process';

export async function detectClangFormat(pathHint?: string): Promise<string | null> {
    const candidates = [];

    if (pathHint) {
        candidates.push(pathHint);
    }

    // Default names per OS
    if (process.platform === 'win32') {
        candidates.push('clang-format.exe', 'clang-format');
    } else {
        candidates.push('clang-format');
    }

    for (const c of candidates) {
        try {
            child_process.execFileSync(c, ['--version'], { stdio: 'ignore' });
            return c; // Found working clang-format
        } catch { }
    }
    return null;
}


