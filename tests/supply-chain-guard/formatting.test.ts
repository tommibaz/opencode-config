import { describe, test, expect } from "bun:test"
import { formatFindings } from "../../plugins/supply-chain-guard/formatting.ts"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(overrides: Record<string, unknown> = {}) {
  return {
    check_id: "rules.backdoor-detect",
    path: "node_modules/evil/index.js",
    start: { line: 42 },
    extra: { lines: "const x = require('http')" },
    ...overrides,
  }
}

function makeStdout(results: unknown[]) {
  return JSON.stringify({ results })
}

// ---------------------------------------------------------------------------
// 1. Empty stdout → "no output", count = 0
// ---------------------------------------------------------------------------
describe("empty stdout", () => {
  test("returns summary with 'no output' and count 0 for empty string", () => {
    const result = formatFindings("", "npm/yarn")
    expect(result.count).toBe(0)
    expect(result.summary).toContain("no output")
  })
})

// ---------------------------------------------------------------------------
// 2. Valid JSON with empty results → "0 findings", count = 0
// ---------------------------------------------------------------------------
describe("zero findings", () => {
  test("returns count 0 and summary with '0 findings'", () => {
    const result = formatFindings(makeStdout([]), "composer")
    expect(result.count).toBe(0)
    expect(result.summary).toContain("0 findings")
  })
})

// ---------------------------------------------------------------------------
// 3. Valid JSON with { results: [] } → "Dependencies look clean"
// ---------------------------------------------------------------------------
describe("clean dependencies message", () => {
  test("summary contains 'Dependencies look clean' for empty results", () => {
    const result = formatFindings(makeStdout([]), "bundler")
    expect(result.summary).toContain("Dependencies look clean")
  })
})

// ---------------------------------------------------------------------------
// 4. Valid JSON with 1 finding → count = 1, "1 finding(s)"
// ---------------------------------------------------------------------------
describe("single finding", () => {
  test("returns count 1 and summary containing '1 finding(s)'", () => {
    const result = formatFindings(makeStdout([makeFinding()]), "npm/yarn")
    expect(result.count).toBe(1)
    expect(result.summary).toContain("1 finding(s)")
  })
})

// ---------------------------------------------------------------------------
// 5. Grouping: 3 findings, 2 same rule → correct hit counts
// ---------------------------------------------------------------------------
describe("grouping by rule", () => {
  test("groups findings by check_id with correct counts", () => {
    const findings = [
      makeFinding({ check_id: "rules.backdoor" }),
      makeFinding({ check_id: "rules.backdoor" }),
      makeFinding({ check_id: "rules.exfiltration" }),
    ]
    const result = formatFindings(makeStdout(findings), "npm")
    expect(result.count).toBe(3)
    expect(result.summary).toContain("rules.backdoor: 2 hit(s)")
    expect(result.summary).toContain("rules.exfiltration: 1 hit(s)")
  })
})

// ---------------------------------------------------------------------------
// 6. Finding details include file path, line number, rule name
// ---------------------------------------------------------------------------
describe("finding details", () => {
  test("includes file path, line number, and rule in output", () => {
    const finding = makeFinding({
      check_id: "rules.network-call",
      path: "vendor/lib/conn.php",
      start: { line: 99 },
    })
    const result = formatFindings(makeStdout([finding]), "composer")
    expect(result.summary).toContain("[rules.network-call]")
    expect(result.summary).toContain("vendor/lib/conn.php:99")
  })
})

// ---------------------------------------------------------------------------
// 7. Snippet is included when extra.lines is present
// ---------------------------------------------------------------------------
describe("snippet inclusion", () => {
  test("includes snippet from extra.lines", () => {
    const finding = makeFinding({
      extra: { lines: "fetch('https://evil.com')" },
    })
    const result = formatFindings(makeStdout([finding]), "npm")
    expect(result.summary).toContain("fetch('https://evil.com')")
  })
})

// ---------------------------------------------------------------------------
// 8. Snippet is truncated at 120 characters
// ---------------------------------------------------------------------------
describe("snippet truncation", () => {
  test("truncates snippet to 120 characters", () => {
    const longSnippet = "A".repeat(200)
    const finding = makeFinding({ extra: { lines: longSnippet } })
    const result = formatFindings(makeStdout([finding]), "npm")
    expect(result.summary).toContain("A".repeat(120))
    expect(result.summary).not.toContain("A".repeat(121))
  })
})

