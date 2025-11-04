"use strict";
/* -------------------- Helpers -------------------- */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripCommentsAndStrings = stripCommentsAndStrings;
exports.splitTopLevelBy = splitTopLevelBy;
exports.removeTopLevelInitializer = removeTopLevelInitializer;
exports.looksLikeFunctionPrototype = looksLikeFunctionPrototype;
exports.extractIdentifierFromDeclarator = extractIdentifierFromDeclarator;
/**
 * Remove //... and /* ... *\/ and also neutralize string/char literals so
 * that delimiters inside them don’t affect top-level splitting.
 */
function stripCommentsAndStrings(src) {
    let out = '';
    let i = 0;
    const N = src.length;
    let Mode;
    (function (Mode) {
        Mode[Mode["Code"] = 0] = "Code";
        Mode[Mode["SLComment"] = 1] = "SLComment";
        Mode[Mode["MLComment"] = 2] = "MLComment";
        Mode[Mode["SQuote"] = 3] = "SQuote";
        Mode[Mode["DQuote"] = 4] = "DQuote";
    })(Mode || (Mode = {}));
    let mode = Mode.Code;
    while (i < N) {
        const c = src[i];
        const n = src[i + 1];
        if (mode === Mode.Code) {
            if (c === '/' && n === '/') {
                mode = Mode.SLComment;
                i += 2;
                continue;
            }
            if (c === '/' && n === '*') {
                mode = Mode.MLComment;
                i += 2;
                continue;
            }
            if (c === "'") {
                mode = Mode.SQuote;
                out += ' ';
                i++;
                continue;
            }
            if (c === '"') {
                mode = Mode.DQuote;
                out += ' ';
                i++;
                continue;
            }
            out += c;
            i++;
        }
        else if (mode === Mode.SLComment) {
            if (c === '\n') {
                mode = Mode.Code;
                out += '\n';
            }
            i++;
        }
        else if (mode === Mode.MLComment) {
            if (c === '*' && n === '/') {
                mode = Mode.Code;
                i += 2;
            }
            else
                i++;
        }
        else if (mode === Mode.SQuote) {
            if (c === '\\') {
                i += 2;
            } // skip escape
            else if (c === "'") {
                mode = Mode.Code;
                i++;
            }
            else
                i++;
        }
        else if (mode === Mode.DQuote) {
            if (c === '\\') {
                i += 2;
            } // skip escape
            else if (c === '"') {
                mode = Mode.Code;
                i++;
            }
            else
                i++;
        }
    }
    return out;
}
/** Split by a single delimiter char at top-level (not inside (), [], {}). */
function splitTopLevelBy(s, delim) {
    const parts = [];
    let depthParen = 0, depthBracket = 0, depthBrace = 0;
    let last = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(')
            depthParen++;
        else if (c === ')')
            depthParen = Math.max(0, depthParen - 1);
        else if (c === '[')
            depthBracket++;
        else if (c === ']')
            depthBracket = Math.max(0, depthBracket - 1);
        else if (c === '{')
            depthBrace++;
        else if (c === '}')
            depthBrace = Math.max(0, depthBrace - 1);
        if (c === delim && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
            parts.push(s.slice(last, i));
            last = i + 1;
        }
    }
    parts.push(s.slice(last));
    return parts;
}
/** Remove top-level initializer: trims anything from the first top-level '=' onward. */
function removeTopLevelInitializer(s) {
    let depthP = 0, depthB = 0, depthBr = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(')
            depthP++;
        else if (c === ')')
            depthP = Math.max(0, depthP - 1);
        else if (c === '[')
            depthB++;
        else if (c === ']')
            depthB = Math.max(0, depthB - 1);
        else if (c === '{')
            depthBr++;
        else if (c === '}')
            depthBr = Math.max(0, depthBr - 1);
        else if (c === '=' && depthP === 0 && depthB === 0 && depthBr === 0) {
            return s.slice(0, i);
        }
    }
    return s;
}
/**
 * Heuristic to skip export function prototypes (not variable declarations):
 * If there is a top-level '(' in the statement and no '=', and the ')' closes
 * before the semicolon, we consider it a prototype.
 */
function looksLikeFunctionPrototype(stmt) {
    // Remove qualifiers that might confuse the heuristic (e.g., attributes)
    const s = stmt.replace(/\b__attribute__\s*\(\s*\([^)]+\)\s*\)/g, ' ').trim();
    if (s.includes('='))
        return false;
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '(') {
            if (depth === 0)
                return true; // a top-level '('
            depth++;
        }
        else if (c === ')') {
            depth = Math.max(0, depth - 1);
        }
    }
    return false;
}
/**
 * Extract the variable identifier from a single declarator by scanning backwards.
 * Handles pointers, arrays, and export function pointers gracefully.
 * Examples it handles:
 *   "int *a" -> a
 *   "const unsigned long arr[10]" -> arr
 *   "struct S *p" -> p
 *   "int (*fp)(int)" -> fp
 *   "char *names[3]" -> names
 */
function extractIdentifierFromDeclarator(decl) {
    let i = decl.length - 1;
    // Remove trailing whitespace
    while (i >= 0 && /\s/.test(decl[i]))
        i--;
    // Skip trailing array/export function suffixes: [ ... ] and ( ... ) at top-level
    while (i >= 0) {
        if (decl[i] === ']') {
            let depth = 1;
            i--;
            while (i >= 0 && depth > 0) {
                if (decl[i] === ']')
                    depth++;
                else if (decl[i] === '[')
                    depth--;
                i--;
            }
            // skip whitespace after skipping a suffix
            while (i >= 0 && /\s/.test(decl[i]))
                i--;
            continue;
        }
        if (decl[i] === ')') {
            let depth = 1;
            i--;
            while (i >= 0 && depth > 0) {
                if (decl[i] === ')')
                    depth++;
                else if (decl[i] === '(')
                    depth--;
                i--;
            }
            while (i >= 0 && /\s/.test(decl[i]))
                i--;
            continue;
        }
        break;
    }
    // Skip pointer stars and whitespace to the left
    while (i >= 0 && (decl[i] === '*' || /\s/.test(decl[i])))
        i--;
    // Now read the identifier backwards
    let end = i;
    while (i >= 0 && /[A-Za-z0-9_]/.test(decl[i]))
        i--;
    const ident = decl.slice(i + 1, end + 1);
    if (!ident)
        return null;
    // Filter out obvious keywords if we somehow landed on type words
    const kw = new Set([
        'const', 'volatile', 'unsigned', 'signed', 'short', 'long', 'struct', 'union', 'enum',
        'int', 'char', 'float', 'double', 'void', '_Bool', 'bool', 'auto', 'register', 'extern', 'static'
    ]);
    if (kw.has(ident)) {
        // If we hit a keyword, try to continue scanning left to find the next identifier
        let j = i;
        while (j >= 0) {
            while (j >= 0 && !/[A-Za-z0-9_]/.test(decl[j]))
                j--;
            if (j < 0)
                break;
            let end2 = j;
            while (j >= 0 && /[A-Za-z0-9_]/.test(decl[j]))
                j--;
            const id2 = decl.slice(j + 1, end2 + 1);
            if (!kw.has(id2))
                return id2;
        }
        return null;
    }
    return ident;
}
//# sourceMappingURL=parse_helpers.js.map