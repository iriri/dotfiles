import { resolveConfig } from "./config.ts"
import { registerDiagnosticsHook } from "./diagnostics.ts"
import { LspManager } from "./manager.ts"
import { registerTools } from "./tools.ts"
import { LspRpc } from "./rpc.ts"
import type { Plugin, PluginContext } from "./types.ts"

const plugin: Plugin = {
  id: "opencode.lsp",
  async setup(context: PluginContext) {
    const config = resolveConfig(context.location.directory, context.options ?? {})
    if (config.debug) {
      console.error(
        `[lsp] loaded ${config.servers.length} server(s): ${config.servers.map((server) => server.id).join(", ") || "none"}`,
      )
    }
    const manager = new LspManager(
      config.servers,
      context.location.directory,
      config.requestTimeoutMs,
      config.idleTimeoutMs,
      config.debug,
    )
    const statusRegistration = await context.rpc.register(LspRpc, {
      getStatus: async () => ({ servers: manager.status() }),
    })
    manager.setStatusPublisher((payload) => statusRegistration.events.emit("statusChanged", payload))
    await registerTools(context, manager)
    await registerDiagnosticsHook(context, manager, config.diagnostics)
    return async () => {
      await manager.shutdown()
      await statusRegistration.dispose()
    }
  },
}

export default plugin
