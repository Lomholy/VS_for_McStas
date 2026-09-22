"""pygls-based skeleton for the McStas language server.

This is a scaffold, not a feature-complete port. It wires up the pygls
server, capability declarations, and stub feature handlers that mirror the
TypeScript implementation in ``server/src``. The actual completion/hover
logic still needs to be ported from:

  - server/src/methods/textDocument/hover.ts
  - server/src/methods/textDocument/completion.ts

See ../PLAN.md for the full rewrite plan and phased port order.

Document sync (didOpen/didChange/didClose) is handled automatically by
pygls's Workspace, unlike the current server.ts, which only populates its
documents map on didChange and has no didOpen handler at all -- so hover and
completion silently do nothing on a freshly opened, unedited file. Nothing
extra needs to be registered here to fix that; ls.workspace.get_text_document
always returns current content.
"""

from __future__ import annotations

import json
import logging
from importlib import resources
from typing import Any

from lsprotocol import types as lsp
from pygls.lsp.server import LanguageServer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcstas_ls")

server = LanguageServer("mcstas-language-server", "0.0.1")

_components: dict[str, Any] | None = None


def get_components() -> dict[str, Any]:
    """Lazily load mcstas-comps.json (copied verbatim from the TS server's
    data file -- no need to regenerate it for this port).
    """
    global _components
    if _components is None:
        data_path = resources.files("mcstas_ls").joinpath("data/mcstas-comps.json")
        with data_path.open("r", encoding="utf-8") as f:
            _components = json.load(f)
    return _components


@server.feature(lsp.TEXT_DOCUMENT_HOVER)
def hover(ls: LanguageServer, params: lsp.HoverParams) -> lsp.Hover | None:
    """TODO: port server/src/methods/textDocument/hover.ts.

    That implementation matches a `COMPONENT ... = Name` pattern on the
    current line, looks `Name` up in the components data, and renders a
    Markdown hover from its parameters/types/units/defaults.
    """
    document = ls.workspace.get_text_document(params.text_document.uri)
    logger.debug("hover requested at %s in %s", params.position, document.uri)
    return None


@server.feature(
    lsp.TEXT_DOCUMENT_COMPLETION,
    lsp.CompletionOptions(trigger_characters=["=", "(", " "]),
)
def completion(ls: LanguageServer, params: lsp.CompletionParams) -> lsp.CompletionList | None:
    """TODO: port server/src/methods/textDocument/completion.ts.

    That implementation:
      - detects whether the cursor is inside a COMPONENT(...) parameter
        list and, if so, offers that component's parameters;
      - otherwise offers component-insertion snippets (from the components
        data), DECLARE-block variables, and DEFINE INSTRUMENT parameters
        (both parsed out of the document with parse_helpers);
      - fuzzy-filters the aggregated list against the user's typed prefix
        (rapidfuzz replaces the TS `fuzzy-search` package here).
    """
    document = ls.workspace.get_text_document(params.text_document.uri)
    logger.debug("completion requested at %s in %s", params.position, document.uri)
    return None


def main() -> None:
    server.start_io()


if __name__ == "__main__":
    main()
