import { tool } from "@opencode-ai/plugin";
import { textToNumber } from "../lib/text-to-number.ts";

export const add = tool({
	description: "ALWAYS use this tool when you need to add numbers together. Do NOT calculate math in your head to avoid hallucinations.",
	args: {
		a: tool.schema
			.string()
			.describe(
				"First number (can be digits or words like 'one', 'two', 'hundred')",
			),
		b: tool.schema
			.string()
			.describe(
				"Second number (can be digits or words like 'one', 'two', 'hundred')",
			),
	},
	async execute(args) {
		const a = textToNumber(args.a);
		const b = textToNumber(args.b);
		return (a + b).toString();
	},
});

export const multiply = tool({
	description: "ALWAYS use this tool when you need to multiply numbers together. Do NOT calculate math in your head to avoid hallucinations.",
	args: {
		a: tool.schema
			.string()
			.describe(
				"First number (can be digits or words like 'one', 'two', 'hundred')",
			),
		b: tool.schema
			.string()
			.describe(
				"Second number (can be digits or words like 'one', 'two', 'hundred')",
			),
	},
	async execute(args) {
		const a = textToNumber(args.a);
		const b = textToNumber(args.b);
		return (a * b).toString();
	},
});

export const subtract = tool({
	description: "ALWAYS use this tool when you need to subtract numbers. Do NOT calculate math in your head to avoid hallucinations.",
	args: {
		a: tool.schema
			.string()
			.describe(
				"First number (can be digits or words like 'one', 'two', 'hundred')",
			),
		b: tool.schema
			.string()
			.describe(
				"Second number (can be digits or words like 'one', 'two', 'hundred')",
			),
	},
	async execute(args) {
		const a = textToNumber(args.a);
		const b = textToNumber(args.b);
		return (a - b).toString();
	},
});

export const divide = tool({
	description: "ALWAYS use this tool when you need to divide numbers. Do NOT calculate math in your head to avoid hallucinations.",
	args: {
		a: tool.schema
			.string()
			.describe(
				"First number - dividend (can be digits or words like 'one', 'ett', 'hundred', 'hundra')",
			),
		b: tool.schema
			.string()
			.describe(
				"Second number - divisor (can be digits or words like 'one', 'ett', 'hundred', 'hundra')",
			),
	},
	async execute(args) {
		const a = textToNumber(args.a);
		const b = textToNumber(args.b);
		if (b === 0) {
			throw new Error("Division by zero is not allowed");
		}
		return (a / b).toString();
	},
});
