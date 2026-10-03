# opencode-lsp-plugin

100% vibecoded slop because OpenCode v2 accepts, then silently ignores, a v1
`lsp` property in your config. I didn't write (or read) any of the code, or
even the rest of this file.

## Supported properties (identical to v1):

| Property         | Type       | Description                                                                                                              |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `command`        | `string[]` | Command and arguments used to start the server. Required.                                                                |
| `extensions`     | `string[]` | File extensions this server handles. Optional for known server IDs (e.g. `rust`, `typescript`), required for custom IDs. |
| `env`            | `object`   | Environment variables set when starting the server.                                                                      |
| `initialization` | `object`   | Sent as `initializationOptions` and returned for `workspace/configuration` requests.                                     |
| `disabled`       | `boolean`  | Disable this server.                                                                                                     |

`"lsp": false` disables everything. A known server ID such as `rust` or
`typescript` infers its extensions; custom IDs must declare `extensions`.

## Tools

All positions are **1-indexed** (line 1, character 1 is the first character).

| Tool             | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `lsp_hover`      | Type information and documentation at a position.          |
| `lsp_definition` | Definition location(s) for a symbol at a position.         |
| `lsp_references` | All references to a symbol at a position.                  |
| `lsp_rename`     | Preview rename edits, or pass `apply: true` to apply them. |

Requests that fail while a server is still loading (for example LSP
`ContentModified`) are retried a few times before the error is returned.

`lsp_rename` is preview-only by default. Pass `apply: true` to apply text edits
to files within the project; workspace resource operations (such as file
renames) are rejected rather than applied.

## Diagnostics behavior

- Servers start lazily the first time a file of their language is edited or an
  `lsp_*` tool is used. They stay alive during active work, then stop after
  `idleTimeoutMs` of inactivity (one minute by default); the next use starts
  them again. OpenCode plugins run in the server process, so a CLI client
  disconnect does not itself unload the plugin.
- After an edit the plugin syncs the new contents and sends `didSave`, so
  servers that run external checks on save (such as rust-analyzer's flycheck)
  refresh their results instead of leaving stale ones.
- It then waits for the server to settle: the wait ends once at least one
  diagnostic set has arrived and the server has been quiet briefly. This keeps
  a server's early empty result during indexing from being reported as clean.
- Only `error` and `warning` diagnostics are surfaced, capped by `maxLines`.
- The Write/Edit UI receives structured diagnostics in tool metadata. Warnings
  are assigned error severity for the built-in renderer; Patch diagnostics
  remain in the tool result text but are not yet drawn inside its diff view.
- The wait is bounded by `timeoutMs`. If nothing is published in that window,
  the last cached result for the file is used when one exists; otherwise no
  diagnostics are appended.
- The first `lsp_*` call on a cold server waits once for the initial analysis
  to settle (up to 6s) before sending its request.

### Plugin options

| Option             | Default                                                         | Description                                                                                    |
| ------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `lsp`              | —                                                               | Inline `lsp` config that overrides files on disk.                                              |
| `diagnostics`      | `{ enabled: true, timeoutMs: 5000, maxLines: 20, maxFiles: 5 }` | Set to `false` to disable post-edit diagnostics, or override individual fields.                |
| `requestTimeoutMs` | `15000`                                                         | Timeout for LSP requests issued by the tools.                                                  |
| `idleTimeoutMs`    | `60000`                                                         | Stop an idle language server after this many milliseconds. It is restarted lazily when needed. |
| `debug`            | `false`                                                         | Log server startup, stderr, config warnings, and transport/parse errors.                       |

## Notes

- The server entry exports a plain `{ id, setup }` object without a runtime
  dependency on `@opencode/plugin`. The optional TUI entry uses OpenCode's
  runtime-resolved `@opencode/plugin/tui` API and its declared UI peers; no
  build step is needed.
- The client uses full-document text sync and advertises `utf-16` position
  encoding (the LSP default).
