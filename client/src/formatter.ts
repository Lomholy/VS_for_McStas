export async function formatMetaLanguage(source: string, filePath: string): Promise<string> {

    const lower = filePath.toLowerCase();
    let blockRegex: RegExp;

    if (lower.endsWith(".comp")) {
        blockRegex = /(\s*)(TRACE|SHARE|DECLARE|INITIALIZE|FINALLY|MCDISPLAY)\s*%\{([\s\S]*?)%\}/g;
    } else if (lower.endsWith('.instr')) {
        blockRegex = /(\s*)(DECLARE|INITIALIZE)\s*%\{([\s\S]*?)%\}/g;
    } else {
        return source;
    }

    let result = "";
    let lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = blockRegex.exec(source)) !== null) {
        const [full, leading, keyword, cCode] = match;

        // Add the text before this block
        result += source.slice(lastIndex, match.index);

        // Format the C code asynchronously
        const formatted = await formatWithMicrosoftCFormatter(cCode);

        // Append the formatted block
        result += `${leading}${keyword}\n%{${formatted}%}`;

        lastIndex = blockRegex.lastIndex;
    }

    // Append remainder of file
    result += source.slice(lastIndex);

    return result;
}

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

function applyTextEditsToString(text: string, edits: vscode.TextEdit[] | undefined): string {
    if (!edits || edits.length === 0) return text;

    // Apply in reverse order to preserve ranges
    const sorted = edits.slice().sort((a, b) => {
        const as = a.range.start, bs = b.range.start;
        if (as.line !== bs.line) return bs.line - as.line;
        return bs.character - as.character;
    });

    let lines = text.split(/\r?\n/);
    const posToOffset = (p: vscode.Position) => {
        let off = 0;
        for (let i = 0; i < p.line; i++) off += lines[i].length + 1; // +1 for '\n'
        return off + p.character;
    };

    let flat = lines.join('\n');
    for (const e of sorted) {
        const start = posToOffset(e.range.start);
        const end = posToOffset(e.range.end);
        flat = flat.slice(0, start) + e.newText + flat.slice(end);
        lines = flat.split('\n');
    }
    return flat;
}

// Use the Microsoft C formatter headlessly
async function formatWithMicrosoftCFormatter(code: string): Promise<string> {

    // Step 1 — Extract % lines and replace with placeholders
    const percentLines: { placeholder: string, line: string }[] = [];
    let processed = code.split("\n").map((line, idx) => {
        if (line.trim().startsWith("%")) {
            const placeholder = `__MCSTAS_PRESERVE_${idx}__`;
            percentLines.push({ placeholder, line });
            return placeholder; // replace with placeholder
        }
        return line;
    }).join("\n");

    // Write to a real .c file so the C/C++ formatter picks it up
    const tmpFilePath = path.join(os.tmpdir(), `mcstas_temp_${Date.now()}.c`);
    const tmpUri = vscode.Uri.file(tmpFilePath);

    await vscode.workspace.fs.writeFile(tmpUri, Buffer.from(processed, 'utf8'));

    // Open as a TextDocument (no editor tab)
    const doc = await vscode.workspace.openTextDocument(tmpUri);

    // Ask VS Code to run the registered format provider for C
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatDocumentProvider',
        doc.uri
    );

    const original = doc.getText();
    let formatted = applyTextEditsToString(original, edits);


    for (const { placeholder, line } of percentLines) {
        // preserve the original indentation of the % line
        formatted = formatted.replace(placeholder, line);
    }


    // Delete the temp file silently (no trash, no prompt)
    await vscode.workspace.fs.delete(tmpUri, { useTrash: false });

    return formatted;
}