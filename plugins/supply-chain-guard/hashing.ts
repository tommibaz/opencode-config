import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

export async function hashContent(content: string | Buffer): Promise<string> {
  return createHash("sha256").update(content).digest("hex")
}

export async function hashFile(filePath: string): Promise<string | null> {
  try {
    const data = await fs.readFile(filePath)
    return hashContent(data)
  } catch {
    return null
  }
}

export async function hashLockfiles(
  workdir: string,
  lockfiles: string[],
): Promise<string | null> {
  for (const lockfile of lockfiles) {
    const h = await hashFile(path.join(workdir, lockfile))
    if (h) return h
  }
  return null
}

export async function hashRecipes(recipesDir: string): Promise<string> {
  try {
    const entries = await fs.readdir(recipesDir)
    const yamlFiles = entries
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort()
    const contents = await Promise.all(
      yamlFiles.map((f) => fs.readFile(path.join(recipesDir, f), "utf8")),
    )
    return hashContent(contents.join(""))
  } catch {
    return "no-recipes"
  }
}
