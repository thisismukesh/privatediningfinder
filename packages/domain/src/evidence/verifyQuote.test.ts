import { describe, expect, it } from 'vitest';
import { verifyQuote } from './verifyQuote.js';

describe('verifyQuote', () => {
  it('verifies an exact substring match', () => {
    expect(verifyQuote('seats up to 40 guests', 'Our Vine Room seats up to 40 guests.')).toBe(
      true,
    );
  });

  it('returns false when the quote is not present', () => {
    expect(verifyQuote('seats up to 90 guests', 'Our Vine Room seats up to 40 guests.')).toBe(
      false,
    );
  });

  it('returns false for an empty quote', () => {
    expect(verifyQuote('', 'Our Vine Room seats up to 40 guests.')).toBe(false);
  });

  it('returns false for empty source text', () => {
    expect(verifyQuote('seats up to 40', '')).toBe(false);
  });

  it('returns false for both empty', () => {
    expect(verifyQuote('', '')).toBe(false);
  });

  it('returns false when the quote is longer than the source', () => {
    expect(verifyQuote('a very long quote indeed', 'short')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(verifyQuote('SEATS UP TO 40 GUESTS', 'our vine room seats up to 40 guests.')).toBe(
      true,
    );
  });

  it('collapses whitespace runs to a single space', () => {
    expect(verifyQuote('seats   up  to    40', 'Our room seats up to 40 guests.')).toBe(true);
  });

  it('normalises smart quotes and apostrophes', () => {
    expect(verifyQuote("chef's table for 12", 'Our chef’s table for 12 guests.')).toBe(true);
    expect(verifyQuote('chef’s table for 12', "Our chef's table for 12 guests.")).toBe(true);
  });

  it('normalises curly double quotes', () => {
    expect(
      verifyQuote('the "Vine Room" seats 40', 'Our the “Vine Room” seats 40 guests.'),
    ).toBe(true);
  });

  it('normalises en dashes and em dashes to a common form', () => {
    expect(verifyQuote('seats 20-40 guests', 'It seats 20–40 guests comfortably.')).toBe(
      true,
    );
    expect(verifyQuote('seats 20—40 guests', 'It seats 20-40 guests comfortably.')).toBe(
      true,
    );
  });

  it('normalises non-breaking spaces', () => {
    expect(verifyQuote('seats 40 guests', 'It seats 40 guests comfortably.')).toBe(true);
  });

  it('normalises via Unicode NFKC (full-width characters)', () => {
    // full-width "40" (４０) should normalise to ascii "40"
    expect(verifyQuote('seats ４０ guests', 'It seats 40 guests comfortably.')).toBe(
      true,
    );
  });

  it('verifies only the first 200 normalised chars when the quote exceeds 300 chars', () => {
    const shared = 'seats up to 40 guests in the vine room, our largest private space';
    // shared is 67 chars; pad with filler to push past the 200-char truncation point,
    // then continue with 150 chars that will NOT appear anywhere in source.
    const quote = `${shared}${' filler'.repeat(20)}${'zzz nomatch'.repeat(20)}`;
    expect(quote.length).toBeGreaterThan(300);
    // Source contains the quote's first 200 normalised chars verbatim, then diverges
    // completely -- proving only the truncated prefix was checked. Source must be at
    // least as long as the quote (verifyQuote rejects quote.length > source.length
    // outright, independent of normalisation).
    const source = `${shared}${' filler'.repeat(20)} but then something totally different follows, padded well past the quote's own length so the length guard never fires ${'.'.repeat(200)}`;
    expect(source.length).toBeGreaterThan(quote.length);
    expect(verifyQuote(quote, source)).toBe(true);
  });

  it('rejects a quote exceeding 300 chars whose first 200 normalised chars do not match', () => {
    const quote = 'z'.repeat(350);
    const source = 'a'.repeat(1000);
    expect(verifyQuote(quote, source)).toBe(false);
  });

  it('trims leading/trailing whitespace as part of collapsing', () => {
    expect(verifyQuote('  seats 40  ', 'Our room seats 40 guests.')).toBe(true);
  });

  it('does not fuzzy-match on a near-miss number (strict substring only)', () => {
    expect(verifyQuote('seats 400', 'Our room seats 40 guests.')).toBe(false);
  });
});
