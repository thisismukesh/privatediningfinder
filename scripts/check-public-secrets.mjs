#!/usr/bin/env node
// CI hard-fails if any variable containing KEY, TOKEN, or SECRET is prefixed NEXT_PUBLIC_,
// except the explicit allowlist in SPECS.md §3.4 (NEXT_PUBLIC_MAPTILER_KEY — a
// client-side map tile key, not a secret).
import { readFileSync } from 'node:fs';

const ALLOWLIST = new Set(['NEXT_PUBLIC_MAPTILER_KEY']);
const SENSITIVE = /KEY|TOKEN|SECRET/i;

export function findViolations(envFileContents) {
  const violations = [];
  for (const line of envFileContents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name.startsWith('NEXT_PUBLIC_') && SENSITIVE.test(name) && !ALLOWLIST.has(name)) {
      violations.push(name);
    }
  }
  return violations;
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: check-public-secrets.mjs <file...>');
    process.exit(2);
  }
  let allViolations = [];
  for (const file of files) {
    let contents;
    try {
      contents = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const violations = findViolations(contents).map((name) => `${file}: ${name}`);
    allViolations = allViolations.concat(violations);
  }
  if (allViolations.length > 0) {
    console.error('NEXT_PUBLIC_ secret check failed:');
    for (const v of allViolations) {
      console.error(`  ${v} — a NEXT_PUBLIC_ variable must not contain KEY/TOKEN/SECRET`);
    }
    process.exit(1);
  }
  console.log('NEXT_PUBLIC_ secret check passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
