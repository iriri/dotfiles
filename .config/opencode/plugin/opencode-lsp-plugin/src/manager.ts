import { readFile } from "node:fs/promises"
import { basename, extname } from "node:path"
import { pathToFileURL } from "node:url"
import { languageIdForExtension } from "./catalog.ts"
import { LspClient, type LspDiagnostic } from "./client.ts"
import type { ServerConfig } from "./config.ts"
import type { LspServerStatus, LspStatusPayload } from "./rpc.ts"

interface ClientEntry {
  readonly config: ServerConfig
  client?: LspClient
  starting?: Promise<LspClient>
  error?: string
  users: number
  idle?: ReturnType<typeof setTimeout>
}

const SETTLE_MS = 600

/**
 * Lookup key for a file. Files with an extension map to their lowercased
 * extension (e.g. `x.rs` → `.rs`). Extensionless files map to their lowercased
 * basename, verbatim: `Dockerfile` → `dockerfile`, `.foo` → `.foo`. Together
 * with the entries in `ServerConfig.extensions` this gives:
 * - a dotted entry `.foo` matches both `x.foo` and a dotfile named `.foo`
 * - an undotted entry `foo` matches only a file named exactly `foo`
 */
function extensionKey(file: string): string {
  const extension = extname(file).toLowerCase()
  if (extension) return extension
  return basename(file).toLowerCase()
}

export class LspManager {
  readonly #servers: ServerConfig[]
  readonly #byExtension = new Map<string, ServerConfig>()
  readonly #clients = new Map<string, ClientEntry>()
  readonly #diagnostics = new Map<string, LspDiagnostic[]>()
  readonly #versions = new Map<string, number>()
  readonly #opened = new WeakMap<LspClient, Set<string>>()
  readonly #urisByServer = new Map<string, Set<string>>()
  readonly #waiters = new Map<string, Set<(diagnostics: LspDiagnostic[]) => void>>()
  readonly #activity = new Map<string, Set<() => void>>()
  readonly #warmed = new Set<string>()
  readonly #root: string
  readonly #requestTimeoutMs: number
  readonly #idleTimeoutMs: number
  readonly #debug: boolean
  #publishStatus?: (payload: LspStatusPayload) => Promise<void>
  #lastStatus = ""
  #closed = false

