import { createHmac, randomBytes } from 'node:crypto';
import type { Finding } from './doctor.js';
import type { Fetch } from './graph.js';
import { version } from './index.js';
import { rejectionPageUrl } from './rejections.js';

const TIMEOUT_MS = 10_000;
const CALLBACK_DOCS =
  'https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/';

/** The user ID sent in test requests. No real user has it, so onDelete has nothing to delete. */
export const TEST_USER_ID = '0';

/** Signs a payload the way Meta does: base64url HMAC-SHA256 signature, a dot, base64url JSON. */
export function signRequest(payload: Record<string, unknown>, appSecret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', appSecret).update(encoded).digest('base64url');
  return `${signature}.${encoded}`;
}

interface Sent {
  response?: Response;
  problem?: string;
}

async function post(url: URL, signedRequest: string, fetchImpl: Fetch): Promise<Sent> {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': `cleared/${version}`,
      },
      body: new URLSearchParams({ signed_request: signedRequest }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { response };
  } catch (error) {
    return { problem: `Could not reach it (${(error as Error).message}).` };
  }
}

function payload(): Record<string, unknown> {
  return {
    algorithm: 'HMAC-SHA256',
    issued_at: Math.floor(Date.now() / 1000),
    user_id: TEST_USER_ID,
  };
}

async function checkStatusPage(statusUrl: string, fetchImpl: Fetch): Promise<Finding> {
  const id = 'callback.deletion.status-page';
  const manual = (detail: string): Finding => ({
    id,
    status: 'manual',
    title: 'The deletion status page did not load',
    detail: `${detail} People open this link to follow their request.`,
  });
  try {
    const response = await fetchImpl(statusUrl, {
      headers: { accept: 'text/html,*/*', 'user-agent': `cleared/${version}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await response.body?.cancel();
    if (!response.ok) return manual(`${statusUrl} answers ${response.status}.`);
  } catch (error) {
    return manual(`Could not load ${statusUrl} (${(error as Error).message}).`);
  }
  return { id, status: 'pass', title: 'The deletion status page loads' };
}

/**
 * Sends a signed test request for user ID 0 to the data deletion callback and checks that it
 * answers 200 with a status `url` and a `confirmation_code`. It also sends a request with a
 * wrong signature, which the callback must reject. The app secret signs the requests and is
 * never sent.
 */
export async function checkDeletionCallback(
  callbackUrl: string,
  appSecret: string,
  fetchImpl: Fetch = globalThis.fetch,
): Promise<Finding[]> {
  const id = 'callback.deletion';
  const blocking = (detail: string): Finding[] => [
    {
      id,
      status: 'blocking',
      title: 'The data deletion callback failed the test request',
      detail: `${detail} See docs/callbacks.md and ${CALLBACK_DOCS}`,
      docs: rejectionPageUrl('deletionUnconfirmed'),
    },
  ];

  let url: URL;
  try {
    url = new URL(callbackUrl.trim());
  } catch {
    return blocking(`"${callbackUrl}" is not a valid URL.`);
  }
  if (url.protocol !== 'https:') return blocking(`${url.href} does not use HTTPS.`);

  const forgedSecret = randomBytes(16).toString('hex');
  const [signed, forged] = await Promise.all([
    post(url, signRequest(payload(), appSecret), fetchImpl),
    post(url, signRequest(payload(), forgedSecret), fetchImpl),
  ]);
  const { response } = signed;
  if (!response) return blocking(signed.problem ?? 'No response.');
  await forged.response?.body?.cancel();

  const { status } = response;
  if (status >= 300 && status < 400) {
    const location = response.headers.get('location');
    return blocking(
      `It answers ${status}${location ? ` to ${location}` : ''}. Set the data deletion URL to the final address; the request is a POST and should not be redirected.`,
    );
  }
  if (status !== 200) {
    const hint =
      status === 400
        ? ' If it says the signature does not match, the server uses a different app secret than META_APP_SECRET.'
        : '';
    return blocking(`It answers ${status} to a correctly signed request.${hint}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return blocking('It answers 200, but the body is not JSON.');
  }
  const { url: statusUrl, confirmation_code: code } = (body ?? {}) as Record<string, unknown>;
  const missing = [
    typeof statusUrl === 'string' && statusUrl !== '' ? '' : 'url',
    typeof code === 'string' && code !== '' ? '' : 'confirmation_code',
  ].filter(Boolean);
  if (missing.length > 0) {
    return blocking(
      `The JSON has no ${missing.join(' or ')}. Answer with { "url": "<status page>", "confirmation_code": "<code>" }.`,
    );
  }
  let parsedStatusUrl: URL;
  try {
    parsedStatusUrl = new URL(statusUrl as string);
  } catch {
    return blocking(`The url in the answer, "${statusUrl}", is not an absolute URL.`);
  }

  const findings: Finding[] = [
    { id, status: 'pass', title: 'The data deletion callback answers a signed test request' },
  ];
  if (!/^[A-Za-z0-9]+$/.test(code as string)) {
    findings.push({
      id: `${id}.code`,
      status: 'manual',
      title: 'The confirmation code is not alphanumeric',
      detail: 'Use only letters and digits in the confirmation code.',
    });
  }
  if (parsedStatusUrl.protocol !== 'https:') {
    findings.push({
      id: 'callback.deletion.status-page',
      status: 'manual',
      title: 'The deletion status page does not use HTTPS',
      detail: `Serve ${parsedStatusUrl.href} over HTTPS.`,
    });
  } else {
    findings.push(await checkStatusPage(parsedStatusUrl.href, fetchImpl));
  }

  const forgedStatus = forged.response?.status;
  if (forgedStatus !== undefined && forgedStatus >= 200 && forgedStatus < 300) {
    findings.push({
      id: `${id}.signature`,
      status: 'manual',
      title: 'The data deletion callback accepts a wrong signature',
      detail: `It answered ${forgedStatus} to a request signed with a random secret. Verify the signed_request with your app secret, for example with parseSignedRequest, and answer 400 when it does not match.`,
    });
  } else if (forgedStatus !== undefined) {
    findings.push({
      id: `${id}.signature`,
      status: 'pass',
      title: 'The data deletion callback rejects a wrong signature',
    });
  }
  return findings;
}
