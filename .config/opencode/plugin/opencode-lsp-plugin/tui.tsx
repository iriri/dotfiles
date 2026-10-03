import { Plugin } from "@opencode/plugin/tui"
import { createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import { LspRpc, type LspServerStatus } from "./src/rpc.ts"
import { isRecord } from "./src/types.ts"

function SidebarLsp(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const session = createMemo(() => props.context.data.session.get(props.sessionID))
  const location = createMemo(() => session()?.location ?? props.context.location)
  const [servers, setServers] = createSignal<LspServerStatus[]>([])
  const rpc = props.context.client.rpc(LspRpc)
  let revision = 0

  const update = (value: unknown) => setServers(parseStatus(value))
  const unsubscribe = rpc.events.on("statusChanged", (event) => {
    if (!sameLocation(event.location, location())) return
    revision++
    update(event.data)
  })

  createEffect(() => {
    const current = location()
    if (!current) {
      setServers([])
      return
    }
    const observed = revision
    void rpc
      .getStatus({}, { location: current })
      .then((value) => {
        if (revision === observed && sameLocation(location(), current)) update(value)
      })
      .catch(() => {
        if (revision === observed && sameLocation(location(), current)) setServers([])
      })
  })
  onCleanup(unsubscribe)

  const visible = createMemo(() => servers().filter((server) => server.status !== "stopped"))
  const running = createMemo(() => servers().filter((server) => server.status === "running"))
  const dot = (status: LspServerStatus["status"]) => {
    if (status === "running") return theme.text.feedback.success.base
    if (status === "failed") return theme.text.feedback.error.base
    if (status === "starting") return theme.text.feedback.warning.base
    return theme.text.muted
  }

  return (
    <Show when={visible().length > 0}>
      <box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.text.base}>
            <b>LSP</b>
            <span style={{ fg: theme.text.muted }}> ({running().length} running)</span>
          </text>
        </box>
        <For each={visible()}>
          {(server) => (
            <box flexDirection="row" gap={1} minWidth={0}>
              <text flexShrink={0} fg={dot(server.status)}>
                •
              </text>
              <text fg={theme.text.base} wrapMode="none" truncate flexGrow={1} flexShrink={1} minWidth={0}>
                <b>{server.id}</b>
              </text>
              <text fg={server.status === "failed" ? theme.text.feedback.error.base : theme.text.muted} flexShrink={0}>
                <Switch fallback={server.status}>
                  <Match when={server.status === "running"}>Running</Match>
                  <Match when={server.status === "starting"}>Starting</Match>
                  <Match when={server.status === "failed"}>Failed</Match>
                </Switch>
              </text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "opencode.lsp.sidebar",
  setup(context) {
    return context.ui.slot({
      append: "sidebar.content",
      render: (slot) => <SidebarLsp context={context} sessionID={slot.sessionID} />,
    })
  },
})

function parseStatus(value: unknown): LspServerStatus[] {
  if (!isRecord(value) || !Array.isArray(value.servers)) return []
  return value.servers.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string") return []
    if (
      item.status !== "stopped" &&
      item.status !== "starting" &&
      item.status !== "running" &&
      item.status !== "failed"
    ) {
      return []
    }
    return [{ id: item.id, status: item.status }]
  })
}

function sameLocation(left: unknown, right: unknown): boolean {
  return (
    isRecord(left) && isRecord(right) && left.directory === right.directory && left.workspaceID === right.workspaceID
  )
}
