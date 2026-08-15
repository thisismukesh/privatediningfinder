import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

function timestamptz(name: string) {
  return timestamp(name, { withTimezone: true });
}

// PostGIS geography/geometry columns aren't natively typed by drizzle-orm; represent them
// as a custom type so drizzle-kit round-trips them without trying to manage the PostGIS
// extension's own type definitions.
const geography = customType<{ data: string }>({
  dataType() {
    return 'geography(Point,4326)';
  },
});

const geometryMultiPolygon = customType<{ data: string }>({
  dataType() {
    return 'geometry(MultiPolygon,4326)';
  },
});

export const trustLabel = pgEnum('trust_label', ['verified', 'likely', 'unverified']);
export const sourceTier = pgEnum('source_tier', ['A', 'B', 'C', 'D', 'E']);
export const spaceKind = pgEnum('space_kind', [
  'private_room',
  'semi_private',
  'patio',
  'bar_area',
  'ballroom',
  'full_buyout',
  'event_lawn',
]);
export const privacyLevel = pgEnum('privacy_level', [
  'dedicated_enclosed',
  'semi_private_partitioned',
  'open_area_reserved',
]);
export const layoutType = pgEnum('layout_type', [
  'seated_dinner',
  'standing_reception',
  'theater',
  'u_shape',
  'boardroom',
  'classroom',
  'banquet_rounds',
]);
export const travelMode = pgEnum('travel_mode', ['walking', 'driving', 'cycling']);
export const searchStatus = pgEnum('search_status', [
  'queued',
  'running',
  'complete',
  'failed',
  'partial',
]);
export const eventStyle = pgEnum('event_style', ['seated_dinner', 'standing_reception', 'either']);

export const venue = pgTable(
  'venue',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    googlePlaceId: text('google_place_id').unique(),
    osmId: text('osm_id').unique(),
    name: text('name').notNull(),
    addressLine: text('address_line').notNull(),
    city: text('city').notNull(),
    region: text('region'),
    postalCode: text('postal_code'),
    country: text('country').notNull().default('US'),
    geog: geography('geog').notNull(),
    websiteUrl: text('website_url'),
    phone: text('phone'),
    email: text('email'),
    venueType: text('venue_type'),
    metroSlug: text('metro_slug'),
    crawlState: jsonb('crawl_state').notNull().default({}),
    lastCrawledAt: timestamptz('last_crawled_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('venue_metro_idx').on(t.metroSlug),
    // venue_geog_idx (GIST) and venue_name_trgm (GIN, trgm ops) are created by raw SQL
    // migration since drizzle-kit does not model GiST/GIN operator classes.
  ],
);

export const space = pgTable(
  'space',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: spaceKind('kind').notNull(),
    privacy: privacyLevel('privacy'),
    privacyTrust: trustLabel('privacy_trust').notNull().default('unverified'),
    combinableWith: uuid('combinable_with').array().notNull().default([]),
    squareFeet: integer('square_feet'),
    hasAv: boolean('has_av'),
    isOutdoor: boolean('is_outdoor').notNull().default(false),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [unique().on(t.venueId, t.name)],
);

export const spaceCapacity = pgTable(
  'space_capacity',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => space.id, { onDelete: 'cascade' }),
    layout: layoutType('layout').notNull(),
    minCapacity: integer('min_capacity'),
    maxCapacity: integer('max_capacity').notNull(),
    isDerived: boolean('is_derived').notNull().default(false),
    derivedFrom: layoutType('derived_from'),
    derivationRule: text('derivation_rule'),
    trust: trustLabel('trust').notNull(),
    factId: uuid('fact_id'),
  },
  (t) => [
    unique().on(t.spaceId, t.layout),
    check('space_capacity_max_positive', sql`${t.maxCapacity} > 0`),
    check(
      'space_capacity_min_le_max',
      sql`${t.minCapacity} IS NULL OR ${t.minCapacity} <= ${t.maxCapacity}`,
    ),
    check(
      'space_capacity_derived_requires_source',
      sql`${t.isDerived} = false OR ${t.derivedFrom} IS NOT NULL`,
    ),
  ],
);

export const fact = pgTable(
  'fact',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id').references(() => space.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    valueNum: numeric('value_num'),
    valueText: text('value_text'),
    valueJson: jsonb('value_json'),
    unit: text('unit'),
    trust: trustLabel('trust').notNull(),
    trustReason: text('trust_reason').notNull(),
    isConflicted: boolean('is_conflicted').notNull().default(false),
    computedAt: timestamptz('computed_at').notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.venueId, t.spaceId, t.field),
    index('fact_venue_field_idx').on(t.venueId, t.field),
  ],
);

