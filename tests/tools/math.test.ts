import { describe, it, expect } from "bun:test"
import { add, subtract, multiply, divide } from "../../tools/math"

// Minimal mock context — tools only use args, not context
const ctx = {} as any

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------
describe("add", () => {
	it("adds two numeric strings", async () => {
		expect(await add.execute({ a: "3", b: "4" }, ctx)).toBe("7")
	})

	it("adds text numbers", async () => {
		expect(await add.execute({ a: "twenty", b: "two" }, ctx)).toBe("22")
	})

	it("adds mixed text and numeric", async () => {
		expect(await add.execute({ a: "hundred", b: "50" }, ctx)).toBe("150")
	})

	it("handles decimals", async () => {
		expect(await add.execute({ a: "1.5", b: "2.5" }, ctx)).toBe("4")
	})

	it("handles negative numbers", async () => {
		expect(await add.execute({ a: "-10", b: "3" }, ctx)).toBe("-7")
	})
})

// ---------------------------------------------------------------------------
// subtract
// ---------------------------------------------------------------------------
describe("subtract", () => {
	it("subtracts two numeric strings", async () => {
		expect(await subtract.execute({ a: "10", b: "3" }, ctx)).toBe("7")
	})

	it("subtracts text numbers", async () => {
		expect(await subtract.execute({ a: "fifty", b: "twenty" }, ctx)).toBe("30")
	})

	it("returns negative when b > a", async () => {
		expect(await subtract.execute({ a: "3", b: "10" }, ctx)).toBe("-7")
	})
})

// ---------------------------------------------------------------------------
// multiply
// ---------------------------------------------------------------------------
describe("multiply", () => {
	it("multiplies two numeric strings", async () => {
		expect(await multiply.execute({ a: "6", b: "7" }, ctx)).toBe("42")
	})

	it("multiplies text numbers", async () => {
		expect(await multiply.execute({ a: "three", b: "four" }, ctx)).toBe("12")
	})

	it("multiplies by zero", async () => {
		expect(await multiply.execute({ a: "999", b: "0" }, ctx)).toBe("0")
	})
})

// ---------------------------------------------------------------------------
// divide
// ---------------------------------------------------------------------------
describe("divide", () => {
	it("divides two numeric strings", async () => {
		expect(await divide.execute({ a: "10", b: "2" }, ctx)).toBe("5")
	})

	it("divides text numbers", async () => {
		expect(await divide.execute({ a: "hundred", b: "four" }, ctx)).toBe("25")
	})

	it("returns decimal result", async () => {
		expect(await divide.execute({ a: "7", b: "2" }, ctx)).toBe("3.5")
	})

	it("throws on division by zero", async () => {
		expect(divide.execute({ a: "10", b: "0" }, ctx)).rejects.toThrow(
			"Division by zero",
		)
	})

	it("throws on division by zero (text)", async () => {
		expect(divide.execute({ a: "ten", b: "zero" }, ctx)).rejects.toThrow(
			"Division by zero",
		)
	})
})

// ---------------------------------------------------------------------------
// cross-language operations
// ---------------------------------------------------------------------------
describe("cross-language", () => {
	it("adds Swedish and English", async () => {
		expect(await add.execute({ a: "tjugo", b: "five" }, ctx)).toBe("25")
	})

	it("multiplies German and Spanish", async () => {
		expect(await multiply.execute({ a: "drei", b: "cuatro" }, ctx)).toBe("12")
	})
})
