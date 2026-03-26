import { describe, expect, it } from "bun:test"
import {
  detectInstalls,
  type DetectedInstall,
} from "../../plugins/supply-chain-guard/detection.ts"

// ---------------------------------------------------------------------------
// 1. Single ecosystem detection
// ---------------------------------------------------------------------------
describe("single ecosystem detection", () => {
  it("detects npm install as npm/yarn/pnpm/bun", () => {
    const results = detectInstalls("npm install")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("npm/yarn/pnpm/bun")
  })

  it("detects composer install as composer", () => {
    const results = detectInstalls("composer install")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("composer")
  })

  it("detects cargo build as cargo", () => {
    const results = detectInstalls("cargo build")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("cargo")
  })

  it("detects pip install flask as pip/poetry/pipenv/uv", () => {
    const results = detectInstalls("pip install flask")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("pip/poetry/pipenv/uv")
  })
})

// ---------------------------------------------------------------------------
// 2. Multi-ecosystem detection
// ---------------------------------------------------------------------------
describe("multi-ecosystem detection", () => {
  it("detects both npm and composer in a compound command", () => {
    const results = detectInstalls("npm install && composer install")
    expect(results).toHaveLength(2)
    const names = results.map((r) => r.ecosystem.name)
    expect(names).toContain("npm/yarn/pnpm/bun")
    expect(names).toContain("composer")
  })
})

// ---------------------------------------------------------------------------
// 3. No match cases
// ---------------------------------------------------------------------------
describe("no match", () => {
  it("returns empty for ls -la", () => {
    expect(detectInstalls("ls -la")).toHaveLength(0)
  })

  it("returns empty for git status", () => {
    expect(detectInstalls("git status")).toHaveLength(0)
  })

  it("returns empty for npm run dev (run is not install)", () => {
    expect(detectInstalls("npm run dev")).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 4. Quoted command — trailing quote blocks the terminator set
// ---------------------------------------------------------------------------
describe("quoted command matching", () => {
  it('does not match echo "npm install" (trailing quote is not a terminator)', () => {
    const results = detectInstalls('echo "npm install"')
    expect(results).toHaveLength(0)
  })

  it("matches echo npm install (no trailing quote)", () => {
    const results = detectInstalls("echo npm install")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("npm/yarn/pnpm/bun")
  })
})

// ---------------------------------------------------------------------------
// 5. Commands with shell operators
// ---------------------------------------------------------------------------
describe("commands with shell operators", () => {
  it("detects npm install piped to tee", () => {
    const results = detectInstalls("npm install | tee log.txt")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("npm/yarn/pnpm/bun")
  })

  it("detects npm install followed by semicolon", () => {
    const results = detectInstalls("npm install; echo done")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("npm/yarn/pnpm/bun")
  })

  it("detects npm install followed by &&", () => {
    const results = detectInstalls("npm install && npm test")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("npm/yarn/pnpm/bun")
  })
})

// ---------------------------------------------------------------------------
// 6. Returned objects contain the original command string
// ---------------------------------------------------------------------------
describe("returned object shape", () => {
  it("includes the original command string", () => {
    const command = "cargo build --release"
    const results = detectInstalls(command)
    expect(results).toHaveLength(1)
    expect(results[0].command).toBe(command)
  })

  it("includes the correct ecosystem config reference", () => {
    const results = detectInstalls("pip install flask")
    expect(results).toHaveLength(1)
    expect(results[0].ecosystem.name).toBe("pip/poetry/pipenv/uv")
    expect(results[0].ecosystem.installPattern).toBeInstanceOf(RegExp)
    expect(Array.isArray(results[0].ecosystem.lockfiles)).toBe(true)
    expect(Array.isArray(results[0].ecosystem.scanPasses)).toBe(true)
  })
})
