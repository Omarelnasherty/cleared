import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { createDataDeletionHandler, createMemoryStatusStore } from '../src/index.js';

const secret = 'test-secret';

function sign(payload: unknown, key = secret): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', key).update(body).digest().toString('base64url');
  return `${sig}.${body}`;
}

function post(signedRequest?: string): Request {
  const body = new URLSearchParams(signedRequest ? { signed_request: signedRequest } : {});
  return new Request('https://app.example/deletion', { method: 'POST', body });
}

const fresh = () => ({
  algorithm: 'HMAC-SHA256',
  issued_at: Math.floor(Date.now() / 1000),
  user_id: '1234',
});

function setup(onDelete = async () => {}) {
  const store = createMemoryStatusStore();
  const calls: unknown[] = [];
  const handler = createDataDeletionHandler({
    appSecret: secret,
    statusUrl: 'https://app.example/deletion-status',
    store,
    onDelete: async (req) => {
      calls.push(req);
      await onDelete();
    },
  });
  return { handler, store, calls };
}

describe('createDataDeletionHandler', () => {
  test('returns url and confirmation_code and calls onDelete', async () => {
    const { handler, store, calls } = setup();
    const res = await handler(post(sign(fresh())));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; confirmation_code: string };
    expect(Object.keys(body).sort()).toEqual(['confirmation_code', 'url']);
    expect(body.url).toBe(`https://app.example/deletion-status?code=${body.confirmation_code}`);
    expect(calls).toEqual([{ userId: '1234', confirmationCode: body.confirmation_code }]);
    expect((await store.get(body.confirmation_code))?.state).toBe('completed');
  });

  test('accepts a function for statusUrl', async () => {
    const handler = createDataDeletionHandler({
      appSecret: secret,
      statusUrl: (code) => `https://app.example/s/${code}`,
      onDelete: () => {},
    });
    const body = (await (await handler(post(sign(fresh())))).json()) as { url: string };
    expect(body.url).toMatch(/^https:\/\/app\.example\/s\/[0-9a-f]{24}$/);
  });

  test('rejects a forged request without calling onDelete', async () => {
    const { handler, calls } = setup();
    const res = await handler(post(sign(fresh(), 'other')));
    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  test('rejects a missing signed_request and a payload without user_id', async () => {
    const { handler } = setup();
    expect((await handler(post())).status).toBe(400);
    const { user_id: _omit, ...noUser } = fresh();
    expect((await handler(post(sign(noUser)))).status).toBe(400);
  });

  test('rejects methods other than POST', async () => {
    const { handler } = setup();
    const res = await handler(new Request('https://app.example/deletion'));
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });

  test('rejects a body that is not a form', async () => {
    const { handler } = setup();
    const res = await handler(
      new Request('https://app.example/deletion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(res.status).toBe(400);
  });

  test('marks the request failed when onDelete throws', async () => {
    const store = createMemoryStatusStore();
    let code = '';
    const handler = createDataDeletionHandler({
      appSecret: secret,
      statusUrl: 'https://app.example/s',
      store,
      onDelete: (req) => {
        code = req.confirmationCode;
        throw new Error('db down');
      },
    });
    const res = await handler(post(sign(fresh())));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('db down');
    expect((await store.get(code))?.state).toBe('failed');
  });
});
