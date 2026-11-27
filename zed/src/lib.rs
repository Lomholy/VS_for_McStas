use zed_extension_api::{self as zed, settings::LspSettings, LanguageServerId, Result};

struct McStasExtension;

impl zed::Extension for McStasExtension {
    fn new() -> Self {
        McStasExtension
    }

    // Uses lsp.mcstas-language-server.binary.path from the settings, else the server on PATH.
    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let binary = LspSettings::for_worktree(language_server_id.as_ref(), worktree)
            .ok()
            .and_then(|settings| settings.binary);
        let command = binary
            .as_ref()
            .and_then(|binary| binary.path.clone())
            .or_else(|| worktree.which("mcstas-language-server"))
            .ok_or_else(|| {
                "mcstas-language-server not found on PATH: install it with pipx, or set \
                 lsp.mcstas-language-server.binary.path in Zed's settings"
                    .to_string()
            })?;
        Ok(zed::Command {
            command,
            args: binary.and_then(|binary| binary.arguments).unwrap_or_default(),
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(McStasExtension);
