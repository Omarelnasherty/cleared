import { describe, expect, test } from 'vitest';
import { checkDeletionCallback, signRequest, TEST_USER_ID } from '../src/callback-test.js';
import { runDoctor } from '../src/doctor.js';
import { createDataDeletionHandler, parseSignedRequest } from '../src/index.js';
import { fakeGraph } from './fake-graph.js';

const secret = 'test-secret-0123456789abcdef';
const callback = 'https://example.com/meta/deletion';
const statusPage = 'https://example.com/meta/deletion-status';

type Handler = (request: Request) => Response | Promise<Response>;

/** A fetch that routes the callback URL to `handler` and serves the status page with `pageStatus`. */
function server(handler: Handler, pageStatus = 200) {
  const requests: Request[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    const url = new URL(request.url);
    if (`${url.origin}${url.pathname}` === callback) return handler(request);
    if (`${url.origin}${url.pathname}` === statusPage)
      return new Response('<html></html>', { status: pageStatus });
    return new Response('Not found', { status: 404 });
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

const deletions: string[] = [];
const cleared = createDataDeletionHandler({
  appSecret: secret,
  statusUrl: statusPage,
  onDelete: ({ userId }) => {
    deletions.push(userId);
  },
});

const statuses = (findings: { id: string; status: string }[]) =>
  findings.map((f) => [f.id, f.status]);

describe('signRequest', () => {
  test('signs a payload that parseSignedRequest accepts', () => {
    const payload = { algorithm: 'HMAC-SHA256', issued_at: 1_700_000_000, user_id: '42' };
    const parsed = parseSignedRequest(signRequest(payload, secret), secret, {
      now: 1_700_000_000_000,
    });
    expect(parsed.user_id).toBe('42');
  });
});

describe('checkDeletionCallback', () => {
  test('passes a callback built with createDataDeletionHandler', async () => {
    const { fetch } = server(cleared);
    const findings = await checkDeletionCallback(callback, secret, fetch);
    expect(statuses(findings)).toEqual([
      ['callback.deletion', 'pass'],
      ['callback.deletion.status-page', 'pass'],
      ['callback.deletion.signature', 'pass'],
    ]);
    expect(deletions).toContain(TEST_USER_ID);
  });

  test('posts a form with a signed request for user 0 and never sends the secret', async () => {
    const { fetch, requests } = server(cleared);
    await checkDeletionCallback(callback, secret, fetch);
    const posts = requests.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(2);
    const valid: (string | undefined | null)[] = [];
    for (const request of posts) {
      expect(request.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
      const body = await request.text();
      expect(body).not.toContain(secret);
      const signed = new URLSearchParams(body).get('signed_request') ?? '';
      expect(signed).toMatch(/^[\w-]+\.[\w-]+$/);
      try {
        valid.push(parseSignedRequest(signed, secret).user_id);
      } catch {
        valid.push(null);
      }
    }
    expect(valid.sort()).toEqual([TEST_USER_ID, null].sort());
  });

  test('blocks a URL that is not HTTPS', async () => {
    const { fetch, requests } = server(cleared);
    const findings = await checkDeletionCallback('http://example.com/meta/deletion', secret, fetch);
    expect(statuses(findings)).toEqual([['callback.deletion', 'blocking']]);
    expect(findings[0]?.detail).toContain('does not use HTTPS');
    expect(requests).toHaveLength(0);
  });

  test('blocks a callback that rejects a correct signature', async () => {
    const other = createDataDeletionHandler({
      appSecret: 'another-secret',
      statusUrl: statusPage,
      onDelete: () => {},
    });
    const findings = await checkDeletionCallback(callback, secret, server(other).fetch);
    expect(statuses(findings)).toEqual([['callback.deletion', 'blocking']]);
    expect(findings[0]?.detail).toContain('different app secret');
  });

  test('blocks an answer without url or confirmation_code', async () => {
    const findings = await checkDeletionCallback(
      callback,
      secret,
      server(() => Response.json({ ok: true })).fetch,
    );
    expect(findings[0]?.status).toBe('blocking');
    expect(findings[0]?.detail).toContain('no url or confirmation_code');
  });

  test('blocks an answer that is not JSON', async () => {
    const findings = await checkDeletionCallback(
      callback,
      secret,
      server(() => new Response('OK')).fetch,
    );
    expect(findings[0]?.detail).toContain('not JSON');
  });

  test('blocks a redirect and an unreachable callback', async () => {
    const redirect = server(
      () => new Response(null, { status: 301, headers: { location: 'https://example.com/x' } }),
    );
    const redirected = await checkDeletionCallback(callback, secret, redirect.fetch);
    expect(redirected[0]?.detail).toContain('301 to https://example.com/x');

    const down = async () => {
      throw new Error('ECONNREFUSED');
    };
    const unreachable = await checkDeletionCallback(callback, secret, down);
    expect(unreachable[0]?.detail).toContain('ECONNREFUSED');
  });

  test('flags a callback that accepts any signature', async () => {
    const answer = () => Response.json({ url: statusPage, confirmation_code: 'abc123' });
    const findings = await checkDeletionCallback(callback, secret, server(answer).fetch);
    expect(statuses(findings)).toContainEqual(['callback.deletion.signature', 'manual']);
  });

  test('flags a status page that does not load and a code with symbols', async () => {
    const answer = () => Response.json({ url: statusPage, confirmation_code: 'abc-123' });
    const findings = await checkDeletionCallback(callback, secret, server(answer, 500).fetch);
    expect(statuses(findings)).toContainEqual(['callback.deletion.code', 'manual']);
    expect(statuses(findings)).toContainEqual(['callback.deletion.status-page', 'manual']);
  });
});

describe('runDoctor with a deletion URL', () => {
  const env = { META_APP_ID: '1234567890', META_APP_SECRET: secret };

  test('asks to test the callback by hand when no URL is given', async () => {
    const report = await runDoctor({ env, fetch: fakeGraph().fetch });
    expect(report.findings.find((f) => f.id === 'callback.deletion')?.status).toBe('manual');
  });

  test('tests the callback when a URL is given', async () => {
    const graph = fakeGraph();
    const callbackServer = server(cleared);
    const fetch: typeof globalThis.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return url.hostname === 'graph.facebook.com' || url.pathname.match(/privacy|terms/)
        ? graph.fetch(input, init)
        : callbackServer.fetch(input, init);
    };
    const report = await runDoctor({ env, fetch, deletionUrl: callback });
    expect(report.findings.find((f) => f.id === 'callback.deletion')?.status).toBe('pass');
    expect(JSON.stringify(report)).not.toContain(secret);
  });
});
