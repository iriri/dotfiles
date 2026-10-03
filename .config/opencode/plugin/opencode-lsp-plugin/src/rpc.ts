export type LspServerState = "stopped" | "starting" | "running" | "failed"

export interface LspServerStatus {
  readonly id: string
  readonly status: LspServerState
}

export interface LspStatusPayload {
  readonly servers: LspServerStatus[]
}

export interface LspRpcRegistration {
  dispose(): Promise<void>
  readonly events: {
    emit(name: "statusChanged", payload: LspStatusPayload): Promise<void>
  }
}

const ServerStatusSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    status: { enum: ["stopped", "starting", "running", "failed"] },
  },
  required: ["id", "status"],
  additionalProperties: false,
} as const

const StatusPayloadSchema = {
  type: "object",
  properties: {
    servers: { type: "array", items: ServerStatusSchema },
  },
  required: ["servers"],
  additionalProperties: false,
} as const

export const LspRpc = {
  id: "opencode.lsp",
  methods: {
    getStatus: {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: StatusPayloadSchema,
    },
  },
  events: {
    statusChanged: { schema: StatusPayloadSchema },
  },
} as const
