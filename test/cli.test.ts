import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { type CliIo, main } from '../src/cli.js';
import { version } from '../src/index.js';
import { fakeGraph } from './fake-graph.js';

const secret = 'test-secret-0123456789abcdef';

async function run(argv: string[], env: CliIo['env'] = {}, isTTY = false) {
  let stdout = '';
  let stderr = '';
  const code = await main(argv, {
    env,
    isTTY,
    fetch: fakeGraph().fetch,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

const env = { META_APP_ID: '1234567890', META_APP_SECRET: secret };

describe('cleared', () => {
  test('doctor exits 0 without blocking issues', async () => {
    const { code, stdout } = await run(['doctor'], env);
    expect(code).toBe(0);
    expect(stdout).toContain('0 blocking');
    expect(stdout).not.toContain(secret);
  });

  test('doctor exits 1 on blocking issues', async () => {
    const { code, stdout } = await run(['doctor']);
    expect(code).toBe(1);
    expect(stdout).toContain('META_APP_ID is not set');
  });

  test('doctor --json prints the report', async () => {
    const { code, stdout } = await run(['doctor', '--json'], env);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report).toMatchObject({ version, appId: '1234567890', summary: { blocking: 0 } });
    expect(stdout).not.toContain(secret);
  });

  test('uses colors only on a terminal and respects NO_COLOR', async () => {
    expect((await run(['doctor'], env, true)).stdout).toContain('\x1b[');
    expect((await run(['doctor'], { ...env, NO_COLOR: '1' }, true)).stdout).not.toContain('\x1b[');
    expect((await run(['doctor'], { ...env, FORCE_COLOR: '1' })).stdout).toContain('\x1b[');
  });

  test('prints help and the version', async () => {
    expect((await run([])).stdout).toContain('Usage: cleared');
    expect((await run(['--help'])).code).toBe(0);
    expect((await run(['-v'])).stdout).toBe(`${version}\n`);
  });

  test('exits 2 on bad usage', async () => {
    const unknown = await run(['deploy']);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('Unknown command: deploy');
    expect((await run(['doctor', '--nope'])).code).toBe(2);
  });

  test('package.json points the bin at the built entry', async () => {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.bin).toEqual({ cleared: './dist/bin.js' });
    const bin = await readFile(new URL('../src/bin.ts', import.meta.url), 'utf8');
    expect(bin.startsWith('#!/usr/bin/env node\n')).toBe(true);
  });
});
