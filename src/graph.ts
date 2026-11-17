/** The Graph API version cleared calls. Checked against Meta's changelog when it changes. */
export const GRAPH_API_VERSION = 'v25.0';

const GRAPH_URL = 'https://graph.facebook.com';

/** The app settings the doctor reads from the Graph API Application node. */
export interface AppSettings {
  name?: string;
  privacy_policy_url?: string;
  terms_of_service_url?: string;
  icon_url?: string;
  category?: string;
  app_domains?: string[];
  deauth_callback_url?: string;
}

export const APP_FIELDS = [
  'name',
  'privacy_policy_url',
  'terms_of_service_url',
  'icon_url',
  'category',
  'app_domains',
  'deauth_callback_url',
] as const;

/** A Graph API error, with the secret removed from the message. */
export class GraphError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'GraphError';
  }
}

export type Fetch = typeof globalThis.fetch;

/** Reads the app settings with an app access token built from the app ID and secret. */
export async function fetchAppSettings(
  appId: string,
  appSecret: string,
  fetchImpl: Fetch = globalThis.fetch,
): Promise<AppSettings> {
  if (!/^\d+$/.test(appId)) throw new GraphError('The app ID must contain only digits.');
  const url = new URL(`/${GRAPH_API_VERSION}/${appId}`, GRAPH_URL);
  url.searchParams.set('fields', APP_FIELDS.join(','));
  url.searchParams.set('access_token', `${appId}|${appSecret}`);
  const redact = (text: string) => text.split(appSecret).join('[secret]');

  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  } catch (error) {
    throw new GraphError(redact(`Could not reach the Graph API (${(error as Error).message}).`));
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new GraphError(`The Graph API answered ${response.status} without JSON.`);
  }
  const error = (body as { error?: { message?: unknown; code?: unknown } }).error;
  if (!response.ok || error) {
    const message = typeof error?.message === 'string' ? error.message : `HTTP ${response.status}`;
    const code = typeof error?.code === 'number' ? error.code : undefined;
    throw new GraphError(redact(message), code);
  }
  return body as AppSettings;
}
