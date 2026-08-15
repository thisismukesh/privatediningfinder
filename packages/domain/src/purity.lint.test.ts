import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

function lintSnippet(code: string): { violated: boolean; output: string } {
  const dir = mkdtempSync(join(tmpdir(), 'domain-purity-'));
  const file = join(repoRoot, 'packages', 'domain', 'src', `__tmp_${Date.now()}.ts`);
  writeFileSync(file, code);
  try {
    execFileSync('npx', ['eslint', file], { cwd: repoRoot, stdio: 'pipe' });
    return { violated: false, output: '' };
  } catch (err) {
    const output = (err as { stdout?: Buffer }).stdout?.toString() ?? '';
    return { violated: true, output };
  } finally {
    rmSync(file, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('packages/domain purity enforcement', () => {
  it('rejects fetch()', () => {
    const { violated, output } = lintSnippet(`export async function bad() {
  return fetch('http://example.com');
}
`);
    expect(violated).toBe(true);
    expect(output).toContain('must not perform IO');
  });

  it('rejects fs imports', () => {
    const { violated, output } = lintSnippet(`import fs from 'fs';
export const bad = () => fs.readFileSync('x');
`);
    expect(violated).toBe(true);
    expect(output).toContain('must not perform IO');
  });

  it('rejects Date.now()', () => {
    const { violated, output } = lintSnippet(`export const bad = () => Date.now();`);
    expect(violated).toBe(true);
    expect(output).toContain('system clock');
  });

  it('rejects new Date() with no arguments', () => {
    const { violated, output } = lintSnippet(`export const bad = () => new Date();`);
    expect(violated).toBe(true);
    expect(output).toContain('system clock');
  });

  it('rejects Math.random()', () => {
    const { violated, output } = lintSnippet(`export const bad = () => Math.random();`);
    expect(violated).toBe(true);
    expect(output).toContain('Math.random');
  });

  it('allows pure code with an injected now parameter', () => {
    const { violated } = lintSnippet(`export const good = (now: number) => now + 1;`);
    expect(violated).toBe(false);
  });
}, 30_000);
