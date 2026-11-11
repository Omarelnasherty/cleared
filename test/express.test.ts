import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, test } from 'vitest';
import { dataDeletion, deauthorize, deletionStatus, toExpress } from '../src/express.js';
import { createMemoryStatusStore } from '../src/index.js';

const secret = 'test-secret';

function sign(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest().toString('base64url');
  return `${sig}.${body}`;
}

const signed = () =>
  sign({ algorithm: 'HMAC-SHA256', issued_at: Math.floor(Date.now() / 1000), user_id: '1234' });

const servers: { close: () => void }[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function listen(app: express.Express): Promise<string> {
  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function form(signedRequest: string): RequestInit {
  return { method: 'POST', body: new URLSearchParams({ signed_request: signedRequest }) };
}

function deletionApp(withParser: boolean) {
  const store = createMemoryStatusStore();
  const deleted: string[] = [];
  const app = express();
  if (withParser) app.use(express.urlencoded({ extended: false }));
  app.post(
    '/deletion',
    dataDeletion({
      appSecret: secret,
      statusUrl: 'https://app.example/deletion-status',
      store,
      onDelete: ({ userId }) => {
        deleted.push(userId);
      },
    }),
  );
  app.get('/deletion-status', deletionStatus({ store }));
  return { app, store, deleted };
}

describe('cleared/express', () => {
  for (const withParser of [false, true]) {
    test(`handles the data deletion callback ${withParser ? 'after' : 'without'} a body parser`, async () => {
      const { app, store, deleted } = deletionApp(withParser);
      const base = await listen(app);
      const res = await fetch(`${base}/deletion`, form(signed()));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
      const body = (await res.json()) as { url: string; confirmation_code: string };
      expect(body.url).toBe(`https://app.example/deletion-status?code=${body.confirmation_code}`);
      expect(deleted).toEqual(['1234']);
      expect((await store.get(body.confirmation_code))?.state).toBe('completed');
    });
  }

  test('works after express.json() when the body is a form', async () => {
    const { app } = deletionApp(false);
    const outer = express();
    outer.use(express.json());
    outer.use(app);
    const base = await listen(outer);
    const res = await fetch(`${base}/deletion`, form(signed()));
    expect(res.status).toBe(200);
  });

  test('rejects a bad signature with 400', async () => {
    const { app, deleted } = deletionApp(true);
    const base = await listen(app);
    const res = await fetch(`${base}/deletion`, form(`x${signed()}`));
    expect(res.status).toBe(400);
    expect(deleted).toEqual([]);
  });

  test('serves the status page with query parameters', async () => {
    const { app, store } = deletionApp(false);
    await store.set('abc123', { state: 'completed', createdAt: 0 });
    const base = await listen(app);
    const res = await fetch(`${base}/deletion-status?code=abc123&lang=ar`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    const html = await res.text();
    expect(html).toContain('lang="ar"');
    expect(html).toContain('abc123');
  });

  test('handles the deauthorize callback', async () => {
    const removed: string[] = [];
    const app = express();
    app.post(
      '/deauthorize',
      deauthorize({
        appSecret: secret,
        onDeauthorize: ({ userId }) => {
          removed.push(userId);
        },
      }),
    );
    const base = await listen(app);
    const res = await fetch(`${base}/deauthorize`, form(signed()));
    expect(res.status).toBe(200);
    expect(removed).toEqual(['1234']);
  });

  test('passes handler errors to next', async () => {
    const app = express();
    app.post(
      '/boom',
      toExpress(async () => {
        throw new Error('boom');
      }),
    );
    app.use(
      (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(503).send(error.message);
      },
    );
    const base = await listen(app);
    const res = await fetch(`${base}/boom`, { method: 'POST' });
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('boom');
  });
});
