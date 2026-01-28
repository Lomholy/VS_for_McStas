# vs-for-mcstas README

VS-for-McStas is a vs code extension that serves as both a syntax highlighter,
 component snippet writer, and language server.

The component snippet writer is only available if you have an installation of 
 mcstas available through conda. If you do have a mcstas available through conda,
 and it does not show up, please submit an issue on the github repository.



## Known Issues


## Release Notes


### 1.0.0

Initial release of VS-for-McStas

### 1.2.0

Switch component reader to use mcstasscript.
At the same time it is now mandatory to have a mcstas conda environment
called 'mcstas'.

### 1.2.1

Fix comp_parser lying in src instead of media

### 1.2.2

Update readme to include the most recent developments.


### 2.0.0

Addition of language server, that allows for autocompletion in text.
From now on the extension relies on the user having a conda environment with 
flask and mcstas installed.

### 2.0.1 

Fix of server break on multiple instances of vs code active

### 2.0.2

Move cursor to end at component name when component is inserted.
Also fix error in declare section regex.

### 2.1.0

Remove flask dependency by using a dict for the mcstas component lookup.
Also add in hover support to the language server.


### 2.2.0

Publish correctly...


### 2.2.1 

Add failsafe to content read for hover that would crash the server.

### 2.2.2

Make ComponentProvider work again, this time using the mcstas-comps json,
and if the conda environment can be found, use that to open the component file.


### 2.2.3

Make ComponentProvider sort alphabetically.
Fix language server crash when opening files typed with non standard utf encodings.