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

    // ---- PASS 1: Find all brace pairs ----
    const bracePairs: { start: number; end: number }[] = [];
    const stack: number[] = [];

    function stripComments(line: string): string {
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
                break; // rest of line ignored
            }
            if (!inBlockComment) out += line[i];
            i++;
        }
        return out;
    }

    for (let i = 0; i < n; i++) {
        const cleaned = stripComments(lines[i]);
        for (const ch of cleaned) {
            if (ch === '{') {
                stack.push(i);
            } else if (ch === '}') {
                if (stack.length > 0) {
                    const start = stack.pop()!;
                    bracePairs.push({ start, end: i });
                }
            }
        }
    }

    // ---- PASS 2: Compute indentation level for each line ----
    // indentLevel[i] = number of brace pairs that enclose line i
    const indentLevel = new Array(n).fill(0);

    for (const pair of bracePairs) {
        for (let i = pair.start + 1; i < pair.end; i++) {
            indentLevel[i]++;
        }
    }

    // ---- PASS 3: Apply indentation ----
    const indentStr = "    ";
    const out: string[] = [];

    for (let i = 0; i < n; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();

        if (trimmed === "") { out.push(raw); continue; }

        const ind = indentLevel[i] + 1; // +1 base indent as you previously used
        out.push(indentStr.repeat(ind) + trimmed);
    }

    return out.join("\n");
}