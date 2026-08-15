import { z } from 'zod';

export const trustLabelSchema = z.enum(['verified', 'likely', 'unverified']);
export type TrustLabel = z.infer<typeof trustLabelSchema>;

export const sourceTierSchema = z.enum(['A', 'B', 'C', 'D', 'E']);
export type SourceTier = z.infer<typeof sourceTierSchema>;

export const spaceKindSchema = z.enum([
  'private_room',
  'semi_private',
  'patio',
  'bar_area',
  'ballroom',
  'full_buyout',
  'event_lawn',
]);
export type SpaceKind = z.infer<typeof spaceKindSchema>;

export const privacyLevelSchema = z.enum([
  'dedicated_enclosed',
  'semi_private_partitioned',
  'open_area_reserved',
]);
export type PrivacyLevel = z.infer<typeof privacyLevelSchema>;

export const layoutTypeSchema = z.enum([
  'seated_dinner',
  'standing_reception',
  'theater',
  'u_shape',
  'boardroom',
  'classroom',
  'banquet_rounds',
]);
export type LayoutType = z.infer<typeof layoutTypeSchema>;

export const travelModeSchema = z.enum(['walking', 'driving', 'cycling']);
export type TravelMode = z.infer<typeof travelModeSchema>;

export const eventStyleSchema = z.enum(['seated_dinner', 'standing_reception', 'either']);
export type EventStyle = z.infer<typeof eventStyleSchema>;

export const extractionMethodSchema = z.enum(['api_field', 'html_table', 'pdf_table', 'llm']);
export type ExtractionMethod = z.infer<typeof extractionMethodSchema>;

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const spaceCapacitySchema = z
  .object({
    layout: layoutTypeSchema,
    minCapacity: z.number().int().positive().nullish(),
    maxCapacity: z.number().int().positive(),
    isDerived: z.boolean().default(false),
    derivedFrom: layoutTypeSchema.nullish(),
    derivationRule: z.string().nullish(),
    trust: trustLabelSchema,
  })
  .refine((v) => v.minCapacity == null || v.minCapacity <= v.maxCapacity, {
    message: 'minCapacity must be <= maxCapacity',
    path: ['minCapacity'],
  })
  .refine((v) => v.isDerived === false || v.derivedFrom != null, {
    message: 'derivedFrom is required when isDerived is true',
    path: ['derivedFrom'],
  });
export type SpaceCapacity = z.infer<typeof spaceCapacitySchema>;

export const spaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: spaceKindSchema,
  privacy: privacyLevelSchema.nullish(),
  combinableWith: z.array(z.string()).default([]),
  squareFeet: z.number().int().positive().nullish(),
  hasAv: z.boolean().nullish(),
  isOutdoor: z.boolean().default(false),
  capacities: z.array(spaceCapacitySchema),
});
export type Space = z.infer<typeof spaceSchema>;

export const evidenceSchema = z.object({
  tier: sourceTierSchema,
  sourceUrl: z.string().url(),
  sourceName: z.string().nullish(),
  quote: z.string().min(1),
  quoteVerified: z.literal(true),
  extractionMethod: extractionMethodSchema,
  extractorVersion: z.string().min(1),
  contentHash: z.string().min(1),
  fetchedAt: z.date(),
  rawValue: z.string(),
  injectionFlag: z.boolean().default(false),
});
export type Evidence = z.infer<typeof evidenceSchema>;
