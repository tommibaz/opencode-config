import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runScanPasses, type ScanResult, type ShellExecutor } from "../../plugins/supply-chain-guard/scanner.ts"
import type { ScanPass } from "../../plugins/supply-chain-guard/ecosystems.ts"

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-test-"))
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function makeShell(stdout: string, exitCode = 0): ShellExecutor {
  return async () => ({ stdout, exitCode })
}

function makeFailingShell(error: Error): ShellExecutor {
  return async () => {
    throw error
  }
}

const noopLog = async () => {}

describe("runScanPasses", () => {
  describe("target existence check", () => {
    it("skips passes where the target directory does not exist", async () => {
      const passes: ScanPass[] = [
        { label: "dependencies", target: "nonexistent_dir/", flags: [] },
      ]

      const result = await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/fake/recipes",
        ecoName: "test-eco",
        shell: makeShell(""),
        log: noopLog,
      })

      expect(result.totalFindings).toBe(0)
      expect(result.outputs.length).toBe(1)
      expect(result.outputs[0]).toContain("not found")
    })

    it("runs scans when target exists", async () => {
      const targetDir = path.join(tmpDir, "existing_dir")
      fs.mkdirSync(targetDir, { recursive: true })

      const passes: ScanPass[] = [
        { label: "source", target: "existing_dir", flags: [] },
      ]

      const scanOutput = JSON.stringify({ results: [] })
      const result = await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/fake/recipes",
        ecoName: "test-eco",
        shell: makeShell(scanOutput),
        log: noopLog,
      })

      expect(result.totalFindings).toBe(0)
      expect(result.outputs[0]).toContain("0 findings")
    })
  })

  describe("shell command construction", () => {
    it("passes correct arguments to the shell executor", async () => {
      const targetDir = path.join(tmpDir, "cmd_test")
      fs.mkdirSync(targetDir, { recursive: true })

      let capturedArgs: {
        command: string[]
        workdir: string
      } | undefined

      const capturingShell: ShellExecutor = async (args) => {
        capturedArgs = args
        return { stdout: JSON.stringify({ results: [] }), exitCode: 0 }
      }

      const passes: ScanPass[] = [
        {
          label: "dependencies",
          target: "cmd_test",
          flags: ["--no-git-ignore", "--exclude=!node_modules"],
        },
      ]

      await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/home/user/recipes",
        ecoName: "test-eco",
        shell: capturingShell,
        log: noopLog,
      })

      expect(capturedArgs).toBeDefined()
      expect(capturedArgs!.command).toContain("semgrep")
      expect(capturedArgs!.command).toContain("--config")
      expect(capturedArgs!.command).toContain("/home/user/recipes")
      expect(capturedArgs!.command).toContain("--no-git-ignore")
      expect(capturedArgs!.command).toContain("--exclude=!node_modules")
      expect(capturedArgs!.command).toContain("--json")
      expect(capturedArgs!.command).toContain("cmd_test")
      expect(capturedArgs!.workdir).toBe(tmpDir)
    })

    it("does not include empty flag strings", async () => {
      const targetDir = path.join(tmpDir, "no_flags")
      fs.mkdirSync(targetDir, { recursive: true })

      let capturedArgs: { command: string[]; workdir: string } | undefined

      const capturingShell: ShellExecutor = async (args) => {
        capturedArgs = args
        return { stdout: JSON.stringify({ results: [] }), exitCode: 0 }
      }

      const passes: ScanPass[] = [
        { label: "source", target: "no_flags", flags: [] },
      ]

      await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/recipes",
        ecoName: "test-eco",
        shell: capturingShell,
        log: noopLog,
      })

      expect(capturedArgs).toBeDefined()
      const nonEmpty = capturedArgs!.command.filter((s) => s.trim() !== "")
      expect(nonEmpty.length).toBe(capturedArgs!.command.length)
    })
  })

  describe("findings accumulation", () => {
    it("sums findings across multiple passes", async () => {
      const depsDir = path.join(tmpDir, "node_modules_sum")
      fs.mkdirSync(depsDir, { recursive: true })

      const passes: ScanPass[] = [
        { label: "dependencies", target: "node_modules_sum", flags: [] },
        { label: "source", target: ".", flags: [] },
      ]

      const finding = {
        check_id: "rule-1",
        path: "file.js",
        start: { line: 1 },
        extra: { lines: "code" },
      }

      let callCount = 0
      const multiShell: ShellExecutor = async () => {
        callCount++
        if (callCount === 1) {
          return {
            stdout: JSON.stringify({ results: [finding, finding] }),
            exitCode: 1,
          }
        }
        return {
          stdout: JSON.stringify({ results: [finding] }),
          exitCode: 1,
        }
      }

      const result = await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/recipes",
        ecoName: "test-eco",
        shell: multiShell,
        log: noopLog,
      })

      expect(result.totalFindings).toBe(3)
      expect(result.outputs.length).toBe(2)
    })
  })

  describe("error handling", () => {
    it("produces error output when shell throws", async () => {
      const targetDir = path.join(tmpDir, "error_test")
      fs.mkdirSync(targetDir, { recursive: true })

      const passes: ScanPass[] = [
        { label: "source", target: "error_test", flags: [] },
      ]

      const result = await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/recipes",
        ecoName: "test-eco",
        shell: makeFailingShell(new Error("semgrep not found")),
        log: noopLog,
      })

      expect(result.totalFindings).toBe(0)
      expect(result.outputs.length).toBe(1)
      expect(result.outputs[0]).toContain("scan failed")
      expect(result.outputs[0]).toContain("semgrep not found")
    })

    it("truncates long error messages to 500 characters", async () => {
      const targetDir = path.join(tmpDir, "long_error")
      fs.mkdirSync(targetDir, { recursive: true })

      const passes: ScanPass[] = [
        { label: "source", target: "long_error", flags: [] },
      ]

      const longMsg = "x".repeat(1000)
      const result = await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/recipes",
        ecoName: "test-eco",
        shell: makeFailingShell(new Error(longMsg)),
        log: noopLog,
      })

      // The output should contain at most 500 chars of the error
      const errorPart = result.outputs[0].split("Semgrep scan failed: ")[1]
      expect(errorPart.replace("\n", "").length).toBeLessThanOrEqual(501)
    })
  })

  describe("logging", () => {
    it("logs skip messages for missing targets", async () => {
      const messages: string[] = []
      const trackingLog = async (_level: string, msg: string) => {
        messages.push(msg)
      }

      const passes: ScanPass[] = [
        { label: "deps", target: "missing_dir/", flags: [] },
      ]

      await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/recipes",
        ecoName: "test-eco",
        shell: makeShell(""),
        log: trackingLog,
      })

      expect(messages.length).toBeGreaterThan(0)
      expect(messages.some((m) => m.includes("does not exist"))).toBe(true)
    })

    it("logs scan start messages for existing targets", async () => {
      const targetDir = path.join(tmpDir, "log_test")
      fs.mkdirSync(targetDir, { recursive: true })

      const messages: string[] = []
      const trackingLog = async (_level: string, msg: string) => {
        messages.push(msg)
      }

      const passes: ScanPass[] = [
        { label: "source", target: "log_test", flags: [] },
      ]

      await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/recipes",
        ecoName: "test-eco",
        shell: makeShell(JSON.stringify({ results: [] })),
        log: trackingLog,
      })

      expect(messages.some((m) => m.includes("Running Semgrep"))).toBe(true)
    })
  })

  describe("return structure", () => {
    it("returns outputs array and totalFindings", async () => {
      const passes: ScanPass[] = [
        { label: "source", target: ".", flags: [] },
      ]

      const result = await runScanPasses({
        scanPasses: passes,
        workdir: tmpDir,
        recipesDir: "/recipes",
        ecoName: "test-eco",
        shell: makeShell(JSON.stringify({ results: [] })),
        log: noopLog,
      })

      expect(Array.isArray(result.outputs)).toBe(true)
      expect(typeof result.totalFindings).toBe("number")
    })
  })
})
