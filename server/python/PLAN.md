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

- `comp_maker.ipynb` writes `mcstas-comps.json` to the repository root. It
  then has to be copied by hand to `server/python/src/mcstas_ls/data/`.
  Make the generator write there directly, and skip components it cannot
  read instead of storing a string (see 1).
- `media/comp_parser.py` and `client/src/comp_dict.json` are not referenced
  anywhere. Delete them.

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

- vsce ignores `.gitignore`, so a local `server/python/build/` and
  `*.egg-info/` get packed into the `.vsix`. Add them to `.vscodeignore`,
  together with `server/python/tests/` and `server/python/scripts/`.
- `client/package.json` repeats the root devDependencies, with an outdated
  `@vscode/test-electron ^2.4.1` (the root has `^3.1.0`). Remove the
  duplicates unless something under `client/` needs them.
- The private-venv install (#17) is tested only from Node against the
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
