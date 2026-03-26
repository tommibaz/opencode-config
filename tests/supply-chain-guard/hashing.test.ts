import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { hashContent, hashFile, hashLockfiles, hashRecipes } from "../../plugins/supply-chain-guard/hashing.ts"

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hashing-test-"))
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe("hashContent", () => {
  test("returns deterministic SHA-256 hex for string input", async () => {
    const result = await hashContent("hello")
    expect(result).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
  })

  test("Buffer input produces same hash as string for same content", async () => {
    const fromString = await hashContent("hello")
    const fromBuffer = await hashContent(Buffer.from("hello"))
    expect(fromBuffer).toBe(fromString)
  })
})

describe("hashFile", () => {
  test("returns hash string for an existing file", async () => {
    const filePath = path.join(tmpDir, "existing.txt")
    fs.writeFileSync(filePath, "hello")
    const result = await hashFile(filePath)
    expect(result).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
  })

  test("returns null for a non-existent path", async () => {
    const result = await hashFile(path.join(tmpDir, "does-not-exist.txt"))
    expect(result).toBeNull()
  })
})

describe("hashLockfiles", () => {
  test("returns hash of the FIRST found lockfile", async () => {
    const dir = path.join(tmpDir, "lockfiles-first")
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "a.lock"), "content-a")
    fs.writeFileSync(path.join(dir, "b.lock"), "content-b")

    const expectedHash = await hashContent("content-a")
    const result = await hashLockfiles(dir, ["a.lock", "b.lock"])
    expect(result).toBe(expectedHash)
  })

  test("skips missing files and returns hash of first existing one", async () => {
    const dir = path.join(tmpDir, "lockfiles-skip")
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "b.lock"), "content-b")

    const expectedHash = await hashContent("content-b")
    const result = await hashLockfiles(dir, ["missing.lock", "b.lock"])
    expect(result).toBe(expectedHash)
  })

  test("returns null when no lockfiles exist", async () => {
    const dir = path.join(tmpDir, "lockfiles-empty")
    fs.mkdirSync(dir, { recursive: true })

    const result = await hashLockfiles(dir, ["x.lock", "y.lock"])
    expect(result).toBeNull()
  })
})

describe("hashRecipes", () => {
  test("returns deterministic hash for a directory of .yaml files", async () => {
    const dir = path.join(tmpDir, "recipes-basic")
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "rule1.yaml"), "rule-content-1")
    fs.writeFileSync(path.join(dir, "rule2.yml"), "rule-content-2")

    const expectedHash = await hashContent("rule-content-1rule-content-2")
    const result = await hashRecipes(dir)
    expect(result).toBe(expectedHash)
  })

  test('returns "no-recipes" when directory does not exist', async () => {
    const result = await hashRecipes(path.join(tmpDir, "nonexistent-dir"))
    expect(result).toBe("no-recipes")
  })

  test("sorts files before hashing", async () => {
    const dirAlpha = path.join(tmpDir, "recipes-alpha")
    fs.mkdirSync(dirAlpha, { recursive: true })
    fs.writeFileSync(path.join(dirAlpha, "a.yaml"), "aaa")
    fs.writeFileSync(path.join(dirAlpha, "b.yaml"), "bbb")

    const dirReverse = path.join(tmpDir, "recipes-reverse")
    fs.mkdirSync(dirReverse, { recursive: true })
    fs.writeFileSync(path.join(dirReverse, "b.yaml"), "bbb")
    fs.writeFileSync(path.join(dirReverse, "a.yaml"), "aaa")

    const hashAlpha = await hashRecipes(dirAlpha)
    const hashReverse = await hashRecipes(dirReverse)
    expect(hashReverse).toBe(hashAlpha)
  })

  test("ignores non-yaml files in the directory", async () => {
    const dir = path.join(tmpDir, "recipes-filter")
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "rule.yaml"), "yaml-content")
    fs.writeFileSync(path.join(dir, "readme.md"), "markdown-content")
    fs.writeFileSync(path.join(dir, "data.json"), "json-content")

    const expectedHash = await hashContent("yaml-content")
    const result = await hashRecipes(dir)
    expect(result).toBe(expectedHash)
  })
})
