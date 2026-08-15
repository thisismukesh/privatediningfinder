import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const [row] = await sql<{ exists: boolean }[]>`
        SELECT EXISTS(SELECT 1 FROM _migrations WHERE name = ${file}) AS exists
      `;
      if (row?.exists) continue;
      const contents = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await sql.unsafe(contents);
      await sql`INSERT INTO _migrations (name) VALUES (${file})`;
    }
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL or DIRECT_DATABASE_URL must be set.');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => {
      console.log('Migrations applied.');
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
