import { RequestMessage } from "../../server";
import { documents, TextDocumentIdentifier } from "../../documents";
import { integer} from "vscode-languageclient";
import * as data from "./mcstas-comps.json";
import log from "../../log";

// ---- Types that match your JSON structure ----
export interface ComponentSpec {
  name: string;
  category: string;
  parameter_names: string[];
  parameter_defaults: Record<string, unknown>;
  parameter_types: Record<string, string>;
  parameter_comments: Record<string, string>;
  parameter_units: Record<string, string>;
}

// ---- Rendering options ----
export interface HoverRenderOptions {
  includeDefaults?: boolean;  // default: true
  includeUnits?: boolean;     // default: true
  headingLevel?: 1 | 2 | 3;   // markdown heading level, default: 2
}

// ---- MarkupContent (as per your server) ----
export interface MarkupContent {
  kind: MarkupKind;
  value: string;
}

// ---- Utility: escape Markdown special chars (safe for names/units) ----
function escapeMd(text: string): string {
  return String(text).replace(/([\\`*_}\[\#+\-!.])/g, '\\$1');
}

// ---- Utility: format default values nicely ----
function formatDefault(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NaN';
  if (typeof v === 'string') return v.length ? escapeMd(v) : '""';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  try { return escapeMd(JSON.stringify(v)); } catch { return escapeMd(String(v)); }
}

type ProgressToken = integer | string;
export interface WorkDoneProgressParams {
	/**
	 * An optional token that a server can use to report work done progress.
	 */
	workDoneToken?: ProgressToken;
}
interface Position {
    line: number;
    character: number;
}
interface TextDocumentPositionParams {
	/**
	 * The text document.
	 */
	textDocument: TextDocumentIdentifier;

	/**
	 * The position inside the text document.
	 */
	position: Position;
}
export interface HoverParams extends TextDocumentPositionParams,
	WorkDoneProgressParams {
}
type MarkedString = string | { language: string; value: string };
export interface MarkupContent {
	/**
	 * The type of the Markup
	 */
	kind: MarkupKind;

	/**
	 * The content itself
	 */
	value: string;
}
export type MarkupKind = 'plaintext' | 'markdown';
export interface Hover {
	/**
	 * The hover's content
	 */
	contents: MarkedString | MarkedString[] | MarkupContent;

	/**
	 * An optional range is a range inside a text document
	 * that is used to visualize a hover, e.g. by changing the background color.
	 */
	range?: Range;
}

function hasKey<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return key in obj;
}


/**
 * Build a Markdown hover for a ComponentSpec.
 * - Title: large header with component name
 * - Under the title: category (italic)
 * - Parameters: bullet list, each with type and explanation
 * - Optional extras: defaults and units
 */
export function buildComponentHoverMarkdown(
  spec: ComponentSpec,
  options: HoverRenderOptions = {}
): Hover {
  const {
    includeDefaults = true,
    includeUnits = true,
    headingLevel = 2,
  } = options;

  const lines: string[] = [];

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

    const metaParts: string[] = [];
    metaParts.push(type);
    if (includeUnits && unit) metaParts.push(`unit: ${escapeMd(unit)}`);
    if (includeDefaults && def !== undefined) metaParts.push(`default: ${formatDefault(def)}`);
    const meta = metaParts.length ? ` *(${metaParts.join(', ')})*` : '';

    const desc = comment ? ` — ${escapeMd(comment)}` : '';
    lines.push(`- \`${escapeMd(pname)}\`${meta}${desc}`);
  }

  return {contents: {
    kind: 'markdown',
    value: lines.join('\n'),
  }};
}


export const hover = (message: RequestMessage): Hover | null => {
    const hover = message.params as HoverParams;
    const { textDocument, position } = hover;
    // log.write(textDocument.uri)
    const text = documents.get(hover.textDocument.uri);

    if (!text){
      return null;
    }

    const lines = text.split(/\r?\n/);
    const lineText = lines[position.line];

    // Pattern: COMPONENT <sometext> = <wordOfInterest>
    // - Case-sensitive "COMPONENT" (use /i for case-insensitive)
    // - Identifiers: start with letter/underscore, followed by word chars
    const COMPONENT_PATTERN =/^[\t ]*(COMPONENT)\s+(?:[A-Za-z_]\w*)*\s*=\s*([A-Za-z_]\w*)/;

    const match = COMPONENT_PATTERN.exec(lineText);
    if (match) {
        const keyword = match[1];
        const valueName = match[2];
        // log.write(keyword);
        // log.write(valueName);

        // Compute the character range of <wordOfInterest> in this line
        const startChar = match.index + match[0].lastIndexOf(valueName);
        const endChar = startChar + valueName.length;
        const withinWord =
            position.character >= startChar && position.character <= endChar;

        // Log whenever we're on a line with COMPONENT; you can tighten this to only log when hovering the value
        if (withinWord) {
            if (hasKey(data, valueName)) {
                const spec = data[valueName] as ComponentSpec; 
                // log.write(`hover: COMPONENT "${valueName}" detected`);
                return buildComponentHoverMarkdown(spec);
            } else {
                // log.write(
                // `hover: COMPONENT line detected (component="${valueName}", line=${position.line + 1}), but ${valueName} is not a valid component`
                // );
            }
        }
    } 
    return null; 
};