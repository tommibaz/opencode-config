import { describe, it, expect } from "bun:test"
import featureTool from "../../tools/feature-planning"

const ctx = {} as any

// ---------------------------------------------------------------------------
// with feature idea provided
// ---------------------------------------------------------------------------
describe("feature-planning tool (with feature idea)", () => {
	it("returns skill content with feature preamble", async () => {
		const result = await featureTool.execute({ feature_idea: "dark mode toggle" }, ctx)

		expect(result).toContain('plan this feature: "dark mode toggle"')
	})

	it("includes the workflow instructions header", async () => {
		const result = await featureTool.execute({ feature_idea: "dark mode toggle" }, ctx)

		expect(result).toContain("Follow these instructions for the feature planning workflow")
	})

	it("strips YAML frontmatter from skill content", async () => {
		const result = await featureTool.execute({ feature_idea: "dark mode toggle" }, ctx)

		expect(result).not.toContain("compatibility: opencode")
		expect(result).not.toContain("metadata:")
	})

	it("includes step content from the skill", async () => {
		const result = await featureTool.execute({ feature_idea: "dark mode toggle" }, ctx)

		expect(result).toContain("Step 1: Understand the feature goal")
		expect(result).toContain("Step 7: Output the feature spec")
	})

	it("includes INVEST criteria", async () => {
		const result = await featureTool.execute({ feature_idea: "dark mode toggle" }, ctx)

		expect(result).toContain("INVEST")
	})

	it("includes Given/When/Then format", async () => {
		const result = await featureTool.execute({ feature_idea: "dark mode toggle" }, ctx)

		expect(result).toContain("Given")
		expect(result).toContain("When")
		expect(result).toContain("Then")
	})
})

// ---------------------------------------------------------------------------
// without feature idea
// ---------------------------------------------------------------------------
describe("feature-planning tool (no feature idea)", () => {
	it("asks user what feature to plan", async () => {
		const result = await featureTool.execute({}, ctx)

		expect(result).toContain("Ask the user what feature they want to plan")
	})

	it("still includes the full skill workflow", async () => {
		const result = await featureTool.execute({}, ctx)

		expect(result).toContain("Step 1: Understand the feature goal")
		expect(result).toContain("Definition of Done")
	})
})
