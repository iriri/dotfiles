import { isAbsolute, resolve } from "node:path"
import { formatDiagnostics, isErrorOrWarning } from "./format.ts"
import { isRecord, type PluginContext, type ToolExecuteAfterCompleted, type ToolResult } from "./types.ts"
import type { LspDiagnostic } from "./client.ts"
import type { DiagnosticsSettings } from "./config.ts"
import type { LspManager } from "./manager.ts"

const MUTATING_TOOLS = new Set(["write", "edit", "patch", "apply_patch"])

/**
 * After a successful file mutation, push the new contents to any applicable
 * language server and append its errors and warnings to the tool result.
 */
export async function registerDiagnosticsHook(
  context: PluginContext,
  manager: LspManager,
  settings: DiagnosticsSettings,
): Promise<void> {
  if (!settings.enabled) return
  await context.tool.hook("execute.after", async (event) => {
    if (event.status !== "completed") return
    if (!MUTATING_TOOLS.has(event.tool)) return
    const files = affectedFiles(event, context.location.directory)
    if (files.length === 0) return

    const sections: string[] = []
    const metadataDiagnostics: Record<string, LspDiagnostic[]> = {}
    for (const file of files.slice(0, settings.maxFiles)) {
      const reported = await manager.collectDiagnostics(file, settings.timeoutMs)
      if (!reported) continue
      const diagnostics = reported.filter(isErrorOrWarning)
      if (diagnostics.length === 0) continue
      sections.push(formatDiagnostics(file, diagnostics, context.location.directory, settings.maxLines))
      const shown = diagnostics.map((diagnostic) => ({ ...diagnostic, severity: 1 }))
      for (const filePath of displayPaths(event, file, context.location.directory)) {
        metadataDiagnostics[filePath] = shown
      }
    }
    if (sections.length === 0) return
    const existingDiagnostics = event.result.metadata?.diagnostics
    event.result.metadata = {
      ...event.result.metadata,
      diagnostics: {
        ...(isRecord(existingDiagnostics) ? existingDiagnostics : {}),
        ...metadataDiagnostics,
      },
    }
    appendToContent(event.result, `\n\n${sections.join("\n\n")}`)
  })
}

function affectedFiles(event: ToolExecuteAfterCompleted, root: string): string[] {
  const files: string[] = []
  const add = (value: unknown) => {
    if (typeof value !== "string" || value.length === 0) return
    const path = value.replace(/^@/, "")
    const absolute = isAbsolute(path) ? path : resolve(root, path)
    if (!files.includes(absolute)) files.push(absolute)
  }

  const metadata = event.result?.metadata
  const changed = metadata && Array.isArray(metadata.files) ? metadata.files : []
  for (const item of changed) {
    if (!isRecord(item) || item.status === "deleted") continue
    add(item.file)
  }
  if (event.input && typeof event.input === "object" && "path" in event.input) {
    add((event.input as { path?: unknown }).path)
  }
  return files
}

function displayPaths(event: ToolExecuteAfterCompleted, file: string, root: string): string[] {
  const paths: string[] = []
  const add = (value: unknown) => {
    if (typeof value !== "string" || value.length === 0) return
    const path = value.replace(/^@/, "")
    const absolute = isAbsolute(path) ? resolve(path) : resolve(root, path)
    if (absolute !== file) return
    for (const filePath of [value, absolute]) if (!paths.includes(filePath)) paths.push(filePath)
  }

  if (isRecord(event.input)) add(event.input.path)
  const files = event.result.metadata?.files
  if (Array.isArray(files)) {
    for (const item of files) {
      if (!isRecord(item)) continue
      add(item.filePath)
      add(item.file)
    }
  }
  if (paths.length > 0) return paths
  return [file]
}

function appendToContent(result: ToolResult, text: string): void {
  if (typeof result.content === "string") {
    result.content += text
    return
  }
  if (Array.isArray(result.content)) {
    result.content = [...result.content, { type: "text", text }]
    return
  }
  if (typeof result.output === "string") {
    result.output += text
    return
  }
  result.content = text.trimStart()
}
