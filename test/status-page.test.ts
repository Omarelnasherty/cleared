import { describe, expect, test } from 'vitest';
import { createDeletionStatusHandler, createMemoryStatusStore } from '../src/index.js';

function setup() {
  const store = createMemoryStatusStore();
  store.set('abc123', { state: 'completed', createdAt: 1 });
  store.set('wait', { state: 'pending', createdAt: 1 });
  store.set('bad', { state: 'failed', createdAt: 1 });
  return createDeletionStatusHandler({ store, appName: 'Example App' });
}

const get = (query: string, headers: Record<string, string> = {}) =>
  new Request(`https://app.example/deletion-status${query}`, { headers });

describe('createDeletionStatusHandler', () => {
  test('shows the code and a completed state in English', async () => {
    const res = await setup()(get('?code=abc123'));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('lang="en"');
    expect(html).toContain('abc123');
    expect(html).toContain('Completed');
    expect(html).toContain('Example App');
  });

  test('shows pending and failed states', async () => {
    expect(await (await setup()(get('?code=wait'))).text()).toContain('In progress');
    expect(await (await setup()(get('?code=bad'))).text()).toContain('Failed');
  });

  test('serves Arabic from the lang parameter or Accept-Language', async () => {
    const byParam = await (await setup()(get('?code=abc123&lang=ar'))).text();
    expect(byParam).toContain('dir="rtl"');
    expect(byParam).toContain('اكتمل');
    const byHeader = await (
      await setup()(get('?code=abc123', { 'accept-language': 'ar-EG,ar;q=0.9' }))
    ).text();
    expect(byHeader).toContain('lang="ar"');
  });

  test('returns 404 for an unknown code and 400 without one', async () => {
    expect((await setup()(get('?code=nope'))).status).toBe(404);
    expect((await setup()(get(''))).status).toBe(400);
  });

  test('escapes the code and ships no scripts', async () => {
    const res = await setup()(get('?code=%3Cscript%3Ealert(1)%3C/script%3E'));
    const html = await res.text();
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  test('rejects other methods', async () => {
    const res = await setup()(new Request('https://app.example/s', { method: 'POST' }));
    expect(res.status).toBe(405);
  });
});
