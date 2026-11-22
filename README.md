
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
  McStas components by category. Clicking a component opens a form for its
  parameters, which generates the `COMPONENT` declaration or McStasScript code
  for you to copy into your instrument. The component data ships with the
  extension (currently from McCode v3.10.3), so no McStas installation is
  needed. Only "Open Component File", which opens the component's `.comp`
  source, needs McStas installed through conda.
- **Formatter:** format a file with Shift+Alt+F (Windows), Shift+Option+F
  (macOS) or Ctrl+Shift+I (Linux). It formats the C code in `%{ %}` blocks the
  same way as McCode's `mccode-clangformat`, with McCode's `.clang-format`
  style, and lays out component parameters. clang-format is installed together
  with the language server; set `mcstas.formatter.clangFormatPath` to use a
  different one. Formatting is not run on save.
- **Run, display and plot:** the buttons in the component browser's title bar
  run `mcrun`, `mcdisplay` and `mcplot` in a terminal, so McStas must be
  available in that terminal.

In general, if you have any problems, desires for improvements etc. add an issue or your own fix on [the Github Repository](https://github.com/Lomholy/VS_for_McStas)!

## Other editors

The language server also works outside VS Code. See [installation.md](installation.md)
for Neovim, Emacs, Helix, Sublime Text and JetBrains IDEs.
