import { describe, expect, test } from 'vitest';
import { formatReport, runDoctor } from '../src/doctor.js';
import { version } from '../src/index.js';

const secret = 'test-secret-0123456789abcdef';
const env = { META_APP_ID: '1234567890', META_APP_SECRET: secret };

describe('runDoctor', () => {
  test('passes when the app ID and secret are set', async () => {
    const report = await runDoctor({ env });
    expect(report.version).toBe(version);
    expect(report.appId).toBe('1234567890');
    expect(report.summary).toEqual({ pass: 2, manual: 0, blocking: 0 });
  });

  test('blocks when the variables are missing', async () => {
    const report = await runDoctor({ env: {} });
    expect(report.appId).toBeNull();
    expect(report.findings.map((f) => [f.id, f.status])).toEqual([
      ['env.app-id', 'blocking'],
      ['env.app-secret', 'blocking'],
    ]);
  });

  test('blocks an app ID that is not numeric', async () => {
    const report = await runDoctor({ env: { ...env, META_APP_ID: 'my-app' } });
    expect(report.findings[0]).toMatchObject({
      status: 'blocking',
      title: expect.stringMatching(/valid/),
    });
  });

  test('blocks a secret with whitespace around it', async () => {
    const report = await runDoctor({ env: { ...env, META_APP_SECRET: `${secret}\n` } });
    expect(report.findings[1]?.status).toBe('blocking');
  });

  test('never puts the secret in the report', async () => {
    for (const value of [secret, ` ${secret} `]) {
      const report = await runDoctor({ env: { ...env, META_APP_SECRET: value } });
      expect(JSON.stringify(report)).not.toContain(secret);
      expect(formatReport(report)).not.toContain(secret);
    }
  });
});

describe('formatReport', () => {
  test('lists blocking issues first and ends with the contact line', async () => {
    const text = formatReport(await runDoctor({ env: { META_APP_ID: '1234567890' } }));
    expect(text).toBe(
      [
        `cleared doctor ${version}`,
        '',
        '  ✗ META_APP_SECRET is not set',
        '    Copy it from App settings > Basic in the App Dashboard. Keep it in your environment or a secret manager, never in your code.',
        '  ✓ META_APP_ID is set (1234567890)',
        '',
        '1 blocking, 0 to check by hand, 1 passed.',
        '',
        'Still blocked after fixing these? contact@omarelnasherty.com',
        '',
      ].join('\n'),
    );
  });

  test('has no contact line without blocking issues', async () => {
    const text = formatReport(await runDoctor({ env }));
    expect(text).not.toContain('contact@');
    expect(text).not.toContain('\x1b[');
  });

  test('colors the marks with the brand colors', async () => {
    const text = formatReport(await runDoctor({ env: { META_APP_ID: '1' } }), { color: true });
    expect(text).toContain('\x1b[38;2;43;214;123m✓\x1b[39m');
    expect(text).toContain('\x1b[38;2;240;87;79m✗\x1b[39m');
  });
});
