"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureInstrumentComponents = captureInstrumentComponents;
exports.formatDefineInstrumentBlock = formatDefineInstrumentBlock;
exports.formatMetaLanguage = formatMetaLanguage;
const child_process = require("child_process");
const formatConfig_1 = require("./formatConfig");
const PRE_ESCAPE = '//__ESC__PRE';
// === Helper: run clang-format with style=file and assume-filename ===
function runClangFormat(code, clangFormatPath, assumeFilename) {
    return new Promise((resolve, reject) => {
        const args = ['-style', 'file', '-assume-filename', assumeFilename];
        const proc = child_process.spawn(clangFormatPath, args, { shell: false });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => (stdout += d.toString()));
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('error', (err) => reject(err));
        proc.on('close', (code) => {
            if (code === 0)
                resolve(stdout);
            else
                reject(new Error(`clang-format failed (${code}): ${stderr || stdout}`));
        });
        proc.stdin.end(code);
    });
}
// === Helper: split preserving EOLs (like Python splitlines(True)) ===
function splitLinesPreserveEOL(s) {
    if (!s)
        return [];
    const m = s.match(/[^\r\n]*\r?\n|[^\r\n]+$/g);
    return m ? m : [];
}
// === Helper: indent lines by fixed string, skipping blank lines if asked ===
function indentLines(core, indentStr, indentBlankLines) {
    if (!indentStr)
        return core;
    const lines = splitLinesPreserveEOL(core);
    for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        // A line is "blank" if it is only whitespace and possibly an EOL
        const onlyWS = /^[ \t]*\r?\n?$/.test(L);
        if (!indentBlankLines && onlyWS)
            continue;
        // Insert indent just before any EOL (if present)
        const eolMatch = L.match(/\r?\n$/);
        if (eolMatch) {
            const eol = eolMatch[0];
            const body = L.slice(0, L.length - eol.length);
            lines[i] = indentStr + body + eol;
        }
        else {
            lines[i] = indentStr + L;
        }
    }
    return lines.join('');
}
// === Escape %/# lines so clang-format treats them as comments for indentation ===
function escapePrecompilerLines(s) {
    return s.replace(/^([ \t]*)([%#])/gm, (_m, lead, sym) => `${lead}${PRE_ESCAPE}${sym}`);
}
function unescapePrecompilerLines(s) {
    return s.replace(new RegExp(PRE_ESCAPE, 'g'), '');
}
// === EXACT same block regex as Python ===
// r'(^[ \t]*%\{[ \t]*\r?\n)((?:[^\r\n]*\r?\n)*?)(^[ \t]*%\}[ \t]*\r?$)'
// Flags: MULTILINE
const BLOCK_RE = /(^[ \t]*%\{[ \t]*\r?\n)((?:[^\r\n]*\r?\n)*?)(^[ \t]*%\}[ \t]*\r?$)/gm;
function hasNonPercentLine(inner) {
    const lines = inner.split(/\r?\n/);
    return lines.some((ln) => ln.trim() !== '' && !ln.trimStart().startsWith('%'));
}
/**
 * Format the *inner* with clang-format, preserving line endings and treating
 * %/# lines as comments for indentation. Mirrors Python `_format_preserving_percent_lines`.
 */
async function formatInnerLikePython(inner, clangFormatPath, assumeFilename) {
    // Escape
    const escapedLines = splitLinesPreserveEOL(inner).map((L) => escapePrecompilerLines(L));
    let chunk = escapedLines.join('');
    // Python strips one trailing newline before sending to clang-format and remembers it
    let trailingNL = '';
    if (chunk.endsWith('\n')) {
        chunk = chunk.slice(0, -1);
        trailingNL = '\n';
    }
    // Run clang-format
    let formatted = await runClangFormat(chunk, clangFormatPath, assumeFilename);
    // clang-format usually adds a trailing newline; strip exactly one (if present)
    if (formatted.endsWith('\n')) {
        formatted = formatted.slice(0, -1);
    }
    // Re-add the newline we preserved to maintain control
    formatted = formatted + trailingNL;
    // Unescape
    formatted = unescapePrecompilerLines(formatted);
    return formatted;
}
async function formatComponent(source) {
    const { clangFormatPath, styleFilePath } = (0, formatConfig_1.getFormatterConfig)();
    let result = '';
    let lastIndex = 0;
    let m;
    while ((m = BLOCK_RE.exec(source)) !== null) {
        const [fullSpan, opening, inner, closing] = m;
        // Append text before this block
        result += source.slice(lastIndex, m.index);
        // If inner is empty or contains only blank or % lines, leave the whole block unchanged
        if (!hasNonPercentLine(inner)) {
            result += fullSpan;
            lastIndex = BLOCK_RE.lastIndex;
            continue;
        }
        // Format inner exactly like the Python script
        let formattedInner = await formatInnerLikePython(inner, clangFormatPath, styleFilePath);
        // Remove exactly one trailing newline (if present) so we can control placement
        let trailingNL = '';
        if (formattedInner.endsWith('\n')) {
            formattedInner = formattedInner.slice(0, -1);
            trailingNL = '\n';
        }
        // Indent with two spaces per line, skipping purely blank lines
        const core = indentLines(formattedInner, '  ', /*indentBlankLines*/ false);
        // Reassemble: opening already includes its newline; ensure exactly one newline before closing
        // If core is empty (shouldn’t happen due to earlier guard), return opening+closing
        if (core === '') {
            result += opening + closing;
        }
        else {
            let block = opening + core;
            if (!block.endsWith('\n')) {
                block += '\n';
            }
            block += closing;
            result += block;
        }
        lastIndex = BLOCK_RE.lastIndex;
    }
    // Append remainder
    result += source.slice(lastIndex);
    return result;
}
function captureInstrumentComponents(source) {
    const COMPONENT_BLOCK_RE = /(^[ \t]*COMPONENT[\s\S]*?\()([\s\S]*?)\)(?=\s*(?:AT\b|WHEN\b)|$)/gm;
    const blocks = [];
    let m;
    while ((m = COMPONENT_BLOCK_RE.exec(source)) !== null) {
        blocks.push({
            header: m[1],
            params: m[2],
            fullMatch: m[0]
        });
    }
    return blocks;
}
function normalizeHeaderLine(header) {
    return header.trimEnd();
}
function splitParameters(input_params) {
    // Remove white space
    // input_params = input_params.replace(/\s/g, "")
    const s = input_params; // keep as-is to preserve spaces inside strings/braces
    const params = [];
    let current = '';
    let inString = false; // inside double quotes
    let braceDepth = 0; // { ... } nesting depth
    let parDepth = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        // Handle entering/exiting string (")
        if (ch === '"') {
            // If previous char is a backslash, treat this as escaped quote
            const escaped = i > 0 && s[i - 1] === '\\';
            if (!escaped)
                inString = !inString;
            current += ch;
            continue;
        }
        // Handle braces only when not in a string
        if (!inString) {
            if (ch === '{') {
                braceDepth++;
                current += ch;
                continue;
            }
            if (ch === '}') {
                // avoid negative depth if malformed
                if (braceDepth > 0)
                    braceDepth--;
                current += ch;
                continue;
            }
        }
        if (!inString) {
            if (ch === '(') {
                parDepth++;
                current += ch;
                continue;
            }
            if (ch === ')') {
                // avoid negative depth if malformed
                if (parDepth > 0)
                    parDepth--;
                current += ch;
                continue;
            }
        }
        // Split on commas only when not protected
        if (ch === ',' && !inString && braceDepth === 0 && parDepth == 0) {
            const piece = current.trim();
            if (piece.length > 0)
                params.push(piece);
            current = '';
            continue;
        }
        current += ch;
    }
    // Push the final segment
    const last = current.trim();
    if (last.length > 0)
        params.push(last);
    return params;
}
function formatParamsTwoPerLine(params) {
    const parameters = splitParameters(params);
    if (parameters.length === 0)
        return ""; // no whitespace if no params
    const lines = [];
    for (let i = 0; i < parameters.length; i += 2) {
        const p1 = parameters[i];
        const p2 = parameters[i + 1];
        const p3 = parameters[i + 2];
        if (p3) {
            lines.push(`    ${p1}, ${p2},`);
        }
        else if (p2) {
            lines.push(`    ${p1}, ${p2}`);
        }
        else {
            lines.push(`    ${p1}`);
        }
    }
    return lines.join("\n") + "\n";
}
function rebuildComponent(header, params) {
    const h = normalizeHeaderLine(header);
    const body = formatParamsTwoPerLine(params);
    if (body === "")
        return `${h})`;
    return `${h}\n${body})`;
}
function captureDefineInstrument(source) {
    const RE = /(^[ \t]*DEFINE[ \t]+INSTRUMENT\b[\s\S]*?\()([\s\S]*?)\)/m;
    const m = RE.exec(source);
    if (!m)
        return null;
    return {
        header: m[1],
        params: m[2],
        fullMatch: m[0],
        start: m.index,
        end: RE.lastIndex
    };
}
// --- 3) Format: one parameter per line ---
function formatDefineParamsOnePerLine(params) {
    const parts = splitParameters(params);
    const indent = ' '.repeat(30);
    let out = '';
    for (let i = 0; i < parts.length; i += 1) {
        const p1 = parts[i];
        console.log(p1);
        if (parts[i + 1])
            out += (`${indent}${p1},\n`);
        else
            out += (`${indent}${p1}\n`);
    }
    return out;
}
// --- 4) Rebuild header + params ---
function rebuildDefineInstrument(header, params) {
    const h = header.trimEnd();
    const body = formatDefineParamsOnePerLine(params);
    if (body === '')
        return `${h})`; // no params -> close immediately
    return `${h}\n${body})`;
}
// --- 5) Apply replacement in the file ---
function formatDefineInstrumentBlock(source) {
    const cap = captureDefineInstrument(source);
    if (!cap)
        return source;
    const newBlock = rebuildDefineInstrument(cap.header, cap.params);
    // Replace the first occurrence only (the captured block)
    return source.replace(cap.fullMatch, newBlock);
}
async function formatInstrument(source) {
    const comps = captureInstrumentComponents(source);
    // 2) Build replacements
    const replacements = comps.map(c => {
        const newBlock = rebuildComponent(c.header, c.params);
        return { old: c.fullMatch, new: newBlock };
    });
    // 3) Apply replacements safely (reverse order)
    let updated = source;
    for (const r of replacements.reverse()) {
        updated = updated.replace(r.old, r.new);
    }
    updated = formatDefineInstrumentBlock(updated);
    return updated;
}
// === MAIN exposed function: mirrors the Python formatter output ===
async function formatMetaLanguage(source, filePath) {
    // We now format ALL %{ %} blocks regardless of DECLARE/TRACE/... to match Python.
    // (The original TS used keyword-gated regex; this change is intentional to match Python.)
    const { clangFormatPath, styleFilePath } = (0, formatConfig_1.getFormatterConfig)();
    let ret;
    console.log(filePath);
    if (filePath.endsWith(".comp"))
        ret = formatComponent(source);
    else if (filePath.endsWith('.instr'))
        ret = formatInstrument(source);
    return ret;
}
//# sourceMappingURL=formatter.js.map