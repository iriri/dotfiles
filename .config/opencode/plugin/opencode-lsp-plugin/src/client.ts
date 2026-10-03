import { spawn, type ChildProcess } from "node:child_process"

export interface LspPosition {
  readonly line: number
  readonly character: number
}

export interface LspRange {
  readonly start: LspPosition
  readonly end: LspPosition
}

export interface LspDiagnostic {
  readonly range: LspRange
  readonly severity?: number
  readonly code?: string | number
  readonly source?: string
  readonly message: string
}

interface Pending {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/** JSON-RPC error with the server-provided code preserved for retry decisions. */
export class LspError extends Error {
  readonly code: number | undefined
  constructor(message: string, code: number | undefined) {
    super(message)
    this.name = "LspError"
    this.code = code
  }
}

export interface LspClientOptions {
  readonly id: string
  readonly command: string[]
  readonly cwd: string
  readonly env: Record<string, string>
  readonly initialization?: Record<string, unknown>
  readonly requestTimeoutMs: number
  readonly rootUri: string
  readonly workspaceFolders: { readonly uri: string; readonly name: string }[]
  readonly onDiagnostics: (uri: string, diagnostics: LspDiagnostic[]) => void
  /** Called for every inbound message; used to detect that the server is still working. */
  readonly onActivity?: () => void
  readonly onExit?: () => void
  readonly debug: boolean
}

/** Minimal JSON-RPC 2.0 client for a stdio language server. */
export class LspClient {
  readonly id: string
  readonly #options: LspClientOptions
  #child?: ChildProcess
  #buffer: Buffer = Buffer.alloc(0)
  #nextId = 1
  #pending = new Map<number, Pending>()
  #capabilities: Record<string, any> = {}
  #stopping = false

  constructor(options: LspClientOptions) {
    this.id = options.id
    this.#options = options
  }

  get capabilities(): Record<string, any> {
    return this.#capabilities
  }

  get running(): boolean {
    return (
      !this.#stopping && this.#child !== undefined && this.#child.exitCode === null && this.#child.signalCode === null
    )
  }

