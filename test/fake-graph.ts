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

/** A fetch that answers like the Graph API and records the URLs it was called with. */
export function fakeGraph(body: unknown = completeApp, status = 200) {
  const urls: URL[] = [];
  const fetch = async (input: string | URL | Request) => {
    urls.push(new URL(input instanceof Request ? input.url : input));
    return Response.json(body, { status });
  };
  return { fetch: fetch as typeof globalThis.fetch, urls };
}
