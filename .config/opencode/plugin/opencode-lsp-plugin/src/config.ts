import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { BUILTIN_EXTENSIONS } from "./catalog.ts"
import { parseJsonc } from "./jsonc.ts"
import { isRecord } from "./types.ts"

export interface ServerConfig {
  readonly id: string
  readonly command: string[]
  readonly extensions: string[]
  readonly env: Record<string, string>
  readonly initialization?: Record<string, unknown>
}

export interface DiagnosticsSettings {
  readonly enabled: boolean
  readonly timeoutMs: number
  readonly maxLines: number
  readonly maxFiles: number
}

export interface ResolvedConfig {
  readonly servers: ServerConfig[]
  readonly diagnostics: DiagnosticsSettings
  readonly requestTimeoutMs: number
  readonly idleTimeoutMs: number
  readonly debug: boolean
}

const DEFAULT_DIAGNOSTICS: DiagnosticsSettings = {
  enabled: true,
  timeoutMs: 5_000,
  maxLines: 20,
  maxFiles: 5,
}

export function resolveConfig(directory: string, options: Record<string, unknown>): ResolvedConfig {
  let lsp: unknown
  for (const document of collectConfigDocuments(directory)) {
    if (document.lsp !== undefined) lsp = mergeLsp(lsp, document.lsp)
  }
  // Plugin options are the highest-precedence config source.
  if (options.lsp !== undefined) lsp = mergeLsp(lsp, options.lsp)

  const diagnostics = resolveDiagnostics(options.diagnostics)
  const requestTimeoutMs = numberOption(options.requestTimeoutMs, 15_000)
  const idleTimeoutMs = numberOption(options.idleTimeoutMs, 60_000)
  const debug = options.debug === true

  return { servers: resolveServers(lsp, debug), diagnostics, requestTimeoutMs, idleTimeoutMs, debug }
}

function resolveDiagnostics(value: unknown): DiagnosticsSettings {
  if (value === false) return { ...DEFAULT_DIAGNOSTICS, enabled: false }
  if (!isRecord(value)) return DEFAULT_DIAGNOSTICS
  return {
    enabled: value.enabled !== false,
    timeoutMs: numberOption(value.timeoutMs, DEFAULT_DIAGNOSTICS.timeoutMs),
    maxLines: numberOption(value.maxLines, DEFAULT_DIAGNOSTICS.maxLines),
    maxFiles: numberOption(value.maxFiles, DEFAULT_DIAGNOSTICS.maxFiles),
  }
}

function resolveServers(lsp: unknown, debug: boolean): ServerConfig[] {
  if (lsp === false) return []
  if (!isRecord(lsp)) return []
  const servers: ServerConfig[] = []
  for (const [id, raw] of Object.entries(lsp)) {
    if (!isRecord(raw)) continue
    if (raw.disabled === true) continue
    const command = stringArray(raw.command).map(expandEnv)
    if (command.length === 0) {
      if (debug) console.error(`[lsp] server "${id}" has no command; skipping`)
      continue
    }
    const extensions = normalizeExtensions(
      stringArray(raw.extensions).length ? stringArray(raw.extensions) : (BUILTIN_EXTENSIONS[id] ?? []),
    )
    if (extensions.length === 0 && debug) {
      console.error(`[lsp] server "${id}" has no extensions and is not a known builtin; it will not match any file`)
    }
    servers.push({
      id,
      command,
      extensions,
      env: stringRecord(raw.env),
      initialization: isRecord(raw.initialization) ? raw.initialization : undefined,
    })
  }
  return servers
}

/** Later configs win; `false` disables everything, an object re-enables and merges per server. */
function mergeLsp(previous: unknown, next: unknown): unknown {
  if (next === false) return false
  if (next === true) return previous === false ? {} : (previous ?? {})
  if (!isRecord(next)) return previous
  const base = isRecord(previous) ? previous : {}
  return { ...base, ...next }
}

function collectConfigDocuments(directory: string): Record<string, unknown>[] {
  const documents: Record<string, unknown>[] = []
  const globalDirectory = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : join(homedir(), ".config", "opencode")
  const global = readFirst([join(globalDirectory, "opencode.json"), join(globalDirectory, "opencode.jsonc")])
  if (global) documents.push(global)

  const directories: string[] = []
  let current = resolve(directory)
  while (true) {
    directories.push(current)
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  // Farthest ancestor first so nearer configs override. Direct files are
  // applied before every `.opencode` file, matching OpenCode discovery order.
  const farthestToNearest = [...directories].reverse()
  for (const dir of farthestToNearest) {
    const direct = readFirst([join(dir, "opencode.json"), join(dir, "opencode.jsonc")])
    if (direct) documents.push(direct)
  }
  for (const dir of farthestToNearest) {
    const nested = readFirst([join(dir, ".opencode", "opencode.json"), join(dir, ".opencode", "opencode.jsonc")])
    if (nested) documents.push(nested)
  }
  return documents
}

function readFirst(paths: string[]): Record<string, unknown> | undefined {
  for (const path of paths) {
    if (!existsSync(path)) continue
    try {
      const parsed = parseJsonc(readFileSync(path, "utf8"))
      if (isRecord(parsed)) return parsed
    } catch (error) {
      console.error(`[lsp] failed to parse ${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return undefined
}

function normalizeExtensions(values: string[]): string[] {
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim().toLowerCase()
    if (!trimmed) continue
    if (!result.includes(trimmed)) result.push(trimmed)
  }
  return result
}

function expandEnv(value: string): string {
  return value.replace(/\$\{(\w+)\}|\$(\w+)/g, (match, braced, bare) => process.env[braced ?? bare] ?? match)
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) if (typeof item === "string") result[key] = item
  return result
}

function numberOption(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback
}
