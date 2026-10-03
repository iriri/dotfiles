import { readFile, realpath, writeFile } from "node:fs/promises"
import { isAbsolute, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { isRecord } from "./types.ts"

interface Position {
  readonly line: number
  readonly character: number
}

interface TextEdit {
  readonly range: { readonly start: Position; readonly end: Position }
  readonly newText: string
}

interface PendingFileEdit {
  readonly path: string
  readonly text: string
  readonly edits: number
}

export async function applyWorkspaceEdit(
  edit: unknown,
  root: string,
): Promise<{ readonly files: number; readonly edits: number; readonly paths: string[] }> {
  if (!isRecord(edit)) throw new Error("The language server returned an invalid workspace edit.")
  const byUri = new Map<string, TextEdit[]>()
  const add = (uri: string, rawEdits: unknown) => {
    if (!Array.isArray(rawEdits)) throw new Error(`The workspace edit for ${uri} has an invalid edits list.`)
    const edits = byUri.get(uri) ?? []
    edits.push(...rawEdits.map(requireTextEdit))
    byUri.set(uri, edits)
  }

  if (edit.documentChanges !== undefined) {
    if (!Array.isArray(edit.documentChanges)) throw new Error("The language server returned invalid document changes.")
    for (const change of edit.documentChanges) {
      if (!isRecord(change) || !isRecord(change.textDocument) || typeof change.textDocument.uri !== "string") {
        throw new Error("Applying rename resource operations is not supported; no files were changed.")
      }
      add(change.textDocument.uri, change.edits)
    }
  }
  if (edit.changes !== undefined) {
    if (!isRecord(edit.changes)) throw new Error("The language server returned invalid workspace changes.")
    for (const [uri, edits] of Object.entries(edit.changes)) add(uri, edits)
  }

  const realRoot = await realpath(root)
  const pending: PendingFileEdit[] = []
  for (const [uri, edits] of byUri) {
    if (edits.length === 0) continue
    const file = fileURLToPath(uri)
    const path = await realpath(file)
    const rel = relative(realRoot, path)
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error(`Refusing to apply rename edits outside the project: ${file}`)
    }
    const original = await readFile(path, "utf8")
    const positioned = edits
      .map((item) => ({
        start: offsetAt(original, item.range.start),
        end: offsetAt(original, item.range.end),
        newText: item.newText,
      }))
      .sort((a, b) => b.start - a.start || b.end - a.end)
    if (positioned.some((item) => item.end < item.start)) {
      throw new Error(`The language server returned an invalid edit range for ${file}; no files were changed.`)
    }
    if (
      positioned.some(
        (item, index) =>
          index > 0 && (item.end > positioned[index - 1].start || item.start === positioned[index - 1].start),
      )
    ) {
      throw new Error(`The language server returned overlapping edits for ${file}; no files were changed.`)
    }
    const text = positioned.reduce(
      (value, item) => value.slice(0, item.start) + item.newText + value.slice(item.end),
      original,
    )
    pending.push({ path, text, edits: edits.length })
  }

  for (const item of pending) await writeFile(item.path, item.text)
  return {
    files: pending.length,
    edits: pending.reduce((count, item) => count + item.edits, 0),
    paths: pending.map((item) => item.path),
  }
}

function offsetAt(text: string, position: Position): number {
  if (
    !Number.isInteger(position.line) ||
    position.line < 0 ||
    !Number.isInteger(position.character) ||
    position.character < 0
  ) {
    throw new Error("The language server returned an invalid text edit position.")
  }
  let line = 0
  let start = 0
  while (line < position.line) {
    const newline = text.indexOf("\n", start)
    if (newline < 0) throw new Error("The language server returned a text edit outside the file.")
    start = newline + 1
    line++
  }
  const newline = text.indexOf("\n", start)
  let end = newline < 0 ? text.length : newline
  if (end > start && text.charCodeAt(end - 1) === 13) end--
  if (position.character > end - start) throw new Error("The language server returned a text edit outside the line.")
  return start + position.character
}

function requireTextEdit(value: unknown): TextEdit {
  if (!isRecord(value) || !isRecord(value.range) || !isRecord(value.range.start) || !isRecord(value.range.end)) {
    throw new Error("The language server returned an invalid text edit.")
  }
  if (
    typeof value.range.start.line !== "number" ||
    typeof value.range.start.character !== "number" ||
    typeof value.range.end.line !== "number" ||
    typeof value.range.end.character !== "number" ||
    typeof value.newText !== "string"
  ) {
    throw new Error("The language server returned an invalid text edit.")
  }
  return {
    range: {
      start: { line: value.range.start.line, character: value.range.start.character },
      end: { line: value.range.end.line, character: value.range.end.character },
    },
    newText: value.newText,
  }
}
