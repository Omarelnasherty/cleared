import type { AppSettings } from '../src/graph.js';

/** A complete app, as the Graph API returns it for a test app. */
export const completeApp: AppSettings = {
  name: 'Example App',
  privacy_policy_url: 'https://example.com/privacy',
  terms_of_service_url: 'https://example.com/terms',
  icon_url: 'https://example.com/icon.png',
  category: 'Business',
  app_domains: ['example.com'],
  deauth_callback_url: 'https://example.com/meta/deauthorize',
};

export const policyHtml =
  '<html><body><h1>Privacy</h1><p>To delete your data, email privacy@example.com.</p></body></html>';

export type Page = { status?: number; html?: string; location?: string };

/**
 * A fetch that answers like the Graph API for graph.facebook.com and serves `pages`
 * for any other URL. It records the Graph API URLs and the page URLs separately.
 */
export function fakeGraph(
  body: unknown = completeApp,
  status = 200,
  pages: Record<string, Page> = {},
) {
  const urls: URL[] = [];
  const pageUrls: URL[] = [];
  const fetch = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname === 'graph.facebook.com') {
      urls.push(url);
      return Response.json(body, { status });
    }
    pageUrls.push(url);
    const page = pages[url.href] ?? { html: policyHtml };
    const headers = new Headers({ 'content-type': 'text/html' });
    if (page.location) headers.set('location', page.location);
    return new Response(page.html ?? '', { status: page.status ?? 200, headers });
  };
  return { fetch: fetch as typeof globalThis.fetch, urls, pageUrls };
}
