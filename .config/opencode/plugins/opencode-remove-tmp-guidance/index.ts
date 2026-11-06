import { Plugin } from "@opencode/plugin/effect"
import type { SessionRequest } from "@opencode/plugin/effect/session"
import { Effect } from "effect"

const envBlock = /<env>[\s\S]*?<\/env>/
const tmpHint = /\/tmp\/opencode/

function stripTmpHint(text: string) {
  return text.replace(envBlock, (block) =>
    block
      .split(/\r?\n/)
      .filter((line) => !tmpHint.test(line))
      .join("\n"),
  )
}

export default Plugin.define({
  id: "remove-tmp-hint",
  effect: Effect.fn("RemoveTmpHintPlugin")(function* (ctx) {
    const hook = (event: SessionRequest) =>
      Effect.sync(() => {
        for (const part of event.system) part.text = stripTmpHint(part.text)
      })
    yield* ctx.session.hook("context", hook)
    yield* ctx.session.hook("compaction", hook)
    yield* ctx.session.hook("generate", hook)
    yield* ctx.session.hook("title", hook)
  }),
})
