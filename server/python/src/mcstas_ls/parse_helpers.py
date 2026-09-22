"""String-scanning helpers, ported from server/src/methods/textDocument/parse_helpers.ts.

These are pure functions with no LSP dependency, so they translate directly
from the TypeScript character-scanner implementation.
"""

from __future__ import annotations

import re

_IDENT_CHAR = re.compile(r"[A-Za-z0-9_]")
_ATTRIBUTE_RE = re.compile(r"__attribute__\s*\(\s*\([^)]+\)\s*\)")

_KEYWORDS = {
    "const", "volatile", "unsigned", "signed", "short", "long", "struct",
    "union", "enum", "int", "char", "float", "double", "void", "_Bool",
    "bool", "auto", "register", "extern", "static",
}

_CODE, _SL_COMMENT, _ML_COMMENT, _SQUOTE, _DQUOTE = range(5)


def strip_comments_and_strings(src: str) -> str:
    """Remove //... and /* ... */ comments and neutralize string/char literals
    so that delimiters inside them don't affect top-level splitting.
    """
    out: list[str] = []
    i = 0
    n = len(src)
    mode = _CODE
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""

        if mode == _CODE:
            if c == "/" and nxt == "/":
                mode = _SL_COMMENT
                i += 2
                continue
            if c == "/" and nxt == "*":
                mode = _ML_COMMENT
                i += 2
                continue
            if c == "'":
                mode = _SQUOTE
                out.append(" ")
                i += 1
                continue
            if c == '"':
                mode = _DQUOTE
                out.append(" ")
                i += 1
                continue
            out.append(c)
            i += 1
        elif mode == _SL_COMMENT:
            if c == "\n":
                mode = _CODE
                out.append("\n")
            i += 1
        elif mode == _ML_COMMENT:
            if c == "*" and nxt == "/":
                mode = _CODE
                i += 2
            else:
                i += 1
        elif mode == _SQUOTE:
            if c == "\\":
                i += 2
            elif c == "'":
                mode = _CODE
                i += 1
            else:
                i += 1
        elif mode == _DQUOTE:
            if c == "\\":
                i += 2
            elif c == '"':
                mode = _CODE
                i += 1
            else:
                i += 1
    return "".join(out)


def split_top_level_by(s: str, delim: str) -> list[str]:
    """Split by a single delimiter char at top-level (not inside (), [], {})."""
    parts: list[str] = []
    depth_paren = depth_bracket = depth_brace = 0
    last = 0
    for i, c in enumerate(s):
        if c == "(":
            depth_paren += 1
        elif c == ")":
            depth_paren = max(0, depth_paren - 1)
        elif c == "[":
            depth_bracket += 1
        elif c == "]":
            depth_bracket = max(0, depth_bracket - 1)
        elif c == "{":
            depth_brace += 1
        elif c == "}":
            depth_brace = max(0, depth_brace - 1)

        if c == delim and depth_paren == 0 and depth_bracket == 0 and depth_brace == 0:
            parts.append(s[last:i])
            last = i + 1
    parts.append(s[last:])
    return parts


def remove_top_level_initializer(s: str) -> str:
    """Trim anything from the first top-level '=' onward."""
    depth_p = depth_b = depth_br = 0
    for i, c in enumerate(s):
        if c == "(":
            depth_p += 1
        elif c == ")":
            depth_p = max(0, depth_p - 1)
        elif c == "[":
            depth_b += 1
        elif c == "]":
            depth_b = max(0, depth_b - 1)
        elif c == "{":
            depth_br += 1
        elif c == "}":
            depth_br = max(0, depth_br - 1)
        elif c == "=" and depth_p == 0 and depth_b == 0 and depth_br == 0:
            return s[:i]
    return s


def looks_like_function_prototype(stmt: str) -> bool:
    """Heuristic to skip function prototypes (not variable declarations):
    if there is a top-level '(' in the statement and no '=', treat it as a
    prototype.
    """
    s = _ATTRIBUTE_RE.sub(" ", stmt).strip()
    if "=" in s:
        return False
    depth = 0
    for c in s:
        if c == "(":
            if depth == 0:
                return True
            depth += 1
        elif c == ")":
            depth = max(0, depth - 1)
    return False


def extract_identifier_from_declarator(decl: str) -> str | None:
    """Extract the variable identifier from a single declarator by scanning
    backwards. Handles pointers and arrays, e.g.:
        "int *a"                        -> "a"
        "const unsigned long arr[10]"   -> "arr"
        "struct S *p"                   -> "p"
        "char *names[3]"                -> "names"

    Ported as-is from parse_helpers.ts, including a known limitation: function
    pointer declarators like "int (*fp)(int)" return None, because the
    trailing-suffix scanner strips both parenthesized groups indiscriminately
    and never recovers the identifier. The original .ts implementation has
    the same behavior despite its docstring claiming otherwise.
    """
    i = len(decl) - 1
    while i >= 0 and decl[i].isspace():
        i -= 1

    # Skip trailing array/function suffixes: [ ... ] and ( ... ) at top-level
    while i >= 0:
        if decl[i] == "]":
            depth = 1
            i -= 1
            while i >= 0 and depth > 0:
                if decl[i] == "]":
                    depth += 1
                elif decl[i] == "[":
                    depth -= 1
                i -= 1
            while i >= 0 and decl[i].isspace():
                i -= 1
            continue
        if decl[i] == ")":
            depth = 1
            i -= 1
            while i >= 0 and depth > 0:
                if decl[i] == ")":
                    depth += 1
                elif decl[i] == "(":
                    depth -= 1
                i -= 1
            while i >= 0 and decl[i].isspace():
                i -= 1
            continue
        break

    # Skip pointer stars and whitespace to the left
    while i >= 0 and (decl[i] == "*" or decl[i].isspace()):
        i -= 1

    end = i
    while i >= 0 and _IDENT_CHAR.match(decl[i]):
        i -= 1
    ident = decl[i + 1 : end + 1]
    if not ident:
        return None

    if ident in _KEYWORDS:
        j = i
        while j >= 0:
            while j >= 0 and not _IDENT_CHAR.match(decl[j]):
                j -= 1
            if j < 0:
                break
            end2 = j
            while j >= 0 and _IDENT_CHAR.match(decl[j]):
                j -= 1
            id2 = decl[j + 1 : end2 + 1]
            if id2 not in _KEYWORDS:
                return id2
        return None
    return ident
