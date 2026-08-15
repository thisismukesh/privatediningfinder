import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.js';

const BASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/diner_test';

function withRole(url: string, role: 'anon' | 'service_role'): string {
  const u = new URL(url);
  u.searchParams.set('options', `-c role=${role}`);
  return u.toString();
}

const adminSql = postgres(BASE_URL, { max: 1 });
const anonSql = postgres(withRole(BASE_URL, 'anon'), { max: 1 });
const serviceSql = postgres(withRole(BASE_URL, 'service_role'), { max: 1 });

let venueId: string;
let searchId: string;
const validToken = 'a'.repeat(22) + '==';

beforeAll(async () => {
  await adminSql`DROP SCHEMA public CASCADE`;
  await adminSql`CREATE SCHEMA public`;
  await adminSql`GRANT ALL ON SCHEMA public TO postgres`;
  await adminSql`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role`;
  await adminSql`CREATE EXTENSION IF NOT EXISTS postgis`;
  await adminSql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await adminSql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await runMigrations(BASE_URL);

  const [venue] = await adminSql<{ id: string }[]>`
    INSERT INTO venue (name, address_line, city, geog)
    VALUES ('Shared Venue', '1 Main St', 'New York', ST_GeogFromText('SRID=4326;POINT(-73.98 40.75)'))
    RETURNING id
  `;
  venueId = venue!.id;

  const [search] = await adminSql<{ id: string }[]>`
    INSERT INTO search (input_address, headcount, max_commute_min, share_token, status)
    VALUES ('1 Main St', 20, 15, ${validToken}, 'complete')
    RETURNING id
  `;
  searchId = search!.id;

  await adminSql`
    INSERT INTO search_result (
      search_id, venue_id, rank, bucket, score_total, score_breakdown, risk_multiplier,
      fit, commute_mode, commute_is_estimated
    ) VALUES (
      ${searchId}, ${venueId}, 1, 'recommended', 88.5, '{}'::jsonb, 1.0,
      '[]'::jsonb, 'walking', false
    )
  `;
});

afterAll(async () => {
  await adminSql.end();
  await anonSql.end();
  await serviceSql.end();
});

describe('Row Level Security (§4.6)', () => {
  it('anon cannot read venue directly', async () => {
    await expect(anonSql`SELECT * FROM venue`).rejects.toThrow(/permission denied|policy/i);
  });

  it('anon cannot read search directly', async () => {
    await expect(anonSql`SELECT * FROM search`).rejects.toThrow(/permission denied|policy/i);
  });

  it('anon cannot read search_result directly', async () => {
    await expect(anonSql`SELECT * FROM search_result`).rejects.toThrow(/permission denied|policy/i);
  });

  it('service_role can read venue directly (bypasses RLS)', async () => {
    const rows = await serviceSql`SELECT * FROM venue WHERE id = ${venueId}`;
    expect(rows.length).toBe(1);
  });

  it('anon can read the shared search via a valid token', async () => {
    const rows = await anonSql`SELECT * FROM get_shared_search(${validToken})`;
    expect(rows.length).toBe(1);
    expect(rows[0]?.venue_name).toBe('Shared Venue');
  });

  it('anon gets an empty result for an invalid token (no enumeration signal)', async () => {
    const rows = await anonSql`SELECT * FROM get_shared_search(${'b'.repeat(22) + '=='})`;
    expect(rows.length).toBe(0);
  });

  it('anon gets an empty result for a null-like empty token', async () => {
    const rows = await anonSql`SELECT * FROM get_shared_search(${''})`;
    expect(rows.length).toBe(0);
  });
});