export const evidence = pgTable(
  'evidence',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    factId: uuid('fact_id')
      .notNull()
      .references(() => fact.id, { onDelete: 'cascade' }),
    tier: sourceTier('tier').notNull(),
    sourceUrl: text('source_url').notNull(),
    sourceName: text('source_name'),
    quote: text('quote').notNull(),
    quoteVerified: boolean('quote_verified').notNull(),
    extractionMethod: text('extraction_method').notNull(),
    extractorVersion: text('extractor_version').notNull(),
    contentHash: text('content_hash').notNull(),
    fetchedAt: timestamptz('fetched_at').notNull(),
    rawValue: text('raw_value').notNull(),
    injectionFlag: boolean('injection_flag').notNull().default(false),
  },
  (t) => [
    index('evidence_fact_idx').on(t.factId),
    check('evidence_quote_verified_true', sql`${t.quoteVerified} = true`),
  ],
);

export const negativeEvidence = pgTable(
  'negative_evidence',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    sourceUrl: text('source_url').notNull(),
    checkedAt: timestamptz('checked_at').notNull().defaultNow(),
    note: text('note'),
  },
  (t) => [unique().on(t.venueId, t.field, t.sourceUrl)],
);

export const placesCache = pgTable(
  'places_cache',
  {
    placeId: text('place_id').primaryKey(),
    payload: jsonb('payload').notNull(),
    fetchedAt: timestamptz('fetched_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at')
      .notNull()
      .default(sql`(now() + interval '30 days')`),
  },
  (t) => [index('places_cache_expiry').on(t.expiresAt)],
);

export const search = pgTable('search', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuid_generate_v4()`),
  inputAddress: text('input_address').notNull(),
  originGeog: geography('origin_geog'),
  headcount: integer('headcount').notNull(),
  maxCommuteMin: integer('max_commute_min').notNull(),
  mode: travelMode('mode'),
  modeWasExplicit: boolean('mode_was_explicit').notNull().default(false),
  modeReason: text('mode_reason'),
  style: eventStyle('style').notNull().default('either'),
  styleWasInferred: boolean('style_was_inferred').notNull().default(false),
  budgetTotal: numeric('budget_total'),
  budgetPerPerson: numeric('budget_per_person'),
  dietary: text('dietary').array().notNull().default([]),
  isochroneGeom: geometryMultiPolygon('isochrone_geom'),
  status: searchStatus('status').notNull().default('queued'),
  stage: text('stage'),
  error: text('error'),
  costUsd: numeric('cost_usd').notNull().default('0'),
  shareToken: text('share_token').unique(),
  sessionKey: text('session_key'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  completedAt: timestamptz('completed_at'),
});

export const searchResult = pgTable(
  'search_result',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    searchId: uuid('search_id')
      .notNull()
      .references(() => search.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venue.id),
    rank: integer('rank').notNull(),
    bucket: text('bucket').notNull(),
    scoreTotal: numeric('score_total').notNull(),
    scoreBreakdown: jsonb('score_breakdown').notNull(),
    riskMultiplier: numeric('risk_multiplier').notNull(),
    constraintApplied: boolean('constraint_applied').notNull().default(false),
    fit: jsonb('fit').notNull(),
    commuteMinutes: numeric('commute_minutes'),
    commuteMeters: numeric('commute_meters'),
    commuteMode: travelMode('commute_mode').notNull(),
    commuteIsEstimated: boolean('commute_is_estimated').notNull(),
  },
  (t) => [unique().on(t.searchId, t.venueId), unique().on(t.searchId, t.rank)],
);

export const searchStageLog = pgTable('search_stage_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  searchId: uuid('search_id')
    .notNull()
    .references(() => search.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  status: text('status').notNull(),
  message: text('message'),
  durationMs: integer('duration_ms'),
  at: timestamptz('at').notNull().defaultNow(),
});

export const geocodeCache = pgTable('geocode_cache', {
  queryHash: text('query_hash').primaryKey(),
  query: text('query').notNull(),
  geog: geography('geog').notNull(),
  formattedAddress: text('formatted_address'),
  fetchedAt: timestamptz('fetched_at').notNull().defaultNow(),
});

export const isochroneCache = pgTable('isochrone_cache', {
  cacheKey: text('cache_key').primaryKey(),
  geom: geometryMultiPolygon('geom').notNull(),
  provider: text('provider').notNull(),
  fetchedAt: timestamptz('fetched_at').notNull().defaultNow(),
});

export const pageCache = pgTable('page_cache', {
  urlHash: text('url_hash').primaryKey(),
  url: text('url').notNull(),
  contentHash: text('content_hash').notNull(),
  content: text('content'),
  contentType: text('content_type'),
  httpStatus: integer('http_status').notNull(),
  fetchedAt: timestamptz('fetched_at').notNull().defaultNow(),
});

export const extractionCache = pgTable('extraction_cache', {
  cacheKey: text('cache_key').primaryKey(),
  contentHash: text('content_hash').notNull(),
  extractorVersion: text('extractor_version').notNull(),
  result: jsonb('result').notNull(),
  tokensUsed: integer('tokens_used'),
  costUsd: numeric('cost_usd'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});
