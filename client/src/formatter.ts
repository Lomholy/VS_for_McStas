export function formatMetaLanguage(source: string): string {
    const blockRegex = /(\s*)(TRACE|SHARE|DECLARE|INITIALIZE)\s*%\{([\s\S]*?)%\}/g;


    return source.replace(blockRegex, (match, leading, keyword, cCode) => {
        const formatted = formatCIndentation(cCode);
        return `${leading}${keyword} %{\n${formatted}\n%}`;
    });

}



export function formatCIndentation(code: string): string {
    const lines = code.split("\n");

    let indent = 1;
    let indentNext = false; // NEW: for one-line if bodies
    const indentStr = "    ";
    const out: string[] = [];


    for (const line of lines) {
        const trimmed = line.trim();

        // blank line → keep as-is
        if (trimmed === "") {
            out.push(line);
            continue;
        }

        const isCloseBrace = trimmed.startsWith("}") || trimmed.startsWith(")");
        const isOpenBrace  = trimmed.endsWith("{") || trimmed.endsWith("(");

        const isEndif = trimmed.startsWith("#endif");
        const isElse  = trimmed.startsWith("#else");
        const isElif  = trimmed.startsWith("#elif");
        const isIfLike =
            trimmed.startsWith("#if ") ||
            trimmed.startsWith("#ifdef") ||
            trimmed.startsWith("#ifndef");

        // NEW: detect "if(x)" with NO brace
        const isSingleLineIf = 
            trimmed.startsWith("if") &&
            !trimmed.includes("{") && !trimmed.endsWith(";");

        // Dedent before printing
        if (isCloseBrace || isEndif || isElse || isElif) {
            indent = Math.max(1, indent - 1);
        }

        // Apply indentation
        if (indentNext){
            if (trimmed.startsWith("{")){
                indentNext = false;
            }
        }
        const appliedIndent = indentNext ? indent + 1 : indent;
        out.push(indentStr.repeat(appliedIndent) + trimmed);

        // Reset indentNext after use
        indentNext = false;

        // After-print indentation rules
        if (isOpenBrace) indent++;
        if (isIfLike || isElse || isElif) indent++;

        // if-this-then indent next non-empty line
        if (isSingleLineIf) {
            indentNext = true;
        }
    }

    return out.join("\n");
}
