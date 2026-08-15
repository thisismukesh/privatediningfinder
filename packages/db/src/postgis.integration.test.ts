import postgres from 'postgres';
import { afterAll, describe, expect, it } from 'vitest';

const DATABASE_URL =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/diner_test';

const sql = postgres(DATABASE_URL, { max: 1 });

afterAll(async () => {
  await sql.end();
});

describe('Postgres + PostGIS local setup', () => {
  it('reports PostGIS 3.3 or newer', async () => {
    const [row] = await sql<{ version: string }[]>`SELECT postgis_full_version() AS version`;
    expect(row).toBeDefined();
    const match = row!.version.match(/POSTGIS="(\d+)\.(\d+)\.(\d+)/);
    expect(match).not.toBeNull();
    const [, major, minor] = match!.map(Number) as [number, number, number, number];
    const meetsMinimum = major! > 3 || (major === 3 && minor! >= 3);
    expect(meetsMinimum).toBe(true);
  });

  it('has pg_trgm and uuid-ossp extensions installed', async () => {
    const rows = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'uuid-ossp', 'postgis')
    `;
    const names = rows.map((r) => r.extname).sort();
    expect(names).toEqual(['pg_trgm', 'postgis', 'uuid-ossp']);
  });

  it('computes geodesic distance correctly (Times Square to Rockefeller Center)', async () => {
    const [row] = await sql<{ meters: number }[]>`
      SELECT ST_Distance(
        'SRID=4326;POINT(-73.9855 40.7580)'::geography,
        'SRID=4326;POINT(-73.9787 40.7587)'::geography
      ) AS meters
    `;
    expect(row).toBeDefined();
    expect(row!.meters).toBeGreaterThan(500);
    expect(row!.meters).toBeLessThan(900);
  });
});
