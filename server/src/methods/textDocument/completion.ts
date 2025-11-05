import { RequestMessage } from "../../server";
import FuzzySearch = require('fuzzy-search');
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
    insertText?: string;
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

type Component = {
  category: string;
  name: string;
  parameter_comments: {[key:string]: string};
  parameter_defaults:{[key:string]: string};
  parameter_units: {[key:string]: string};
  parameter_names: string[];
  parameter_types: {[key:string]: string};
  // add other fields as needed
};

const components: {[key: string]: Component} = {};

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

async function printcomponents(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    log.write("Response is not okay");
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
    Object.assign(components, parsed);      // <-- mutate in place
  } catch (e) {
      console.error("Failed to parse JSON:", e);
  }


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








/* ---------------- Main completion (async) ---------------- */



export interface CompletionParams extends TextDocumentPositionParams {}

function getComponentContext(
  content: string,
  params: CompletionParams
): { inComponentBlock: boolean; componentType: string | null } {
  // Convert LSP position (line, character) to absolute offset in content
  const lines = content.split("\n");
  let offset = 0;
  for (let i = 0; i < params.position.line; i++) {
    offset += lines[i].length + 1; // +1 for '\n'
  }
  offset += params.position.character;

  // One regex to capture type (group 1) and args (group 2)
  // - COMPONENT ... = (capture type) ( capture args )
  const re = /COMPONENT[\s\S]*?=([\s\S]*?)\(([\s\S]*?)\)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const matchStart = m.index;
    const full = m[0];

    // Where is the '(' relative to the match?
    const openRel = full.indexOf('(');
    if (openRel < 0) continue;

    const argsText = m[2] ?? '';
    const argsStart = matchStart + openRel + 1;           // first char inside '('
    const argsEnd = argsStart + argsText.length;          // first char AFTER last arg char

    // Is cursor inside the parentheses?
    if (offset >= argsStart && offset <= argsEnd) {
      const rawType = (m[1] ?? '').trim();

      // Minimal “clean” type extraction:
      // pick the last identifier-looking token before '(' (handles "ns::Type", "Type", "Type /*comment*/")
      const cleanedType = rawType
        // strip inline comments (very rough)
        .replace(/\/\/.*|#.*|\/\*[\s\S]*?\*\//g, '')
        .trim();

      // Take the last identifier-ish token (letters, digits, underscore, colon, dot)
      const typeMatch = cleanedType.match(/[A-Za-z_][\w:.]*\s*$/);
      const componentType = (typeMatch ? typeMatch[0] : cleanedType).trim();

      return { inComponentBlock: true, componentType };
    }
  }

  return { inComponentBlock: false, componentType: null };
}

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

  const { inComponentBlock, componentType } = getComponentContext(content, params);
  // TODO: This fails sometimes
  const aggregated: CompletionItem[] = [];
  // Example: log or branch logic
  log.write({ inComponentBlock });

  if (inComponentBlock) {
    // fetch component parameters
    log.write(componentType);
    if (componentType !== null){
      let name: string;
      components[componentType].parameter_names.forEach(function(key) {
        const parmType = components[componentType].parameter_types[key]
        const parmComment = components[componentType].parameter_comments[key]

        aggregated.push({
          label: key,
          detail: `${key} is a parameter for ${componentType}`,
          documentation: parmComment
        });
      });
    }
  }



  // 1) Base commands COMPONENT etc.
  aggregated.push(...baseSuggestions);


  // 2) Components from the service
  if (!inComponentBlock)
  Object.keys(components).forEach(function(key) {
    const value = components[key];
    let label = key;
    if (value !== undefined) {
      try{
        const cat = value.category;
        const highlight = key +" From Category: " + cat ;
        let parmFlag = 0;
        let insertString = `COMPONENT my_component = ${key}(\n`

        let doc_string = "";
        value.parameter_names.forEach(function(name) {
          const parmType = value.parameter_types[name];
          const unit = value.parameter_units[name];
          const defaultVal = value.parameter_defaults[name];
          if (name === "Source_Maxwell_3"){
            log.write(defaultVal);
          }
          if (defaultVal === null){
            insertString += `    ${name} = ,\n`
            parmFlag = 1;
          }
          const comment = value.parameter_comments[name];
          doc_string += `${parmType} ${name} [${unit}] = ${defaultVal} | ${comment} \n\n`;
        })
        if (parmFlag===1){
          insertString = insertString.substring(0, insertString.length - 2); 
        }
        insertString += `\n)\nAT (0,0,0) RELATIVE PREVIOUS\n`
        aggregated.push({
           label,
           detail: highlight,
           documentation: doc_string,
           insertText: insertString
         });
      }
      catch{
        aggregated.push({
          label,
          detail: "McStas Component. Parsing unsuccessfull",
          documentation: "Missing documentation for now"
        })
        log.write("Log didn't work");
        log.write(JSON.stringify(value, null, 2));
        }
      } else {
        log.write('[undefined]');
    }

  });


  // 3) DECLARE variables
  if (!inComponentBlock)
  for (const v of declaredVariables) {
    aggregated.push({
      label: v,
        detail: "variable",
      documentation: "Declared in DECLARE%{ … }% block"
    });
  }
  
  // 4) DEFINE INSTRUMENT parameters
  if (!inComponentBlock)
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
  } else {
    // No query → deliver the first 500 items (or your preferred default ordering)
    items = items.slice(0, 500);
  }


  log.write({completion: currentLine, lineUntilCursor, currentPrefix, items: items});
  return {
    isIncomplete: true,
    items, 
  };
};
