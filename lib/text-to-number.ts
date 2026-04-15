export function textToNumber(text: string): number {
	let input = text.toLowerCase().trim();

	if (!isNaN(parseFloat(input)) && isFinite(parseFloat(input))) {
		return parseFloat(input);
	}

	// Detect if context indicates US (short scale) or UK/European (long scale)
	const isUS = /(dollar|\$|usd|us|american)/i.test(input);
	const isUK = /(pound|£|gbp|uk|british|sterling)/i.test(input);
	const useShortScale = isUS && !isUK; // Default to long scale (Swedish/European standard)

	// Pre-process specific language quirks before splitting (like French quatre-vingt)
	input = input.replace(/quatre-vingts?/g, "quatrevingt");
	input = input.replace(/soixante-dix/g, "seventy"); // Simple fallback mapping for 70
	input = input.replace(/quatrevingt-dix/g, "ninety"); // Fallback for 90

	const ones: { [key: string]: number } = {
		// English
		zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
		ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
		// Swedish
		noll: 0, en: 1, ett: 1, två: 2, tre: 3, fyra: 4, fem: 5, sex: 6, sju: 7, åtta: 8, nio: 9,
		tio: 10, elva: 11, tolv: 12, tretton: 13, fjorton: 14, femton: 15, sexton: 16, sjutton: 17, arton: 18, nitton: 19,
		// Spanish
		cero: 0, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
		diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
		// German
		"null": 0, eins: 1, ein: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
		zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19,
		// French (missing from above)
		zéro: 0, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9,
		douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
	};

	const tens: { [key: string]: number } = {
		// English
		twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
		// Swedish
		tjugo: 20, trettio: 30, fyrtio: 40, femtio: 50, sextio: 60, sjuttio: 70, åttio: 80, nittio: 90,
		// Spanish
		veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
		// German
		zwanzig: 20, dreißig: 30, dreissig: 30, vierzig: 40, fünfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
		// French
		vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, quatrevingt: 80,
	};

	const scales: { [key: string]: number } = {
		// Unambiguous translations
		hundred: 100, hundra: 100, cien: 100, ciento: 100, hundert: 100, cent: 100,
		thousand: 1000, tusen: 1000, mil: 1000, tausend: 1000, mille: 1000,
		million: 1e6, miljon: 1e6, millon: 1e6, millón: 1e6, millionen: 1e6,
		miljard: 1e9, milliarde: 1e9, milliard: 1e9, // These ALWAYS mean 10^9
		biljon: 1e12, billon: 1e12, billonen: 1e12, // These ALWAYS mean 10^12
		biljard: 1e15,
		triljon: 1e18,
	};

	// Contextual scales based on US vs UK/Europe "Billion" definitions
	if (useShortScale) {
		scales["billion"] = 1e9;
		scales["trillion"] = 1e12;
	} else {
		// Default to long scale for UK English and European standards
		scales["billion"] = 1e12;
		scales["trillion"] = 1e18;
	}

	if (ones[input] !== undefined) return ones[input];
	if (tens[input] !== undefined) return tens[input];
	if (scales[input] !== undefined) return scales[input];

	let result = 0;
	let current = 0;
	let parsedSomething = false;

	// Split by space, dash, or generic logical connectors like "und", "y", "and", "och", "et"
	const words = input.split(/[\s-]+|(?:^|\s)(?:and|y|und|och|et)(?:\s|$)/).filter(Boolean);

	for (const w of words) {
		const word = w.trim();
		if (!word) continue;

		// Skip currency keywords as they are used for scale detection but shouldn't break the parser
		if (word.match(/^(dollars?|\$|usd|pounds?|£|gbp|euros?|€)$/i)) continue;

		if (ones[word] !== undefined) {
			current += ones[word];
			parsedSomething = true;
		} else if (tens[word] !== undefined) {
			current += tens[word];
			parsedSomething = true;
		} else if (scales[word] === 100) {
			current = current === 0 ? 100 : current * 100;
			parsedSomething = true;
		} else if (scales[word] !== undefined) {
			current = current === 0 ? 1 : current;
			result += current * scales[word];
			current = 0;
			parsedSomething = true;
		}
	}

	result += current;

	if (!parsedSomething) {
		throw new Error(`Unable to parse number: "${text}"`);
	}

	return result;
}
