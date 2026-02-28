"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectClangFormat = detectClangFormat;
const child_process = require("child_process");
async function detectClangFormat(pathHint) {
    const candidates = [];
    if (pathHint) {
        candidates.push(pathHint);
    }
    // Default names per OS
    if (process.platform === 'win32') {
        candidates.push('clang-format.exe', 'clang-format');
    }
    else {
        candidates.push('clang-format');
    }
    for (const c of candidates) {
        try {
            child_process.execFileSync(c, ['--version'], { stdio: 'ignore' });
            return c; // Found working clang-format
        }
        catch { }
    }
    return null;
}
//# sourceMappingURL=detectClang.js.map