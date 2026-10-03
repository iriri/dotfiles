import { isAbsolute, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { LspError, type LspClient } from "./client.ts"
import { formatHover, formatLocations, formatWorkspaceEdit } from "./format.ts"
import { applyWorkspaceEdit } from "./workspace-edit.ts"
import type { LspManager } from "./manager.ts"
import type { PluginContext, ToolInfo, ToolResult } from "./types.ts"

// Errors a server returns while it is still loading or has cancelled a request
// because the document changed. Retrying lets cold servers answer instead of
// surfacing a transient failure to the model.
const TRANSIENT_CODES = new Set([-32800, -32801, -32802])

// Upper bound on the one-time wait for a cold server to finish indexing before
// the first navigation request.
const WARMUP_TIMEOUT_MS = 6_000

interface PositionInput {
  path: string
  line: number
  character: number
}

const PATH_PROPERTY = {
  type: "string",
  description: "File path, relative to the project root or absolute.",
} as const

const LINE_PROPERTY = {
  type: "integer",
  minimum: 1,
  description: "1-indexed line number.",
} as const

const CHARACTER_PROPERTY = {
  type: "integer",
  minimum: 1,
  description: "1-indexed character (column) number.",
} as const

export async function registerTools(context: PluginContext, manager: LspManager): Promise<void> {
  await context.tool.transform((editor) => {
    editor.add(hoverTool(context, manager))
    editor.add(definitionTool(context, manager))
    editor.add(referencesTool(context, manager))
    editor.add(renameTool(context, manager))
  })
}

function hoverTool(context: PluginContext, manager: LspManager): ToolInfo {
  return {
    name: "lsp_hover",
    description:
      "Get type information and documentation for a symbol using the language server. Provide a 1-indexed line and character in the file.",
    input: {
      type: "object",
      properties: { path: PATH_PROPERTY, line: LINE_PROPERTY, character: CHARACTER_PROPERTY },
      required: ["path", "line", "character"],
      additionalProperties: false,
    },
    options: { codemode: false },
    async execute(input: PositionInput): Promise<ToolResult> {
      const outcome = await requestPosition(context, manager, input, "textDocument/hover")
      if ("error" in outcome) return { content: outcome.error }
      const text = formatHover(outcome.result)
      return { content: text, metadata: { lsp: "hover", file: input.path } }
    },
  }
}

function definitionTool(context: PluginContext, manager: LspManager): ToolInfo {
  return {
    name: "lsp_definition",
    description:
      "Find the definition of a symbol using the language server. Provide a 1-indexed line and character in the file.",
    input: {
      type: "object",
      properties: { path: PATH_PROPERTY, line: LINE_PROPERTY, character: CHARACTER_PROPERTY },
      required: ["path", "line", "character"],
      additionalProperties: false,
    },
    options: { codemode: false },
    async execute(input: PositionInput): Promise<ToolResult> {
      const outcome = await requestPosition(context, manager, input, "textDocument/definition")
      if ("error" in outcome) return { content: outcome.error }
      const locations = formatLocations(outcome.result, context.location.directory)
      if (locations.length === 0)
        return { content: `No definition found for ${input.path}:${input.line}:${input.character}.` }
      const header = locations.length === 1 ? "Definition:" : `Definitions (${locations.length}):`
      return { content: `${header}\n${locations.map((location) => `  ${location}`).join("\n")}` }
    },
  }
}

function referencesTool(context: PluginContext, manager: LspManager): ToolInfo {
  return {
    name: "lsp_references",
    description:
      "Find all references to a symbol using the language server. Provide a 1-indexed line and character in the file.",
    input: {
      type: "object",
      properties: {
        path: PATH_PROPERTY,
        line: LINE_PROPERTY,
        character: CHARACTER_PROPERTY,
        includeDeclaration: {
          type: "boolean",
          description: "Include the declaration itself. Defaults to true.",
        },
      },
      required: ["path", "line", "character"],
      additionalProperties: false,
    },
    options: { codemode: false },
    async execute(input: PositionInput & { includeDeclaration?: boolean }): Promise<ToolResult> {
      const outcome = await requestPosition(context, manager, input, "textDocument/references", {
        context: { includeDeclaration: input.includeDeclaration ?? true },
      })
      if ("error" in outcome) return { content: outcome.error }
      const locations = formatLocations(outcome.result, context.location.directory)
      if (locations.length === 0)
        return { content: `No references found for ${input.path}:${input.line}:${input.character}.` }
      return {
        content: `${locations.length} reference${locations.length === 1 ? "" : "s"} found:\n${locations
          .map((location) => `  ${location}`)
          .join("\n")}`,
      }
    },
  }
}

function renameTool(context: PluginContext, manager: LspManager): ToolInfo {
  return {
    name: "lsp_rename",
    description:
      "Preview a rename refactoring using the language server. Set apply to true to apply its text edits directly; by default this only previews them.",
    input: {
      type: "object",
      properties: {
        path: PATH_PROPERTY,
        line: LINE_PROPERTY,
        character: CHARACTER_PROPERTY,
        newName: { type: "string", description: "The new symbol name." },
        apply: { type: "boolean", description: "Apply the rename edits. Defaults to false (preview only)." },
      },
      required: ["path", "line", "character", "newName"],
      additionalProperties: false,
    },
    options: { codemode: false },
    async execute(input: PositionInput & { newName: string; apply?: boolean }): Promise<ToolResult> {
      const outcome = await requestPosition(context, manager, input, "textDocument/rename", { newName: input.newName })
      if ("error" in outcome) return { content: outcome.error }
      if (!outcome.result)
        return { content: `The language server returned no edits for renaming to "${input.newName}".` }
      const preview = formatWorkspaceEdit(outcome.result, context.location.directory)
      if (preview.edits === 0)
        return { content: `The language server returned no edits for renaming to "${input.newName}".` }
      if (input.apply) {
        try {
          const applied = await applyWorkspaceEdit(outcome.result, context.location.directory)
          const synced = await Promise.all(
            applied.paths.map(async (path) => {
              try {
                await manager.withClient(path, async () => {
                  await manager.syncFile(path)
                })
                return true
              } catch {
                return false
              }
            }),
          )
          const warning = synced.includes(false)
            ? "\n\nWarning: some edited files could not be synced to their language server."
            : ""
          return {
            content: `Applied rename to "${input.newName}": ${applied.edits} edit${applied.edits === 1 ? "" : "s"} across ${applied.files} file${
              applied.files === 1 ? "" : "s"
            }.\n\n${preview.text}${warning}`,
          }
        } catch (error) {
          return { content: `Failed to apply rename edits: ${error instanceof Error ? error.message : String(error)}` }
        }
      }
      return {
        content: `Rename to "${input.newName}": ${preview.edits} edit${preview.edits === 1 ? "" : "s"} across ${preview.files} file${
          preview.files === 1 ? "" : "s"
        }.\n\n${preview.text}\n\nThese changes were not applied. Set apply to true to apply them.`,
      }
    },
  }
}

type Outcome = { result: any } | { error: string }

async function requestPosition(
  context: PluginContext,
  manager: LspManager,
  input: PositionInput,
  method: string,
  extra: Record<string, unknown> = {},
): Promise<Outcome> {
  const file = resolveFile(context.location.directory, input.path)
  const server = manager.serverForFile(file)
  if (!server) return { error: `No LSP server is configured for ${input.path}.` }
  try {
    const response = await manager.withClient(file, async (client) => {
      await manager.syncFile(file)
      await manager.warmUp(file, WARMUP_TIMEOUT_MS)
      return {
        result: await requestWithRetry(client, method, {
          textDocument: { uri: pathToFileURL(file).href },
          position: { line: input.line - 1, character: input.character - 1 },
          ...extra,
        }),
      }
    })
    if (!response) return { error: `No LSP server is configured for ${input.path}.` }
    return { result: response.result }
  } catch (error) {
    return { error: `LSP request failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

async function requestWithRetry(client: LspClient, method: string, params: unknown, attempts = 6): Promise<any> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await client.request(method, params)
    } catch (error) {
      lastError = error
      if (!(error instanceof LspError) || error.code === undefined || !TRANSIENT_CODES.has(error.code)) throw error
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  throw lastError
}

function resolveFile(root: string, value: string): string {
  const path = value.replace(/^@/, "")
  return isAbsolute(path) ? path : resolve(root, path)
}
