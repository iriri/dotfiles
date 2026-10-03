/**
 * Minimal structural types for the slice of the OpenCode v2 plugin API this
 * plugin uses. They mirror `@opencode/plugin` (promise flavor) but are declared
 * locally so the plugin has no runtime or type dependency on the OpenCode
 * checkout. Keep these in sync with packages/plugin/src/promise/{plugin,tool,rpc}.ts.
 */
import type { LspRpc, LspRpcRegistration, LspStatusPayload } from "./rpc.ts"

/** Narrow an `unknown` value to a non-null, non-array object record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export interface TextContent {
  readonly type: "text"
  readonly text: string
}

export interface FileContent {
  readonly type: "file"
  readonly uri: string
  readonly mime: string
  readonly name?: string
}

export type Content = TextContent | FileContent

export interface ToolResult {
  output?: unknown
  content?: string | Content[]
  metadata?: Record<string, unknown>
}

export interface ToolContext {
  readonly signal: AbortSignal
  readonly progress: (update: Record<string, unknown>) => Promise<void>
  readonly sessionID: string
  readonly agent: string
  readonly messageID: string
  readonly id: string
}

export interface ToolOptions {
  readonly namespace?: string
  readonly permission?: string
  readonly codemode?: boolean
  readonly pinned?: boolean
}

export interface ToolInfo {
  readonly name: string
  readonly description: string
  readonly input: unknown
  readonly output?: unknown
  readonly options?: ToolOptions
  readonly execute: (input: any, context: ToolContext) => Promise<ToolResult>
}

export interface ToolEditor {
  add(tool: ToolInfo): void
  get(id: string): (ToolInfo & { readonly id: string }) | undefined
  list(): readonly (ToolInfo & { readonly id: string })[]
  namespace(namespace: { readonly name: string; readonly description: string }): void
  remove(id: string): void
  update(id: string, update: (tool: ToolInfo) => void): void
}

export interface Registration {
  dispose(): Promise<void>
}

export interface ToolExecuteAfterBase {
  readonly tool: string
  readonly sessionID: string
  readonly agent: string
  readonly messageID: string
  readonly id: string
  readonly input: unknown
}

export interface ToolExecuteAfterCompleted extends ToolExecuteAfterBase {
  readonly status: "completed"
  result: ToolResult
}

export interface ToolExecuteAfterError extends ToolExecuteAfterBase {
  readonly status: "error"
  error: unknown
}

export type ToolExecuteAfter = ToolExecuteAfterCompleted | ToolExecuteAfterError

export interface PluginContext {
  readonly location: { readonly directory: string }
  readonly options: Record<string, unknown>
  readonly rpc: {
    register(
      definition: typeof LspRpc,
      handlers: { getStatus: (input: unknown) => Promise<LspStatusPayload> },
    ): Promise<LspRpcRegistration>
  }
  readonly tool: {
    transform(callback: (editor: ToolEditor) => void): Promise<Registration>
    hook(name: "execute.after", callback: (event: ToolExecuteAfter) => Promise<void> | void): Promise<Registration>
  }
}

export interface Plugin {
  readonly id: string
  readonly setup: (
    context: PluginContext,
  ) => Promise<(() => Promise<void> | void) | void> | (() => Promise<void> | void) | void
}
