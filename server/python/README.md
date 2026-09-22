# mcstas-language-server (Python, scaffold)

A `pygls`-based skeleton for a Python rewrite of the TypeScript language
server in `../` (`server/src`). See [`PLAN.md`](./PLAN.md) for the full
rewrite plan and rationale.

## Status

This is a **scaffold only** — not yet wired into the VS Code extension and
not feature-complete:

- [x] Project layout, packaging (`pyproject.toml`), pygls server instance
- [x] `parse_helpers.py` ported from `parse_helpers.ts`, with tests
- [x] `mcstas-comps.json` data file copied over
- [ ] `hover.py` — port of `hover.ts`
- [ ] `completion.py` — port of `completion.ts`
- [ ] `extension.ts` client wiring to launch this server instead of/alongside
      the Node one

## Setup

```bash
cd server/python
python3 -m venv .venv
source .venv/bin/activate
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
