import { describe, expect, it } from "bun:test"
import {
  ECOSYSTEMS,
  type EcosystemConfig,
  type ScanPass,
} from "../../plugins/supply-chain-guard/ecosystems.ts"

// ---------------------------------------------------------------------------
// Helper: find ecosystem by name substring
// ---------------------------------------------------------------------------
function findEcosystem(nameFragment: string): EcosystemConfig {
  const eco = ECOSYSTEMS.find((e) =>
    e.name.toLowerCase().includes(nameFragment.toLowerCase()),
  )
  if (!eco) throw new Error(`No ecosystem matching "${nameFragment}"`)
  return eco
}

// ---------------------------------------------------------------------------
// 1. ECOSYSTEMS is a non-empty array
// ---------------------------------------------------------------------------
describe("ECOSYSTEMS array", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(ECOSYSTEMS)).toBe(true)
    expect(ECOSYSTEMS.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 2. Every entry has required fields
// ---------------------------------------------------------------------------
describe("EcosystemConfig shape", () => {
  it.each(ECOSYSTEMS)(
    "$name has required fields",
    (eco: EcosystemConfig) => {
      expect(typeof eco.name).toBe("string")
      expect(eco.name.length).toBeGreaterThan(0)

      expect(eco.installPattern).toBeInstanceOf(RegExp)

      expect(Array.isArray(eco.lockfiles)).toBe(true)
      expect(eco.lockfiles.length).toBeGreaterThan(0)
      eco.lockfiles.forEach((lf) => expect(typeof lf).toBe("string"))

      expect(Array.isArray(eco.scanPasses)).toBe(true)
      expect(eco.scanPasses.length).toBeGreaterThan(0)
    },
  )
})

// ---------------------------------------------------------------------------
// 3. Every scanPasses entry has label, target, flags
// ---------------------------------------------------------------------------
describe("ScanPass shape", () => {
  const allPasses: Array<{ ecoName: string; pass: ScanPass }> = ECOSYSTEMS.flatMap(
    (eco) => eco.scanPasses.map((pass) => ({ ecoName: eco.name, pass })),
  )

  it.each(allPasses)(
    "$ecoName / $pass.label has required fields",
    ({ pass }) => {
      expect(typeof pass.label).toBe("string")
      expect(pass.label.length).toBeGreaterThan(0)

      expect(typeof pass.target).toBe("string")
      expect(pass.target.length).toBeGreaterThan(0)

      expect(Array.isArray(pass.flags)).toBe(true)
      pass.flags.forEach((f) => expect(typeof f).toBe("string"))
    },
  )
})

// ---------------------------------------------------------------------------
// 4. Positive pattern matching per ecosystem
// ---------------------------------------------------------------------------
describe("positive pattern matching", () => {
  const cases: Array<[string, string]> = [
    ["npm install", "npm"],
    ["composer require", "composer"],
    ["cargo build", "cargo"],
    ["pip install flask", "pip"],
    ["go get", "go modules"],
    ["dotnet restore", "dotnet"],
    ["bundle install", "bundler"],
    ["mvn install", "maven"],
    ["conan install", "conan"],
  ]

  it.each(cases)(
    '"%s" matches %s ecosystem',
    (command: string, ecoFragment: string) => {
      const eco = findEcosystem(ecoFragment)
      expect(eco.installPattern.test(command)).toBe(true)
    },
  )
})

// ---------------------------------------------------------------------------
// 5. Multi-word commands
// ---------------------------------------------------------------------------
describe("multi-word commands", () => {
  const cases: Array<[string, string]> = [
    ["npm ci", "npm"],
    ["yarn add lodash", "npm"],
    ["pnpm install", "npm"],
    ["bun add express", "npm"],
  ]

  it.each(cases)(
    '"%s" matches %s ecosystem',
    (command: string, ecoFragment: string) => {
      const eco = findEcosystem(ecoFragment)
      expect(eco.installPattern.test(command)).toBe(true)
    },
  )
})

// ---------------------------------------------------------------------------
// 6. Negative cases
// ---------------------------------------------------------------------------
describe("negative cases", () => {
  it('"npm run dev" does NOT match JS/TS', () => {
    const eco = findEcosystem("npm")
    expect(eco.installPattern.test("npm run dev")).toBe(false)
  })

  it('"npm start" does NOT match JS/TS', () => {
    const eco = findEcosystem("npm")
    expect(eco.installPattern.test("npm start")).toBe(false)
  })

  it('"cargo run" does NOT match Rust', () => {
    const eco = findEcosystem("cargo")
    expect(eco.installPattern.test("cargo run")).toBe(false)
  })

  it('"go run main.go" does NOT match Go', () => {
    const eco = findEcosystem("go modules")
    expect(eco.installPattern.test("go run main.go")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 7. Word boundary — partial word must NOT match
// ---------------------------------------------------------------------------
describe("word boundary", () => {
  it('"mynpm install" does NOT match JS/TS', () => {
    const eco = findEcosystem("npm")
    expect(eco.installPattern.test("mynpm install")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 8. Command terminators — commands with ; && | should still match
// ---------------------------------------------------------------------------
describe("command terminators", () => {
  const cases: Array<[string]> = [
    ["npm install;"],
    ["npm install && echo done"],
    ["npm install | grep"],
  ]

  it.each(cases)('"%s" matches JS/TS', (command: string) => {
    const eco = findEcosystem("npm")
    expect(eco.installPattern.test(command)).toBe(true)
  })
})
