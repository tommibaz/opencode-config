import fs from "node:fs/promises"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheEntry {
  lockfileHash: string
  recipesHash: string
  findingsCount: number
  scannedAt: string
  ecosystem: string
}

export type Cache = Record<string, CacheEntry>

// ---------------------------------------------------------------------------
// I/O — the only functions that touch the filesystem
// ---------------------------------------------------------------------------

export async function loadCache(cacheFilePath: string): Promise<Cache> {
  try {
    const raw = await fs.readFile(cacheFilePath, "utf8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function saveCache(
  cache: Cache,
  cacheFilePath: string,
): Promise<void> {
  try {
    await fs.writeFile(cacheFilePath, JSON.stringify(cache, null, 2), "utf8")
  } catch {
    // best-effort — caller should not break on write failure
  }
}

// ---------------------------------------------------------------------------
// Pure functions — no I/O
// ---------------------------------------------------------------------------

export function isCacheHit(
  cached: CacheEntry | undefined,
  lockfileHashAfter: string | null,
  recipesHash: string,
  lockfileHashBefore: string | null,
): boolean {
  if (!cached) return false
  return (
    cached.lockfileHash === lockfileHashAfter &&
    cached.recipesHash === recipesHash &&
    lockfileHashBefore === lockfileHashAfter
  )
}

export function evictStaleEntries(cache: Cache, maxAgeDays: number): Cache {
  const now = Date.now()
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
  const result: Cache = {}

  for (const [key, entry] of Object.entries(cache)) {
    const scannedMs = Date.parse(entry.scannedAt)
    if (Number.isNaN(scannedMs)) continue // malformed → evict
    if (now - scannedMs > maxAgeMs) continue // stale → evict
    result[key] = entry
  }

  return result
}
