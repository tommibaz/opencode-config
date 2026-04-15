import { describe, it, expect } from "bun:test"
import { textToNumber } from "../../lib/text-to-number"

// ---------------------------------------------------------------------------
// Numeric strings (passthrough)
// ---------------------------------------------------------------------------
describe("numeric strings", () => {
	it("parses integers", () => {
		expect(textToNumber("42")).toBe(42)
	})

	it("parses floats", () => {
		expect(textToNumber("3.14")).toBe(3.14)
	})

	it("parses negative numbers", () => {
		expect(textToNumber("-7")).toBe(-7)
	})

	it("trims whitespace", () => {
		expect(textToNumber("  100  ")).toBe(100)
	})
})

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------
describe("English", () => {
	it("parses single digits", () => {
		expect(textToNumber("zero")).toBe(0)
		expect(textToNumber("one")).toBe(1)
		expect(textToNumber("nine")).toBe(9)
	})

	it("parses teens", () => {
		expect(textToNumber("ten")).toBe(10)
		expect(textToNumber("thirteen")).toBe(13)
		expect(textToNumber("nineteen")).toBe(19)
	})

	it("parses tens", () => {
		expect(textToNumber("twenty")).toBe(20)
		expect(textToNumber("fifty")).toBe(50)
		expect(textToNumber("ninety")).toBe(90)
	})

	it("parses compound tens (twenty-one)", () => {
		expect(textToNumber("twenty-one")).toBe(21)
		expect(textToNumber("forty two")).toBe(42)
		expect(textToNumber("ninety-nine")).toBe(99)
	})

	it("parses hundreds", () => {
		expect(textToNumber("hundred")).toBe(100)
		expect(textToNumber("one hundred")).toBe(100)
		expect(textToNumber("three hundred")).toBe(300)
	})

	it("parses hundreds with remainder", () => {
		expect(textToNumber("two hundred and fifty")).toBe(250)
		expect(textToNumber("five hundred and twelve")).toBe(512)
	})

	it("parses thousands", () => {
		expect(textToNumber("thousand")).toBe(1000)
		expect(textToNumber("one thousand")).toBe(1000)
		expect(textToNumber("three thousand")).toBe(3000)
	})

	it("parses thousands with remainder", () => {
		expect(textToNumber("two thousand and five")).toBe(2005)
	})

	it("parses million", () => {
		expect(textToNumber("million")).toBe(1e6)
		expect(textToNumber("five million")).toBe(5e6)
	})
})

// ---------------------------------------------------------------------------
// Swedish
// ---------------------------------------------------------------------------
describe("Swedish", () => {
	it("parses single digits", () => {
		expect(textToNumber("noll")).toBe(0)
		expect(textToNumber("en")).toBe(1)
		expect(textToNumber("ett")).toBe(1)
		expect(textToNumber("nio")).toBe(9)
	})

	it("parses teens", () => {
		expect(textToNumber("tio")).toBe(10)
		expect(textToNumber("tolv")).toBe(12)
		expect(textToNumber("nitton")).toBe(19)
	})

	it("parses tens", () => {
		expect(textToNumber("tjugo")).toBe(20)
		expect(textToNumber("femtio")).toBe(50)
		expect(textToNumber("nittio")).toBe(90)
	})

	it("parses hundreds", () => {
		expect(textToNumber("hundra")).toBe(100)
		expect(textToNumber("tre hundra")).toBe(300)
	})

	it("parses thousands", () => {
		expect(textToNumber("tusen")).toBe(1000)
		expect(textToNumber("fem tusen")).toBe(5000)
	})

	it("parses miljon", () => {
		expect(textToNumber("miljon")).toBe(1e6)
		expect(textToNumber("två miljon")).toBe(2e6)
	})

	it("parses miljard (always 10^9)", () => {
		expect(textToNumber("miljard")).toBe(1e9)
	})

	it("parses biljon (always 10^12)", () => {
		expect(textToNumber("biljon")).toBe(1e12)
	})
})

// ---------------------------------------------------------------------------
// Spanish
// ---------------------------------------------------------------------------
describe("Spanish", () => {
	it("parses single digits", () => {
		expect(textToNumber("cero")).toBe(0)
		expect(textToNumber("uno")).toBe(1)
		expect(textToNumber("nueve")).toBe(9)
	})

	it("parses teens", () => {
		expect(textToNumber("diez")).toBe(10)
		expect(textToNumber("quince")).toBe(15)
	})

	it("parses tens", () => {
		expect(textToNumber("veinte")).toBe(20)
		expect(textToNumber("noventa")).toBe(90)
	})

	it("parses cien/ciento", () => {
		expect(textToNumber("cien")).toBe(100)
		expect(textToNumber("ciento")).toBe(100)
	})

	it("parses mil", () => {
		expect(textToNumber("mil")).toBe(1000)
	})

	it("parses billon (always 10^12 in long scale)", () => {
		expect(textToNumber("billon")).toBe(1e12)
	})
})

