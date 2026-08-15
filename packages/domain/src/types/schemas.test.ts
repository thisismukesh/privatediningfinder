import { describe, expect, it } from 'vitest';
import {
  eventStyleSchema,
  evidenceSchema,
  geoPointSchema,
  layoutTypeSchema,
  privacyLevelSchema,
  sourceTierSchema,
  spaceCapacitySchema,
  spaceKindSchema,
  spaceSchema,
  travelModeSchema,
  trustLabelSchema,
} from './schemas.js';

describe('trustLabelSchema', () => {
  it('accepts all three labels', () => {
    for (const v of ['verified', 'likely', 'unverified']) {
      expect(trustLabelSchema.parse(v)).toBe(v);
    }
  });
  it('rejects an unknown label', () => {
    expect(() => trustLabelSchema.parse('confirmed')).toThrow();
  });
});

describe('sourceTierSchema', () => {
  it('accepts A through E', () => {
    for (const v of ['A', 'B', 'C', 'D', 'E']) {
      expect(sourceTierSchema.parse(v)).toBe(v);
    }
  });
  it('rejects a lowercase tier', () => {
    expect(() => sourceTierSchema.parse('a')).toThrow();
  });
  it('rejects tier F', () => {
    expect(() => sourceTierSchema.parse('F')).toThrow();
  });
});

describe('spaceKindSchema', () => {
  it('accepts every documented kind', () => {
    for (const v of [
      'private_room',
      'semi_private',
      'patio',
      'bar_area',
      'ballroom',
      'full_buyout',
      'event_lawn',
    ]) {
      expect(spaceKindSchema.parse(v)).toBe(v);
    }
  });
  it('rejects an unknown kind', () => {
    expect(() => spaceKindSchema.parse('rooftop')).toThrow();
  });
});

describe('privacyLevelSchema', () => {
  it('accepts every documented level', () => {
    for (const v of ['dedicated_enclosed', 'semi_private_partitioned', 'open_area_reserved']) {
      expect(privacyLevelSchema.parse(v)).toBe(v);
    }
  });
  it('rejects an unknown level', () => {
    expect(() => privacyLevelSchema.parse('fully_open')).toThrow();
  });
});

describe('layoutTypeSchema', () => {
  it('accepts every documented layout', () => {
    for (const v of [
      'seated_dinner',
      'standing_reception',
      'theater',
      'u_shape',
      'boardroom',
      'classroom',
      'banquet_rounds',
    ]) {
      expect(layoutTypeSchema.parse(v)).toBe(v);
    }
  });
  it('rejects an unknown layout', () => {
    expect(() => layoutTypeSchema.parse('cabaret')).toThrow();
  });
});

describe('travelModeSchema', () => {
  it('accepts walking, driving, cycling', () => {
    for (const v of ['walking', 'driving', 'cycling']) {
      expect(travelModeSchema.parse(v)).toBe(v);
    }
  });
  it('rejects transit', () => {
    expect(() => travelModeSchema.parse('transit')).toThrow();
  });
});

describe('eventStyleSchema', () => {
  it('accepts seated_dinner, standing_reception, either', () => {
    for (const v of ['seated_dinner', 'standing_reception', 'either']) {
      expect(eventStyleSchema.parse(v)).toBe(v);
    }
  });
  it('rejects an unknown style', () => {
    expect(() => eventStyleSchema.parse('cocktail')).toThrow();
  });
});

describe('geoPointSchema', () => {
  it('round-trips a valid point', () => {
    const point = { lat: 40.758, lng: -73.9855 };
    expect(geoPointSchema.parse(point)).toEqual(point);
  });
  it('rejects latitude out of range', () => {
    expect(() => geoPointSchema.parse({ lat: 91, lng: 0 })).toThrow();
    expect(() => geoPointSchema.parse({ lat: -91, lng: 0 })).toThrow();
  });
  it('rejects longitude out of range', () => {
    expect(() => geoPointSchema.parse({ lat: 0, lng: 181 })).toThrow();
    expect(() => geoPointSchema.parse({ lat: 0, lng: -181 })).toThrow();
  });
  it('accepts boundary values', () => {
    expect(geoPointSchema.parse({ lat: 90, lng: 180 })).toEqual({ lat: 90, lng: 180 });
    expect(geoPointSchema.parse({ lat: -90, lng: -180 })).toEqual({ lat: -90, lng: -180 });
  });
});

