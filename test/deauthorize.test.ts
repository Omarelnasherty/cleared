import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { createDeauthorizeHandler } from '../src/index.js';

const secret = 'test-secret';

function sign(payload: unknown, key = secret): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', key).update(body).digest().toString('base64url');
  return `${sig}.${body}`;
}

function post(signedRequest?: string): Request {
  const body = new URLSearchParams(signedRequest ? { signed_request: signedRequest } : {});
  return new Request('https://app.example/deauthorize', { method: 'POST', body });
}

const fresh = () => ({
  algorithm: 'HMAC-SHA256',
  issued_at: Math.floor(Date.now() / 1000),
  user_id: '1234',
});

function setup(fail = false) {
  const calls: unknown[] = [];
  const handler = createDeauthorizeHandler({
    appSecret: secret,
    onDeauthorize: (req) => {
      calls.push(req);
      if (fail) throw new Error('db down');
    },
  });
  return { handler, calls };
}

describe('createDeauthorizeHandler', () => {
  test('calls onDeauthorize with the user id and answers 200', async () => {
    const { handler, calls } = setup();
    const res = await handler(post(sign(fresh())));
    expect(res.status).toBe(200);
    expect(calls).toEqual([{ userId: '1234' }]);
  });

  test('rejects a forged request without calling the hook', async () => {
    const { handler, calls } = setup();
    expect((await handler(post(sign(fresh(), 'other')))).status).toBe(400);
    expect(calls).toEqual([]);
  });

  test('rejects a missing signed_request and a payload without user_id', async () => {
    const { handler } = setup();
    expect((await handler(post())).status).toBe(400);
    const { user_id: _omit, ...noUser } = fresh();
    expect((await handler(post(sign(noUser)))).status).toBe(400);
  });

  test('rejects a non-form body and a GET', async () => {
    const { handler } = setup();
    const json = new Request('https://app.example/d', { method: 'POST', body: '{}' });
    expect((await handler(json)).status).toBe(400);
    const get = await handler(new Request('https://app.example/d'));
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
  });

  test('answers 500 when the hook throws', async () => {
    const { handler } = setup(true);
    expect((await handler(post(sign(fresh())))).status).toBe(500);
  });
});
