export function formatMetaLanguage(source: string): string {
    const blockRegex = /(\s*)(TRACE|SHARE|DECLARE|INITIALIZE)\s*%\{([\s\S]*?)%\}/g;

    return source.replace(blockRegex, (match, leading, keyword, cCode) => {
        const formatted = formatCIndentation(cCode);
        return `${leading}${keyword} %{\n${formatted}\n%}`;
    });
}



export function formatCIndentation(code: string): string {
    const lines = code.split("\n");
    const n = lines.length;

    let inBlockComment = false;

    // Pass 1 outputs
    const bracePairs: { start: number; end: number }[] = [];
    const parenPairs: { start: number; end: number }[] = [];
    const oneLiners: number[] = [];   // lines after which we indent one line

    const braceStack: number[] = [];
    const parenStack: number[] = [];

    // Strip comments but keep code
    const stripComments = (line: string): string => {
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
            if (!inBlockComment && line.startsWith("//", i)) {
                break;
            }
            if (!inBlockComment) out += line[i];
            i++;
        }
        return out;
    };

    // ---------------- PASS 1: structure detection ----------------
    for (let i = 0; i < n; i++) {
        const raw = lines[i];
        const codeOnly = stripComments(raw);

        // detect brace + paren tokens
        for (const ch of codeOnly) {
            if (ch === "{") braceStack.push(i);
            if (ch === "}") {
                if (braceStack.length) {
                    const s = braceStack.pop()!;
                    bracePairs.push({ start: s, end: i });
                }
            }
            if (ch === "(") parenStack.push(i);
            if (ch === ")") {
                if (parenStack.length) {
                    const s = parenStack.pop()!;
                    parenPairs.push({ start: s, end: i });
                }
            }
        }

        // Single-line if() / for() without brace
        const trimmed = codeOnly.trim();
        const isIf = trimmed.startsWith("if");
        const isFor = trimmed.startsWith("for");

        const hasParenPair = trimmed.includes("(") && trimmed.includes(")");
        const hasOpenBrace = trimmed.includes("{");

        if ((isIf || isFor) && hasParenPair && !hasOpenBrace) {
            oneLiners.push(i);
        }
    }

    // ---------------- PASS 2: Build indentation levels ----------------
    const indentLevel = new Array(n).fill(0);

    // Brace blocks
    for (const p of bracePairs) {
        for (let i = p.start + 1; i < p.end; i++) indentLevel[i]++;
    }

    // Give parentheses smaller structural weight (optional)
    // Here: each paren pair contributes +0.5 indentation
    // You can drop this if you prefer only brace-based structural indentation.
    for (const p of parenPairs) {
        for (let i = p.start + 1; i < p.end; i++) indentLevel[i] ++;
    }

    // Single-line if() and for()
    for (const idx of oneLiners) {
        // indent only the *next* non-empty line
        for (let j = idx + 1; j < n; j++) {
            if (lines[j].trim() !== "") {
                indentLevel[j] += 1;
                break;
            }
        }
    }

    // ---------------- PASS 3: apply indentation ----------------
    const indentStr = "    ";
    const out: string[] = [];

    for (let i = 0; i < n; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();

        if (trimmed === "") {
            out.push(raw);
            continue;
        }

        const ind = Math.floor(indentLevel[i]) + 1;
        out.push(indentStr.repeat(ind) + trimmed);
    }

    return out.join("\n");
}