  async start(): Promise<void> {
    const [command, ...args] = this.#options.command
    if (!command) throw new Error(`${this.id}: no command configured`)
    const child = spawn(command, args, {
      cwd: this.#options.cwd,
      env: { ...process.env, ...this.#options.env },
      stdio: ["pipe", "pipe", "pipe"],
    })
    this.#child = child
    child.stdout?.on("data", (chunk: Buffer) => this.#onData(chunk))
    child.stderr?.on("data", (chunk: Buffer) => {
      if (this.#options.debug) process.stderr.write(`[lsp:${this.id}] ${chunk.toString()}`)
    })
    child.on("exit", (code, signal) => this.#onExit(code, signal))
    child.stdin?.on("error", () => {
      // A server that exits while we are writing a notification can raise EPIPE.
    })
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve())
      child.once("error", (error) => reject(new Error(`${this.id}: failed to start "${command}": ${error.message}`)))
    })
    await this.#initialize()
  }

  async #initialize(): Promise<void> {
    const result = await this.request("initialize", {
      processId: process.pid,
      clientInfo: { name: "opencode-lsp-plugin", version: "0.1.0" },
      rootUri: this.#options.rootUri,
      workspaceFolders: this.#options.workspaceFolders,
      initializationOptions: this.#options.initialization ?? {},
      capabilities: {
        general: { positionEncodings: ["utf-16"] },
        window: { workDoneProgress: true },
        workspace: {
          configuration: true,
          workspaceFolders: true,
          workspaceEdit: { documentChanges: true },
        },
        textDocument: {
          synchronization: { dynamicRegistration: false, didSave: true, save: { includeText: true } },
          publishDiagnostics: { relatedInformation: true },
          hover: { contentFormat: ["markdown", "plaintext"] },
          definition: {},
          references: {},
          rename: { prepareSupport: false },
        },
      },
    })
    this.#capabilities = result?.capabilities ?? {}
    this.notify("initialized", {})
    if (this.#options.initialization) {
      this.notify("workspace/didChangeConfiguration", { settings: this.#options.initialization })
    }
  }

  request(method: string, params: unknown, timeoutMs = this.#options.requestTimeoutMs): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.#child) {
        reject(new Error(`${this.id}: server is not running`))
        return
      }
      const id = this.#nextId++
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        reject(new Error(`${this.id}: ${method} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this.#pending.set(id, { resolve, reject, timer })
      this.#send({ jsonrpc: "2.0", id, method, params })
    })
  }

  notify(method: string, params?: unknown): void {
    if (params === undefined) this.#send({ jsonrpc: "2.0", method })
    else this.#send({ jsonrpc: "2.0", method, params })
  }

  didOpen(uri: string, languageId: string, version: number, text: string): void {
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version, text },
    })
  }

  didChange(uri: string, version: number, text: string): void {
    this.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    })
  }

  didSave(uri: string, text?: string): void {
    this.notify(
      "textDocument/didSave",
      text === undefined ? { textDocument: { uri } } : { textDocument: { uri }, text },
    )
  }

  didClose(uri: string): void {
    this.notify("textDocument/didClose", { textDocument: { uri } })
  }

  async stop(): Promise<void> {
    if (this.#stopping) return
    const child = this.#child
    this.#stopping = true
    if (!child) {
      this.#rejectPending(new Error(`${this.id}: server stopped`))
      return
    }
    try {
      await this.request("shutdown", null, 2_000)
    } catch {
      // The server may already be gone.
    }
    try {
      this.#send({ jsonrpc: "2.0", method: "exit" })
    } catch {
      // Ignore a closed stdin.
    }
    if (child.exitCode !== null) {
      this.#child = undefined
      this.#rejectPending(new Error(`${this.id}: server stopped`))
      return
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL")
        } catch {
          // Already exited.
        }
        resolve()
      }, 1_000)
      child.once("exit", () => {
        clearTimeout(timer)
        resolve()
      })
    })
    this.#child = undefined
    this.#rejectPending(new Error(`${this.id}: server stopped`))
  }

  #rejectPending(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.#pending.clear()
  }

  #send(message: Record<string, unknown>): void {
    const stdin = this.#child?.stdin
    if (!stdin || stdin.destroyed) return
    const body = JSON.stringify(message)
    stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
  }

  #onData(chunk: Buffer): void {
    this.#buffer = Buffer.concat([this.#buffer, chunk])
    while (true) {
      const separator = this.#buffer.indexOf("\r\n\r\n")
      if (separator < 0) return
      const header = this.#buffer.subarray(0, separator).toString("utf8")
      const match = /Content-Length:\s*(\d+)/i.exec(header)
      if (!match) {
        this.#buffer = this.#buffer.subarray(separator + 4)
        continue
      }
      const bodyStart = separator + 4
      const bodyLength = Number(match[1])
      if (this.#buffer.length < bodyStart + bodyLength) return
      const body = this.#buffer.subarray(bodyStart, bodyStart + bodyLength).toString("utf8")
      this.#buffer = this.#buffer.subarray(bodyStart + bodyLength)
      try {
        this.#handleMessage(JSON.parse(body))
      } catch (error) {
        if (this.#options.debug) {
          console.error(`[lsp:${this.id}] invalid message: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }

  #handleMessage(message: any): void {
    if (!message || typeof message !== "object") return
    this.#options.onActivity?.()
    const isResponse = message.id !== undefined && message.method === undefined
    if (isResponse) {
      const pending = typeof message.id === "number" ? this.#pending.get(message.id) : undefined
      if (!pending) return
      clearTimeout(pending.timer)
      this.#pending.delete(message.id)
      if (message.error) {
        pending.reject(new LspError(`${this.id}: ${message.error.message ?? "request failed"}`, message.error.code))
      } else {
        pending.resolve(message.result)
      }
      return
    }
    if (message.method === "textDocument/publishDiagnostics") {
      const params = message.params ?? {}
      this.#options.onDiagnostics(String(params.uri ?? ""), Array.isArray(params.diagnostics) ? params.diagnostics : [])
      return
    }
    if (message.id !== undefined && message.method !== undefined) this.#respond(message)
  }

  #respond(message: any): void {
    const id = message.id
    switch (message.method) {
      case "workspace/configuration": {
        const items = Array.isArray(message.params?.items) ? message.params.items : []
        const resolve = (section: unknown) => {
          if (typeof section !== "string") return this.#options.initialization ?? {}
          let value: any = this.#options.initialization
          for (const key of section.split(".")) {
            value = value?.[key]
            if (value === undefined) return this.#options.initialization ?? {}
          }
          return value
        }
        this.#send({ jsonrpc: "2.0", id, result: items.map((item: any) => resolve(item.section)) })
        return
      }
      case "workspace/workspaceFolders":
        this.#send({ jsonrpc: "2.0", id, result: this.#options.workspaceFolders })
        return
      case "client/registerCapability":
      case "client/unregisterCapability":
      case "window/workDoneProgress/create":
        this.#send({ jsonrpc: "2.0", id, result: null })
        return
      default:
        this.#send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${message.method}` } })
    }
  }

  #onExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.#child = undefined
    this.#rejectPending(new Error(`${this.id}: server exited (${code ?? signal})`))
    this.#options.onExit?.()
    if (!this.#stopping && this.#options.debug) {
      console.error(`[lsp:${this.id}] exited (${code ?? signal})`)
    }
  }
}
