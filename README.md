
# VS-for-McStas README

VS-for-McStas is a VS Code extension that serves as both a syntax highlighter,
component snippet writer, language server and auto formatter for .instr and .comp files.

The syntax highlighting and language server are on by default when the extension is installed.
 
The component snippet writer can be accessed by pressing the little neutron to the left, whereafter all the components available are listed within a folder like structure of the components.

The auto formatter is not enabled on save, but instruments and components can be auto formatted by pressing Shift + Alt + F or Shift + Option + F on Windows/Linux and MacOS respectively.

The component snippet writer is only available if you have an installation of
mcstas available through conda. If you do have mcstas available through conda
and it does not show up, please submit an issue on the [Githup Repository](https://github.com/Lomholy/VS_for_McStas).

In general, if you have any problems, desires for improvements etc. add an issue or your own fix on [the Github Repository](https://github.com/Lomholy/VS_for_McStas)!

## Using the language server in Neovim

The language server (hover and autocompletion) is a standalone Python package
in `server/python`, so it also works in Neovim without the VS Code extension.
It needs Python 3.9 or newer and Neovim 0.10 or newer.

Install it from a clone of this repository:

```bash
git clone https://github.com/Lomholy/VS_for_McStas.git
cd VS_for_McStas
python3 -m pip install --user --upgrade pip
python3 -m pip install --user -e server/python
```

The editable install (`-e`) needs pip 21.3 or newer, which is why pip is
upgraded first. It makes the server follow the clone, so a `git pull` is
enough to update it.

Check that the interpreter can find the server:

```bash
python3 -c "import mcstas_ls; print(mcstas_ls.__file__)"
```

Then add this to your `init.lua`:

```lua
vim.filetype.add({
  extension = {
    instr = 'mccode',
    comp = 'mccode',
  },
})

vim.api.nvim_create_autocmd('FileType', {
  pattern = 'mccode',
  callback = function(args)
    vim.lsp.start({
      name = 'mcstas_language_server',
      cmd = { 'python3', '-m', 'mcstas_ls.server' },
      root_dir = vim.fs.dirname(vim.api.nvim_buf_get_name(args.buf)),
    })
  end,
})
```

`cmd` must use the same interpreter the package was installed with. If
`python3` points somewhere else inside Neovim (for example with an activated
conda environment), replace it with the absolute path printed by
`python3 -c "import sys; print(sys.executable)"` in the shell you installed
from.

Open a `.instr` or `.comp` file and run `:checkhealth vim.lsp` to confirm that
`mcstas_language_server` is attached. `K` shows the documentation of the
component under the cursor and `<C-x><C-o>` completes component names and
parameters.

Syntax highlighting is not part of the language server, so Neovim only
highlights these files if you have a `mccode` syntax file installed.


## Known Issues

## Release Notes

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
