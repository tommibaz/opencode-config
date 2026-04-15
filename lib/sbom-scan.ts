/**
 * SBOM Scan — Internal helpers
 *
 * Deterministic logic for detecting GitHub repos, gh CLI availability,
 * generating Trivy SBOM workflow YAML, and providing manual instructions.
 * Extracted from the tool so helpers can be tested independently.
 */

import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubRepoInfo {
	owner: string
	repo: string
}

export interface GhCliStatus {
	available: boolean
	authenticated: boolean
}

export interface WriteResult {
	created: boolean
	alreadyExists: boolean
	filePath: string
}

// ---------------------------------------------------------------------------
// detectGitHubRepo
// ---------------------------------------------------------------------------

const GITHUB_REMOTE_PATTERN =
	/github\.com[:/]([^/\s]+)\/([^/\s.]+?)(?:\.git)?$/m

export function detectGitHubRepo(directory: string): GitHubRepoInfo | null {
	const gitConfigPath = path.join(directory, ".git", "config")
	if (!fs.existsSync(gitConfigPath)) return null

	try {
		const content = fs.readFileSync(gitConfigPath, "utf-8")
		const match = content.match(GITHUB_REMOTE_PATTERN)
		if (!match) return null
		return { owner: match[1], repo: match[2] }
	} catch {
		return null
	}
}

// ---------------------------------------------------------------------------
// detectGhCli
// ---------------------------------------------------------------------------

export function detectGhCli(): GhCliStatus {
	let available = false
	try {
		execSync("gh --version", { stdio: "ignore" })
		available = true
	} catch {
		return { available: false, authenticated: false }
	}

	let authenticated = false
	try {
		execSync("gh auth status", { stdio: "ignore" })
		authenticated = true
	} catch {
		// gh exists but not logged in
	}

	return { available, authenticated }
}

// ---------------------------------------------------------------------------
// generateWorkflowYaml
// ---------------------------------------------------------------------------

const WORKFLOW_YAML = `name: SBOM Vulnerability Scan

on:
  push:
    branches:
      - main
      - master
  pull_request:
    branches:
      - main
      - master
  workflow_dispatch: {}
  schedule:
    - cron: '30 09 * * *'

jobs:
  sbom-scan:
    name: Trivy SBOM Scan
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    if: (github.actor != 'dependabot[bot]')
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Generate SPDX SBOM
        uses: anchore/sbom-action@v0
        with:
          format: spdx-json
          output-file: sbom.spdx.json

      - name: Scan SBOM for vulnerabilities (blocking)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: sbom
          scan-ref: sbom.spdx.json
          severity: CRITICAL,HIGH,MEDIUM
          exit-code: '1'
          format: table

      - name: Scan SBOM for low-severity issues (SARIF)
        if: always()
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: sbom
          scan-ref: sbom.spdx.json
          severity: LOW
          exit-code: '0'
          format: sarif
          output: trivy-low.sarif

      - name: Upload low-severity results to GitHub Security
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-low.sarif
          category: trivy-sbom-low
`

export function generateWorkflowYaml(): string {
	return WORKFLOW_YAML
}

// ---------------------------------------------------------------------------
// writeWorkflowFile
// ---------------------------------------------------------------------------

const WORKFLOW_REL_PATH = path.join(".github", "workflows", "sbom-scan.yml")

export function writeWorkflowFile(directory: string): WriteResult {
	const filePath = path.join(directory, WORKFLOW_REL_PATH)
	const dirPath = path.dirname(filePath)

	if (fs.existsSync(filePath)) {
		return { created: false, alreadyExists: true, filePath }
	}

	fs.mkdirSync(dirPath, { recursive: true })
	fs.writeFileSync(filePath, generateWorkflowYaml(), "utf-8")
	return { created: true, alreadyExists: false, filePath }
}

// ---------------------------------------------------------------------------
// buildManualInstructions
// ---------------------------------------------------------------------------

export function buildManualInstructions(): string {
	return [
		"## Manual steps to enable SBOM scanning",
		"",
		"The workflow file has been created at `.github/workflows/sbom-scan.yml`.",
		"Complete the setup with these commands:",
		"",
		"```bash",
		"git add .github/workflows/sbom-scan.yml",
		"git commit -m 'feat(ci): add SBOM vulnerability scanning with trivy'",
		"git push",
		"```",
		"",
		"After pushing, the workflow runs automatically on push, PR, and daily.",
		"Results appear under **Security > Code scanning** in your GitHub repo.",
		"",
		"### Future automation",
		"",
		"If you install the `gh` CLI (`gh auth login`), this tool can automate",
		"the commit, push, and first workflow run for you.",
		"",
		"GitHub MCP integration can also be used for full automation",
		"without leaving your editor.",
	].join("\n")
}
