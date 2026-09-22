# mcstas-language-server (Python, scaffold)

A `pygls`-based skeleton for a Python rewrite of the TypeScript language
server in `../` (`server/src`). See [`PLAN.md`](./PLAN.md) for the full
rewrite plan and rationale.

## Status

- [x] Project layout, packaging (`pyproject.toml`), pygls server instance
- [x] `parse_helpers.py` ported from `parse_helpers.ts`, with tests
- [x] `mcstas-comps.json` data file copied over
- [x] Manually verified: `python3 -m mcstas_ls.server` starts and responds
      to an `initialize` request over stdio (see "Manual smoke test" below)
- [x] `hover.py` — port of `hover.ts`, with tests
- [x] `completion.py` — port of `completion.ts`, with tests (fuzzy matching
      uses `rapidfuzz` instead of the TS server's `fuzzy-search`, see
      `PLAN.md` for why exact ranking parity isn't the goal)
- [x] Manually verified over real stdio: hover and completion against an
      open document (see `scripts/smoke_test_hover_completion.py`)
- [ ] `extension.ts` client wiring to launch this server instead of the
      Node one

## Setup

```bash
cd server/python
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip  # editable installs need pip>=21.3 (PEP 660)
pip install -e ".[dev]"
```

## Running the server standalone

The server speaks LSP over stdio, same as the Node server:

```bash
python3 -m mcstas_ls.server
```

## Tests

```bash
pytest
```

## Manual smoke test

To confirm the server starts and speaks LSP correctly without a full VS Code
client, send it a framed `initialize` request over stdio and check the
response:

```bash
python3 scripts/smoke_test_initialize.py
```

This starts `python3 -m mcstas_ls.server` as a subprocess, writes a
`Content-Length`-framed `initialize` request to its stdin, and prints the
framed response it reads back from stdout — the same wire format
`server.ts` implements by hand. A healthy response includes
`"hoverProvider": true`, a `completionProvider`, and
`"textDocumentSync": {"openClose": true, ...}` (the `openClose: true` is
pygls managing document sync automatically, which is the fix for the
missing-`didOpen`-handler gap in the current Node server — see `PLAN.md`).

To exercise hover and completion themselves against an open document:

```bash
python3 scripts/smoke_test_hover_completion.py
```

This opens a tiny in-memory `.instr` document, hovers over a component
name, and requests completions inside its parameter list, asserting on the
shape of both responses.
