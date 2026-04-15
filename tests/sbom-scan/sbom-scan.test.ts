import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import {
	detectGitHubRepo,
	detectGhCli,
	generateWorkflowYaml,
	writeWorkflowFile,
	buildManualInstructions,
	type GitHubRepoInfo,
} from "../../lib/sbom-scan.ts"

let tmpDir: string

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sbom-scan-test-"))
})

afterEach(() => {
	fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// 1. detectGitHubRepo
// ---------------------------------------------------------------------------
describe("detectGitHubRepo", () => {
	it("returns repo info for a directory with a GitHub remote", () => {
		fs.mkdirSync(path.join(tmpDir, ".git"))
		fs.writeFileSync(
			path.join(tmpDir, ".git", "config"),
			[
				"[remote \"origin\"]",
				"\turl = git@github.com:the-commits/opencode-config.git",
				"\tfetch = +refs/heads/*:refs/remotes/origin/*",
			].join("\n"),
		)
		const result = detectGitHubRepo(tmpDir)
		expect(result).not.toBeNull()
		expect(result!.owner).toBe("the-commits")
		expect(result!.repo).toBe("opencode-config")
	})

	it("parses HTTPS GitHub remote URLs", () => {
		fs.mkdirSync(path.join(tmpDir, ".git"))
		fs.writeFileSync(
			path.join(tmpDir, ".git", "config"),
			[
				"[remote \"origin\"]",
				"\turl = https://github.com/some-org/some-repo.git",
			].join("\n"),
		)
		const result = detectGitHubRepo(tmpDir)
		expect(result).not.toBeNull()
		expect(result!.owner).toBe("some-org")
		expect(result!.repo).toBe("some-repo")
	})

	it("handles HTTPS URLs without .git suffix", () => {
		fs.mkdirSync(path.join(tmpDir, ".git"))
		fs.writeFileSync(
			path.join(tmpDir, ".git", "config"),
			[
				"[remote \"origin\"]",
				"\turl = https://github.com/owner/repo",
			].join("\n"),
		)
		const result = detectGitHubRepo(tmpDir)
		expect(result).not.toBeNull()
		expect(result!.owner).toBe("owner")
		expect(result!.repo).toBe("repo")
	})

	it("returns null for a non-git directory", () => {
		const result = detectGitHubRepo(tmpDir)
		expect(result).toBeNull()
	})

	it("returns null for a git repo with a non-GitHub remote", () => {
		fs.mkdirSync(path.join(tmpDir, ".git"))
		fs.writeFileSync(
			path.join(tmpDir, ".git", "config"),
			[
				"[remote \"origin\"]",
				"\turl = git@gitlab.com:someone/project.git",
			].join("\n"),
		)
		const result = detectGitHubRepo(tmpDir)
		expect(result).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// 2. detectGhCli
// ---------------------------------------------------------------------------
describe("detectGhCli", () => {
	it("returns an object with available and authenticated fields", () => {
		const result = detectGhCli()
		expect(result).toHaveProperty("available")
		expect(result).toHaveProperty("authenticated")
		expect(typeof result.available).toBe("boolean")
		expect(typeof result.authenticated).toBe("boolean")
	})

	it("authenticated is false when available is false", () => {
		const result = detectGhCli()
		if (!result.available) {
			expect(result.authenticated).toBe(false)
		}
	})
})

// ---------------------------------------------------------------------------
// 3. generateWorkflowYaml
// ---------------------------------------------------------------------------
describe("generateWorkflowYaml", () => {
	it("returns valid YAML string", () => {
		const yaml = generateWorkflowYaml()
		expect(typeof yaml).toBe("string")
		expect(yaml.length).toBeGreaterThan(0)
	})

	it("contains trivy-action reference", () => {
		const yaml = generateWorkflowYaml()
		expect(yaml).toContain("aquasecurity/trivy-action")
	})

	it("contains SBOM generation step", () => {
		const yaml = generateWorkflowYaml()
		expect(yaml).toContain("anchore/sbom-action")
	})

	it("contains SARIF upload step", () => {
		const yaml = generateWorkflowYaml()
		expect(yaml).toContain("codeql-action/upload-sarif")
	})

	it("blocks on MEDIUM+ severity", () => {
		const yaml = generateWorkflowYaml()
		expect(yaml).toContain("severity: CRITICAL,HIGH,MEDIUM")
		expect(yaml).toContain("exit-code: '1'")
	})

	it("reports LOW severity as informational via SARIF", () => {
		const yaml = generateWorkflowYaml()
		expect(yaml).toContain("severity: LOW")
		expect(yaml).toContain("format: sarif")
	})

	it("includes workflow_dispatch trigger", () => {
		const yaml = generateWorkflowYaml()
		expect(yaml).toContain("workflow_dispatch")
	})

	it("includes daily schedule", () => {
		const yaml = generateWorkflowYaml()
		expect(yaml).toContain("schedule:")
		expect(yaml).toContain("cron:")
	})
})

// ---------------------------------------------------------------------------
// 4. writeWorkflowFile
// ---------------------------------------------------------------------------
describe("writeWorkflowFile", () => {
	it("creates .github/workflows/sbom-scan.yml", () => {
		const result = writeWorkflowFile(tmpDir)
		expect(result.created).toBe(true)
		expect(result.filePath).toBe(
			path.join(tmpDir, ".github", "workflows", "sbom-scan.yml"),
		)
		expect(fs.existsSync(result.filePath)).toBe(true)
	})

	it("creates intermediate directories", () => {
		writeWorkflowFile(tmpDir)
		expect(fs.existsSync(path.join(tmpDir, ".github", "workflows"))).toBe(true)
	})

	it("returns created=false if file already exists", () => {
		const workflowDir = path.join(tmpDir, ".github", "workflows")
		fs.mkdirSync(workflowDir, { recursive: true })
		fs.writeFileSync(path.join(workflowDir, "sbom-scan.yml"), "existing")

		const result = writeWorkflowFile(tmpDir)
		expect(result.created).toBe(false)
		expect(result.alreadyExists).toBe(true)
	})

	it("does not overwrite existing file", () => {
		const workflowDir = path.join(tmpDir, ".github", "workflows")
		fs.mkdirSync(workflowDir, { recursive: true })
		fs.writeFileSync(path.join(workflowDir, "sbom-scan.yml"), "original")

		writeWorkflowFile(tmpDir)
		const content = fs.readFileSync(
			path.join(workflowDir, "sbom-scan.yml"),
			"utf-8",
		)
		expect(content).toBe("original")
	})

	it("written file content matches generateWorkflowYaml()", () => {
		const result = writeWorkflowFile(tmpDir)
		const content = fs.readFileSync(result.filePath, "utf-8")
		expect(content).toBe(generateWorkflowYaml())
	})
})

// ---------------------------------------------------------------------------
// 5. buildManualInstructions
// ---------------------------------------------------------------------------
describe("buildManualInstructions", () => {
	it("includes git add/commit/push steps", () => {
		const instructions = buildManualInstructions()
		expect(instructions).toContain("git add")
		expect(instructions).toContain("git commit")
		expect(instructions).toContain("git push")
	})

	it("mentions gh CLI as future automation option", () => {
		const instructions = buildManualInstructions()
		expect(instructions).toContain("gh")
	})

	it("mentions GitHub MCP as future automation option", () => {
		const instructions = buildManualInstructions()
		expect(instructions).toContain("MCP")
	})
})
