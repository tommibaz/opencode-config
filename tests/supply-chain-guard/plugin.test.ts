import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { SupplyChainGuard } from "../../plugins/supply-chain-guard/plugin.ts"

let tmpDir: string
let recipesDir: string
let cacheFile: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-test-"))
  recipesDir = path.join(tmpDir, "semgrep", "recipes")
  cacheFile = path.join(tmpDir, ".supply-chain-guard-cache.json")
  fs.mkdirSync(recipesDir, { recursive: true })
  fs.writeFileSync(path.join(recipesDir, "test-rule.yaml"), "rule: test")
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

interface MockCtx {
  client: {
    app: {
      log: (opts: { body: { service: string; level: string; message: string } }) => Promise<void>
    }
  }
  directory: string
  $: any
  project: any
  worktree: string
  serverUrl: URL
}

function createMockCtx(overrides: Partial<MockCtx> = {}): MockCtx {
  return {
    client: {
      app: {
        log: async () => {},
      },
    },
    directory: tmpDir,
    $: () => {},
    project: {},
    worktree: tmpDir,
    serverUrl: new URL("http://localhost"),
    ...overrides,
  }
}

describe("SupplyChainGuard plugin", () => {
  describe("initialization", () => {
    it("returns hooks object with before and after handlers", async () => {
      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      expect(hooks["tool.execute.before"]).toBeFunction()
      expect(hooks["tool.execute.after"]).toBeFunction()
    })

    it("logs a startup message", async () => {
      const messages: string[] = []
      const ctx = createMockCtx({
        client: {
          app: {
            log: async (opts) => {
              messages.push(opts.body.message)
            },
          },
        },
      })

      await SupplyChainGuard(ctx as any, recipesDir, cacheFile)
      expect(messages.some((m) => m.includes("loaded"))).toBe(true)
    })
  })

  describe("tool.execute.before", () => {
    it("ignores non-bash tool calls", async () => {
      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      const input = { tool: "read", sessionID: "s1", callID: "c1" }
      const output = { args: {} }
      await hooks["tool.execute.before"]!(input, output)
      // Should not throw, should not store anything
    })

    it("ignores bash calls without install patterns", async () => {
      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      const input = { tool: "bash", sessionID: "s1", callID: "c2" }
      const output = { args: { command: "ls -la" } }
      await hooks["tool.execute.before"]!(input, output)
    })

    it("ignores bash calls with empty command", async () => {
      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      const input = { tool: "bash", sessionID: "s1", callID: "c3" }
      const output = { args: { command: "" } }
      await hooks["tool.execute.before"]!(input, output)
    })

    it("detects install commands and stores pending call", async () => {
      const projectDir = path.join(tmpDir, "project-before")
      fs.mkdirSync(projectDir, { recursive: true })
      fs.writeFileSync(
        path.join(projectDir, "package-lock.json"),
        '{"lockfileVersion": 3}',
      )

      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      const input = { tool: "bash", sessionID: "s1", callID: "c-before-1" }
      const output = { args: { command: "npm install", workdir: projectDir } }
      await hooks["tool.execute.before"]!(input, output)

      // The after hook should find this pending call
      // We verify by calling after and seeing it doesn't skip
      const afterInput = {
        tool: "bash",
        sessionID: "s1",
        callID: "c-before-1",
        args: { command: "npm install", workdir: projectDir },
      }
      const afterOutput = { title: "", output: "", metadata: {} }
      await hooks["tool.execute.after"]!(afterInput, afterOutput)

      // If the pending call was stored, the after hook would have processed it
      // and appended output (even if just a skip or scan result)
      expect(afterOutput.output.length).toBeGreaterThan(0)
    })
  })

  describe("tool.execute.after", () => {
    it("ignores non-bash tool calls", async () => {
      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      const input = { tool: "read", sessionID: "s1", callID: "c4", args: {} }
      const output = { title: "", output: "original", metadata: {} }
      await hooks["tool.execute.after"]!(input, output)
      expect(output.output).toBe("original")
    })

    it("ignores bash calls without a pending before", async () => {
      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      const input = {
        tool: "bash",
        sessionID: "s1",
        callID: "no-pending",
        args: {},
      }
      const output = { title: "", output: "original", metadata: {} }
      await hooks["tool.execute.after"]!(input, output)
      expect(output.output).toBe("original")
    })

    it("appends cache hit message when lockfile and recipes unchanged", async () => {
      const projectDir = path.join(tmpDir, "project-cache-hit")
      fs.mkdirSync(projectDir, { recursive: true })
      fs.writeFileSync(
        path.join(projectDir, "package-lock.json"),
        '{"lockfileVersion": 3, "cached": true}',
      )

      // Pre-seed the cache with matching hashes
      const { hashLockfiles, hashRecipes } = await import(
        "../../plugins/supply-chain-guard/hashing.ts"
      )
      const lockHash = await hashLockfiles(projectDir, [
        "package-lock.json",
      ])
      const recHash = await hashRecipes(recipesDir)

      const cache = {
        [`${projectDir}::npm/yarn/pnpm/bun`]: {
          lockfileHash: lockHash,
          recipesHash: recHash,
          findingsCount: 42,
          scannedAt: "2026-03-25",
          ecosystem: "npm/yarn/pnpm/bun",
        },
      }
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2))

      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      // Before hook
      const callID = "c-cache-hit"
      await hooks["tool.execute.before"]!(
        { tool: "bash", sessionID: "s1", callID },
        { args: { command: "npm install", workdir: projectDir } },
      )

      // After hook
      const afterOutput = { title: "", output: "", metadata: {} }
      await hooks["tool.execute.after"]!(
        {
          tool: "bash",
          sessionID: "s1",
          callID,
          args: { command: "npm install", workdir: projectDir },
        },
        afterOutput,
      )

      expect(afterOutput.output).toContain("Skipped")
      expect(afterOutput.output).toContain("no changes detected")
      expect(afterOutput.output).toContain("42 finding(s)")
    })

    it("cleans up pending calls after processing", async () => {
      const projectDir = path.join(tmpDir, "project-cleanup")
      fs.mkdirSync(projectDir, { recursive: true })
      fs.writeFileSync(
        path.join(projectDir, "package-lock.json"),
        '{"cleanup": true}',
      )

      const ctx = createMockCtx()
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      const callID = "c-cleanup"
      await hooks["tool.execute.before"]!(
        { tool: "bash", sessionID: "s1", callID },
        { args: { command: "npm install", workdir: projectDir } },
      )

      // First after call should process
      const output1 = { title: "", output: "", metadata: {} }
      await hooks["tool.execute.after"]!(
        { tool: "bash", sessionID: "s1", callID, args: {} },
        output1,
      )
      expect(output1.output.length).toBeGreaterThan(0)

      // Second after call with same callID should be a no-op (pending was deleted)
      const output2 = { title: "", output: "untouched", metadata: {} }
      await hooks["tool.execute.after"]!(
        { tool: "bash", sessionID: "s1", callID, args: {} },
        output2,
      )
      expect(output2.output).toBe("untouched")
    })

    it("uses ctx.directory as fallback workdir", async () => {
      const projectDir = path.join(tmpDir, "project-fallback")
      fs.mkdirSync(projectDir, { recursive: true })
      fs.writeFileSync(
        path.join(projectDir, "package-lock.json"),
        '{"fallback": true}',
      )

      const ctx = createMockCtx({ directory: projectDir })
      const hooks = await SupplyChainGuard(ctx as any, recipesDir, cacheFile)

      const callID = "c-fallback"
      // Before hook without workdir in args
      await hooks["tool.execute.before"]!(
        { tool: "bash", sessionID: "s1", callID },
        { args: { command: "npm install" } },
      )

      const afterOutput = { title: "", output: "", metadata: {} }
      await hooks["tool.execute.after"]!(
        { tool: "bash", sessionID: "s1", callID, args: {} },
        afterOutput,
      )

      // Should have processed (not be empty) using ctx.directory as workdir
      expect(afterOutput.output.length).toBeGreaterThan(0)
    })
  })
})
