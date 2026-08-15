import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/diner_test';

const sql = postgres(DATABASE_URL, { max: 1 });

async function resetSchema(): Promise<void> {
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`GRANT ALL ON SCHEMA public TO postgres`;
  await sql`GRANT ALL ON SCHEMA public TO public`;
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
}

beforeAll(async () => {
  await resetSchema();
  await runMigrations(DATABASE_URL);
});

afterAll(async () => {
  await sql.end();
});

async function tableExists(name: string): Promise<boolean> {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists
  `;
  return row!.exists;
}

async function enumExists(name: string): Promise<boolean> {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = ${name} AND typtype = 'e'
    ) AS exists
  `;
  return row!.exists;
}

async function indexExists(name: string): Promise<boolean> {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = ${name}
    ) AS exists
  `;
  return row!.exists;
}

describe('migrations apply cleanly from empty', () => {
  it('runs a second time without error (idempotent)', async () => {
    await expect(runMigrations(DATABASE_URL)).resolves.not.toThrow();
  });

  it('creates every enum from §4.1 and §4.4', async () => {
    for (const name of [
      'trust_label',
      'source_tier',
      'space_kind',
      'privacy_level',
      'layout_type',
      'travel_mode',
      'search_status',
      'event_style',
    ]) {
      expect(await enumExists(name), `enum ${name}`).toBe(true);
    }
  });

  it('creates every table from §4.1–4.5', async () => {
    for (const name of [
      'venue',
      'space',
      'space_capacity',
      'fact',
      'evidence',
      'negative_evidence',
      'places_cache',
      'search',
      'search_result',
      'search_stage_log',
      'geocode_cache',
      'isochrone_cache',
      'page_cache',
      'extraction_cache',
    ]) {
      expect(await tableExists(name), `table ${name}`).toBe(true);
    }
  });

  it('creates the required indexes', async () => {
    for (const name of [
      'venue_geog_idx',
      'venue_metro_idx',
      'venue_name_trgm',
      'fact_venue_field_idx',
      'evidence_fact_idx',
      'places_cache_expiry',
    ]) {
      expect(await indexExists(name), `index ${name}`).toBe(true);
    }
  });

  it('rejects an evidence row with quote_verified = false', async () => {
    const [venue] = await sql<{ id: string }[]>`
      INSERT INTO venue (name, address_line, city, geog)
      VALUES ('Test Venue', '123 Main St', 'New York', ST_GeogFromText('SRID=4326;POINT(-73.98 40.75)'))
      RETURNING id
    `;
    const [fact] = await sql<{ id: string }[]>`
      INSERT INTO fact (venue_id, field, value_num, unit, trust, trust_reason)
      VALUES (${venue!.id}, 'capacity.seated_dinner', 40, 'people', 'verified', 'test')
      RETURNING id
    `;
    await expect(
      sql`
        INSERT INTO evidence (
          fact_id, tier, source_url, quote, quote_verified,
          extraction_method, extractor_version, content_hash, fetched_at, raw_value
        ) VALUES (
          ${fact!.id}, 'A', 'https://example.com', 'seats 40', false,
          'llm', 'v1', 'abc123', now(), '40'
        )
      `,
    ).rejects.toThrow();
  });

  it('accepts an evidence row with quote_verified = true', async () => {
    const [venue] = await sql<{ id: string }[]>`
      INSERT INTO venue (name, address_line, city, geog)
      VALUES ('Test Venue 2', '124 Main St', 'New York', ST_GeogFromText('SRID=4326;POINT(-73.98 40.75)'))
      RETURNING id
    `;
    const [fact] = await sql<{ id: string }[]>`
      INSERT INTO fact (venue_id, field, value_num, unit, trust, trust_reason)
      VALUES (${venue!.id}, 'capacity.seated_dinner', 40, 'people', 'verified', 'test')
      RETURNING id
    `;
    await expect(
      sql`
        INSERT INTO evidence (
          fact_id, tier, source_url, quote, quote_verified,
          extraction_method, extractor_version, content_hash, fetched_at, raw_value
        ) VALUES (
          ${fact!.id}, 'A', 'https://example.com', 'seats 40', true,
          'llm', 'v1', 'abc123', now(), '40'
        )
      `,
    ).resolves.not.toThrow();
  });

  it('rejects a space_capacity row where max_capacity <= 0', async () => {
    const [venue] = await sql<{ id: string }[]>`
      INSERT INTO venue (name, address_line, city, geog)
      VALUES ('Test Venue 3', '125 Main St', 'New York', ST_GeogFromText('SRID=4326;POINT(-73.98 40.75)'))
      RETURNING id
    `;
    const [space] = await sql<{ id: string }[]>`
      INSERT INTO space (venue_id, name, kind) VALUES (${venue!.id}, 'Main Room', 'private_room')
      RETURNING id
    `;
    await expect(
      sql`
        INSERT INTO space_capacity (space_id, layout, max_capacity, trust)
        VALUES (${space!.id}, 'seated_dinner', 0, 'unverified')
      `,
    ).rejects.toThrow();
  });

  it('rejects is_derived = true without derived_from', async () => {
    const [venue] = await sql<{ id: string }[]>`
      INSERT INTO venue (name, address_line, city, geog)
      VALUES ('Test Venue 4', '126 Main St', 'New York', ST_GeogFromText('SRID=4326;POINT(-73.98 40.75)'))
      RETURNING id
    `;
    const [space] = await sql<{ id: string }[]>`
      INSERT INTO space (venue_id, name, kind) VALUES (${venue!.id}, 'Main Room 2', 'private_room')
      RETURNING id
    `;
    await expect(
      sql`
        INSERT INTO space_capacity (space_id, layout, max_capacity, is_derived, trust)
        VALUES (${space!.id}, 'standing_reception', 60, true, 'likely')
      `,
    ).rejects.toThrow();
  });

  it('rejects a search with headcount out of range', async () => {
    await expect(
      sql`
        INSERT INTO search (input_address, headcount, max_commute_min)
        VALUES ('123 Main St', 1, 20)
      `,
    ).rejects.toThrow();
    await expect(
      sql`
        INSERT INTO search (input_address, headcount, max_commute_min)
        VALUES ('123 Main St', 5001, 20)
      `,
    ).rejects.toThrow();
  });
});
