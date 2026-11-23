import { describe, expect, test } from 'vitest';
import { checkPolicyPage, type PolicyPage } from '../src/urls.js';
import { fakeGraph, type Page } from './fake-graph.js';

const privacy: PolicyPage = {
  id: 'url.privacy-policy',
  name: 'Privacy policy',
  url: 'https://example.com/privacy',
  deletion: true,
};

async function check(pages: Record<string, Page>, page: PolicyPage = privacy) {
  const graph = fakeGraph(undefined, 200, pages);
  const findings = await checkPolicyPage(page, graph.fetch);
  return { findings, graph };
}

const statuses = (findings: { id: string; status: string }[]) =>
  findings.map((f) => [f.id, f.status]);

describe('checkPolicyPage', () => {
  test('passes a public HTTPS policy that mentions deletion', async () => {
    const { findings } = await check({});
    expect(statuses(findings)).toEqual([
      ['url.privacy-policy', 'pass'],
      ['url.privacy-policy.deletion', 'pass'],
    ]);
  });

  test('blocks a URL that is not HTTPS without loading it', async () => {
    const { findings, graph } = await check({}, { ...privacy, url: 'http://example.com/privacy' });
    expect(statuses(findings)).toEqual([['url.privacy-policy', 'blocking']]);
    expect(findings[0]?.detail).toContain('does not use HTTPS');
    expect(graph.pageUrls).toHaveLength(0);
  });

  test('links blocking findings to the page docs, when set', async () => {
    const docs = 'https://example.com/docs.md';
    const url = 'http://example.com/privacy';
    const linked = await check({}, { ...privacy, url, docs });
    expect(linked.findings[0]?.docs).toBe(docs);
    const plain = await check({}, { ...privacy, url });
    expect(plain.findings[0]?.docs).toBeUndefined();
  });

  test('blocks a URL that does not parse', async () => {
    const { findings } = await check({}, { ...privacy, url: 'example dot com' });
    expect(findings[0]?.detail).toContain('not a valid URL');
  });

  test('follows redirects to a public page', async () => {
    const { findings, graph } = await check({
      'https://example.com/privacy': { status: 301, location: '/legal/privacy' },
    });
    expect(statuses(findings)[0]).toEqual(['url.privacy-policy', 'pass']);
    expect(graph.pageUrls.map((u) => u.pathname)).toEqual(['/privacy', '/legal/privacy']);
  });

  test('blocks a redirect to a sign-in page', async () => {
    const { findings } = await check({
      'https://example.com/privacy': {
        status: 302,
        location: 'https://accounts.example.com/login?next=/privacy',
      },
    });
    expect(findings[0]).toMatchObject({ status: 'blocking' });
    expect(findings[0]?.detail).toContain('redirects to a sign-in page');
  });

  test('blocks a redirect to HTTP', async () => {
    const { findings } = await check({
      'https://example.com/privacy': { status: 301, location: 'http://example.com/privacy' },
    });
    expect(findings[0]?.detail).toContain('not HTTPS');
  });

  test('blocks a redirect loop', async () => {
    const { findings } = await check({
      'https://example.com/privacy': { status: 302, location: '/privacy' },
    });
    expect(findings[0]?.detail).toContain('redirects more than 5 times');
  });

  test('blocks a page behind a login', async () => {
    for (const status of [401, 403]) {
      const { findings } = await check({ 'https://example.com/privacy': { status } });
      expect(findings[0]?.detail).toContain('needs a login');
    }
  });

  test('blocks a page that is not found', async () => {
    const { findings } = await check({ 'https://example.com/privacy': { status: 404 } });
    expect(findings[0]?.detail).toContain('answers 404');
  });

  test('blocks a page that shows a sign-in form', async () => {
    const { findings } = await check({
      'https://example.com/privacy': {
        html: '<form><input name="user"><input type="password" name="pw"></form>',
      },
    });
    expect(findings[0]?.detail).toContain('sign-in form');
  });

  test('blocks a page that cannot be reached', async () => {
    const fetch = (async () => {
      throw new Error('getaddrinfo ENOTFOUND example.com');
    }) as typeof globalThis.fetch;
    const findings = await checkPolicyPage(privacy, fetch);
    expect(findings[0]?.detail).toContain('ENOTFOUND');
  });

  test('flags a policy without a mention of deletion for a manual check', async () => {
    const { findings } = await check({
      'https://example.com/privacy': {
        html: '<p>We collect your name.</p><script>render("delete your data")</script>',
      },
    });
    expect(statuses(findings)).toEqual([
      ['url.privacy-policy', 'pass'],
      ['url.privacy-policy.deletion', 'manual'],
    ]);
  });

  test('skips the deletion check for other pages', async () => {
    const { findings } = await check(
      { 'https://example.com/terms': { html: '<p>Terms</p>' } },
      {
        id: 'url.terms',
        name: 'Terms of service',
        url: 'https://example.com/terms',
        deletion: false,
      },
    );
    expect(statuses(findings)).toEqual([['url.terms', 'pass']]);
  });

  test('sends no credentials with the request', async () => {
    let init: RequestInit | undefined;
    const fetch = (async (_url: URL, options: RequestInit) => {
      init = options;
      return new Response('<p>delete</p>');
    }) as unknown as typeof globalThis.fetch;
    await checkPolicyPage(privacy, fetch);
    expect(init?.redirect).toBe('manual');
    expect(Object.keys(init?.headers ?? {})).toEqual(['accept', 'user-agent']);
  });
});
