import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const dir = fileURLToPath(new URL('../docs/rejections/', import.meta.url));
const index = readFileSync(join(dir, 'README.md'), 'utf8');
const pages = readdirSync(dir).filter((name) => name.endsWith('.md') && name !== 'README.md');

describe('rejection pages', () => {
  test.each(pages)('%s follows the format', (name) => {
    const text = readFileSync(join(dir, name), 'utf8');
    const title = text.match(/^# (.+)\n/)?.[1];
    expect(title).toBeDefined();
    expect(index).toContain(`[${title}](${name})`);
    expect(text).toContain('**Where you see it.**');
    expect(text).toContain('**What it means.**');
    expect(text).toMatch(/\n## Fix\n/);
    expect(text).toMatch(/\n## Source\n\n- \[.+\]\(https:\/\/developers\.facebook\.com\//);
  });

  test.each(['README.md', ...pages])('%s has no broken relative links', (name) => {
    const text = readFileSync(join(dir, name), 'utf8');
    for (const [, target = ''] of text.matchAll(/\]\(([^)#:]+)(?:#[^)]*)?\)/g)) {
      expect(existsSync(join(dir, target)), target).toBe(true);
    }
  });
});
