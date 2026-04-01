import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import os from "node:os"
import path from "node:path"

// Save original env so we can restore after each test
const originalEnv = { ...process.env }

beforeEach(() => {
  delete process.env.OPENCODE_CONFIG
  delete process.env.OPENCODE_CONFIG_DIR
})

afterEach(() => {
  process.env = { ...originalEnv }
})

/**
 * Bun caches modules, so we bust the cache by using a dynamic import
 * with a unique query string each time. This ensures each test gets a
 * fresh evaluation of process.env at import time.
 */
let importCounter = 0
async function loadFresh() {
  importCounter++
  const mod = await import(
    `../../lib/resolve-config-dir.ts?bust=${importCounter}`
  )
  return mod.resolveConfigDir as () => string
}

// ---------------------------------------------------------------------------
// 1. OPENCODE_CONFIG_DIR takes highest priority
// ---------------------------------------------------------------------------
describe("OPENCODE_CONFIG_DIR", () => {
  it("returns OPENCODE_CONFIG_DIR verbatim when set", async () => {
    process.env.OPENCODE_CONFIG_DIR = "/custom/config/dir"
    const resolveConfigDir = await loadFresh()

    expect(resolveConfigDir()).toBe("/custom/config/dir")
  })

  it("takes priority over OPENCODE_CONFIG", async () => {
    process.env.OPENCODE_CONFIG_DIR = "/dir-override"
    process.env.OPENCODE_CONFIG = "/some/path/opencode.jsonc"
    const resolveConfigDir = await loadFresh()

    expect(resolveConfigDir()).toBe("/dir-override")
  })
})

// ---------------------------------------------------------------------------
// 2. OPENCODE_CONFIG points to a file; dirname is extracted
// ---------------------------------------------------------------------------
describe("OPENCODE_CONFIG", () => {
  it("returns the parent directory of the config file path", async () => {
    process.env.OPENCODE_CONFIG = "/home/user/.config/opencode/opencode.jsonc"
    const resolveConfigDir = await loadFresh()

    expect(resolveConfigDir()).toBe("/home/user/.config/opencode")
  })

  it("handles deeply nested config file paths", async () => {
    process.env.OPENCODE_CONFIG = "/a/b/c/d/custom-config.json"
    const resolveConfigDir = await loadFresh()

    expect(resolveConfigDir()).toBe("/a/b/c/d")
  })
})

// ---------------------------------------------------------------------------
// 3. Fallback to ~/.config/opencode when neither env var is set
// ---------------------------------------------------------------------------
describe("default fallback", () => {
  it("returns ~/.config/opencode when no env vars are set", async () => {
    const resolveConfigDir = await loadFresh()
    const expected = path.join(os.homedir(), ".config", "opencode")

    expect(resolveConfigDir()).toBe(expected)
  })
})