// ---------------------------------------------------------------------------
// German
// ---------------------------------------------------------------------------
describe("German", () => {
	it("parses single digits", () => {
		expect(textToNumber("null")).toBe(0)
		expect(textToNumber("eins")).toBe(1)
		expect(textToNumber("zwei")).toBe(2)
		expect(textToNumber("zwo")).toBe(2)
		expect(textToNumber("fünf")).toBe(5)
		expect(textToNumber("fuenf")).toBe(5)
	})

	it("parses teens", () => {
		expect(textToNumber("zehn")).toBe(10)
		expect(textToNumber("elf")).toBe(11)
		expect(textToNumber("zwölf")).toBe(12)
		expect(textToNumber("zwoelf")).toBe(12)
	})

	it("parses tens", () => {
		expect(textToNumber("zwanzig")).toBe(20)
		expect(textToNumber("dreißig")).toBe(30)
		expect(textToNumber("dreissig")).toBe(30)
	})

	it("parses hundert", () => {
		expect(textToNumber("hundert")).toBe(100)
	})

	it("parses tausend", () => {
		expect(textToNumber("tausend")).toBe(1000)
	})

	it("parses milliarde (always 10^9)", () => {
		expect(textToNumber("milliarde")).toBe(1e9)
	})
})

// ---------------------------------------------------------------------------
// French
// ---------------------------------------------------------------------------
describe("French", () => {
	it("parses single digits", () => {
		expect(textToNumber("zéro")).toBe(0)
		expect(textToNumber("deux")).toBe(2)
		expect(textToNumber("cinq")).toBe(5)
		expect(textToNumber("neuf")).toBe(9)
	})

	it("parses teens", () => {
		expect(textToNumber("douze")).toBe(12)
		expect(textToNumber("seize")).toBe(16)
	})

	it("parses tens", () => {
		expect(textToNumber("vingt")).toBe(20)
		expect(textToNumber("trente")).toBe(30)
		expect(textToNumber("soixante")).toBe(60)
		expect(textToNumber("quatre-vingt")).toBe(80)
	})

	it("parses soixante-dix (70)", () => {
		expect(textToNumber("soixante-dix")).toBe(70)
	})

	it("parses quatre-vingt-dix (90)", () => {
		expect(textToNumber("quatre-vingt-dix")).toBe(90)
	})

	it("parses cent", () => {
		expect(textToNumber("cent")).toBe(100)
	})

	it("parses mille", () => {
		expect(textToNumber("mille")).toBe(1000)
	})

	it("parses milliard (always 10^9)", () => {
		expect(textToNumber("milliard")).toBe(1e9)
	})
})

// ---------------------------------------------------------------------------
// Short scale vs long scale (billion)
// ---------------------------------------------------------------------------
describe("short scale vs long scale", () => {
	it("defaults billion to long scale (10^12)", () => {
		expect(textToNumber("billion")).toBe(1e12)
	})

	it("uses short scale (10^9) when US context detected", () => {
		expect(textToNumber("one billion dollars")).toBe(1e9)
		expect(textToNumber("two billion USD")).toBe(2e9)
	})

	it("uses long scale when UK context detected", () => {
		expect(textToNumber("one billion pounds")).toBe(1e12)
		expect(textToNumber("one billion GBP")).toBe(1e12)
	})

	it("defaults trillion to long scale (10^18)", () => {
		expect(textToNumber("trillion")).toBe(1e18)
	})

	it("uses short scale trillion (10^12) with US context", () => {
		expect(textToNumber("one trillion dollars")).toBe(1e12)
	})
})

// ---------------------------------------------------------------------------
// Edge cases and errors
// ---------------------------------------------------------------------------
describe("edge cases", () => {
	it("is case-insensitive", () => {
		expect(textToNumber("Twenty")).toBe(20)
		expect(textToNumber("HUNDRED")).toBe(100)
	})

	it("throws on unparseable input", () => {
		expect(() => textToNumber("banana")).toThrow("Unable to parse number")
	})

	it("throws on empty string", () => {
		expect(() => textToNumber("")).toThrow()
	})
})
