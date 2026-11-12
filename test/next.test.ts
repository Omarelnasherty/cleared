import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { createMemoryStatusStore } from '../src/index.js';
import { dataDeletion, deauthorize, deletionStatus } from '../src/next.js';

const secret = 'test-secret';

function sign(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest().toString('base64url');
  return `${sig}.${body}`;
}

const signed = () =>
  sign({ algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), user_id: '1234' });

function post(url: string, signedRequest: string): Request {
  return new Request(url, {
    method: 'POST',
    body: new URLSearchParams({ signed_request: signedRequest }),
  });
}

describe('cleared/next', () => {
  test('handles the data deletion callback and serves its status page', async () => {
    const store = createMemoryStatusStore();
    const deleted: string[] = [];
    const { POST } = dataDeletion({
      appSecret: secret,
      statusUrl: 'https://app.example/meta/deletion-status',
      store,
      onDelete: ({ userId }) => {
        deleted.push(userId);
      },
    });
    const { GET } = deletionStatus({ store, appName: 'Example App' });

    const res = await POST(post('https://app.example/meta/deletion', signed()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; confirmation_code: string };
    expect(deleted).toEqual(['1234']);

    const page = await GET(new Request(body.url));
    expect(page.status).toBe(200);
    expect(await page.text()).toContain(body.confirmation_code);
  });

  test('rejects a bad signature', async () => {
    const { POST } = dataDeletion({
      appSecret: secret,
      statusUrl: 'https://app.example/meta/deletion-status',
      onDelete: () => {},
    });
    const res = await POST(post('https://app.example/meta/deletion', `x${signed()}`));
    expect(res.status).toBe(400);
  });

  test('handles the deauthorize callback', async () => {
    const users: string[] = [];
    const { POST } = deauthorize({
      appSecret: secret,
      onDeauthorize: ({ userId }) => {
        users.push(userId);
      },
    });
    const res = await POST(post('https://app.example/meta/deauthorize', signed()));
    expect(res.status).toBe(200);
    expect(users).toEqual(['1234']);
  });
});
