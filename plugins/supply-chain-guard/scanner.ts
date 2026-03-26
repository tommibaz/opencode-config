import fs from "node:fs/promises"
import path from "node:path"
import type { ScanPass } from "./ecosystems.ts"
import { formatFindings } from "./formatting.ts"

export interface ShellResult {
  stdout: string
  exitCode: number
}

export interface ShellArgs {
  command: string[]
  workdir: string
}

export type ShellExecutor = (args: ShellArgs) => Promise<ShellResult>

export interface ScanResult {
  outputs: string[]
  totalFindings: number
}

interface RunScanPassesInput {
  scanPasses: ScanPass[]
  workdir: string
  recipesDir: string
  ecoName: string
  shell: ShellExecutor
  log: (level: string, message: string) => Promise<void>
}

const MAX_ERROR_LENGTH = 500

async function targetExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function buildCommand(recipesDir: string, pass: ScanPass): string[] {
  const cmd = ["semgrep", "--config", recipesDir]
  for (const flag of pass.flags) {
    if (flag) cmd.push(flag)
  }
  cmd.push("--json", pass.target)
  return cmd
}

export async function runScanPasses(input: RunScanPassesInput): Promise<ScanResult> {
  const { scanPasses, workdir, recipesDir, ecoName, shell, log } = input
  const outputs: string[] = []
  let totalFindings = 0

  for (const pass of scanPasses) {
    const passLabel = `${ecoName} / ${pass.label}`
    const scanTargetPath = path.join(workdir, pass.target)

    if (!(await targetExists(scanTargetPath))) {
      await log(
        "info",
        `Scan target ${pass.target} does not exist in ${workdir}, skipping ${passLabel} scan`,
      )
      outputs.push(
        `\n\n--- Supply Chain Guard (${passLabel}) ---\nSkipped: ${pass.target} not found.\n`,
      )
      continue
    }

    await log(
      "info",
      `Running Semgrep supply chain scan for ${passLabel} in ${workdir}/${pass.target}`,
    )

    try {
      const command = buildCommand(recipesDir, pass)
      const result = await shell({ command, workdir })
      const stdout = result.stdout.trim()
      const { summary, count } = formatFindings(stdout, passLabel)
      totalFindings += count
      outputs.push(summary)
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      await log("warn", `Semgrep scan failed for ${passLabel}: ${errMsg}`)
      outputs.push(
        `\n\n--- Supply Chain Guard (${passLabel}) ---\nSemgrep scan failed: ${errMsg.substring(0, MAX_ERROR_LENGTH)}\n`,
      )
    }
  }

  return { outputs, totalFindings }
}
