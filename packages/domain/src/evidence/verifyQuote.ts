const QUOTE_TRUNCATE_LENGTH = 200;
const QUOTE_LENGTH_THRESHOLD = 300;

// Smart quotes, apostrophes, and dashes that models commonly emit but that don't survive
// a byte-for-byte comparison against plain-ASCII source text (or vice versa).
const CHAR_EQUIVALENTS: Array<[RegExp, string]> = [
  [/[‘’‚‛′]/g, "'"], // smart single quotes, prime
  [/[“”„‟″]/g, '"'], // smart double quotes, double prime
  [/[–—‒―]/g, '-'], // en dash, em dash, figure dash, horizontal bar
  [/[   ]/g, ' '], // non-breaking / figure / narrow-no-break spaces
];

function normalise(text: string): string {
  let result = text.normalize('NFKC');
  for (const [pattern, replacement] of CHAR_EQUIVALENTS) {
    result = result.replace(pattern, replacement);
  }
  return result
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function verifyQuote(quote: string, sourceText: string): boolean {
  if (quote.length === 0 || sourceText.length === 0) return false;
  if (quote.length > sourceText.length) return false;

  const normalisedQuote = normalise(quote);
  const normalisedSource = normalise(sourceText);

  const needle =
    normalisedQuote.length > QUOTE_LENGTH_THRESHOLD
      ? normalisedQuote.slice(0, QUOTE_TRUNCATE_LENGTH)
      : normalisedQuote;

  return normalisedSource.includes(needle);
}
