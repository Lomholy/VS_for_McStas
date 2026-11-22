# Installation

VS_for_McStas is a VS Code extension, but its language server (hover and
completion for McStas `.instr` and `.comp` files) is a standalone Python
package, so it works in any editor that speaks the Language Server Protocol.

| Editor | Language server | Syntax highlighting |
|---|---|---|
| [VS Code](#vs-code) | yes, installed by the extension | yes |
| [VSCodium](#vscodium) | yes, installed by the extension | yes |
| [Neovim](#neovim) | yes | yes, McStas Vim syntax |
| [Emacs](#emacs) | yes, with eglot | C highlighting |
| [Helix](#helix) | yes | C highlighting |
| [Sublime Text](#sublime-text) | yes, with the LSP package | C highlighting |
| [JetBrains IDEs](#jetbrains-ides) | yes, with the LSP4IJ plugin | yes, from the extension's TextMate grammar |
| [Xcode](#xcode) | no | no |

The component browser, the formatter and the run/display/plot buttons are part
of the VS Code extension only, which also runs in VSCodium.

## The language server

Every editor except VS Code and VSCodium needs the server installed once. It needs
Python 3.9 or newer. Install it with [pipx](https://pipx.pypa.io) ([installing
pipx](#installing-pipx)), which gives the server its own virtual environment and
puts `mcstas-language-server` in `~/.local/bin`:

```bash
pipx install "git+https://github.com/Lomholy/VS_for_McStas#subdirectory=server/python"
pipx ensurepath
```

Update it later with `pipx reinstall mcstas-language-server`, which installs
the latest commit. `pipx upgrade` does not, because the package version does
not change between commits. Because the server lives in its own environment, it
does not matter which Python or conda environment is active when your editor
starts.

What every editor needs to know about the server:

- command: `mcstas-language-server`, talking LSP over stdin/stdout
- files: `*.instr` and `*.comp`
- language id: `mccode`

If your editor is started from a GUI that does not see `~/.local/bin` on PATH,
use the full path, e.g. `/Users/you/.local/bin/mcstas-language-server` or
`/home/you/.local/bin/mcstas-language-server`.

### Installing pipx

If `pipx` gives `command not found`, install it once:

```bash
brew install pipx                          # macOS (Homebrew)
sudo apt install pipx                      # Debian/Ubuntu
conda install -n base -c conda-forge pipx  # conda (or mamba/micromamba)
python3 -m pip install --user pipx         # anywhere else with Python 3.9+
```

Then run `pipx ensurepath`, which adds `~/.local/bin` to your PATH, and open a
new terminal so the change takes effect. pipx installed with conda is only
found while that conda environment is active, but the language server it
installs into `~/.local/bin` works without it.

### Using a conda environment instead of pipx

The server can also live in a conda environment, either a new one or your
McStas environment:

```bash
conda create -n mcstas-ls -c conda-forge "python>=3.9" pip
conda run -n mcstas-ls pip install "git+https://github.com/Lomholy/VS_for_McStas#subdirectory=server/python"
```

`mamba` and `micromamba` take the same commands. The server is then
`<env>/bin/mcstas-language-server` (`<env>\Scripts\mcstas-language-server.exe`
on Windows); `conda env list` shows `<env>`, e.g.
`~/miniforge3/envs/mcstas-ls`. Since the environment is usually not active
when your editor starts, give the editor that full path as the command.
Update it with the same `pip install` command plus `--force-reinstall`.

## VS Code

Install **VS_for_McStas** from the Marketplace: search for it in the Extensions
view, or run `ext install lomholy.vs-for-mcstas` from the Quick Open bar
(Ctrl+P / Cmd+P). The extension installs the language server itself on first
use; it only needs `python3` (3.9 or newer) on PATH. See the
[README](README.md) for its features.

## VSCodium

VSCodium installs extensions from Open VSX, where VS_for_McStas is not
published, so install it from the `.vsix` file attached to each
[GitHub release](https://github.com/Lomholy/VS_for_McStas/releases):

1. Download `vs-for-mcstas-<version>.vsix` from the latest release.
2. In VSCodium, open the Extensions view, click `...` at the top and choose
   **Install from VSIX...**, then pick the file. Or in a terminal:

   ```bash
   codium --install-extension vs-for-mcstas-2.6.0.vsix
   ```

Everything then works as in VS Code: the extension installs the language
server on first use and only needs `python3` (3.9 or newer) on PATH. VSCodium
does not update `.vsix` installs, so install the new file from the releases
page when a new version comes out.

## Neovim

Needs Neovim 0.11 or newer and [pipx](#installing-pipx), or a [conda environment](#using-a-conda-environment-instead-of-pipx).

This repository is also a Neovim plugin that detects `.instr` and `.comp` files
as filetype `mccode` and highlights them with the McStas Vim syntax file
(`syntax/mccode.vim`, from McCode's `support/common/editors/mccode.vim`).
Install it with [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{ "Lomholy/VS_for_McStas", build = "pipx install --force server/python" },
```

The plugin itself does not include the language server, which is a Python
package. The `build` line lets lazy.nvim install it with pipx from the plugin's
`server/python` folder, and reinstall it whenever the plugin updates, so the
server never gets out of date. Without it, install the server yourself as
described in [the language server](#the-language-server).

With a [conda environment](#using-a-conda-environment-instead-of-pipx) instead
of pipx, let the build install into that environment, and point `cmd` (below)
at it:

```lua
{ "Lomholy/VS_for_McStas", build = "conda run -n mcstas-ls pip install --force-reinstall ./server/python" },
```

```lua
cmd = { vim.fn.expand('~/miniforge3/envs/mcstas-ls/bin/mcstas-language-server') },
```

Without a plugin manager, clone the plugin and install the server:

```bash
git clone https://github.com/Lomholy/VS_for_McStas.git ~/.local/share/nvim/site/pack/mcstas/start/VS_for_McStas
pipx install --force ~/.local/share/nvim/site/pack/mcstas/start/VS_for_McStas/server/python
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

Open a `.instr` or `.comp` file and run `:checkhealth vim.lsp` to confirm that
`mcstas` is attached. `K` shows the documentation of the component under the
cursor and `<C-x><C-o>` completes component names and parameters.

### "'mcstas-language-server' is not executable"

`:checkhealth vim.lsp` shows this when Neovim cannot find the server on its
PATH. Check with `:echo exepath('mcstas-language-server')`, which is empty in
that case:

- **Not installed:** add the `build` line above and run `:Lazy build VS_for_McStas`,
  or install the server with pipx. Cloning the plugin alone does not install it.
- **Installed, but not on Neovim's PATH:** run `pipx ensurepath` and start
  Neovim from a new terminal. If Neovim is started from a GUI that does not
  see `~/.local/bin`, use the full path:
  `cmd = { vim.fn.expand('~/.local/bin/mcstas-language-server') }`.

### "command not found: pipx" during the lazy.nvim build

The `build` line needs pipx. [Install pipx](#installing-pipx), run
`pipx ensurepath`, start Neovim from a new terminal and run
`:Lazy build VS_for_McStas`. Or switch to the conda `build` line above, which
needs no pipx.

## Emacs

Needs Emacs 29 or newer, which includes the LSP client eglot, and
[the language server](#the-language-server). Add this to your `init.el`:

```elisp
(define-derived-mode mccode-mode c-mode "McCode"
  "Major mode for McStas/McXtrace instrument and component files.")
(add-to-list 'auto-mode-alist '("\\.\\(instr\\|comp\\)\\'" . mccode-mode))

(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs '(mccode-mode "mcstas-language-server")))
(add-hook 'mccode-mode-hook #'eglot-ensure)
```

`mccode-mode` is `c-mode` with its own name, so files get C highlighting and
eglot starts the McStas server for them. Hover shows in the echo area and with
`M-x eldoc`, and completion works with `completion-at-point` (`C-M-i`) or a
completion UI such as corfu or company.

## Helix

Needs [the language server](#the-language-server). Add this to
`~/.config/helix/languages.toml`:

```toml
[language-server.mcstas]
command = "mcstas-language-server"

[[language]]
name = "mccode"
scope = "source.mccode"
file-types = ["instr", "comp"]
grammar = "c"
comment-token = "//"
block-comment-tokens = { start = "/*", end = "*/" }
language-servers = ["mcstas"]
```

`grammar = "c"` parses the files with Helix's C grammar. For C highlighting,
indentation and text objects, also let the `mccode` queries inherit the C ones:

```bash
mkdir -p ~/.config/helix/runtime/queries/mccode
for q in highlights indents textobjects; do echo "; inherits: c" > ~/.config/helix/runtime/queries/mccode/$q.scm; done
```

Check the setup with `hx --health mccode`: the language server and all queries
should have a check mark. In the editor, `space k` shows hover and completion
pops up while typing.

## Sublime Text

Needs Sublime Text 4, the [LSP](https://packagecontrol.io/packages/LSP)
package from Package Control, and [the language server](#the-language-server).

1. Give McStas files their own syntax, based on C. Save this as
   `McCode.sublime-syntax` in your `Packages/User` folder
   (Preferences > Browse Packages...):

   ```yaml
   %YAML 1.2
   ---
   name: McCode
   file_extensions: [instr, comp]
   scope: source.mccode
   version: 2
   extends: Packages/C++/C.sublime-syntax
   ```

2. Open Preferences > Package Settings > LSP > Server Configurations (or
   `Preferences: LSP Server Configurations` in the Command Palette) and add:

   ```json
   {
     "mcstas": {
       "enabled": true,
       "command": ["mcstas-language-server"],
       "selector": "source.mccode"
     }
   }
   ```

The `selector` must match the syntax's `scope`. Open a `.instr` file and check
that the status bar shows `mcstas`; hover with the mouse or the
`LSP: Show Hover` command.

## JetBrains IDEs

For IntelliJ IDEA, PyCharm, CLion and the other JetBrains IDEs. Needs the
[LSP4IJ](https://plugins.jetbrains.com/plugin/23257-lsp4ij) plugin and
[the language server](#the-language-server).

1. **Language server.** Open the language server settings of LSP4IJ and click
   `+` (New Language Server):
   - **Server** tab: name `McStas`, command `mcstas-language-server`. LSP4IJ
     starts the command without a shell, so use the full path if it is not
     found.
   - **Mappings** tab: under **File name pattern**, add `*.instr` and `*.comp`,
     each with **Language ID** `mccode`. Use file name patterns rather than a
     custom file type, which would lose the highlighting from step 2.
2. **Highlighting.** Clone this repository and add the clone as a TextMate
   bundle: Settings > Editor > TextMate Bundles, click `+` and choose the
   folder. JetBrains IDEs read VS Code extensions, so this uses the extension's
   McStas grammar.

   ```bash
   git clone https://github.com/Lomholy/VS_for_McStas.git
   ```

## Xcode

Not supported. Xcode has no way to add a language server or a syntax
definition for a new language, so it cannot use this server. On macOS, any of
the editors above can be used instead.
