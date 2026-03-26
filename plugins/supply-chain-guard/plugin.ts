import type { Plugin } from "@opencode-ai/plugin"
import path from "node:path"
import { detectInstalls, type DetectedInstall } from "./detection.ts"
import { hashLockfiles, hashRecipes } from "./hashing.ts"
import {
  loadCache,
  saveCache,
  isCacheHit,
  evictStaleEntries,
} from "./cache.ts"
import { runScanPasses, type ShellExecutor } from "./scanner.ts"

const CACHE_MAX_AGE_DAYS = 90

interface PendingCall {
  detections: DetectedInstall[]
  cwd?: string
  lockfileHashesBefore: Map<string, string | null>
}

function resolveConfigDir(): string {
  if (process.env.OPENCODE_CONFIG) {
    return path.dirname(process.env.OPENCODE_CONFIG)
  }
  return path.join(process.env.HOME || "~", ".config", "opencode")
}

export const SupplyChainGuard: Plugin & {
  (ctx: Parameters<Plugin>[0], recipesDir: string, cacheFilePath: string): ReturnType<Plugin>
} = async (ctx, recipesDir?: string, cacheFilePath?: string) => {
  const configDir = resolveConfigDir()
  const recipes = recipesDir ?? path.join(configDir, "semgrep", "recipes")
  const cacheFile = cacheFilePath ?? path.join(configDir, ".supply-chain-guard-cache.json")
  const pendingCalls = new Map<string, PendingCall>()

  const log = async (level: string, message: string) => {
    try {
      await ctx.client.app.log({
        body: { service: "supply-chain-guard", level, message },
      })
    } catch {
      // best-effort
    }
  }

  const shell: ShellExecutor = async ({ command, workdir }) => {
    const cmd = command.map((c) => `'${c}'`).join(" ")
    const result = await ctx
      .$`sh -c ${cmd}`
      .cwd(workdir)
      .quiet()
      .nothrow()
    return {
      stdout: result.stdout.toString().trim(),
      exitCode: result.exitCode,
    }
  }

  await log("info", "Supply Chain Guard plugin loaded (multi-ecosystem)")

  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return

      const command: string = output.args?.command ?? ""
      if (!command) return

      const detections = detectInstalls(command)
      if (detections.length === 0) return

      const workdir = output.args?.workdir || ctx.directory

      const lockfileHashesBefore = new Map<string, string | null>()
      for (const det of detections) {
        lockfileHashesBefore.set(
          det.ecosystem.name,
          await hashLockfiles(workdir, det.ecosystem.lockfiles),
        )
      }

      pendingCalls.set(input.callID, {
        detections,
        cwd: workdir,
        lockfileHashesBefore,
      })

      const ecoNames = detections.map((d) => d.ecosystem.name).join(", ")
      await log(
        "info",
        `Detected install command for [${ecoNames}]: ${command.substring(0, 120)}`,
      )
    },

    "tool.execute.after": async (input, output) => {
      if (input.tool !== "bash") return

      const pending = pendingCalls.get(input.callID)
      if (!pending) return
      pendingCalls.delete(input.callID)

      const workdir = pending.cwd || ctx.directory
      const currentRecipesHash = await hashRecipes(recipes)
      let cache = await loadCache(cacheFile)
      cache = evictStaleEntries(cache, CACHE_MAX_AGE_DAYS)

      for (const det of pending.detections) {
        const eco = det.ecosystem
        const lockfileHashAfter = await hashLockfiles(workdir, eco.lockfiles)
        const lockfileHashBefore = pending.lockfileHashesBefore.get(eco.name) ?? null
        const cacheKey = `${workdir}::${eco.name}`
        const cached = cache[cacheKey]

        if (isCacheHit(cached, lockfileHashAfter, currentRecipesHash, lockfileHashBefore)) {
          await log(
            "info",
            `Skipping scan for ${eco.name} in ${workdir}: lockfile and recipes unchanged (cached ${cached.findingsCount} findings from ${cached.scannedAt})`,
          )
          output.output =
            (output.output || "") +
            `\n\n--- Supply Chain Guard (${eco.name}) ---\nSkipped: no changes detected (lockfile + recipes unchanged). Last scan: ${cached.findingsCount} finding(s) on ${cached.scannedAt}.\n`
          continue
        }

        const result = await runScanPasses({
          scanPasses: eco.scanPasses,
          workdir,
          recipesDir: recipes,
          ecoName: eco.name,
          shell,
          log,
        })

        for (const out of result.outputs) {
          output.output = (output.output || "") + out
        }

        if (lockfileHashAfter) {
          cache[cacheKey] = {
            lockfileHash: lockfileHashAfter,
            recipesHash: currentRecipesHash,
            findingsCount: result.totalFindings,
            scannedAt: new Date().toISOString().split("T")[0],
            ecosystem: eco.name,
          }
          await saveCache(cache, cacheFile)
        }
      }
    },
  }
}
