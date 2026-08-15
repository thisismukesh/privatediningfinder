import { describe, expect, it } from 'vitest';
import { verifyQuote } from './verifyQuote.js';

// A small deterministic PRNG (mulberry32) so the fuzz run is reproducible without
// reaching for Math.random -- this file lives in packages/domain, which must stay pure.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOURCE_CORPUS = [
  'Our Vine Room seats up to 40 guests for a seated dinner, or 75 for a standing reception.',
  'The Grand Ballroom accommodates 200 for a reception and 120 for a seated banquet.',
  'Minimum spend is $5,000 on weekday evenings and $8,000 on weekends.',
  'We offer a semi-private patio that seats 24, combinable with the main dining room.',
  'Please call our events team at (555) 123-4567 to check availability.',
];

const MUTATIONS: Array<(s: string) => string> = [
  (s) => s.toUpperCase(),
  (s) => s.toLowerCase(),
  (s) => s.split('').reverse().join(''),
  (s) => s.slice(1),
  (s) => s + 'x',
  (s) => s.replace(/e/g, '3'),
  (s) => s.replace(/o/g, '0'),
  (s) => s.split(' ').reverse().join(' '),
  (s) => s.replace(/[aeiou]/gi, ''),
  (s) => `${s} ${s}`,
  (s) => s.replace(/\d+/g, (m) => String(Number(m) + 1)),
  (s) => Array.from(s).join('​'), // zero-width space injection
  (s) => s.slice(0, Math.max(1, Math.floor(s.length / 2))),
  (s) => s.split('').sort().join(''),
  (s) => s.replace(/ /g, ''),
];

function mutate(source: string, rand: () => number): string {
  const fn = MUTATIONS[Math.floor(rand() * MUTATIONS.length)]!;
  return fn(source);
}

describe('verifyQuote fuzz resistance', () => {
  it('never false-positives across 1000 adversarial mutations', () => {
    const rand = mulberry32(42);
    let falsePositives = 0;
    const failures: Array<{ quote: string; source: string }> = [];

    for (let i = 0; i < 1000; i++) {
      const source = SOURCE_CORPUS[Math.floor(rand() * SOURCE_CORPUS.length)]!;
      // Mutate a DIFFERENT source than the one checked against, so any match found
      // would be a genuine false positive rather than a coincidental true positive.
      const otherSource =
        SOURCE_CORPUS[(SOURCE_CORPUS.indexOf(source) + 1) % SOURCE_CORPUS.length]!;
      const mutatedQuote = mutate(otherSource, rand);

      if (mutatedQuote.length === 0) continue;

      const result = verifyQuote(mutatedQuote, source);
      if (result) {
        falsePositives++;
        failures.push({ quote: mutatedQuote, source });
      }
    }

    expect(failures.slice(0, 5)).toEqual([]);
    expect(falsePositives).toBe(0);
  });

  it('still verifies a genuine, unmutated quote after the fuzz corpus is exercised', () => {
    expect(verifyQuote('seats up to 40 guests', SOURCE_CORPUS[0]!)).toBe(true);
  });
});
