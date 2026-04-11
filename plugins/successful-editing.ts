import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";

export const SuccessfulEditingPlugin: Plugin = async ({ client, $, directory }) => {
	// We'll keep track of the files edited recently
	const editedFiles = new Set<string>();

	// Helper to check if granular_commits is enabled in local or global config
	const hasGranularCommitsEnabled = async () => {
		for (const filename of [".opencode.jsonc", "opencode.jsonc"]) {
			try {
				const configPath = path.join(directory, filename);
				const content = await fs.readFile(configPath, "utf-8");
				if (content.includes('"granular_commits": true') || content.includes("'granular_commits': true")) {
					return true;
				}
			} catch {
				// Ignore if file doesn't exist
			}
		}
		return false;
	};

	return {
		event: async ({ event }) => {
			if (event.type === "file.edited") {
				// Mark that this file was edited
				editedFiles.add(event.file);
			}

			if (event.type === "lsp.client.diagnostics") {
				// We check if the diagnostics are for a file we just edited
				if (editedFiles.has(event.file)) {
					// Are there any errors in the diagnostics?
					// Usually diagnostics contain an array of objects, where severity 1 = Error
					const hasErrors = event.diagnostics?.some(
						(d: any) => d.severity === 1 || d.severity === "Error" || d.severity === "error"
					);

					if (!hasErrors) {
						// No errors found! We emit our custom successful-editing event
						client.emit("successful-editing", {
							file: event.file,
							message: `Successfully edited ${event.file} with no LSP errors.`,
						});

						// Check if the user wants automatic granular commits for successful edits
						const autoCommit = await hasGranularCommitsEnabled();
						if (autoCommit) {
							try {
								const fileName = path.basename(event.file);
								// Stage the specific file
								await $`git add ${event.file}`;
								// Commit it with a granular message
								const result = await $`git commit -m "chore(auto): successful edit of ${fileName}" -m "Auto-committed by successful-editing plugin after passing LSP diagnostic checks."`;
								
								if (result.exitCode === 0) {
									await client.app.log({
										body: {
											service: "successful-editing-plugin",
											level: "info",
											message: `Auto-committed ${event.file} due to granular_commits=true`,
										},
									});
								}
							} catch (e: any) {
								await client.app.log({
									body: {
										service: "successful-editing-plugin",
										level: "debug",
										message: `Auto-commit skipped for ${event.file}: ${e.message}`,
									},
								});
							}
						} else {
							// Optional: Log it for debugging if not committing
							await client.app.log({
								body: {
									service: "successful-editing-plugin",
									level: "info",
									message: `Emitted successful-editing for ${event.file} (no auto-commit)`,
								},
							});
						}

						// Remove the file from tracking since we successfully handled it
						editedFiles.delete(event.file);
					}
				}
			}
		},
	};
};
