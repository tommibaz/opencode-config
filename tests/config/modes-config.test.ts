import { describe, expect, it } from "bun:test"
import fs from "node:fs"
import path from "node:path"

describe("mode config", () => {
  it("uses a valid brainstorm model", () => {
    const configPath = path.join(process.cwd(), "opencode.jsonc")
    const raw = fs.readFileSync(configPath, "utf8")
    const brainstormBlock = raw.match(
      /"brainstorm"\s*:\s*\{[\s\S]*?"model"\s*:\s*"([^"]+)"/,
    )

    expect(brainstormBlock).not.toBeNull()
    expect(brainstormBlock![1]).toBe("github-copilot/claude-4.6-sonnet")
  })
})
