import { randomBytes } from 'node:crypto';
import type { Finding } from './doctor.js';
import type { Fetch, Subscription } from './graph.js';
import { version } from './index.js';

const TIMEOUT_MS = 10_000;
const WEBHOOKS_DOCS = 'https://developers.facebook.com/docs/graph-api/webhooks/getting-started';

type Handshake = Omit<Finding, 'id'>;

/**
 * Sends a verification request with a random verify token. The real token is never
 * sent: a correct endpoint must reject a token it doesn't know.
 */
async function testHandshake(callbackUrl: string, fetchImpl: Fetch): Promise<Handshake> {
  const blocking = (detail: string): Handshake => ({
    status: 'blocking',
    title: `Webhook callback ${callbackUrl} is not reachable`,
    detail: `${detail} Meta can only deliver events to a public HTTPS URL with a valid certificate. See ${WEBHOOKS_DOCS}`,
  });

  let url: URL;
  try {
    url = new URL(callbackUrl.trim());
  } catch {
    return blocking(`"${callbackUrl}" is not a valid URL.`);
  }
  if (url.protocol !== 'https:') return blocking(`${url.href} does not use HTTPS.`);

  const challenge = randomBytes(8).toString('hex');
  url.searchParams.set('hub.mode', 'subscribe');
  url.searchParams.set('hub.challenge', challenge);
  url.searchParams.set('hub.verify_token', `cleared-test-${randomBytes(8).toString('hex')}`);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: 'manual',
      headers: { 'user-agent': `cleared/${version}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return blocking(`Could not reach it (${(error as Error).message}).`);
  }

  const { status } = response;
  if (status >= 500) return blocking(`It answers ${status}.`);
  if (status >= 300 && status < 400) {
    const location = response.headers.get('location');
    return {
      status: 'manual',
      title: `Webhook callback ${callbackUrl} redirects`,
      detail: `It answers ${status}${location ? ` to ${location}` : ''}. Set the callback URL to the final address.`,
    };
  }
  if (status === 404) {
    return {
      status: 'manual',
      title: `Webhook callback ${callbackUrl} answers 404`,
      detail: 'Check that the path is right and that the route handles GET requests.',
    };
  }
  if (status >= 400) {
    return {
      status: 'pass',
      title: `Webhook callback ${callbackUrl} rejects a wrong verify token`,
    };
  }

  const body = await response.text().catch(() => '');
  return {
    status: 'manual',
    title: `Webhook callback ${callbackUrl} accepts a wrong verify token`,
    detail: `${
      body.trim() === challenge
        ? 'It echoed the challenge for a random token.'
        : `It answered ${status} to a random token.`
    } Compare hub.verify_token with your own token and answer 403 when they differ.`,
  };
}

/**
 * Checks the webhook subscriptions read from the Graph API: each one should be active,
 * subscribed to at least one field, and its callback should reject a wrong verify token.
 */
export async function checkWebhooks(
  subscriptions: Subscription[],
  fetchImpl: Fetch = globalThis.fetch,
): Promise<Finding[]> {
  const handshakes = new Map<string, Promise<Handshake>>();
  const findings = await Promise.all(
    subscriptions.map(async (subscription, index): Promise<Finding[]> => {
      const object = subscription.object?.trim() || `subscription-${index + 1}`;
      const id = `webhook.${object}`;
      const result: Finding[] = [];

      if (subscription.active === false) {
        result.push({
          id,
          status: 'blocking',
          title: `Webhook subscription for ${object} is inactive`,
          detail:
            'Meta is not sending events for it. Open Webhooks in the App Dashboard, check the callback URL and verify token, and save it again to reactivate it.',
        });
      } else {
        result.push({ id, status: 'pass', title: `Webhook subscription for ${object} is active` });
      }

      const fields = (subscription.fields ?? []).map((field) => field.name).filter(Boolean);
      if (fields.length === 0) {
        result.push({
          id: `${id}.fields`,
          status: 'manual',
          title: `Webhook subscription for ${object} has no fields`,
          detail: 'Subscribe to the fields your app needs in Webhooks in the App Dashboard.',
        });
      }

      const callbackUrl = subscription.callback_url?.trim();
      if (!callbackUrl) {
        result.push({
          id: `${id}.callback`,
          status: 'blocking',
          title: `Webhook subscription for ${object} has no callback URL`,
          detail: 'Set a callback URL in Webhooks in the App Dashboard.',
        });
        return result;
      }
      let handshake = handshakes.get(callbackUrl);
      if (!handshake) {
        handshake = testHandshake(callbackUrl, fetchImpl);
        handshakes.set(callbackUrl, handshake);
      }
      result.push({ id: `${id}.callback`, ...(await handshake) });
      return result;
    }),
  );
  return findings.flat();
}
