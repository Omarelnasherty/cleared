import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, test } from 'vitest';
import { createApp } from '../examples/express/app.js';

const secret = 'test-secret';

function signed(userId: string): string {
  const body = Buffer.from(
    JSON.stringify({
      algorithm: 'HMAC-SHA256',
      issued_at: Math.floor(Date.now() / 1000),
      user_id: userId,
    }),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${sig}.${body}`;
}

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function start(users: Map<string, unknown>, sessions: Set<string>): Promise<string> {
  const server = createApp({
    appSecret: secret,
    publicUrl: 'https://app.example',
    users,
    sessions,
  }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const post = (userId: string): RequestInit => ({
  method: 'POST',
  body: new URLSearchParams({ signed_request: signed(userId) }),
});

describe('express example', () => {
  test('deletes the user and serves the status page', async () => {
    const users = new Map([['42', { name: 'Test' }]]);
    const sessions = new Set(['42']);
    const base = await start(users, sessions);

    const res = await fetch(`${base}/meta/deletion`, post('42'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; confirmation_code: string };
    expect(body.url).toBe(
      `https://app.example/meta/deletion-status?code=${body.confirmation_code}`,
    );
    expect(users.has('42')).toBe(false);
    expect(sessions.has('42')).toBe(false);

    const page = await fetch(`${base}/meta/deletion-status?code=${body.confirmation_code}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Completed');
  });

  test('ends sessions on deauthorize and keeps the data', async () => {
    const users = new Map([['7', { name: 'Test' }]]);
    const sessions = new Set(['7']);
    const base = await start(users, sessions);

    const res = await fetch(`${base}/meta/deauthorize`, post('7'));
    expect(res.status).toBe(200);
    expect(sessions.has('7')).toBe(false);
    expect(users.has('7')).toBe(true);
  });
});
