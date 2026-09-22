"""Completion support, ported from server/src/methods/textDocument/completion.ts.

Behaves the same as the TS version:

  - inside a `COMPONENT(...)` parameter list, offers that component's
    parameters;
  - otherwise offers component-insertion snippets, DECLARE-block variables,
    and DEFINE INSTRUMENT parameters;
  - fuzzy-filters the aggregated list against the user's typed prefix.

The fuzzy matching itself is not a byte-for-byte port: the TS server uses
the `fuzzy-search` npm package, this uses `rapidfuzz` (see PLAN.md). Ranking
and cutoffs will differ in the margins even though both approaches are
"fuzzy label/detail matching."
"""

from __future__ import annotations

import re
from typing import Any

from lsprotocol import types as lsp
from rapidfuzz import fuzz
from rapidfuzz import process as fuzzy_process

from .data import get_components
from .parse_helpers import (
    extract_identifier_from_declarator,
    looks_like_function_prototype,
    remove_top_level_initializer,
    split_top_level_by,
    strip_comments_and_strings,
)

_BASE_SUGGESTIONS: list[dict[str, Any]] = [
    {"label": "COMPONENT", "detail": "keyword", "documentation": "Begins a new component block"},
    {"label": "ABSOLUTE", "detail": "keyword", "documentation": "Use ABSOLUTE as the reference coordinate system"},
    {
        "label": "RELATIVE",
        "detail": "keyword",
        "documentation": "The following component or keyword will be the coordinate system used for computing this components coordinate system",
    },
    {"label": "PREVIOUS", "detail": "keyword", "documentation": "Use the previous component as the reference coordinate system"},
]

_DEFINE_INSTRUMENT_RE = re.compile(r"DEFINE INSTRUMENT.*?\((.*?)\)", re.DOTALL)
_DECLARE_BLOCK_RE = re.compile(r"DECLARE\s*%\{(.*?)%\}", re.DOTALL)
_PREPROCESSOR_RE = re.compile(r"^\s*#")
_VOID_ONLY_RE = re.compile(r"^\s*\bvoid\b\s*$")
_COMPONENT_ASSIGN_RE = re.compile(r"COMPONENT.*?=(.*?)\((.*?)\)", re.DOTALL)
_INLINE_COMMENT_RE = re.compile(r"//.*|#.*|/\*[\s\S]*?\*/")
_TRAILING_TYPE_TOKEN_RE = re.compile(r"[A-Za-z_][\w:.]*\s*$")
_TRAILING_WORD_RE = re.compile(r"(\w*)$")


def get_input_parameters(content: str) -> list[str]:
    params: list[str] = []
    for m in _DEFINE_INSTRUMENT_RE.finditer(content):
        clean = strip_comments_and_strings(m.group(1))
        for piece in split_top_level_by(clean, ","):
            p = piece.strip()
            if not p or p == "..." or _VOID_ONLY_RE.match(p):
                continue
            p = remove_top_level_initializer(p).strip()
            if not p:
                continue
            name = extract_identifier_from_declarator(p)
            if name and name not in params:
                params.append(name)
    return params


def get_declared_variables(content: str) -> list[str]:
    variables: list[str] = []
    for m in _DECLARE_BLOCK_RE.finditer(content):
        clean = strip_comments_and_strings(m.group(1))
        for raw_stmt in split_top_level_by(clean, ";"):
            stmt = raw_stmt.strip()
            if not stmt:
                continue
            if _PREPROCESSOR_RE.match(stmt):
                continue
            if "typedef" in stmt:
                continue
            if "{" in stmt:
                continue
            if looks_like_function_prototype(stmt):
                continue

            for raw_decl in split_top_level_by(stmt, ","):
                decl = remove_top_level_initializer(raw_decl).strip()
                if not decl:
                    continue
                name = extract_identifier_from_declarator(decl)
                if name and name not in variables:
                    variables.append(name)
    return variables


def get_component_context(content: str, offset: int) -> tuple[bool, str | None]:
    """Detect whether `offset` sits inside a `COMPONENT ... = Type(...)`
    parameter list, and if so, which `Type`.
    """
    for m in _COMPONENT_ASSIGN_RE.finditer(content):
        full = m.group(0)
        open_rel = full.find("(")
        if open_rel < 0:
            continue

        args_text = m.group(2) or ""
        args_start = m.start() + open_rel + 1
        args_end = args_start + len(args_text)

        if args_start <= offset <= args_end:
            raw_type = (m.group(1) or "").strip()
            cleaned_type = _INLINE_COMMENT_RE.sub("", raw_type).strip()
            type_match = _TRAILING_TYPE_TOKEN_RE.search(cleaned_type)
            component_type = (type_match.group(0) if type_match else cleaned_type).strip()
            return True, component_type

    return False, None


def _offset_at(content: str, line: int, character: int) -> int:
    lines = content.split("\n")
    offset = sum(len(lines[i]) + 1 for i in range(min(line, len(lines))))
    return offset + character


