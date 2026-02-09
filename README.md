
# VS-for-McStas README

VS-for-McStas is a VS Code extension that serves as both a syntax highlighter,
component snippet writer, language server and auto formatter for .instr and .comp files.
 
The component snippet writer is only available if you have an installation of
mcstas available through conda. If you do have mcstas available through conda
and it does not show up, please submit an issue on the [Githup Repository](https://github.com/Lomholy/VS_for_McStas).

In general, if you have any problems, desires for improvements etc. add an issue or your own fix on [the Github Repository](https://github.com/Lomholy/VS_for_McStas)!


## Known Issues

## Release Notes

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
