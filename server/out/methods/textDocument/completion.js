"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completion = void 0;
exports.getInputParameters = getInputParameters;
exports.getDeclaredVariables = getDeclaredVariables;
const FuzzySearch = require("fuzzy-search");
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
    if (!response.ok) {
        log_1.default.write("Response is not okay");
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
}
async function ensureComponentsLoaded() {
    if (Object.keys(components).length === 0) {
        const data1 = await printcomponents('http://127.0.0.1:5000/get_all_comps');
        try {
            const safeString = data1.replace(/\bNaN\b/g, 'null');
            const parsed = JSON.parse(safeString);
            Object.assign(components, parsed); // <-- mutate in place
        }
        catch (e) {
            console.error("Failed to parse JSON:", e);
        }
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
    // 1) Base commands COMPONENT etc.
    aggregated.push(...baseSuggestions);
    // 2) Components from the service
    Object.keys(components).forEach(function (key) {
        const value = components[key];
        let label = key;
        if (value !== undefined) {
            try {
                const cat = value.category;
                const highlight = key + " From Category: " + cat;
                let parmFlag = 0;
                let insertString = `COMPONENT my_component = ${key}(\n`;
                let doc_string = "";
                value.parameter_names.forEach(function (name) {
                    const parmType = value.parameter_types[name];
                    const unit = value.parameter_units[name];
                    const defaultVal = value.parameter_defaults[name];
                    if (name === "Source_Maxwell_3") {
                        log_1.default.write(defaultVal);
                    }
                    if (defaultVal === null) {
                        insertString += `    ${name} = ,\n`;
                        parmFlag = 1;
                    }
                    const comment = value.parameter_comments[name];
                    doc_string += `${parmType} ${name} [${unit}] = ${defaultVal} | ${comment} \n\n`;
                });
                if (parmFlag === 1) {
                    insertString = insertString.substring(0, insertString.length - 2);
                }
                insertString += `\n)\nAT (0,0,0) RELATIVE PREVIOUS\n`;
                aggregated.push({
                    label,
                    detail: highlight,
                    documentation: doc_string,
                    insertText: insertString
                });
            }
            catch {
                aggregated.push({
                    label,
                    detail: "McStas Component. Parsing unsuccessfull",
                    documentation: "Missing documentation for now"
                });
                log_1.default.write("Log didn't work");
                log_1.default.write(JSON.stringify(value, null, 2));
            }
        }
        else {
            log_1.default.write('[undefined]');
        }
    });
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
    // Compute the query from your existing logic
    const query = (currentPrefix ?? '').trim();
    // If there is a user-typed prefix, fuzzy search; otherwise return defaults
    if (query.length >= 1) {
        // Search primarily in 'label', and also in 'detail' for extra context hits.
        // Add 'documentation' to the array if you want very broad matches (can be noisy).
        const searcher = new FuzzySearch(items, ['label', 'detail'], {
            caseSensitive: false,
            sort: true, // sorts best matches first
        });
        const results = searcher.search(query);
        // Map back to CompletionItems, keep fields, and add stable sortText
        items = results.slice(0, 500).map((it, idx) => ({
            ...it,
            // Ensure the editor doesn't re-filter strictly by label
            filterText: it.label,
            // Put best matches first; since fuzzy-search already sorts, we just encode idx
            sortText: String(idx).padStart(6, '0'),
            // Nice-to-have: preselect the top candidate
            preselect: idx === 0,
        }));
    }
    else {
        // No query → deliver the first 500 items (or your preferred default ordering)
        items = items.slice(0, 500);
    }
    log_1.default.write({ completion: currentLine, lineUntilCursor, currentPrefix, items: items });
    return {
        isIncomplete: true,
        items,
    };
};
exports.completion = completion;
//# sourceMappingURL=completion.js.map