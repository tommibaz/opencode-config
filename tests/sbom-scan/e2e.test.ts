import { describe, expect, it } from "bun:test"
import { execSync, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { generateWorkflowYaml } from "../../lib/sbom-scan.ts"

const SKIP_E2E = process.env.SKIP_E2E === "1"

function actAvailable(): boolean {
	try {
		execSync("act --version", { stdio: "ignore" })
		return true
	} catch {
		return false
	}
}

function dockerAvailable(): boolean {
	try {
		execSync("docker info", { stdio: "ignore", timeout: 5000 })
		return true
	} catch {
		return false
	}
}

/**
 * Run act dry-run with a timeout, collecting output progressively.
 * act -n can hang on large action clones (e.g. codeql-action),
 * so we kill it after collecting enough output to validate.
 */
function runActDryRun(cwd: string, timeoutMs: number): string {
	return new Promise<string>((resolve, reject) => {
		let output = ""
		const proc = spawn(
			"act",
			["-n", "--workflows", ".github/workflows/sbom-scan.yml"],
			{ cwd, stdio: ["ignore", "pipe", "pipe"] },
		)

		proc.stdout.on("data", (chunk: Buffer) => { output += chunk.toString() })
		proc.stderr.on("data", (chunk: Buffer) => { output += chunk.toString() })

		const timer = setTimeout(() => {
			proc.kill("SIGTERM")
			resolve(output)
		}, timeoutMs)

		proc.on("close", () => {
			clearTimeout(timer)
			resolve(output)
		})

		proc.on("error", (err) => {
			clearTimeout(timer)
			reject(err)
		})
	}) as unknown as string
}

describe("sbom-scan act dry-run", () => {
	it.skipIf(SKIP_E2E || !actAvailable() || !dockerAvailable())(
		"workflow passes act dry-run validation",
		async () => {
			const tmpDir = fs.mkdtempSync(
				path.join(os.tmpdir(), "sbom-scan-act-"),
			)

			try {
				execSync("git init", { cwd: tmpDir, stdio: "ignore" })
				const workflowDir = path.join(tmpDir, ".github", "workflows")
				fs.mkdirSync(workflowDir, { recursive: true })
				fs.writeFileSync(
					path.join(workflowDir, "sbom-scan.yml"),
					generateWorkflowYaml(),
				)

				// Give act 60s to resolve actions, then kill it.
				// The dry-run output before timeout is enough to validate.
				const output = await runActDryRun(tmpDir, 60_000)

				// act dry-run shows action refs, not step names
				expect(output).toContain("Trivy SBOM Scan")
				expect(output).toContain("anchore/sbom-action")
				expect(output).toContain("aquasecurity/trivy-action")
				expect(output).toContain("Scan SBOM for vulnerabilities (blocking)")
				expect(output).toContain("Scan SBOM for low-severity issues (SARIF)")
				expect(output).toContain("codeql-action")
				expect(output).not.toContain("level=error")
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true })
			}
		},
		{ timeout: 90_000 },
	)
})
