import { RequestMessage } from "../../server";
import * as fs from "fs"
import { documents, TextDocumentIdentifier } from "../../documents";
import log from '../../log';
import {looksLikeFunctionPrototype,
        stripCommentsAndStrings,
        splitTopLevelBy,
        removeTopLevelInitializer,
        extractIdentifierFromDeclarator
} from "./parse_helpers";


type CompletionItem = {
    label: string;
    detail: string;
    documentation: string;
};

interface CompletionList {
	isIncomplete: boolean;
	items: CompletionItem[];
};
 
interface Position {
    line: number;
    character: number;
}


interface TextDocumentPositionParams {
	textDocument: TextDocumentIdentifier;
	position: Position;
}


/* ----------- Base suggestions (with default metadata) ----------- */

const baseSuggestions: CompletionItem[] = [
  { label: "COMPONENT", detail: "keyword", documentation: "Begins a new component block" },
  { label: "ABSOLUTE",  detail: "keyword", documentation: "Use ABSOLUTE as the reference coordinate system" },
  { label: "RELATIVE",  detail: "keyword", documentation: "The following component or keyword will be the coordinate system used for computing this components coordinate system" },
  { label: "PREVIOUS",  detail: "keyword", documentation: "Use the previous component as the reference coordinate system" }
];

/**
 * Components: label -> documentation
 * e.g. { "Motor": "A controllable motor", "Sensor": "Temperature sensor", ... }
 */
const components: Record<string, string> = {};

/** Optional end-of-pipeline overrides: label -> { detail?, documentation? } */
const customAnnotations: Record<string, Partial<CompletionItem>> = {
  // Example:
  // "COMPONENT": { detail: "reserved keyword", documentation: "Introduces a component section" }
};

/* ---------------- Parsing helpers (your existing code) ---------------- */

export function getInputParameters(content: string): string[] {
  const matches = [...content.matchAll(/DEFINE INSTRUMENT[\s\S]*?\(([\s\S]*?)\)/g)];
  const params: string[] = [];

  for (const m of matches) {
    const paramList = m[1];
    const clean = stripCommentsAndStrings(paramList);

    // Split into top-level parameters by comma
    const pieces = splitTopLevelBy(clean, ',');

    for (let p of pieces) {
      p = p.trim();
      if (!p) continue;
      if (p === '...' || /^\s*\bvoid\b\s*$/.test(p)) continue; // skip varargs and lone 'void'

      // Remove default initializer (in case the DSL or C++-style defaults exist)
      p = removeTopLevelInitializer(p).trim();
      if (!p) continue;

      const name = extractIdentifierFromDeclarator(p);
      if (name) params.push(name);
    }
  }

  // Deduplicate while preserving order across multiple definitions
  return Array.from(new Set(params));
}

export function getDeclaredVariables(content: string): string[] {
  const declBlocks = [...content.matchAll(/DECLARE\s*%\{([\s\S]*?)\}%/g)];
  const vars: string[] = [];

  for (const m of declBlocks) {
    const block = m[1];
    const clean = stripCommentsAndStrings(block);
    const stmts = splitTopLevelBy(clean, ';');

    for (let stmt of stmts) {
      stmt = stmt.trim();
      if (!stmt) continue;
      if (/^\s*#/.test(stmt)) continue;              // skip preprocessor
      if (/\btypedef\b/.test(stmt)) continue;        // skip typedefs
      if (/\{/.test(stmt)) continue;                 // skip struct/enum definitions

      // Heuristic: skip function prototypes like 'void foo(int a);'
      // (top-level '(' before '=' and before end)
      if (looksLikeFunctionPrototype(stmt)) continue;

      // Split "int a, *b, arr[10]" into declarators
      const decls = splitTopLevelBy(stmt, ',');
      for (let decl of decls) {
        // Remove initializer at top level: "= ..."
        decl = removeTopLevelInitializer(decl).trim();
        if (!decl) continue;

        // Extract the variable identifier by scanning backwards
        const name = extractIdentifierFromDeclarator(decl);
        if (name) vars.push(name);
      }
    }
  }

  // Deduplicate, preserve order
  return Array.from(new Set(vars));
}

/* ---------------- Components loader ---------------- */

async function printcomponents(url: string): Promise<Record<string, string>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return (await response.json()) as Record<string, string>;
}

async function ensureComponentsLoaded() {
  if (Object.keys(components).length === 0) {
    const data = await printcomponents('http://127.0.0.1:5000/get_all_comps');
    Object.assign(components, data);      // <-- mutate in place
  }
}


/* ---------------- Utilities ---------------- */


function dedupeByLabel(items: CompletionItem[]): CompletionItem[] {
  const map = new Map<string, CompletionItem>();
  for (const it of items) {
    if (!map.has(it.label)) map.set(it.label, it);
  }
  return Array.from(map.values());
}

function mergeCustomAnnotations(items: CompletionItem[]): CompletionItem[] {
  return items.map(it => {
    const extra = customAnnotations[it.label];
    return extra ? { ...it, ...extra } : it;
  });
}


/* ------------------- Parse component parameter utilities --------------- */

function parsePythonStringList(s: string): string[] | null {
  const t = s.trim();
  if (!t.startsWith('[') || !t.endsWith(']')) return null;

  const items: string[] = [];
  let i = 1;
  const end = t.length - 1;

  while (i < end) {
    // skip whitespace/commas
    while (i < end && /[\s,]/.test(t[i])) i++;
    if (i >= end) break;

    if (t[i] !== "'") return null; // expect single-quoted string
    i++; // skip opening quote

    let buf = '';
    while (i < end) {
      const c = t[i++];
      if (c === "\\") {
        if (i < end) {
          const e = t[i++];
          buf += e === "'" ? "'" : e === "\\" ? "\\" : e;
        }
      } else if (c === "'") {
        items.push(buf);
        break;
      } else {
        buf += c;
      }
    }
  }
  return items.length ? items : null;
}


function toPlainTextDocumentation(doc: unknown): string {
  if (typeof doc !== 'string') return String(doc ?? '');

  try {
    const parsed = JSON.parse(doc);
    if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
      return parsed.join('\n'); // or '\n\n' for spacing, or bullets
    }
  } catch { /* ignore */ }

  const pyList = parsePythonStringList(doc);
  if (pyList) return pyList.join('\n');

  return doc;
}


/* ---------------- Main completion (async) ---------------- */



export interface CompletionParams extends TextDocumentPositionParams {}


export const completion = (message: RequestMessage): CompletionList | null => {

    
  ensureComponentsLoaded();
  
    
  const params = message.params as CompletionParams;
  const content = documents.get(params.textDocument.uri);
  if (!content){
      return null;
  }

  const currentLine = content?.split("\n")[params.position.line];
  const lineUntilCursor = currentLine.slice(0,params.position.character)
  const currentPrefix = lineUntilCursor.replace(/.*\W(.*?)/, "$1");

  const declaredVariables = getDeclaredVariables(content)
  const inputParameters = getInputParameters(content);

  const aggregated: CompletionItem[] = [];

  aggregated.push(...baseSuggestions);
    
  // 2) Components from the service
  for (const [label, doc] of Object.entries(components)) {
    const documentation = toPlainTextDocumentation(doc).split(",").join("\n");
    log.write({label,documentation});
    aggregated.push({
      label,
      detail: "McStas Component. Parameters are:",
      documentation: documentation
    });
  };
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


  log.write({completion: currentLine, lineUntilCursor, currentPrefix, items: items});
  return {
    isIncomplete: true,
    items, 
  };
};