def _extract_prefix(line_until_cursor: str) -> str:
    # Equivalent to the TS `lineUntilCursor.replace(/.*\W(.*?)/, "$1")`:
    # that pattern, run through backtracking, ends up matching everything up
    # to and including the last non-word character and replacing it with an
    # empty capture, which -- for every input -- is the same as just taking
    # the trailing run of word characters.
    match = _TRAILING_WORD_RE.search(line_until_cursor)
    return match.group(1) if match else line_until_cursor


def _component_snippet_item(key: str, spec: dict[str, Any]) -> dict[str, Any]:
    try:
        category = spec["category"]
        highlight = f"{key} From Category: {category}"
        param_missing_default = False
        insert_lines = [f"COMPONENT $0 = {key}(\n"]

        doc_lines = []
        for name in spec["parameter_names"]:
            ptype = spec["parameter_types"][name]
            unit = spec["parameter_units"][name]
            default_val = spec["parameter_defaults"][name]
            if default_val is None:
                insert_lines.append(f"    {name} = ,\n")
                param_missing_default = True
            comment = spec["parameter_comments"][name]
            doc_lines.append(f"{ptype} {name} [{unit}] = {default_val} | {comment} \n\n")

        insert_text = "".join(insert_lines)
        if param_missing_default:
            insert_text = insert_text[:-2]
        insert_text += "\n)\nAT (0,0,0) RELATIVE PREVIOUS\n"

        return {
            "label": key,
            "detail": highlight,
            "documentation": "".join(doc_lines),
            "insertText": insert_text,
            "insertTextFormat": lsp.InsertTextFormat.Snippet,
            "kind": lsp.CompletionItemKind.Snippet,
        }
    except (KeyError, TypeError):
        return {
            "label": key,
            "detail": "McStas Component. Parsing unsuccessfull",
            "documentation": "Missing documentation for now",
        }


def _dedupe_by_label(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: dict[str, dict[str, Any]] = {}
    for item in items:
        seen.setdefault(item["label"], item)
    return list(seen.values())


def _fuzzy_filter(items: list[dict[str, Any]], query: str, limit: int = 500) -> list[dict[str, Any]]:
    choices = [f"{it['label']} {it.get('detail', '')}" for it in items]
    matches = fuzzy_process.extract(query, choices, scorer=fuzz.WRatio, limit=limit, score_cutoff=1)

    out: list[dict[str, Any]] = []
    for idx, (_, _score, choice_idx) in enumerate(matches):
        item = dict(items[choice_idx])
        item["filterText"] = item["label"]
        item["sortText"] = str(idx).zfill(6)
        item["preselect"] = idx == 0
        out.append(item)
    return out


def build_completion_items(content: str, line: int, character: int) -> list[dict[str, Any]]:
    """Pure logic behind the `completion` feature handler: build the ranked
    completion item list for `content` at the given cursor position, without
    touching pygls/lsprotocol types directly (keeps this unit-testable).
    """
    lines = content.split("\n")
    current_line = lines[line] if 0 <= line < len(lines) else ""
    line_until_cursor = current_line[:character]
    current_prefix = _extract_prefix(line_until_cursor)

    declared_variables = get_declared_variables(content)
    input_parameters = get_input_parameters(content)

    offset = _offset_at(content, line, character)
    in_component_block, component_type = get_component_context(content, offset)

    components = get_components()
    aggregated: list[dict[str, Any]] = []

    if in_component_block and component_type is not None:
        spec = components.get(component_type)
        if spec is not None:
            for name in spec.get("parameter_names", []):
                comment = spec.get("parameter_comments", {}).get(name, "")
                aggregated.append(
                    {
                        "label": name,
                        "detail": f"{name} is a parameter for {component_type}",
                        "documentation": comment,
                        "kind": lsp.CompletionItemKind.Property,
                    }
                )

    aggregated.extend(_BASE_SUGGESTIONS)

    if not in_component_block:
        for key, spec in components.items():
            if spec is not None:
                aggregated.append(_component_snippet_item(key, spec))

    for v in declared_variables:
        aggregated.append({"label": v, "detail": "Parameter from DECLARE section", "kind": lsp.CompletionItemKind.Variable})

    for p in input_parameters:
        aggregated.append({"label": p, "detail": "INSTRUMENT input parameter", "kind": lsp.CompletionItemKind.Variable})

    items = _dedupe_by_label(aggregated)

    query = current_prefix.strip()
    if query:
        return _fuzzy_filter(items, query)
    return items[:500]


def _to_completion_item(item: dict[str, Any]) -> lsp.CompletionItem:
    return lsp.CompletionItem(
        label=item["label"],
        detail=item.get("detail"),
        documentation=item.get("documentation"),
        insert_text=item.get("insertText"),
        insert_text_format=item.get("insertTextFormat"),
        kind=item.get("kind"),
        filter_text=item.get("filterText"),
        sort_text=item.get("sortText"),
        preselect=item.get("preselect"),
    )


def completion(ls, params: lsp.CompletionParams) -> lsp.CompletionList | None:
    document = ls.workspace.get_text_document(params.text_document.uri)
    content = document.source
    if not content:
        return None

    items = build_completion_items(content, params.position.line, params.position.character)
    return lsp.CompletionList(is_incomplete=True, items=[_to_completion_item(it) for it in items])
