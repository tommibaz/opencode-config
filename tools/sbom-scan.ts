import { tool } from "@opencode-ai/plugin";
import { execSync } from "node:child_process";
import {
	detectGitHubRepo,
	detectGhCli,
	writeWorkflowFile,
	buildManualInstructions,
} from "../lib/sbom-scan.ts";

export default tool({
	description:
		"Set up SBOM vulnerability scanning with Trivy in a GitHub Actions CI pipeline. " +
		"Detects if the current project is a GitHub repo, generates the workflow file, " +
		"and optionally automates commit/push/trigger via gh CLI. " +
		"Use when the user wants to add SBOM scanning, supply chain security, " +
		"Trivy CI, or vulnerability scanning to their GitHub project.",
	args: {
		directory: tool.schema
			.string()
			.optional()
			.describe("Project directory to set up. Defaults to current working directory."),
	},
	async execute(args, context) {
		const directory = args.directory || process.cwd();
		const lines: string[] = [];

		// Step 1: Detect GitHub repo
		const repoInfo = detectGitHubRepo(directory);
		if (!repoInfo) {
			return [
				"This directory is not a GitHub repository.",
				"SBOM CI scanning requires a GitHub repo with a remote pointing to github.com.",
				"",
				"To set up manually, initialize a git repo and add a GitHub remote:",
				"```bash",
				"git init",
				"git remote add origin git@github.com:<owner>/<repo>.git",
				"```",
				"Then run this tool again.",
			].join("\n");
		}

		lines.push(`Detected GitHub repo: **${repoInfo.owner}/${repoInfo.repo}**`);
		lines.push("");

		// Step 2: Write workflow file
		const writeResult = writeWorkflowFile(directory);
		if (writeResult.alreadyExists) {
			lines.push(`Workflow file already exists at \`${writeResult.filePath}\`.`);
			lines.push("No changes were made. Delete the file first if you want to regenerate it.");
			return lines.join("\n");
		}

		lines.push(`Created workflow file: \`${writeResult.filePath}\``);
		lines.push("");

		// Step 3: Check gh CLI availability
		const ghStatus = detectGhCli();

		if (ghStatus.available && ghStatus.authenticated) {
			lines.push("gh CLI detected and authenticated. Automating setup...");
			lines.push("");

			try {
				execSync(
					"git add .github/workflows/sbom-scan.yml && " +
					"git commit -m 'feat(ci): add SBOM vulnerability scanning with trivy'",
					{ cwd: directory, stdio: "pipe" },
				);
				lines.push("Committed workflow file.");

				execSync("git push", { cwd: directory, stdio: "pipe" });
				lines.push("Pushed to remote.");

				try {
					execSync(
						'gh workflow run "SBOM Vulnerability Scan"',
						{ cwd: directory, stdio: "pipe" },
					);
					lines.push("Triggered first workflow run.");
				} catch {
					lines.push(
						"Could not trigger workflow run automatically. " +
						"The workflow will run on the next push or PR.",
					);
				}

				lines.push("");
				lines.push("Setup complete. Results will appear under **Security > Code scanning**.");
			} catch (err) {
				lines.push(
					"Automated commit/push failed. " +
					"You may need to commit and push manually:",
				);
				lines.push("");
				lines.push(buildManualInstructions());
			}
		} else {
			if (ghStatus.available && !ghStatus.authenticated) {
				lines.push(
					"gh CLI is installed but not authenticated. " +
					"Run `gh auth login` to enable automation.",
				);
				lines.push("");
			}

			lines.push(buildManualInstructions());
		}

		return lines.join("\n");
	},
});
