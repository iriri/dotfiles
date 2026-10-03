import { relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { isRecord } from "./types.ts"
import type { LspDiagnostic } from "./client.ts"

export function fileToUri(file: string): string {
  return pathToFileURL(file).href
}

export function uriToPath(uri: string): string | undefined {
  try {
    return fileURLToPath(uri)
  } catch {
    return undefined
  }
}

export function displayPath(uri: string, root: string): string {
  const file = uriToPath(uri)
  if (!file) return uri
  const rel = relative(root, file)
  return rel && !rel.startsWith("..") ? rel : file
}

export function severityName(severity: number | undefined): string {
  switch (severity) {
    case 1:
      return "error"
    case 2:
      return "warning"
    case 3:
      return "info"
    case 4:
      return "hint"
    default:
      return "diagnostic"
  }
}

export function isErrorOrWarning(diagnostic: LspDiagnostic): boolean {
  return diagnostic.severity === 1 || diagnostic.severity === 2
}

export function formatDiagnostics(file: string, diagnostics: LspDiagnostic[], root: string, maxLines: number): string {
  const path = relative(root, file) || file
  const sorted = [...diagnostics].sort((a, b) => (a.severity ?? 99) - (b.severity ?? 99))
  const shown = sorted.slice(0, maxLines).map((diagnostic) => {
    const line = (diagnostic.range?.start?.line ?? 0) + 1
    const column = (diagnostic.range?.start?.character ?? 0) + 1
    const code = diagnostic.code !== undefined ? ` (${diagnostic.code})` : ""
    const source = diagnostic.source ? ` [${diagnostic.source}]` : ""
    return `  ${path}:${line}:${column} ${severityName(diagnostic.severity)}: ${diagnostic.message}${code}${source}`
  })
  const extra = sorted.length > shown.length ? `\n  ...and ${sorted.length - shown.length} more` : ""
  return `LSP diagnostics:\n${shown.join("\n")}${extra}`
}

export function formatHover(result: unknown): string {
  const contents = isRecord(result) ? result.contents : undefined
  if (contents === undefined || contents === null) return "No hover information available."
  if (typeof contents === "string") return contents
  if (Array.isArray(contents)) return contents.map(markup).join("\n\n")
  return markup(contents)
}

function markup(value: unknown): string {
  if (typeof value === "string") return value
  if (isRecord(value) && typeof value.value === "string") {
    return typeof value.language === "string" ? `\`\`\`${value.language}\n${value.value}\n\`\`\`` : value.value
  }
  return JSON.stringify(value)
}

export function formatLocations(result: unknown, root: string): string[] {
  if (!result) return []
  const items: unknown[] = Array.isArray(result) ? result : [result]
  const locations: string[] = []
  for (const item of items) {
    if (!isRecord(item)) continue
    if (typeof item.targetUri === "string") {
      locations.push(formatUriRange(item.targetUri, item.targetSelectionRange ?? item.targetRange, root))
      continue
    }
    if (typeof item.uri === "string") locations.push(formatUriRange(item.uri, item.range, root))
  }
  return locations
}

function formatUriRange(uri: string, range: unknown, root: string): string {
  const { line, character } = startPosition(range)
  return `${displayPath(uri, root)}:${line}:${character}`
}

/** Resolve a range's start to 1-indexed line/character, defaulting to 1 when malformed. */
function startPosition(range: unknown): { line: number; character: number } {
  const start = isRecord(range) ? range.start : undefined
  const line = isRecord(start) && typeof start.line === "number" ? start.line : 0
  const character = isRecord(start) && typeof start.character === "number" ? start.character : 0
  return { line: line + 1, character: character + 1 }
}

export function formatWorkspaceEdit(edit: unknown, root: string): { text: string; edits: number; files: number } {
  const byFile = new Map<string, string[]>()
  const add = (uri: string, range: unknown, newText: unknown) => {
    const { line, character } = startPosition(range)
    const entries = byFile.get(uri) ?? []
    entries.push(`  ${line}:${character} -> ${JSON.stringify(newText)}`)
    byFile.set(uri, entries)
  }
  if (isRecord(edit) && Array.isArray(edit.documentChanges)) {
    for (const change of edit.documentChanges) {
      if (
        isRecord(change) &&
        isRecord(change.textDocument) &&
        typeof change.textDocument.uri === "string" &&
        Array.isArray(change.edits)
      ) {
        for (const item of change.edits) {
          if (isRecord(item)) add(change.textDocument.uri, item.range, item.newText)
        }
      }
    }
  }
  if (isRecord(edit) && isRecord(edit.changes)) {
    for (const [uri, list] of Object.entries(edit.changes)) {
      if (!Array.isArray(list)) continue
      for (const item of list) {
        if (isRecord(item)) add(uri, item.range, item.newText)
      }
    }
  }
  const edits = [...byFile.values()].reduce((total, entries) => total + entries.length, 0)
  const text = [...byFile.entries()]
    .map(([uri, entries]) => `${displayPath(uri, root)}:\n${entries.join("\n")}`)
    .join("\n")
  return { text, edits, files: byFile.size }
}