// ---------------------------------------------------------------------------
// 9. More than 10 findings → "and X more findings"
// ---------------------------------------------------------------------------
describe("overflow message", () => {
  test("shows 'and X more findings' when more than 10 findings exist", () => {
    const findings = Array.from({ length: 13 }, (_, i) =>
      makeFinding({ check_id: `rule-${i}`, path: `file-${i}.js` }),
    )
    const result = formatFindings(makeStdout(findings), "npm")
    expect(result.count).toBe(13)
    expect(result.summary).toContain("and 3 more findings")
  })
})

// ---------------------------------------------------------------------------
// 10. Exactly 10 findings → no "and X more" message
// ---------------------------------------------------------------------------
describe("exactly 10 findings", () => {
  test("does NOT show overflow message for exactly 10 findings", () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({ check_id: `rule-${i}`, path: `file-${i}.js` }),
    )
    const result = formatFindings(makeStdout(findings), "npm")
    expect(result.count).toBe(10)
    expect(result.summary).not.toContain("more findings")
  })
})

// ---------------------------------------------------------------------------
// 11. Invalid JSON → raw output fallback, count = 0
// ---------------------------------------------------------------------------
describe("invalid JSON fallback", () => {
  test("falls back to raw output with count 0", () => {
    const result = formatFindings("not valid json {{{", "pip")
    expect(result.count).toBe(0)
    expect(result.summary).toContain("Semgrep output:")
    expect(result.summary).toContain("not valid json")
  })
})

// ---------------------------------------------------------------------------
// 12. Raw output fallback truncates at 2000 characters
// ---------------------------------------------------------------------------
describe("raw output truncation", () => {
  test("truncates raw output to 2000 characters", () => {
    const longOutput = "X".repeat(3000)
    const result = formatFindings(longOutput, "pip")
    expect(result.summary).toContain("X".repeat(2000))
    expect(result.summary).not.toContain("X".repeat(2001))
  })
})

// ---------------------------------------------------------------------------
// 13. Missing fields → uses "?" fallback
// ---------------------------------------------------------------------------
describe("missing fields fallback", () => {
  test("uses '?' for missing path, start.line, and check_id", () => {
    const finding = { extra: { lines: "some code" } }
    const result = formatFindings(makeStdout([finding]), "cargo")
    expect(result.summary).toContain("[?]")
    expect(result.summary).toContain("?:?")
  })
})

// ---------------------------------------------------------------------------
// 14. Summary always includes ecoName in the header
// ---------------------------------------------------------------------------
describe("ecoName in header", () => {
  test("includes ecoName in header for empty stdout", () => {
    const result = formatFindings("", "go modules")
    expect(result.summary).toContain("Supply Chain Guard (go modules)")
  })

  test("includes ecoName in header for valid findings", () => {
    const result = formatFindings(makeStdout([makeFinding()]), "composer / deps")
    expect(result.summary).toContain("Supply Chain Guard (composer / deps)")
  })

  test("includes ecoName in header for invalid JSON", () => {
    const result = formatFindings("broken", "dotnet")
    expect(result.summary).toContain("Supply Chain Guard (dotnet)")
  })
})

// ---------------------------------------------------------------------------
// 15. Missing extra.lines → no snippet line for that finding
// ---------------------------------------------------------------------------
describe("missing snippet", () => {
  test("does not add snippet line when extra.lines is absent", () => {
    const finding = makeFinding({ extra: {} })
    const result = formatFindings(makeStdout([finding]), "npm")
    const lines = result.summary.split("\n")
    const detailLine = lines.find((l) => l.includes("[rules.backdoor-detect]"))
    expect(detailLine).toBeDefined()
    const detailIdx = lines.indexOf(detailLine!)
    const nextLine = lines[detailIdx + 1]
    // Next line should NOT be an indented snippet (4 spaces)
    expect(nextLine?.startsWith("    ")).toBe(false)
  })

  test("does not add snippet line when extra is missing entirely", () => {
    const finding = { check_id: "rule.x", path: "a.js", start: { line: 1 } }
    const result = formatFindings(makeStdout([finding]), "npm")
    const lines = result.summary.split("\n")
    const detailLine = lines.find((l) => l.includes("[rule.x]"))
    expect(detailLine).toBeDefined()
    const detailIdx = lines.indexOf(detailLine!)
    const nextLine = lines[detailIdx + 1]
    expect(nextLine?.startsWith("    ")).toBe(false)
  })
})
