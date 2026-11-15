import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { version } from '../src/index.js';

test('exports the version from package.json', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  expect(version).toBe(pkg.version);
});
