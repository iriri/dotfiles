/**
 * Parse JSON with comments and trailing commas. OpenCode config files may be
 * `opencode.jsonc`, and no JSONC parser is guaranteed to be available in the
 * plugin runtime.
 */
export function parseJsonc(text: string): unknown {
  return JSON.parse(stripJsonc(text))
}

/** Remove `//` and block comments plus trailing commas while preserving strings. */
export function stripJsonc(text: string): string {
  let output = ""
  let index = 0
  while (index < text.length) {
    const char = text[index]

    if (char === '"') {
      output += char
      index++
      while (index < text.length) {
        const current = text[index]
        output += current
        if (current === "\\") {
          index++
          if (index < text.length) output += text[index]
          index++
          continue
        }
        index++
        if (current === '"') break
      }
      continue
    }

    if (char === "/" && text[index + 1] === "/") {
      while (index < text.length && text[index] !== "\n") {
        output += " "
        index++
      }
      continue
    }

    if (char === "/" && text[index + 1] === "*") {
      index += 2
      output += "  "
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        output += text[index] === "\n" ? "\n" : " "
        index++
      }
      if (index < text.length) {
        output += "  "
        index += 2
      }
      continue
    }

    if (char === ",") {
      let lookahead = index + 1
      while (lookahead < text.length) {
        const next = text[lookahead]
        if (next === " " || next === "\t" || next === "\r" || next === "\n") {
          lookahead++
          continue
        }
        if (next === "/" && text[lookahead + 1] === "/") {
          while (lookahead < text.length && text[lookahead] !== "\n") lookahead++
          continue
        }
        if (next === "/" && text[lookahead + 1] === "*") {
          lookahead += 2
          while (lookahead < text.length && !(text[lookahead] === "*" && text[lookahead + 1] === "/")) lookahead++
          if (lookahead < text.length) lookahead += 2
          continue
        }
        break
      }
      if (lookahead < text.length && (text[lookahead] === "}" || text[lookahead] === "]")) {
        output += " "
        index++
        continue
      }
      output += char
      index++
      continue
    }

    output += char
    index++
  }
  return output
}
