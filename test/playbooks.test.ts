import { describe, expect, test } from 'vitest';
import { type CliIo, main } from '../src/cli.js';
import { formatPlaybook, getPlaybook, listPlaybooks } from '../src/playbooks.js';

async function run(argv: string[], isTTY = false) {
  let stdout = '';
  let stderr = '';
  const io: CliIo = {
    env: {},
    isTTY,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  };
  const code = await main(argv, io);
  return { code, stdout, stderr };
}

describe('playbooks', () => {
  test('every playbook is complete', () => {
    const playbooks = listPlaybooks();
    expect(playbooks.length).toBeGreaterThan(0);
    for (const playbook of playbooks) {
      expect(playbook.permission).toMatch(/^[a-z_]+$/);
      expect(playbook.summary).not.toBe('');
      expect(playbook.reviewerNeeds.length).toBeGreaterThan(0);
      expect(playbook.screencast.length).toBeGreaterThan(0);
      expect(playbook.notes).toContain(playbook.permission);
      for (const url of playbook.docs)
        expect(url).toMatch(/^https:\/\/developers\.facebook\.com\//);
      for (const name of playbook.requires) expect(getPlaybook(name)).toBeDefined();
    }
  });

  test('lists playbooks sorted by permission', () => {
    const names = listPlaybooks().map((p) => p.permission);
    expect(names).toEqual([...names].sort());
  });

  test('finds a playbook ignoring case and spaces', () => {
    expect(getPlaybook(' PAGES_SHOW_LIST ')?.permission).toBe('pages_show_list');
    expect(getPlaybook('nope')).toBeUndefined();
  });

  test('formats the sections in order, with the common screencast steps first', () => {
    const playbook = getPlaybook('pages_show_list');
    if (!playbook) throw new Error('missing playbook');
    const text = formatPlaybook(playbook);
    const sections = ['What the reviewer needs to see', 'Screencast', 'Reviewer notes', 'Docs'];
    const positions = sections.map((s) => text.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(text).toContain('  1. Start logged out');
    expect(text).not.toContain('\x1b[');
    expect(text).not.toMatch(/guarantee/i);
  });
});

describe('cleared playbook', () => {
  test('lists the playbooks', async () => {
    const { code, stdout } = await run(['playbook']);
    expect(code).toBe(0);
    expect(stdout).toContain('pages_show_list');
  });

  test('prints a playbook as text or JSON', async () => {
    const text = await run(['playbook', 'pages_show_list']);
    expect(text.code).toBe(0);
    expect(text.stdout).toContain('pages_show_list (Pages)');
    const json = await run(['playbook', 'pages_show_list', '--json']);
    expect(JSON.parse(json.stdout)).toMatchObject({ permission: 'pages_show_list' });
    expect((await run(['playbook', 'pages_show_list'], true)).stdout).toContain('\x1b[');
  });

  test('exits 2 for an unknown permission or extra arguments', async () => {
    const unknown = await run(['playbook', 'ads_management']);
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('No playbook for ads_management yet');
    expect((await run(['playbook', 'a', 'b'])).code).toBe(2);
  });
});
