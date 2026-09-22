"""pygls-based McStas language server.

Ports server/src to Python. See ../PLAN.md for the rewrite plan and
per-module notes on where behavior intentionally differs from the TS
implementation (fuzzy-match ranking, mainly).

Document sync (didOpen/didChange/didClose) is handled automatically by
pygls's Workspace, unlike the current server.ts, which only populates its
documents map on didChange and has no didOpen handler at all -- so hover and
completion silently do nothing on a freshly opened, unedited file. Nothing
extra needs to be registered here to fix that; ls.workspace.get_text_document
always returns current content.
"""

from __future__ import annotations

import logging

from lsprotocol import types as lsp
from pygls.lsp.server import LanguageServer

from .completion import completion as completion_impl
from .hover import hover as hover_impl

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcstas_ls")

server = LanguageServer("mcstas-language-server", "0.0.1")


@server.feature(lsp.TEXT_DOCUMENT_HOVER)
def hover(ls: LanguageServer, params: lsp.HoverParams) -> lsp.Hover | None:
    return hover_impl(ls, params)


@server.feature(
    lsp.TEXT_DOCUMENT_COMPLETION,
    lsp.CompletionOptions(trigger_characters=["=", "(", " "]),
)
def completion(ls: LanguageServer, params: lsp.CompletionParams) -> lsp.CompletionList | None:
    return completion_impl(ls, params)


def main() -> None:
    server.start_io()


if __name__ == "__main__":
    main()
