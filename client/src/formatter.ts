export function formatMetaLanguage(source: string, filePath: string): string {

    const lower = filePath.toLowerCase();
    let blockRegex;
    if (lower.endsWith(".comp")) {
        blockRegex = /(\s*)(TRACE|SHARE|DECLARE|INITIALIZE)\s*%\{([\s\S]*?)%\}/g;
    } else if (lower.endsWith('.instr')) {
        blockRegex = /(\s*)(DECLARE|INITIALIZE)\s*%\{([\s\S]*?)%\}/g;
    } else {
        return;
    }



    return source.replace(blockRegex, (match, leading, keyword, cCode) => {
        const formatted = formatCIndentation(cCode);
        return `${leading}${keyword}\n%{${formatted}%}`;
    });
}



export function formatCIndentation(code: string): string {
    const lines = code.split("\n");
    const n = lines.length;

    let inBlockComment = false;

    const bracePairs: { start: number; end: number }[] = [];
    const parenPairs: { start: number; end: number }[] = [];
    const ifdefPairs: { start: number; end: number }[] = [];
    const oneLiners: number[] = [];

    const braceStack: number[] = [];
    const parenStack: number[] = [];
    const ifdefStack: number[] = [];

    const stripComments = (line: string): string => {
        let out = "";
        let i = 0;
        while (i < line.length) {
            if (!inBlockComment && line.startsWith("/*", i)) { inBlockComment = true; i += 2; continue; }
            if (inBlockComment && line.startsWith("*/", i)) { inBlockComment = false; i += 2; continue; }
            if (!inBlockComment && line.startsWith("//", i)) break;
            if (!inBlockComment) out += line[i];
            i++;
        }
        return out;
    };

    // ---------------- PASS 1 ----------------
    for (let i = 0; i < n; i++) {
        const raw = lines[i];
        const codeOnly = stripComments(raw);
        const trimmed = codeOnly.trim();

        // Braces & parentheses
        for (const ch of codeOnly) {
            if (ch === "{") braceStack.push(i);
            if (ch === "}") {
                if (braceStack.length) bracePairs.push({ start: braceStack.pop()!, end: i });
            }
            if (ch === "(") parenStack.push(i);
            if (ch === ")") {
                if (parenStack.length) parenPairs.push({ start: parenStack.pop()!, end: i });
            }
        }

        // Preprocessor structure
        if (/^#if/.test(trimmed) || /^#ifdef/.test(trimmed) || /^#ifndef/.test(trimmed)) {
            ifdefStack.push(i);
        }
        if (/^#elif/.test(trimmed) || /^#else/.test(trimmed)) {
            if (ifdefStack.length) {
                const s = ifdefStack.pop()!;
                ifdefPairs.push({ start: s, end: i });
                ifdefStack.push(i);
            }
        }
        if (/^#endif/.test(trimmed)) {
            if (ifdefStack.length) ifdefPairs.push({ start: ifdefStack.pop()!, end: i });
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
        for (let i = p.start + 1; i < p.end; i++) indentLevel[i]++;

    for (const p of parenPairs)
        for (let i = p.start + 1; i < p.end; i++) indentLevel[i]++;

    for (const p of ifdefPairs)
        for (let i = p.start + 1; i < p.end; i++) indentLevel[i]++;

    for (const idx of oneLiners)
        for (let j = idx + 1; j < n; j++)
            if (lines[j].trim() !== "") { indentLevel[j]++; break; }

    // ---------------- PASS 3: apply indentation ----------------
    const indentStr = "    ";
    const out: string[] = [];

    for (let i = 0; i < n; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();

        if (trimmed === "") { out.push(raw); continue; }

        out.push(indentStr.repeat(indentLevel[i] + 1) + trimmed);
    }

    return out.join("\n");
}