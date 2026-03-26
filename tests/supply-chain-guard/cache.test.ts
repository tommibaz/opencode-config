import { describe, expect, it, beforeEach, afterAll } from "bun:test"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import {
  type CacheEntry,
  type Cache,
  loadCache,
  saveCache,
  isCacheHit,
  evictStaleEntries,
} from "../../plugins/supply-chain-guard/cache.ts"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "scg-cache-test-"))
}

function makeEntry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    lockfileHash: sha256("lockfile-v1"),
    recipesHash: sha256("recipes-v1"),
    findingsCount: 5,
    scannedAt: new Date().toISOString().split("T")[0],
    ecosystem: "npm/yarn/pnpm/bun",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Temp dirs are tracked and cleaned up after all tests
// ---------------------------------------------------------------------------

const tmpDirs: string[] = []

function freshCacheFile(): string {
  const dir = makeTmpDir()
  tmpDirs.push(dir)
  return path.join(dir, "cache.json")
}

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

// ===========================================================================
// Migrated tests (from tests/cache-test.ts, rewritten with describe/it/expect)
// ===========================================================================

describe("loadCache / saveCache", () => {
  // 1
  it("returns empty object when file does not exist", async () => {
    const cacheFile = freshCacheFile()
    const result = await loadCache(cacheFile)
    expect(result).toEqual({})
  })

  // 2
  it("write + read roundtrip preserves data", async () => {
    const cacheFile = freshCacheFile()
    const entry = makeEntry()
    const cache: Cache = { "/project::npm/yarn/pnpm/bun": entry }

    await saveCache(cache, cacheFile)
    const reloaded = await loadCache(cacheFile)
    expect(reloaded).toEqual(cache)
  })

  // 7
  it("multiple ecosystems coexist in same cache", async () => {
    const cacheFile = freshCacheFile()
    const cache: Cache = {
      "/project::npm/yarn/pnpm/bun": makeEntry(),
      "/project::composer": makeEntry({
        lockfileHash: sha256("composer-lock-v1"),
        findingsCount: 2,
        ecosystem: "composer",
      }),
    }

    await saveCache(cache, cacheFile)
    const reloaded = await loadCache(cacheFile)

    expect(Object.keys(reloaded)).toHaveLength(2)
    expect(reloaded["/project::npm/yarn/pnpm/bun"]?.findingsCount).toBe(5)
    expect(reloaded["/project::composer"]?.findingsCount).toBe(2)
  })

  // 8
  it("findings count reflects sum of passes", async () => {
    const cacheFile = freshCacheFile()
    const totalFindings = 3 + 4 // deps pass + source pass
    const cache: Cache = {
      "/project::npm/yarn/pnpm/bun": makeEntry({ findingsCount: totalFindings }),
    }

    await saveCache(cache, cacheFile)
    const reloaded = await loadCache(cacheFile)
    expect(reloaded["/project::npm/yarn/pnpm/bun"]?.findingsCount).toBe(7)
  })

  // 9
  it("old entries without ecosystem field load OK", async () => {
    const cacheFile = freshCacheFile()
    const rawCache: Record<string, unknown> = {
      "/old-project": {
        lockfileHash: "abc123",
        recipesHash: "def456",
        findingsCount: 1,
        scannedAt: "2026-01-01",
        // no ecosystem field
      },
      "/project::npm/yarn/pnpm/bun": makeEntry({ findingsCount: 7 }),
    }
    fs.writeFileSync(cacheFile, JSON.stringify(rawCache, null, 2), "utf8")

    const loaded = await loadCache(cacheFile)
    expect(loaded["/old-project"]?.findingsCount).toBe(1)
    expect(loaded["/project::npm/yarn/pnpm/bun"]?.findingsCount).toBe(7)
  })

  // 15
  it("handles corrupt/invalid JSON gracefully (returns empty)", async () => {
    const cacheFile = freshCacheFile()
    fs.writeFileSync(cacheFile, "NOT VALID JSON {{{{", "utf8")

    const result = await loadCache(cacheFile)
    expect(result).toEqual({})
  })

  // 16
  it("saveCache does not throw on write failure (invalid path)", async () => {
    const badPath = "/nonexistent/deeply/nested/dir/cache.json"
    const cache: Cache = { key: makeEntry() }

    // Should not throw
    await expect(saveCache(cache, badPath)).resolves.toBeUndefined()
  })
})

