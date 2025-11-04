"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completion = void 0;
exports.getInputParameters = getInputParameters;
exports.getDeclaredVariables = getDeclaredVariables;
const documents_1 = require("../../documents");
const log_1 = require("../../log");
const parse_helpers_1 = require("./parse_helpers");
;
/* ----------- Base suggestions (with default metadata) ----------- */
const baseSuggestions = [
    { label: "COMPONENT", detail: "keyword", documentation: "Begins a new component block" },
    { label: "ABSOLUTE", detail: "keyword", documentation: "Use ABSOLUTE as the reference coordinate system" },
    { label: "RELATIVE", detail: "keyword", documentation: "The following component or keyword will be the coordinate system used for computing this components coordinate system" },
    { label: "PREVIOUS", detail: "keyword", documentation: "Use the previous component as the reference coordinate system" }
];
/**
 * Components: label -> documentation
 * e.g. { "Motor": "A controllable motor", "Sensor": "Temperature sensor", ... }
 */
const components = {};
/** Optional end-of-pipeline overrides: label -> { detail?, documentation? } */
const customAnnotations = {
// Example:
// "COMPONENT": { detail: "reserved keyword", documentation: "Introduces a component section" }
};
/* ---------------- Parsing helpers (your existing code) ---------------- */
function getInputParameters(content) {
    const matches = [...content.matchAll(/DEFINE INSTRUMENT[\s\S]*?\(([\s\S]*?)\)/g)];
    const params = [];
    for (const m of matches) {
        const paramList = m[1];
        const clean = (0, parse_helpers_1.stripCommentsAndStrings)(paramList);
        // Split into top-level parameters by comma
        const pieces = (0, parse_helpers_1.splitTopLevelBy)(clean, ',');
        for (let p of pieces) {
            p = p.trim();
            if (!p)
                continue;
            if (p === '...' || /^\s*\bvoid\b\s*$/.test(p))
                continue; // skip varargs and lone 'void'
            // Remove default initializer (in case the DSL or C++-style defaults exist)
            p = (0, parse_helpers_1.removeTopLevelInitializer)(p).trim();
            if (!p)
                continue;
            const name = (0, parse_helpers_1.extractIdentifierFromDeclarator)(p);
            if (name)
                params.push(name);
        }
    }
    // Deduplicate while preserving order across multiple definitions
    return Array.from(new Set(params));
}
function getDeclaredVariables(content) {
    const declBlocks = [...content.matchAll(/DECLARE\s*%\{([\s\S]*?)\}%/g)];
    const vars = [];
    for (const m of declBlocks) {
        const block = m[1];
        const clean = (0, parse_helpers_1.stripCommentsAndStrings)(block);
        const stmts = (0, parse_helpers_1.splitTopLevelBy)(clean, ';');
        for (let stmt of stmts) {
            stmt = stmt.trim();
            if (!stmt)
                continue;
            if (/^\s*#/.test(stmt))
                continue; // skip preprocessor
            if (/\btypedef\b/.test(stmt))
                continue; // skip typedefs
            if (/\{/.test(stmt))
                continue; // skip struct/enum definitions
            // Heuristic: skip function prototypes like 'void foo(int a);'
            // (top-level '(' before '=' and before end)
            if ((0, parse_helpers_1.looksLikeFunctionPrototype)(stmt))
                continue;
            // Split "int a, *b, arr[10]" into declarators
            const decls = (0, parse_helpers_1.splitTopLevelBy)(stmt, ',');
            for (let decl of decls) {
                // Remove initializer at top level: "= ..."
                decl = (0, parse_helpers_1.removeTopLevelInitializer)(decl).trim();
                if (!decl)
                    continue;
                // Extract the variable identifier by scanning backwards
                const name = (0, parse_helpers_1.extractIdentifierFromDeclarator)(decl);
                if (name)
                    vars.push(name);
            }
        }
    }
    // Deduplicate, preserve order
    return Array.from(new Set(vars));
}
/* ---------------- Components loader ---------------- */
async function printcomponents(url) {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return (await response.json());
}
async function ensureComponentsLoaded() {
    if (Object.keys(components).length === 0) {
        const data = await printcomponents('http://127.0.0.1:5000/get_all_comps');
        Object.assign(components, data); // <-- mutate in place
    }
}
/* ---------------- Utilities ---------------- */
function dedupeByLabel(items) {
    const map = new Map();
    for (const it of items) {
        if (!map.has(it.label))
            map.set(it.label, it);
    }
    return Array.from(map.values());
}
function mergeCustomAnnotations(items) {
    return items.map(it => {
        const extra = customAnnotations[it.label];
        return extra ? { ...it, ...extra } : it;
    });
}
/* ------------------- Parse component parameter utilities --------------- */
function parsePythonStringList(s) {
    const t = s.trim();
    if (!t.startsWith('[') || !t.endsWith(']'))
        return null;
    const items = [];
    let i = 1;
    const end = t.length - 1;
    while (i < end) {
        // skip whitespace/commas
        while (i < end && /[\s,]/.test(t[i]))
            i++;
        if (i >= end)
            break;
        if (t[i] !== "'")
            return null; // expect single-quoted string
        i++; // skip opening quote
        let buf = '';
        while (i < end) {
            const c = t[i++];
            if (c === "\\") {
                if (i < end) {
                    const e = t[i++];
                    buf += e === "'" ? "'" : e === "\\" ? "\\" : e;
                }
            }
            else if (c === "'") {
                items.push(buf);
                break;
            }
            else {
                buf += c;
            }
        }
    }
    return items.length ? items : null;
}
function toPlainTextDocumentation(doc) {
    if (typeof doc !== 'string')
        return String(doc ?? '');
    try {
        const parsed = JSON.parse(doc);
        if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
            return parsed.join('\n'); // or '\n\n' for spacing, or bullets
        }
    }
    catch { /* ignore */ }
    const pyList = parsePythonStringList(doc);
    if (pyList)
        return pyList.join('\n');
    return doc;
}
const completion = (message) => {
    ensureComponentsLoaded();
    const params = message.params;
    const content = documents_1.documents.get(params.textDocument.uri);
    if (!content) {
        return null;
    }
    const currentLine = content?.split("\n")[params.position.line];
    const lineUntilCursor = currentLine.slice(0, params.position.character);
    const currentPrefix = lineUntilCursor.replace(/.*\W(.*?)/, "$1");
    const declaredVariables = getDeclaredVariables(content);
    const inputParameters = getInputParameters(content);
    const aggregated = [];
    aggregated.push(...baseSuggestions);
    // 2) Components from the service
    for (const [label, doc] of Object.entries(components)) {
        const documentation = toPlainTextDocumentation(doc).split(",").join("\n");
        log_1.default.write({ label, documentation });
        aggregated.push({
            label,
            detail: "McStas Component. Parameters are:",
            documentation: documentation
        });
    }
    ;
    // 3) DECLARE variables
    for (const v of declaredVariables) {
        aggregated.push({
            label: v,
            detail: "variable",
            documentation: "Declared in DECLARE%{ … }% block"
        });
    }
    // 4) DEFINE INSTRUMENT parameters
    for (const p of inputParameters) {
        aggregated.push({
            label: p,
            detail: "parameter",
            documentation: "Parameter from DEFINE INSTRUMENT( … )"
        });
    }
    // Dedupe once and merge final custom annotations (your “add at the end” hook)
    let items = mergeCustomAnnotations(dedupeByLabel(aggregated));
    // Filter by typed prefix and cap list
    items = items
        .filter(it => it.label.startsWith(currentPrefix))
        .slice(0, 500);
    log_1.default.write({ completion: currentLine, lineUntilCursor, currentPrefix, items: items });
    return {
        isIncomplete: true,
        items,
    };
};
exports.completion = completion;
//# sourceMappingURL=completion.js.map