"""Hover support, ported from server/src/methods/textDocument/hover.ts.

Matches a `COMPONENT ... = Name` pattern on the current line and, if the
cursor is over `Name`, renders a Markdown hover from the component's
parameters/types/units/defaults.
"""

from __future__ import annotations

import json
import math
import re
from typing import Any

from lsprotocol import types as lsp

from .data import get_components

_COMPONENT_PATTERN = re.compile(r"^[\t ]*(COMPONENT)\s+(?:[A-Za-z_]\w*)*\s*=\s*([A-Za-z_]\w*)")
_MD_ESCAPE = re.compile(r"([\\`*_}\[#+\-!.])")


def _escape_md(text: Any) -> str:
    return _MD_ESCAPE.sub(r"\\\1", str(text))


def _format_default(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v) if math.isfinite(v) else "NaN"
    if isinstance(v, str):
        return _escape_md(v) if v else '""'
    try:
        return _escape_md(json.dumps(v))
    except (TypeError, ValueError):
        return _escape_md(str(v))


def build_component_hover_markdown(
    spec: dict[str, Any],
    *,
    include_defaults: bool = True,
    include_units: bool = True,
    heading_level: int = 2,
) -> lsp.Hover:
    heading = "#" * max(1, min(6, heading_level))
    lines: list[str] = [
        f"{heading} {_escape_md(spec['name'])}",
        f"*Category:* {_escape_md(spec['category'])}",
        "",
        "**Parameters**",
    ]

    defaults = spec.get("parameter_defaults", {}) or {}
    types = spec.get("parameter_types", {}) or {}
    comments = spec.get("parameter_comments", {}) or {}
    units = spec.get("parameter_units", {}) or {}

    for pname in spec.get("parameter_names", []):
        ptype = types.get(pname, "unknown")
        comment = comments.get(pname, "")
        unit = units.get(pname) if include_units else None
        # A parameter's default may legitimately be JSON null, distinct from
        # the parameter having no default entry at all -- mirrors the TS
        # `def !== undefined` check, which is true for an explicit null.
        has_default = include_defaults and pname in defaults

        meta_parts = [ptype]
        if include_units and unit:
            meta_parts.append(f"unit: {_escape_md(unit)}")
        if has_default:
            meta_parts.append(f"default: {_format_default(defaults.get(pname))}")
        meta = f" *({', '.join(meta_parts)})*" if meta_parts else ""

        desc = f" — {_escape_md(comment)}" if comment else ""
        lines.append(f"- `{_escape_md(pname)}`{meta}{desc}")

    return lsp.Hover(contents=lsp.MarkupContent(kind=lsp.MarkupKind.Markdown, value="\n".join(lines)))


def find_hovered_component(text: str, line: int, character: int) -> str | None:
    """Return the component name under the cursor, if the cursor sits on a
    `COMPONENT ... = Name` line's `Name` token; None otherwise.
    """
    lines = text.splitlines()
    if line < 0 or line >= len(lines):
        return None
    line_text = lines[line]

    match = _COMPONENT_PATTERN.match(line_text)
    if not match:
        return None

    value_name = match.group(2)
    start_char = match.start() + match.group(0).rfind(value_name)
    end_char = start_char + len(value_name)
    if not (start_char <= character <= end_char):
        return None

    return value_name


def hover(ls, params: lsp.HoverParams) -> lsp.Hover | None:
    document = ls.workspace.get_text_document(params.text_document.uri)
    text = document.source
    if not text:
        return None

    value_name = find_hovered_component(text, params.position.line, params.position.character)
    if value_name is None:
        return None

    spec = get_components().get(value_name)
    if spec is None:
        return None

    return build_component_hover_markdown(spec)
