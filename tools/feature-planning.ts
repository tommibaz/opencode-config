import { tool } from "@opencode-ai/plugin";
import path from "node:path";
import { resolveConfigDir } from "../lib/resolve-config-dir.ts";

export default tool({
	description:
		"Start an agile feature planning session. Call this when the user wants " +
		"to plan a feature, write user stories, create acceptance criteria, " +
		"define requirements, break down work, do sprint planning, write a " +
		"feature spec, do agile planning, story mapping, backlog grooming, " +
		"create a product backlog item, or define epic/story/task breakdown.",
	args: {
		feature_idea: tool.schema
			.string()
			.optional()
			.describe("Brief description of the feature to plan"),
	},
	async execute(args, context) {
		const fs = await import("fs/promises");
		const configDir = resolveConfigDir();
		const skillPath = path.join(
			configDir,
			"skills",
			"feature-planning",
			"SKILL.md",
		);

		let content: string;
		try {
			content = await fs.readFile(skillPath, "utf-8");
		} catch (err) {
			throw new Error(
				`Could not find feature-planning skill at ${skillPath}. ` +
				`Ensure the skill file is installed in your OpenCode config directory.`,
			);
		}

		const body = content.replace(/^---[\s\S]*?---\s*/, "");
		const preamble = args.feature_idea
			? `The user wants to plan this feature: "${args.feature_idea}"\n\n`
			: "Ask the user what feature they want to plan.\n\n";

		return (
			preamble +
			"Follow these instructions for the feature planning workflow:\n\n" +
			body
		);
	},
});
