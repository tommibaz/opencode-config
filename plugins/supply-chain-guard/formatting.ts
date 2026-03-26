/**
 * Formats Semgrep scan output into a human-readable summary.
 */

const HEADER = (ecoName: string) => `\n\n--- Supply Chain Guard (${ecoName}) ---`
const MAX_SHOWN = 10
const MAX_SNIPPET = 120
const MAX_RAW_OUTPUT = 2000

function groupByRule(findings: Array<{ check_id?: string }>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const f of findings) {
    const rule = f.check_id || "unknown"
    counts.set(rule, (counts.get(rule) || 0) + 1)
  }
  return counts
}

export function formatFindings(stdout: string, ecoName: string): { summary: string; count: number } {
  if (!stdout) {
    return {
      summary: `${HEADER(ecoName)}\nSemgrep scan completed: no output (dependency directory may not exist).\n`,
      count: 0,
    }
  }

  try {
    const json = JSON.parse(stdout)
    const findings = json.results || []

    if (findings.length === 0) {
      return {
        summary: `${HEADER(ecoName)}\nSemgrep scan completed: 0 findings. Dependencies look clean.\n`,
        count: 0,
      }
    }

    const lines = [
      HEADER(ecoName),
      `Semgrep scan completed: ${findings.length} finding(s)!\n`,
    ]

    for (const [rule, count] of groupByRule(findings)) {
      lines.push(`  ${rule}: ${count} hit(s)`)
    }

    lines.push("")
    for (const f of findings.slice(0, MAX_SHOWN)) {
      const file = f.path || "?"
      const line = f.start?.line || "?"
      const rule = f.check_id || "?"
      const snippet = (f.extra?.lines || "").substring(0, MAX_SNIPPET)
      lines.push(`  [${rule}] ${file}:${line}`)
      if (snippet) lines.push(`    ${snippet}`)
    }
    if (findings.length > MAX_SHOWN) {
      lines.push(`  ... and ${findings.length - MAX_SHOWN} more findings.`)
    }
    lines.push("")

    return { summary: lines.join("\n"), count: findings.length }
  } catch {
    return {
      summary: `${HEADER(ecoName)}\nSemgrep output:\n${stdout.substring(0, MAX_RAW_OUTPUT)}\n`,
      count: 0,
    }
  }
}
