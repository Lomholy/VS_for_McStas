
# VS-for-McStas README

VS-for-McStas is a VS Code extension for McStas `.instr` and `.comp` files. It
provides syntax highlighting, a language server (hover and completion), a
component browser and an auto formatter.

- **Syntax highlighting** is on as soon as the extension is installed.
- **Language server:** hover over a component type to see its parameters, and
  get completion for components, their parameters, DECLARE variables and
  instrument parameters. The server is written in Python and needs `python3`
  (3.9 or newer) on PATH. On first use the extension installs it into its own
  virtual environment, so your Python and conda environments are left alone.
  If `mcstas-language-server` is already on PATH (for example from pipx), that
  one is used instead.
- **Component browser:** press the neutron icon in the activity bar to see all
  McStas components by category. Clicking a component opens a form that writes
  its `COMPONENT` declaration or McStasScript code. The component data ships
  with the extension (currently from McCode v3.10.3), so no McStas installation
  is needed. "Open Component File" opens the component's `.comp` source and
  needs McStas installed through conda.
- **Formatter:** format a file with Shift+Alt+F (Windows), Shift+Option+F
  (macOS) or Ctrl+Shift+I (Linux). It formats the C code in `%{ %}` blocks the
  same way as McCode's `mccode-clangformat`, with McCode's `.clang-format`
  style, and lays out component parameters. It needs `clang-format` on PATH or
  set in `mcstas.formatter.clangFormatPath`. Formatting is not run on save.
- **Run, display and plot:** the buttons in the component browser's title bar
  run `mcrun`, `mcdisplay` and `mcplot` in a terminal, so McStas must be
  available in that terminal.

In general, if you have any problems, desires for improvements etc. add an issue or your own fix on [the Github Repository](https://github.com/Lomholy/VS_for_McStas)!

## Using the language server in Neovim

The language server (hover and autocompletion) is a standalone Python package
in `server/python`, so it also works in Neovim without the VS Code extension.
It needs Python 3.9 or newer and Neovim 0.11 or newer.

Install it with [pipx](https://pipx.pypa.io), which gives the server its own
virtual environment and puts `mcstas-language-server` in `~/.local/bin`:

```bash
pipx install "git+https://github.com/Lomholy/VS_for_McStas#subdirectory=server/python"
pipx ensurepath
```

Update it later with `pipx reinstall mcstas-language-server`, which installs
the latest commit. `pipx upgrade` does not, because the package version does
not change between commits. Because the server
lives in its own environment, it does not matter which Python or conda
environment is active when Neovim starts.

This repository is also a Neovim plugin that detects `.instr` and `.comp` files
as filetype `mccode` and highlights them with the McStas Vim syntax file
(`syntax/mccode.vim`, from McCode's `support/common/editors/mccode.vim`).
Install it with [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{ "Lomholy/VS_for_McStas" },
```

or without a plugin manager:

```bash
git clone https://github.com/Lomholy/VS_for_McStas.git ~/.local/share/nvim/site/pack/mcstas/start/VS_for_McStas
```

Then add this to your `init.lua` to start the language server:

```lua
vim.lsp.config('mcstas', {
  cmd = { 'mcstas-language-server' },
  filetypes = { 'mccode' },
  root_markers = { '.git' },
})
vim.lsp.enable('mcstas')
```

If Neovim is started from a GUI that does not see `~/.local/bin` on PATH, use
the absolute path instead:
`cmd = { vim.fn.expand('~/.local/bin/mcstas-language-server') }`.

Open a `.instr` or `.comp` file and run `:checkhealth vim.lsp` to confirm that
`mcstas` is attached. `K` shows the documentation of the
component under the cursor and `<C-x><C-o>` completes component names and
parameters.


## Known Issues

## Release Notes

## 2.6.0
Minor
- The language server is rewritten in Python (pygls). The extension installs
  it into its own virtual environment on first use, which needs `python3` 3.9
  or newer on PATH. It also works in Neovim, see above.
- Component data comes from McCode v3.10.3: 415 components, including the
  `sasmodels` and new `contrib` components. It is regenerated from each McCode
  release by a script, without a McStas installation.
- Hover works on `SPLIT`, `REMOVABLE` and `CPU` component lines, and shows a
  message for components without data.
- Completion is quieter: no list on every space or after `(` outside a
  component, case-insensitive matching, and component snippets no longer
  insert a second `COMPONENT` after a typed `COMPONENT` or `COMPONENT name =`.
- The formatter matches McCode's `mccode-clangformat`: macro continuation lines
  no longer drift right on every format, `%{ %}` blocks in `.instr` files are
  formatted too, and the `.clang-format` style is kept in sync with McCode.
  clang-format is only looked up when you format.
- `mcrun` and `mcdisplay` save the file first and run in its folder, so
  instruments in subfolders and paths with spaces work.
- The component form marks required parameters, and webviews escape their
  content and use a Content-Security-Policy.
- Removed commands and settings that did nothing, and the extension only
  activates for McStas files and its own views and commands.
- Added an extension icon and integration tests that run in CI.

## 2.5.0
Minor
Add formatter of instrument files

## 2.4.1
Patch
Change formatter to clang-format with McStas' agreed upon .clang-format file.

## 2.4.0
Minor
Switch to using Microsoft formatter in VS code instead of homemade formatter.


## 2.3.3
Patch
Update autoformatter to double indent in parentheses, and not indent in trace share etc.

Also fix bug in oneliners with comments


## 2.3.2
Patch
Fix single liner error when the if statement/for loop is completely included in one line.

## 2.3.1
Patch
Fix extra indents happening on multiple auto formatting

## 2.3.0
Minor
Addition of a simple auto formatter, to handle indentation for the mcstas instruments and components.


## 2.2.3
Patch
Make ComponentProvider sort alphabetically.
Fix language server crash when opening files typed with non-standard UTF encodings.

### 2.2.2
Patch
Make ComponentProvider work again, now using the mcstas-comps JSON.
If a conda environment is found, open the corresponding component file.

### 2.2.1
Patch
Add failsafe to hover content reading to prevent server crashes.

## 2.2.0
Minor
Publish correctly...

## 2.1.0
Minor
Remove flask dependency by switching to a dict-based mcstas component lookup.
Add hover support to the language server.

## 2.0.2
Patch
Move cursor to end of component name after insertion.
Fix error in declare-section regex.

### 2.0.1
Patch
Fix server crash when multiple VS Code instances are open.

## 2.0.0
Major
Add language server with autocompletion support.
From this version onward, the extension requires a conda environment containing both flask and mcstas.

## 1.2.2
Patch
Update README to reflect newest changes.

### 1.2.1
Patch
Fix comp_parser incorrectly located in src instead of media.

## 1.2.0
Minor
Switch component reader to use mcstasscript.
From now on a conda environment named mcstas is required.

## 1.0.0
Major
Initial release of VS-for-McStas.
