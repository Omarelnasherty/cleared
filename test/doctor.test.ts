import { describe, expect, test } from 'vitest';
import { checkAppSettings, formatReport, runDoctor } from '../src/doctor.js';
import { GRAPH_API_VERSION } from '../src/graph.js';
import { version } from '../src/index.js';
import { completeApp, fakeGraph } from './fake-graph.js';

const secret = 'test-secret-0123456789abcdef';
const env = { META_APP_ID: '1234567890', META_APP_SECRET: secret };

describe('runDoctor', () => {
  test('passes a complete app', async () => {
    const graph = fakeGraph();
    const report = await runDoctor({ env, fetch: graph.fetch });
    expect(report.version).toBe(version);
    expect(report.appId).toBe('1234567890');
    expect(report.summary).toEqual({ pass: 12, manual: 0, blocking: 0 });
    expect(report.findings[2]?.title).toBe('Read the app settings (Example App)');
  });

  test('reads the app with an app access token on the pinned version', async () => {
    const graph = fakeGraph();
    await runDoctor({ env, fetch: graph.fetch });
    const [url] = graph.urls;
    expect(url?.origin).toBe('https://graph.facebook.com');
    expect(url?.pathname).toBe(`/${GRAPH_API_VERSION}/1234567890`);
    expect(url?.searchParams.get('access_token')).toBe(`1234567890|${secret}`);
    expect(url?.searchParams.get('fields')?.split(',')).toContain('privacy_policy_url');
  });

  test('loads the privacy policy and terms pages without the token', async () => {
    const graph = fakeGraph(completeApp, 200, {
      'https://example.com/privacy': { status: 302, location: '/login' },
    });
    const report = await runDoctor({ env, fetch: graph.fetch });
    expect(graph.pageUrls.map((u) => u.href)).toEqual([
      'https://example.com/privacy',
      'https://example.com/terms',
    ]);
    expect(graph.pageUrls.some((u) => u.href.includes(secret))).toBe(false);
    const statuses = Object.fromEntries(report.findings.map((f) => [f.id, f.status]));
    expect(statuses['url.privacy-policy']).toBe('blocking');
    expect(statuses['url.terms']).toBe('pass');
  });

  test('skips the page checks for URLs that are not set', async () => {
    const graph = fakeGraph({ name: 'Empty' });
    await runDoctor({ env, fetch: graph.fetch });
    expect(graph.pageUrls).toHaveLength(0);
  });

  test('blocks when the Graph API rejects the credentials', async () => {
    const graph = fakeGraph(
      { error: { message: 'Error validating client secret.', type: 'OAuthException', code: 1 } },
      400,
    );
    const report = await runDoctor({ env, fetch: graph.fetch });
    expect(report.findings.map((f) => [f.id, f.status])).toEqual([
      ['env.app-id', 'pass'],
      ['env.app-secret', 'pass'],
      ['graph.app', 'blocking'],
    ]);
    expect(report.findings[2]?.detail).toBe(
      'Error validating client secret. Check that META_APP_ID and META_APP_SECRET belong to the same app.',
    );
  });

  test('blocks when the Graph API cannot be reached, without leaking the secret', async () => {
    const fetch = async () => {
      throw new Error(`connect failed for access_token=1234567890|${secret}`);
    };
    const report = await runDoctor({ env, fetch });
    expect(report.findings[2]?.status).toBe('blocking');
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  test('does not call the Graph API when the environment is incomplete', async () => {
    const graph = fakeGraph();
    const report = await runDoctor({ env: {}, fetch: graph.fetch });
    expect(graph.urls).toHaveLength(0);
    expect(report.appId).toBeNull();
    expect(report.findings.map((f) => [f.id, f.status])).toEqual([
      ['env.app-id', 'blocking'],
      ['env.app-secret', 'blocking'],
    ]);
  });

  test('blocks an app ID that is not numeric', async () => {
    const report = await runDoctor({
      env: { ...env, META_APP_ID: 'my-app' },
      fetch: fakeGraph().fetch,
    });
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
      const report = await runDoctor({
        env: { ...env, META_APP_SECRET: value },
        fetch: fakeGraph().fetch,
      });
      expect(JSON.stringify(report)).not.toContain(secret);
      expect(formatReport(report)).not.toContain(secret);
    }
  });
});

describe('checkAppSettings', () => {
  const statuses = (app: typeof completeApp) =>
    Object.fromEntries(checkAppSettings(app).map((f) => [f.id, f.status]));

  test('passes a complete app', () => {
    expect(new Set(Object.values(statuses(completeApp)))).toEqual(new Set(['pass']));
  });

  test('blocks on a missing privacy policy, icon and category', () => {
    expect(statuses({ name: 'Empty' })).toEqual({
      'app.privacy-policy': 'blocking',
      'app.terms': 'manual',
      'app.icon': 'blocking',
      'app.category': 'blocking',
      'app.domains': 'manual',
      'app.deauthorize': 'manual',
    });
  });

  test('treats blank values as missing', () => {
    const result = statuses({ ...completeApp, privacy_policy_url: ' ', app_domains: [''] });
    expect(result['app.privacy-policy']).toBe('blocking');
    expect(result['app.domains']).toBe('manual');
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
    const text = formatReport(await runDoctor({ env, fetch: fakeGraph().fetch }));
    expect(text).not.toContain('contact@');
    expect(text).not.toContain('\x1b[');
  });

  test('colors the marks with the brand colors', async () => {
    const text = formatReport(await runDoctor({ env: { META_APP_ID: '1' } }), { color: true });
    expect(text).toContain('\x1b[38;2;43;214;123m✓\x1b[39m');
    expect(text).toContain('\x1b[38;2;240;87;79m✗\x1b[39m');
  });
});
