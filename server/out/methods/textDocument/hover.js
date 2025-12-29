"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hover = void 0;
exports.buildComponentHoverMarkdown = buildComponentHoverMarkdown;
const documents_1 = require("../../documents");
const data = require("./mcstas-comps.json");
const log_1 = require("../../log");
// ---- Utility: escape Markdown special chars (safe for names/units) ----
function escapeMd(text) {
    return String(text).replace(/([\\`*_}\[\#+\-!.])/g, '\\$1');
}
// ---- Utility: format default values nicely ----
function formatDefault(v) {
    if (v === null || v === undefined)
        return 'null';
    if (typeof v === 'number')
        return Number.isFinite(v) ? String(v) : 'NaN';
    if (typeof v === 'string')
        return v.length ? escapeMd(v) : '""';
    if (typeof v === 'boolean')
        return v ? 'true' : 'false';
    try {
        return escapeMd(JSON.stringify(v));
    }
    catch {
        return escapeMd(String(v));
    }
}
function hasKey(obj, key) {
    return key in obj;
}
/**
 * Build a Markdown hover for a ComponentSpec.
 * - Title: large header with component name
 * - Under the title: category (italic)
 * - Parameters: bullet list, each with type and explanation
 * - Optional extras: defaults and units
 */
function buildComponentHoverMarkdown(spec, options = {}) {
    const { includeDefaults = true, includeUnits = true, headingLevel = 2, } = options;
    const lines = [];
    // Title
    const heading = '#'.repeat(Math.max(1, Math.min(6, headingLevel)));
    lines.push(`${heading} ${escapeMd(spec.name)}`);
    lines.push(`*Category:* ${escapeMd(spec.category)}`);
    lines.push(''); // blank line
    // Parameters section
    lines.push('**Parameters**');
    for (const pname of spec.parameter_names) {
        const type = spec.parameter_types?.[pname] ?? 'unknown';
        const comment = spec.parameter_comments?.[pname] ?? '';
        const unit = includeUnits ? spec.parameter_units?.[pname] : undefined;
        const def = includeDefaults ? spec.parameter_defaults?.[pname] : undefined;
        const metaParts = [];
        metaParts.push(type);
        if (includeUnits && unit)
            metaParts.push(`unit: ${escapeMd(unit)}`);
        if (includeDefaults && def !== undefined)
            metaParts.push(`default: ${formatDefault(def)}`);
        const meta = metaParts.length ? ` *(${metaParts.join(', ')})*` : '';
        const desc = comment ? ` — ${escapeMd(comment)}` : '';
        lines.push(`- \`${escapeMd(pname)}\`${meta}${desc}`);
    }
    return { contents: {
            kind: 'markdown',
            value: lines.join('\n'),
        } };
}
const hover = (message) => {
    const hover = message.params;
    const { textDocument, position } = hover;
    log_1.default.write("Inside of hover now!");
    const text = documents_1.documents.get(textDocument.uri);
    log_1.default.write(text);
    const lines = text.split(/\r?\n/);
    const lineText = lines[position.line];
    // Pattern: COMPONENT <sometext> = <wordOfInterest>
    // - Case-sensitive "COMPONENT" (use /i for case-insensitive)
    // - Identifiers: start with letter/underscore, followed by word chars
    const COMPONENT_PATTERN = /^[\t ]*(COMPONENT)\s+(?:[A-Za-z_]\w*)*\s*=\s*([A-Za-z_]\w*)/;
    const match = COMPONENT_PATTERN.exec(lineText);
    if (match) {
        const keyword = match[1];
        const valueName = match[2];
        log_1.default.write(keyword);
        log_1.default.write(valueName);
        // Optional: ensure the hover column is actually within the wordOfInterest
        // Compute the character range of <wordOfInterest> in this line
        const startChar = match.index + match[0].lastIndexOf(valueName);
        const endChar = startChar + valueName.length;
        const withinWord = position.character >= startChar && position.character <= endChar;
        // Log whenever we're on a line with COMPONENT; you can tighten this to only log when hovering the value
        if (withinWord) {
            if (hasKey(data, valueName)) {
                const spec = data[valueName];
                log_1.default.write(`hover: COMPONENT "${valueName}" detected`);
                return buildComponentHoverMarkdown(spec);
            }
            else {
                log_1.default.write(`hover: COMPONENT line detected (component="${valueName}", line=${position.line + 1}), but ${valueName} is not a valid component`);
            }
        }
        else {
            // If you want to log looser detection (anywhere on the COMPONENT line):
            log_1.default.write(`hover: COMPONENT line detected (component="${valueName}", line=${position.line + 1}), hover not on value`);
        }
    }
    else {
        // Optional: silence this if you prefer less logging
        log_1.default.write(`hover: no COMPONENT on line ${position.line + 1}`);
        log_1.default.write(lineText);
    }
    // For now, you’re just logging. Later you can return a Hover payload here.
    return null; // or `null` depending on your framework’s expectations
};
exports.hover = hover;
//# sourceMappingURL=hover.js.map