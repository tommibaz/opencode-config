import type { Plugin } from "@opencode-ai/plugin"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

/**
 * Supply Chain Guard Plugin
 *
 * Intercepts bash tool calls that run package manager install/update commands
 * and automatically runs Semgrep security recipes on node_modules afterward.
 * Uses lockfile + recipes hashing to skip scans when nothing changed.
 *
 * Detects: npm, pnpm, yarn, bun, npx, bunx + install/add/ci/update/upgrade/i
 */

const PKG_INSTALL_PATTERN =
  /\b(npm|pnpm|yarn|bun|npx|bunx)\s+(?:(?:run|exec|dlx)\s+)?(?:install|add|ci|update|upgrade|i)(?:\s|$|;|&&|\|)/

const CONFIG_DIR =
  process.env.OPENCODE_CONFIG_DIR ||
  path.join(process.env.HOME || "~", ".config", "opencode")
const SEMGREP_RECIPES = path.join(CONFIG_DIR, "semgrep", "recipes")
const CACHE_FILE = path.join(CONFIG_DIR, ".supply-chain-guard-cache.json")

const LOCKFILES = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
]

// --- Hashing utilities ---

function md5(content: string | Buffer): string {
  return createHash("md5").update(content).digest("hex")
}

function hashFile(filePath: string): string | null {
  try {
    return md5(fs.readFileSync(filePath))
  } catch {
    return null
  }
}

function hashLockfiles(workdir: string): string | null {
  for (const lockfile of LOCKFILES) {
    const h = hashFile(path.join(workdir, lockfile))
    if (h) return h
  }
  return null
}

function hashRecipes(): string {
  try {
    const files = fs
      .readdirSync(SEMGREP_RECIPES)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort()
    const combined = files
      .map((f) => fs.readFileSync(path.join(SEMGREP_RECIPES, f), "utf8"))
      .join("")
    return md5(combined)
  } catch {
    return "no-recipes"
  }
}

// --- Cache persistence ---

interface CacheEntry {
  lockfileHash: string
  recipesHash: string
  findingsCount: number
  scannedAt: string
}

type Cache = Record<string, CacheEntry>

function loadCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
  } catch {
    return {}
  }
}

function saveCache(cache: Cache): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8")
  } catch {
    // best-effort
  }
}

// --- Plugin ---

// Track bash commands by callID so the after-hook knows what was executed
const pendingCalls = new Map<
  string,
  { command: string; cwd?: string; lockfileHashBefore: string | null }
>()

export const SupplyChainGuard: Plugin = async (ctx) => {
  const log = async (level: string, message: string) => {
    try {
      await ctx.client.app.log({
        body: { service: "supply-chain-guard", level, message },
      })
    } catch {
      // logging is best-effort
    }
  }

  await log("info", "Supply Chain Guard plugin loaded")

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return

      const command: string = output.args?.command ?? ""
      if (!command) return

      if (PKG_INSTALL_PATTERN.test(command)) {
        const workdir = output.args?.workdir || ctx.directory
        pendingCalls.set(input.callID, {
          command,
          cwd: workdir,
          lockfileHashBefore: hashLockfiles(workdir),
        })
        await log(
          "info",
          `Detected package install command: ${command.substring(0, 120)}`,
        )
      }
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool !== "bash") return

      const pending = pendingCalls.get(input.callID)
      if (!pending) return
      pendingCalls.delete(input.callID)

      const workdir = pending.cwd || ctx.directory
      const lockfileHashAfter = hashLockfiles(workdir)
      const currentRecipesHash = hashRecipes()

      // Check cache: skip scan if lockfile and recipes unchanged
      const cache = loadCache()
      const cacheKey = workdir
      const cached = cache[cacheKey]

      if (
        cached &&
        cached.lockfileHash === lockfileHashAfter &&
        cached.recipesHash === currentRecipesHash &&
        pending.lockfileHashBefore === lockfileHashAfter
      ) {
        await log(
          "info",
          `Skipping scan for ${workdir}: lockfile and recipes unchanged (cached ${cached.findingsCount} findings from ${cached.scannedAt})`,
        )
        output.output =
          (output.output || "") +
          `\n\n--- Supply Chain Guard ---\nSkipped: no changes detected (lockfile + recipes unchanged). Last scan: ${cached.findingsCount} finding(s) on ${cached.scannedAt}.\n`
        return
      }

      await log(
        "info",
        `Running Semgrep supply chain scan in ${workdir}/node_modules`,
      )

      try {
        const result =
          await ctx.$`semgrep --config ${SEMGREP_RECIPES} --no-git-ignore --exclude='!node_modules' --json node_modules/`
            .cwd(workdir)
            .quiet()
            .nothrow()

        const stdout = result.stdout.toString().trim()
        let summary: string
        let findingsCount = 0

        if (!stdout) {
          summary =
            "\n\n--- Supply Chain Guard ---\nSemgrep scan completed: no output (node_modules may not exist).\n"
        } else {
          try {
            const json = JSON.parse(stdout)
            const findings = json.results || []
            findingsCount = findings.length

            if (findings.length === 0) {
              summary =
                "\n\n--- Supply Chain Guard ---\nSemgrep scan completed: 0 findings. node_modules looks clean.\n"
            } else {
              const lines = [
                `\n\n--- Supply Chain Guard ---`,
                `Semgrep scan completed: ${findings.length} finding(s) in node_modules!\n`,
              ]

              // Group by rule
              const byRule = new Map<string, number>()
              for (const f of findings) {
                const rule = f.check_id || "unknown"
                byRule.set(rule, (byRule.get(rule) || 0) + 1)
              }
              for (const [rule, count] of byRule) {
                lines.push(`  ${rule}: ${count} hit(s)`)
              }

              // Show first 10 details
              const shown = findings.slice(0, 10)
              lines.push("")
              for (const f of shown) {
                const file = f.path || "?"
                const line = f.start?.line || "?"
                const rule = f.check_id || "?"
                const snippet = (f.extra?.lines || "").substring(0, 120)
                lines.push(`  [${rule}] ${file}:${line}`)
                if (snippet) lines.push(`    ${snippet}`)
              }
              if (findings.length > 10) {
                lines.push(
                  `  ... and ${findings.length - 10} more findings.`,
                )
              }
              lines.push("")

              summary = lines.join("\n")
            }
          } catch {
            summary = `\n\n--- Supply Chain Guard ---\nSemgrep output:\n${stdout.substring(0, 2000)}\n`
          }
        }

        // Update cache
        if (lockfileHashAfter) {
          cache[cacheKey] = {
            lockfileHash: lockfileHashAfter,
            recipesHash: currentRecipesHash,
            findingsCount,
            scannedAt: new Date().toISOString().split("T")[0],
          }
          saveCache(cache)
        }

        output.output = (output.output || "") + summary
      } catch (e: any) {
        const errMsg = e?.message || String(e)
        await log("warn", `Semgrep scan failed: ${errMsg}`)
        output.output =
          (output.output || "") +
          `\n\n--- Supply Chain Guard ---\nSemgrep scan failed: ${errMsg.substring(0, 500)}\n`
      }
    },
  }
}
