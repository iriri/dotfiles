// OpenCode v2 plugin entrypoint.
//
// The plugin deliberately exports a plain `{ id, setup }` object instead of
// importing `Plugin` from `@opencode/plugin`. The loader decodes that exact
// shape (see packages/core/src/plugin/module.ts), and avoiding the bare
// specifier keeps a locally-loaded directory plugin independent of how
// OpenCode resolves its own package at runtime.
export { default } from "./src/plugin.ts"
