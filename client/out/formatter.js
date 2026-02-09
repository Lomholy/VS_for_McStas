"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMetaLanguage = formatMetaLanguage;
exports.formatCIndentation = formatCIndentation;
function formatMetaLanguage(source, filePath) {
    const lower = filePath.toLowerCase();
    let blockRegex;
    if (lower.endsWith(".comp")) {
        blockRegex = /(\s*)(TRACE|SHARE|DECLARE|INITIALIZE)\s*%\{([\s\S]*?)%\}/g;
    }
    else if (lower.endsWith('.instr')) {
        blockRegex = /(\s*)(DECLARE|INITIALIZE)\s*%\{([\s\S]*?)%\}/g;
    }
    else {
        return;
    }
    return source.replace(blockRegex, (match, leading, keyword, cCode) => {
        const formatted = formatCIndentation(cCode);
        return `${leading}${keyword}\n%{${formatted}%}`;
    });
}
function formatCIndentation(code) {
    const lines = code.split("\n");
    const n = lines.length;
    let inBlockComment = false;
    const caseLines = [];
    const bracePairs = [];
    const parenPairs = [];
    const ifdefPairs = [];
    const oneLiners = [];
    const braceStack = [];
    const parenStack = [];
    const ifdefStack = [];
    const stripComments = (line) => {
        let out = "";
        let i = 0;
        while (i < line.length) {
            if (!inBlockComment && line.startsWith("/*", i)) {
                inBlockComment = true;
                i += 2;
                continue;
            }
            if (inBlockComment && line.startsWith("*/", i)) {
                inBlockComment = false;
                i += 2;
                continue;
            }
            if (!inBlockComment && line.startsWith("//", i))
                break;
            if (!inBlockComment)
                out += line[i];
            i++;
        }
        return out;
    };
    // ---------------- PASS 1 ----------------
    for (let i = 0; i < n; i++) {
        const raw = lines[i];
        const codeOnly = stripComments(raw);
        const trimmed = codeOnly.trim();
        // Detect switch cases
        if (/^case\b/.test(trimmed) || /^default\s*:/.test(trimmed)) {
            caseLines.push(i);
        }
        // Braces & parentheses
        for (const ch of codeOnly) {
            if (ch === "{")
                braceStack.push(i);
            if (ch === "}") {
                if (braceStack.length)
                    bracePairs.push({ start: braceStack.pop(), end: i });
            }
            if (ch === "(")
                parenStack.push(i);
            if (ch === ")") {
                if (parenStack.length)
                    parenPairs.push({ start: parenStack.pop(), end: i });
            }
        }
        // Preprocessor structure
        if (/^#if/.test(trimmed) || /^#ifdef/.test(trimmed) || /^#ifndef/.test(trimmed)) {
            ifdefStack.push(i);
        }
        if (/^#elif/.test(trimmed) || /^#else/.test(trimmed)) {
            if (ifdefStack.length) {
                const s = ifdefStack.pop();
                ifdefPairs.push({ start: s, end: i });
                ifdefStack.push(i);
            }
        }
        if (/^#endif/.test(trimmed)) {
            if (ifdefStack.length)
                ifdefPairs.push({ start: ifdefStack.pop(), end: i });
        }
        // Single-line if/for
        const isIf = trimmed.startsWith("if");
        const isFor = trimmed.startsWith("for");
        const hasParenPair = trimmed.includes("(") && trimmed.includes(")");
        const hasOpenBrace = trimmed.includes("{");
        const endsOnLine = trimmed.endsWith(";");
        if ((isIf || isFor) && hasParenPair && !hasOpenBrace && !endsOnLine) {
            oneLiners.push(i);
        }
    }
    // ---------------- PASS 2: build indentation levels ----------------
    const indentLevel = new Array(n).fill(0);
    for (const p of bracePairs)
        for (let i = p.start + 1; i < p.end; i++)
            indentLevel[i]++;
    for (const p of parenPairs)
        for (let i = p.start + 1; i < p.end + 1; i++)
            indentLevel[i] += 2;
    for (const p of ifdefPairs)
        for (let i = p.start + 1; i < p.end; i++)
            indentLevel[i]++;
    for (const idx of oneLiners)
        for (let j = idx + 1; j < n; j++) {
            const t = lines[j].trim();
            // skip blank lines
            if (t === "")
                continue;
            // skip pure comment lines
            if (t.startsWith("//")) {
                indentLevel[j]++; // indent the comment itself
                continue;
            }
            // this is the actual controlled statement
            indentLevel[j]++;
            break;
        }
    // Indent the statements inside case/default
    for (const idx of caseLines) {
        // Now indent the following statements until:
        // - next case/default
        // - closing brace
        for (let j = idx + 1; j < n; j++) {
            const t = lines[j].trim();
            if (t === "")
                continue;
            // Stop at next case, default, or closing brace
            if (/^case\b/.test(t) || /^default\s*:/.test(t) || t === "}")
                break;
            // This is a statement under the case label
            indentLevel[j]++;
        }
    }
    // ---------------- PASS 3: apply indentation ----------------
    const indentStr = "    ";
    const out = [];
    for (let i = 0; i < n; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (trimmed === "") {
            out.push(raw);
            continue;
        }
        out.push(indentStr.repeat(indentLevel[i]) + trimmed);
    }
    return out.join("\n");
}
//# sourceMappingURL=formatter.js.map