describe('spaceCapacitySchema', () => {
  const base = {
    layout: 'seated_dinner' as const,
    minCapacity: 20,
    maxCapacity: 40,
    isDerived: false,
    trust: 'verified' as const,
  };

  it('round-trips a valid non-derived capacity', () => {
    expect(spaceCapacitySchema.parse(base)).toMatchObject(base);
  });

  it('rejects maxCapacity <= 0', () => {
    expect(() => spaceCapacitySchema.parse({ ...base, maxCapacity: 0 })).toThrow();
    expect(() => spaceCapacitySchema.parse({ ...base, maxCapacity: -5 })).toThrow();
  });

  it('rejects minCapacity > maxCapacity', () => {
    expect(() =>
      spaceCapacitySchema.parse({ ...base, minCapacity: 50, maxCapacity: 40 }),
    ).toThrow();
  });

  it('accepts a null minCapacity', () => {
    const { minCapacity: _minCapacity, ...rest } = base;
    expect(spaceCapacitySchema.parse(rest)).toMatchObject(rest);
  });

  it('rejects isDerived=true without derivedFrom', () => {
    expect(() => spaceCapacitySchema.parse({ ...base, isDerived: true })).toThrow();
  });

  it('accepts isDerived=true with derivedFrom and caps trust at likely implicitly (schema does not enforce ranking, just presence)', () => {
    expect(
      spaceCapacitySchema.parse({
        ...base,
        isDerived: true,
        derivedFrom: 'seated_dinner',
        derivationRule: 'standing_reception ~= seated_dinner * 1.5',
        trust: 'likely',
      }),
    ).toMatchObject({ isDerived: true, derivedFrom: 'seated_dinner' });
  });
});

describe('spaceSchema', () => {
  it('round-trips a valid space', () => {
    const s = {
      id: 'space-1',
      name: 'The Vine Room',
      kind: 'private_room' as const,
      privacy: 'dedicated_enclosed' as const,
      combinableWith: ['space-2'],
      isOutdoor: false,
      capacities: [
        {
          layout: 'seated_dinner' as const,
          minCapacity: 20,
          maxCapacity: 40,
          isDerived: false,
          trust: 'verified' as const,
        },
      ],
    };
    expect(spaceSchema.parse(s)).toMatchObject(s);
  });

  it('defaults combinableWith to an empty array', () => {
    const s = {
      id: 'space-1',
      name: 'The Vine Room',
      kind: 'private_room' as const,
      isOutdoor: false,
      capacities: [],
    };
    expect(spaceSchema.parse(s).combinableWith).toEqual([]);
  });
});

describe('evidenceSchema', () => {
  const base = {
    tier: 'A' as const,
    sourceUrl: 'https://example.com/private-events',
    quote: 'Our Vine Room seats up to 40 guests.',
    quoteVerified: true,
    extractionMethod: 'html_table' as const,
    extractorVersion: 'v1',
    contentHash: 'abc123',
    fetchedAt: new Date('2026-08-01T00:00:00Z'),
    rawValue: '40',
  };

  it('round-trips valid evidence', () => {
    expect(evidenceSchema.parse(base)).toMatchObject(base);
  });

  it('rejects quoteVerified=false at the schema level (never enters the system)', () => {
    expect(() => evidenceSchema.parse({ ...base, quoteVerified: false })).toThrow();
  });

  it('rejects an empty quote', () => {
    expect(() => evidenceSchema.parse({ ...base, quote: '' })).toThrow();
  });

  it('rejects an invalid source URL', () => {
    expect(() => evidenceSchema.parse({ ...base, sourceUrl: 'not-a-url' })).toThrow();
  });

  it('defaults injectionFlag to false', () => {
    expect(evidenceSchema.parse(base).injectionFlag).toBe(false);
  });
});