// ===========================================================================
// Cache-hit inline check (migrated)
// ===========================================================================

describe("cache hit/miss (inline logic, migrated)", () => {
  const lockHash = sha256("lockfile-v1")
  const recipesHash = sha256("recipes-v1")
  const cached = makeEntry({ lockfileHash: lockHash, recipesHash })

  // 3
  it("cache hit when nothing changed (all 4 conditions true)", () => {
    const hit = isCacheHit(cached, lockHash, recipesHash, lockHash)
    expect(hit).toBe(true)
  })

  // 4
  it("cache miss when lockfile changed", () => {
    const newLock = sha256("lockfile-v2")
    const hit = isCacheHit(cached, newLock, recipesHash, lockHash)
    expect(hit).toBe(false)
  })

  // 5
  it("cache miss when recipes changed", () => {
    const newRecipes = sha256("recipes-v2")
    const hit = isCacheHit(cached, lockHash, newRecipes, lockHash)
    expect(hit).toBe(false)
  })

  // 6
  it("cache miss when before != after (even if after matches cache)", () => {
    const lockBefore = sha256("lockfile-v0")
    const hit = isCacheHit(cached, lockHash, recipesHash, lockBefore)
    expect(hit).toBe(false)
  })
})

// ===========================================================================
// isCacheHit — pure function (new tests)
// ===========================================================================

describe("isCacheHit", () => {
  const lockHash = sha256("lockfile-v1")
  const recipesHash = sha256("recipes-v1")
  const cached = makeEntry({ lockfileHash: lockHash, recipesHash })

  // 10
  it("returns true when all conditions match", () => {
    expect(isCacheHit(cached, lockHash, recipesHash, lockHash)).toBe(true)
  })

  // 11
  it("returns false when cached is undefined", () => {
    expect(isCacheHit(undefined, lockHash, recipesHash, lockHash)).toBe(false)
  })

  // 12
  it("returns false when lockfileHashAfter doesn't match cached", () => {
    const differentAfter = sha256("lockfile-v99")
    expect(isCacheHit(cached, differentAfter, recipesHash, differentAfter)).toBe(false)
  })

  // 13
  it("returns false when recipesHash doesn't match", () => {
    const differentRecipes = sha256("recipes-v99")
    expect(isCacheHit(cached, lockHash, differentRecipes, lockHash)).toBe(false)
  })

  // 14
  it("returns false when lockfileHashBefore !== lockfileHashAfter", () => {
    const lockBefore = sha256("lockfile-v0")
    expect(isCacheHit(cached, lockHash, recipesHash, lockBefore)).toBe(false)
  })
})

// ===========================================================================
// evictStaleEntries (new tests)
// ===========================================================================

describe("evictStaleEntries", () => {
  function daysAgo(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().split("T")[0]
  }

  // 17
  it("removes entries older than maxAgeDays", () => {
    const cache: Cache = {
      old: makeEntry({ scannedAt: daysAgo(31) }),
      fresh: makeEntry({ scannedAt: daysAgo(1) }),
    }
    const result = evictStaleEntries(cache, 30)
    expect(result).not.toHaveProperty("old")
    expect(result).toHaveProperty("fresh")
  })

  // 18
  it("keeps entries newer than maxAgeDays", () => {
    const cache: Cache = {
      a: makeEntry({ scannedAt: daysAgo(5) }),
      b: makeEntry({ scannedAt: daysAgo(10) }),
    }
    const result = evictStaleEntries(cache, 30)
    expect(Object.keys(result)).toHaveLength(2)
  })

  // 19
  it("handles entries with missing/malformed scannedAt gracefully", () => {
    const cache: Cache = {
      malformed: makeEntry({ scannedAt: "not-a-date" }),
      missing: makeEntry({ scannedAt: "" }),
      valid: makeEntry({ scannedAt: daysAgo(1) }),
    }
    // Should not throw
    const result = evictStaleEntries(cache, 30)
    // Malformed entries are evicted (treated as stale)
    expect(result).not.toHaveProperty("malformed")
    expect(result).not.toHaveProperty("missing")
    expect(result).toHaveProperty("valid")
  })
})