  constructor(servers: ServerConfig[], root: string, requestTimeoutMs: number, idleTimeoutMs: number, debug: boolean) {
    this.#servers = servers
    this.#root = root
    this.#requestTimeoutMs = requestTimeoutMs
    this.#idleTimeoutMs = idleTimeoutMs
    this.#debug = debug
    for (const server of servers) {
      for (const extension of server.extensions) {
        if (!this.#byExtension.has(extension)) this.#byExtension.set(extension, server)
      }
    }
  }

  serverForFile(file: string): ServerConfig | undefined {
    return this.#byExtension.get(extensionKey(file))
  }

  status(): LspServerStatus[] {
    return this.#servers.map((server) => {
      const entry = this.#clients.get(server.id)
      const status = entry?.client?.running
        ? "running"
        : entry?.starting
          ? "starting"
          : entry?.error
            ? "failed"
            : "stopped"
      return { id: server.id, status }
    })
  }

  setStatusPublisher(publish: (payload: LspStatusPayload) => Promise<void>): void {
    this.#publishStatus = publish
  }

  async withClient<T>(file: string, callback: (client: LspClient) => Promise<T>): Promise<T | undefined> {
    const server = this.serverForFile(file)
    if (!server || this.#closed) return undefined
    const entry = this.#clients.get(server.id) ?? { config: server, users: 0 }
    this.#clients.set(server.id, entry)
    if (entry.idle) clearTimeout(entry.idle)
    entry.idle = undefined
    entry.users++
    try {
      return await callback(await this.#client(server))
    } finally {
      entry.users--
      if (entry.users === 0 && entry.client?.running) {
        const client = entry.client
        entry.idle = setTimeout(() => {
          if (entry.users !== 0 || entry.client !== client) return
          entry.client = undefined
          entry.idle = undefined
          this.#notifyStatusChange()
          void client.stop().catch(() => undefined)
        }, this.#idleTimeoutMs)
      }
    }
  }

  async #client(server: ServerConfig): Promise<LspClient> {
    if (this.#closed) throw new Error("LSP manager is shut down")
    const entry = this.#clients.get(server.id) ?? { config: server, users: 0 }
    this.#clients.set(server.id, entry)
    if (entry.client?.running) return entry.client
    entry.client = undefined
    if (entry.starting) return entry.starting
    entry.error = undefined
    entry.starting = (async () => {
      this.#warmed.delete(server.id)
      for (const uri of this.#urisByServer.get(server.id) ?? []) this.#diagnostics.delete(uri)
      const client = new LspClient({
        id: server.id,
        command: server.command,
        cwd: this.#root,
        env: server.env,
        initialization: server.initialization,
        requestTimeoutMs: this.#requestTimeoutMs,
        rootUri: pathToFileURL(this.#root).href,
        workspaceFolders: [{ uri: pathToFileURL(this.#root).href, name: server.id }],
        onDiagnostics: (uri, diagnostics) => this.#publishDiagnostics(uri, diagnostics),
        onActivity: () => this.#notifyActivity(server.id),
        onExit: () => this.#notifyStatusChange(),
        debug: this.#debug,
      })
      try {
        await client.start()
      } catch (error) {
        await client.stop().catch(() => undefined)
        throw error
      }
      entry.client = client
      entry.starting = undefined
      this.#notifyStatusChange()
      return client
    })().catch((error: unknown) => {
      entry.starting = undefined
      entry.error = error instanceof Error ? error.message : String(error)
      this.#notifyStatusChange()
      throw error
    })
    this.#notifyStatusChange()
    return entry.starting
  }

  #notifyStatusChange(): void {
    const servers = this.status()
    const status = JSON.stringify(servers)
    if (status === this.#lastStatus) return
    this.#lastStatus = status
    if (!this.#publishStatus) return
    void this.#publishStatus({ servers }).catch((error) => {
      if (this.#debug)
        console.error(
          `[lsp] failed to publish server status: ${error instanceof Error ? error.message : String(error)}`,
        )
    })
  }

  #publishDiagnostics(uri: string, diagnostics: LspDiagnostic[]): void {
    this.#diagnostics.set(uri, diagnostics)
    const waiters = this.#waiters.get(uri)
    if (!waiters) return
    for (const waiter of [...waiters]) waiter(diagnostics)
  }

  #notifyActivity(serverID: string): void {
    const listeners = this.#activity.get(serverID)
    if (!listeners) return
    for (const listener of [...listeners]) listener()
  }

  /** Push the current on-disk contents of a file to its server, starting it if needed. */
  async syncFile(file: string): Promise<LspClient | undefined> {
    const server = this.serverForFile(file)
    if (!server) return undefined
    const client = await this.#client(server)
    const uri = pathToFileURL(file).href
    const text = await readFile(file, "utf8")
    const version = (this.#versions.get(uri) ?? 0) + 1
    this.#versions.set(uri, version)
    const opened = this.#opened.get(client) ?? new Set<string>()
    this.#opened.set(client, opened)
    if (!opened.has(uri)) client.didOpen(uri, languageIdForExtension(extensionKey(file)), version, text)
    else client.didChange(uri, version, text)
    opened.add(uri)
    const uris = this.#urisByServer.get(client.id) ?? new Set<string>()
    uris.add(uri)
    this.#urisByServer.set(client.id, uris)
    // Editing tools write to disk, so tell the server the document is saved.
    // Servers that run external checks on save (rust-analyzer's flycheck, for
    // example) only refresh their diagnostics in response to didSave.
    client.didSave(uri, text)
    return client
  }

  /**
   * Start or reuse a server for the file, sync it, and wait for diagnostics.
   * Resolves `undefined` when no server applies or nothing is published before
   * the timeout, and an array (possibly empty) once the server reports.
   */
  async collectDiagnostics(file: string, timeoutMs: number): Promise<LspDiagnostic[] | undefined> {
    if (!this.serverForFile(file)) return undefined
    try {
      return await this.withClient(file, async () => {
        await this.syncFile(file)
        const cached = this.#diagnostics.get(pathToFileURL(file).href)
        // When the server already has a result, a changed document republishes
        // quickly. If it stays silent the contents were unchanged, so the cached
        // result is still valid and we avoid waiting the full timeout.
        const wait = cached ? Math.min(timeoutMs, 1_200) : timeoutMs
        const fresh = await this.waitForDiagnostics(file, wait)
        return fresh === undefined ? cached : fresh
      })
    } catch (error) {
      if (this.#debug) console.error(`[lsp] ${file}: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  }

  waitForDiagnostics(file: string, timeoutMs: number): Promise<LspDiagnostic[] | undefined> {
    const server = this.serverForFile(file)
    const uri = pathToFileURL(file).href
    if (!server || !this.#versions.has(uri)) return Promise.resolve(undefined)
    return new Promise((resolve) => {
      let latest: LspDiagnostic[] | undefined
      let published = false
      let settle: ReturnType<typeof setTimeout> | undefined
      let done = false

      // Resolve once the server has published at least one set of diagnostics
      // and then gone quiet. Resetting on any inbound message keeps servers
      // that publish an early empty result (for example rust-analyzer while it
      // indexes) from being reported as clean.
      const bump = () => {
        if (!published || done) return
        if (settle) clearTimeout(settle)
        settle = setTimeout(finish, SETTLE_MS)
      }
      const finish = () => {
        if (done) return
        const value = latest
        cleanup()
        resolve(value)
      }
      const publish = (diagnostics: LspDiagnostic[]) => {
        published = true
        latest = diagnostics
        bump()
      }
      const cleanup = () => {
        done = true
        clearTimeout(timeout)
        if (settle) clearTimeout(settle)
        const waiters = this.#waiters.get(uri)
        waiters?.delete(publish)
        if (waiters && waiters.size === 0) this.#waiters.delete(uri)
        const activity = this.#activity.get(server.id)
        activity?.delete(bump)
        if (activity && activity.size === 0) this.#activity.delete(server.id)
      }

      const waiters = this.#waiters.get(uri) ?? new Set<(diagnostics: LspDiagnostic[]) => void>()
      waiters.add(publish)
      this.#waiters.set(uri, waiters)
      const activity = this.#activity.get(server.id) ?? new Set<() => void>()
      activity.add(bump)
      this.#activity.set(server.id, activity)
      const timeout = setTimeout(finish, timeoutMs)
    })
  }

  /**
   * Best-effort, once-per-server wait for initial analysis to settle. The
   * caller must have synced the file first. Keeps the first tool call on a cold
   * server from returning empty results while it is still indexing.
   */
  async warmUp(file: string, timeoutMs: number): Promise<void> {
    const server = this.serverForFile(file)
    if (!server || this.#warmed.has(server.id)) return
    this.#warmed.add(server.id)
    await this.waitForDiagnostics(file, timeoutMs)
  }

  async shutdown(): Promise<void> {
    this.#closed = true
    const clients = [...this.#clients.values()]
    this.#clients.clear()
    this.#waiters.clear()
    this.#activity.clear()
    this.#warmed.clear()
    this.#diagnostics.clear()
    this.#versions.clear()
    this.#urisByServer.clear()
    await Promise.all(
      clients.map(async (entry) => {
        if (entry.idle) clearTimeout(entry.idle)
        const client = entry.client ?? (await entry.starting?.catch(() => undefined))
        await client?.stop().catch(() => undefined)
      }),
    )
  }
}
