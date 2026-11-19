import { describe, expect, test } from 'vitest';
import { runDoctor } from '../src/doctor.js';
import type { Subscription } from '../src/graph.js';
import { checkWebhooks } from '../src/webhooks.js';
import { fakeGraph, type Page } from './fake-graph.js';

const secret = 'test-secret-0123456789abcdef';
const env = { META_APP_ID: '1234567890', META_APP_SECRET: secret };
const hook = 'https://example.com/webhook';
const rejects: Record<string, Page> = { [hook]: { status: 403 } };

const page: Subscription = {
  object: 'page',
  callback_url: hook,
  active: true,
  fields: [{ name: 'messages', version: 'v25.0' }],
};

async function check(subscriptions: Subscription[], pages: Record<string, Page> = rejects) {
  const graph = fakeGraph(undefined, 200, pages);
  const findings = await checkWebhooks(subscriptions, graph.fetch);
  return { findings, graph };
}

const statuses = (findings: { id: string; status: string }[]) =>
  findings.map((f) => [f.id, f.status]);

describe('checkWebhooks', () => {
  test('passes an active subscription whose callback rejects a wrong token', async () => {
    const { findings } = await check([page]);
    expect(statuses(findings)).toEqual([
      ['webhook.page', 'pass'],
      ['webhook.page.callback', 'pass'],
    ]);
  });

  test('sends a verification request with a random token, never a real one', async () => {
    const { graph } = await check([page]);
    const [url] = graph.pageUrls;
    expect(`${url?.origin}${url?.pathname}`).toBe(hook);
    expect(url?.searchParams.get('hub.mode')).toBe('subscribe');
    expect(url?.searchParams.get('hub.challenge')).toMatch(/^[0-9a-f]{16}$/);
    expect(url?.searchParams.get('hub.verify_token')).toMatch(/^cleared-test-[0-9a-f]{16}$/);
  });

  test('blocks an inactive subscription', async () => {
    const { findings } = await check([{ ...page, active: false }]);
    expect(findings[0]).toMatchObject({ id: 'webhook.page', status: 'blocking' });
    expect(findings[0]?.title).toBe('Webhook subscription for page is inactive');
  });

  test('flags a subscription without fields', async () => {
    const { findings } = await check([{ ...page, fields: [] }]);
    expect(statuses(findings)).toContainEqual(['webhook.page.fields', 'manual']);
  });

  test('flags a callback that echoes the challenge for any token', async () => {
    const echo = async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return new Response(url.searchParams.get('hub.challenge'));
    };
    const findings = await checkWebhooks([page], echo as typeof fetch);
    expect(findings[1]).toMatchObject({ status: 'manual' });
    expect(findings[1]?.title).toContain('accepts a wrong verify token');
    expect(findings[1]?.detail).toContain('echoed the challenge');
  });

  test('blocks a callback that is not HTTPS without calling it', async () => {
    const { findings, graph } = await check([{ ...page, callback_url: 'http://example.com/hook' }]);
    expect(findings[1]).toMatchObject({ status: 'blocking' });
    expect(findings[1]?.detail).toContain('does not use HTTPS');
    expect(graph.pageUrls).toHaveLength(0);
  });

  test('blocks a callback that fails or cannot be reached', async () => {
    const { findings } = await check([page], { [hook]: { status: 502 } });
    expect(findings[1]).toMatchObject({ status: 'blocking' });
    expect(findings[1]?.detail).toContain('answers 502');

    const down = async () => {
      throw new Error('getaddrinfo ENOTFOUND example.com');
    };
    const [, unreachable] = await checkWebhooks([page], down);
    expect(unreachable?.status).toBe('blocking');
    expect(unreachable?.detail).toContain('ENOTFOUND');
  });

  test('flags a callback that answers 404 or redirects', async () => {
    const missing = await check([page], { [hook]: { status: 404 } });
    expect(missing.findings[1]).toMatchObject({ status: 'manual' });

    const moved = await check([page], { [hook]: { status: 301, location: '/hooks' } });
    expect(moved.findings[1]).toMatchObject({ status: 'manual' });
    expect(moved.findings[1]?.detail).toContain('/hooks');
  });

  test('blocks a subscription without a callback URL', async () => {
    const { findings } = await check([
      { object: 'user', active: true, fields: [{ name: 'email' }] },
    ]);
    expect(statuses(findings)).toEqual([
      ['webhook.user', 'pass'],
      ['webhook.user.callback', 'blocking'],
    ]);
  });

  test('calls a callback URL shared by several subscriptions once', async () => {
    const { findings, graph } = await check([page, { ...page, object: 'permissions' }]);
    expect(graph.pageUrls).toHaveLength(1);
    expect(statuses(findings)).toContainEqual(['webhook.permissions.callback', 'pass']);
  });
});

describe('runDoctor webhooks', () => {
  test('reads the subscriptions edge with the app access token', async () => {
    const graph = fakeGraph(undefined, 200, rejects, { data: [page] });
    const report = await runDoctor({ env, fetch: graph.fetch });
    const edge = graph.urls.find((u) => u.pathname.endsWith('/subscriptions'));
    expect(edge?.pathname).toMatch(/^\/v\d+\.\d+\/1234567890\/subscriptions$/);
    expect(edge?.searchParams.get('access_token')).toBe(`1234567890|${secret}`);
    expect(statuses(report.findings)).toContainEqual(['webhook.page.callback', 'pass']);
    expect(graph.pageUrls.some((u) => u.href.includes(secret))).toBe(false);
  });

  test('asks for a manual check when the subscriptions cannot be read', async () => {
    const graph = fakeGraph(undefined, 200, {}, { error: { message: 'Unsupported get request' } });
    const report = await runDoctor({ env, fetch: graph.fetch });
    const finding = report.findings.find((f) => f.id === 'graph.subscriptions');
    expect(finding?.status).toBe('manual');
    expect(report.summary.blocking).toBe(0);
  });
});
