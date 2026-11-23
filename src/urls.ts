import type { Finding } from './doctor.js';
import type { Fetch } from './graph.js';
import { version } from './index.js';

export interface PolicyPage {
  /** Stable prefix for the finding IDs, for example `url.privacy-policy`. */
  id: string;
  /** How the page is named in the report, for example `Privacy policy`. */
  name: string;
  url: string;
  /** Also check that the page explains how to request data deletion. */
  deletion?: boolean;
  /** A rejection page to link from blocking findings. */
  docs?: string;
}

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const SIGN_IN_PATH = /(^|[/._-])(log-?in|sign-?in|sign_in|auth|sso|oauth)([/._-]|$)/i;
const PASSWORD_FIELD = /<input\b[^>]*\btype\s*=\s*["']?password/i;
const DELETION_WORDS = /\b(delete|deletion|deleting|erase|erasure|remove|removal)\b/i;
const TERMS = 'https://developers.facebook.com/terms/';

interface Loaded {
  url: URL;
  response?: Response;
  problem?: string;
}

async function load(start: URL, fetchImpl: Fetch): Promise<Loaded> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        redirect: 'manual',
        headers: { accept: 'text/html,*/*', 'user-agent': `cleared/${version}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      return { url, problem: `Could not load ${url.href} (${(error as Error).message}).` };
    }
    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) return { url, response };

    const next = new URL(location, url);
    if (next.protocol !== 'https:') {
      return { url, problem: `${url.href} redirects to ${next.href}, which is not HTTPS.` };
    }
    if (SIGN_IN_PATH.test(next.pathname) && !SIGN_IN_PATH.test(start.pathname)) {
      return { url, problem: `${url.href} redirects to a sign-in page (${next.href}).` };
    }
    url = next;
  }
  return { url, problem: `${start.href} redirects more than ${MAX_REDIRECTS} times.` };
}

function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Loads a policy page the way a reviewer or crawler would: HTTPS, public, without a
 * sign-in step. With `deletion`, it also looks for how to request data deletion.
 */
export async function checkPolicyPage(
  page: PolicyPage,
  fetchImpl: Fetch = globalThis.fetch,
): Promise<Finding[]> {
  const blocking = (detail: string): Finding[] => [
    {
      id: page.id,
      status: 'blocking',
      title: `${page.name} URL is not publicly reachable`,
      detail: `${detail} Meta needs it on a live, public HTTPS page that anyone can open without signing in. See ${TERMS}`,
      ...(page.docs && { docs: page.docs }),
    },
  ];

  let url: URL;
  try {
    url = new URL(page.url.trim());
  } catch {
    return blocking(`"${page.url}" is not a valid URL.`);
  }
  if (url.protocol !== 'https:') return blocking(`${url.href} does not use HTTPS.`);

  const loaded = await load(url, fetchImpl);
  if (loaded.problem || !loaded.response) return blocking(loaded.problem ?? '');
  const { response } = loaded;
  if (response.status === 401 || response.status === 403) {
    return blocking(`${loaded.url.href} answers ${response.status}, so it needs a login.`);
  }
  if (!response.ok) return blocking(`${loaded.url.href} answers ${response.status}.`);

  let html = '';
  try {
    html = await response.text();
  } catch (error) {
    return blocking(`Could not read ${loaded.url.href} (${(error as Error).message}).`);
  }
  if (PASSWORD_FIELD.test(html)) {
    return blocking(`${loaded.url.href} shows a sign-in form.`);
  }

  const findings: Finding[] = [
    { id: page.id, status: 'pass', title: `${page.name} loads publicly over HTTPS` },
  ];
  if (page.deletion) {
    const text = visibleText(html);
    findings.push(
      DELETION_WORDS.test(text)
        ? {
            id: `${page.id}.deletion`,
            status: 'pass',
            title: `${page.name} mentions data deletion`,
          }
        : {
            id: `${page.id}.deletion`,
            status: 'manual',
            title: `${page.name} does not seem to explain how to request data deletion`,
            detail: `No mention of deletion was found in the page HTML. Make sure the policy tells people how to ask for their data to be deleted, for example an email address or a form, and that it is in the HTML, not only added by JavaScript. See ${TERMS}`,
          },
    );
  }
  return findings;
}
