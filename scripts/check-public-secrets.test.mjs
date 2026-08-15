import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findViolations } from './check-public-secrets.mjs';

test('flags a NEXT_PUBLIC_ variable containing KEY', () => {
  const violations = findViolations('NEXT_PUBLIC_FAKE_KEY=abc123\n');
  assert.deepEqual(violations, ['NEXT_PUBLIC_FAKE_KEY']);
});

test('flags TOKEN and SECRET too', () => {
  const violations = findViolations('NEXT_PUBLIC_AUTH_TOKEN=x\nNEXT_PUBLIC_APP_SECRET=y\n');
  assert.deepEqual(violations, ['NEXT_PUBLIC_AUTH_TOKEN', 'NEXT_PUBLIC_APP_SECRET']);
});

test('allows the documented allowlist exception', () => {
  const violations = findViolations('NEXT_PUBLIC_MAPTILER_KEY=abc123\n');
  assert.deepEqual(violations, []);
});

test('ignores non-NEXT_PUBLIC_ vars and comments', () => {
  const violations = findViolations('# comment\nANTHROPIC_API_KEY=x\nDATABASE_URL=y\n');
  assert.deepEqual(violations, []);
});

test('allows NEXT_PUBLIC_ vars with no sensitive substring', () => {
  const violations = findViolations('NEXT_PUBLIC_APP_NAME=DINER\n');
  assert.deepEqual(violations, []);
});

test('CLI exits 1 on a deliberately injected NEXT_PUBLIC_FAKE_KEY', () => {
  const dir = mkdtempSync(join(tmpdir(), 'secret-check-'));
  const file = join(dir, '.env');
  writeFileSync(file, 'NEXT_PUBLIC_FAKE_KEY=shouldfail\n');
  assert.throws(() => {
    execFileSync('node', [join(import.meta.dirname, 'check-public-secrets.mjs'), file], {
      stdio: 'pipe',
    });
  });
  rmSync(dir, { recursive: true, force: true });
});

test('CLI exits 0 on a clean env file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'secret-check-'));
  const file = join(dir, '.env');
  writeFileSync(file, 'DATABASE_URL=postgresql://x\nNEXT_PUBLIC_MAPTILER_KEY=abc\n');
  execFileSync('node', [join(import.meta.dirname, 'check-public-secrets.mjs'), file], {
    stdio: 'pipe',
  });
  rmSync(dir, { recursive: true, force: true });
});
