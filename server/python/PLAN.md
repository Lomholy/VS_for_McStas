# Plan: Python language server

## Status

The migration from the TypeScript language server is done.

- `server/python` (pygls) is the only language server. The Node server was
  removed in 9e50775 ("Remove the dead Node language server").
- Hover, completion and the parsing helpers are ported, with pytest coverage
  run in CI on Python 3.9 and 3.12.
- VS Code: `client/src/detectPythonServer.ts` runs `mcstas-language-server`
  from PATH if present, else installs `server/python` into a private venv in
  the extension's global storage, rebuilt when the extension version changes
  (#17). A venv is not subject to PEP 668, so this works with Homebrew and
  Debian/Ubuntu Pythons.
- Neovim: the server is installed with pipx, and the repository doubles as a
  Neovim plugin with `syntax/mccode.vim` and `ftdetect/mccode.lua` (#18).

Dropped from the original plan:

- A Node/Python `implementation` setting and old-vs-new parity tests. There
  is no Node server left to compare against.
- Bundling a frozen PyInstaller binary. The private venv covers the same need
  without a per-platform build matrix.

## Open work

In priority order.

### 1. Hover crashes on components without data

`mcstas-comps.json` stores the string `"Component information is
unavailable"` for 4 components: `Rotator`, `SupermirrorFlat`,
`Monochromator_bent`, `Monochromator_bent_complex`. Hovering one of them
raises `TypeError: string indices must be integers` in
`build_component_hover_markdown`. Fix it once in `data.get_components()` by
dropping non-dict entries, so that hover and completion both skip them.

### 2. Component data pipeline

Done:

- `scripts/generate_comps.py <McCode>/mcstas-comps` replaces
  `comp_maker.ipynb` and writes `src/mcstas_ls/data/mcstas-comps.json`
  directly. It needs only mcstasscript and the `.comp` files, not a McStas
  install. Unreadable components are still stored as the string
  `"Component information is unavailable"`.
- `.github/workflows/update-comps.yml` runs it weekly (and on demand)
  against the latest McCode release tag (`v*`) and opens a PR when the data
  changes. The bundled JSON stays the only runtime source, so users need no
  McStas install and no network.
- The bundled data is regenerated from McCode v3.10.3 (415 components, none
  unreadable).
- `media/comp_parser.py` and `client/src/comp_dict.json` are deleted.

Left:

- The workflow needs "Allow GitHub Actions to create and approve pull
  requests" enabled in the repository settings.
- The data tracks the latest McCode release only. Possible follow-up: prefer
  a local McStas component library (`$MCSTAS/`) when one exists, so users on
  older McStas versions see their own components.
- `client/src/dialogue.js` (and `.js.map`) is stale compiled output checked
  into git; the extension loads `client/out/`. It can be deleted.

### 3. Completion behaviour

- The trigger characters include `" "`, so every space opens a list of about
  280 items, which is noisy in Neovim with blink.cmp. Keep only `"="` and
  `"("`.
- Component snippets always insert a full `COMPONENT $0 = Name(...)` block.
  Accepted after typing `COMPONENT s = Sou`, they produce
  `COMPONENT s = COMPONENT  = Source_simple(`. Insert only `Name(...)` when
  the line already has `COMPONENT <name> =`.

### 4. Hover misses prefixed component lines

`_COMPONENT_PATTERN` in `hover.py` requires the line to start with
`COMPONENT`, so `SPLIT 10 COMPONENT a = Arm()` and
`REMOVABLE COMPONENT a = Arm()` get no hover. Completion already handles
these lines.

### 5. Packaging

- Done: `.vscodeignore` now keeps local build leftovers (`build/`,
  `*.egg-info/`), server tests and scripts, `client/node_modules`,
  `client/src`, Vim files and other dev-only files out of the `.vsix`
  (3605 files / 10.5 MB down to 231 files / 0.46 MB). The bundled
  `server/python` still pip-installs from an unpacked `.vsix`.
- Done: `client/package.json` no longer repeats the root devDependencies;
  tsc, eslint and the `@types` packages resolve from the root
  `node_modules`.
- Left: the private-venv install (#17) is tested only from Node against the
  compiled `client/out`. Check it once in a real Extension Development Host
  on a machine without `mcstas-language-server` on PATH.

### 6. Function-pointer declarators

`extract_identifier_from_declarator("int (*fp)(int)")` returns `None`, not
`fp`, so DECLARE function pointers are missing from completion. This was kept
for parity with the TypeScript port and is pinned by a test in
`tests/test_parse_helpers.py`. Fix it, then update the test.

### 7. Stdio smoke tests in CI

`scripts/smoke_test_initialize.py` and `scripts/smoke_test_hover_completion.py`
check the server over real stdio but are run by hand. Add them as steps in
the CI pytest job.
