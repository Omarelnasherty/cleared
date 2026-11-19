import {
  type AppSettings,
  type Fetch,
  fetchAppSettings,
  fetchSubscriptions,
  GraphError,
} from './graph.js';
import { version } from './index.js';
import { checkPolicyPage, type PolicyPage } from './urls.js';
import { checkWebhooks } from './webhooks.js';

/** pass: nothing to do. manual: check it yourself. blocking: fix it before you submit. */
export type FindingStatus = 'pass' | 'manual' | 'blocking';

export interface Finding {
  /** Stable identifier, for example `env.app-secret`. */
  id: string;
  status: FindingStatus;
  title: string;
  /** What to do about it. Set for manual and blocking findings. */
  detail?: string;
}

export interface Report {
  version: string;
  /** The app ID from the environment, if set. The app secret is never part of the report. */
  appId: string | null;
  findings: Finding[];
  summary: Record<FindingStatus, number>;
}

export interface DoctorOptions {
  /** Where to read META_APP_ID and META_APP_SECRET. Default process.env. */
  env?: Record<string, string | undefined>;
  /** The fetch used for Graph API calls. Default the global fetch. */
  fetch?: Fetch;
}

const DASHBOARD_HINT = 'Copy it from App settings > Basic in the App Dashboard.';

function checkAppId(appId: string | undefined): Finding {
  const id = 'env.app-id';
  if (!appId) {
    return {
      id,
      status: 'blocking',
      title: 'META_APP_ID is not set',
      detail: `${DASHBOARD_HINT} Then run: export META_APP_ID=<your app id>`,
    };
  }
  if (!/^\d+$/.test(appId)) {
    return {
      id,
      status: 'blocking',
      title: 'META_APP_ID is not a valid app ID',
      detail: `An app ID contains only digits. ${DASHBOARD_HINT}`,
    };
  }
  return { id, status: 'pass', title: `META_APP_ID is set (${appId})` };
}

function checkAppSecret(appSecret: string | undefined): Finding {
  const id = 'env.app-secret';
  if (!appSecret) {
    return {
      id,
      status: 'blocking',
      title: 'META_APP_SECRET is not set',
      detail: `${DASHBOARD_HINT} Keep it in your environment or a secret manager, never in your code.`,
    };
  }
  if (appSecret.trim() !== appSecret) {
    return {
      id,
      status: 'blocking',
      title: 'META_APP_SECRET has spaces or line breaks around it',
      detail: 'Remove them; the secret is used exactly as it is set.',
    };
  }
  return { id, status: 'pass', title: 'META_APP_SECRET is set' };
}

const BASIC_SETTINGS = 'Set it in App settings > Basic in the App Dashboard.';

function present(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Checks the app settings that App Review looks at, as read from the Graph API. */
export function checkAppSettings(app: AppSettings): Finding[] {
  const findings: Finding[] = [];

  findings.push(
    present(app.privacy_policy_url)
      ? { id: 'app.privacy-policy', status: 'pass', title: 'Privacy policy URL is set' }
      : {
          id: 'app.privacy-policy',
          status: 'blocking',
          title: 'Privacy policy URL is missing',
          detail: `Apps need a public privacy policy to go live and to pass review. ${BASIC_SETTINGS}`,
        },
  );

  findings.push(
    present(app.terms_of_service_url)
      ? { id: 'app.terms', status: 'pass', title: 'Terms of service URL is set' }
      : {
          id: 'app.terms',
          status: 'manual',
          title: 'Terms of service URL is missing',
          detail: `Check whether your app needs one before it can go live. ${BASIC_SETTINGS}`,
        },
  );

  findings.push(
    present(app.icon_url)
      ? { id: 'app.icon', status: 'pass', title: 'App icon is set' }
      : {
          id: 'app.icon',
          status: 'blocking',
          title: 'App icon is missing',
          detail: `Upload a 1024 x 1024 icon. ${BASIC_SETTINGS}`,
        },
  );

  findings.push(
    present(app.category)
      ? { id: 'app.category', status: 'pass', title: `Category is set (${app.category})` }
      : {
          id: 'app.category',
          status: 'blocking',
          title: 'Category is missing',
          detail: `Pick the category that matches what your app does. ${BASIC_SETTINGS}`,
        },
  );

  const domains = (app.app_domains ?? []).filter(present);
  findings.push(
    domains.length > 0
      ? { id: 'app.domains', status: 'pass', title: `App domains are set (${domains.join(', ')})` }
      : {
          id: 'app.domains',
          status: 'manual',
          title: 'No app domains',
          detail: `Add the domains your app runs on if it uses Facebook Login on the web. ${BASIC_SETTINGS}`,
        },
  );

  findings.push(
    present(app.deauth_callback_url)
      ? { id: 'app.deauthorize', status: 'pass', title: 'Deauthorize callback URL is set' }
      : {
          id: 'app.deauthorize',
          status: 'manual',
          title: 'No deauthorize callback URL',
          detail:
            'If your app uses Facebook Login, set it in the Facebook Login settings so you know when people remove your app. See docs/callbacks.md.',
        },
  );

  return findings;
}

async function checkSubscriptions(
  appId: string,
  appSecret: string,
  fetchImpl?: Fetch,
): Promise<Finding[]> {
  try {
    const subscriptions = await fetchSubscriptions(appId, appSecret, fetchImpl);
    return checkWebhooks(subscriptions, fetchImpl);
  } catch (error) {
    return [
      {
        id: 'graph.subscriptions',
        status: 'manual',
        title: 'Could not read the webhook subscriptions from the Graph API',
        detail: `${(error as Error).message.replace(/([^.])$/, '$1.')} Check them in Webhooks in the App Dashboard.`,
      },
    ];
  }
}

async function checkGraph(appId: string, appSecret: string, fetchImpl?: Fetch): Promise<Finding[]> {
  try {
    const app = await fetchAppSettings(appId, appSecret, fetchImpl);
    const name = present(app.name) ? ` (${app.name})` : '';
    const pages: PolicyPage[] = [];
    if (present(app.privacy_policy_url)) {
      pages.push({
        id: 'url.privacy-policy',
        name: 'Privacy policy',
        url: app.privacy_policy_url,
        deletion: true,
      });
    }
    if (present(app.terms_of_service_url)) {
      pages.push({ id: 'url.terms', name: 'Terms of service', url: app.terms_of_service_url });
    }
    const [pageFindings, webhookFindings] = await Promise.all([
      Promise.all(pages.map((page) => checkPolicyPage(page, fetchImpl))),
      checkSubscriptions(appId, appSecret, fetchImpl),
    ]);
    return [
      { id: 'graph.app', status: 'pass', title: `Read the app settings${name}` },
      ...checkAppSettings(app),
      ...pageFindings.flat(),
      ...webhookFindings,
    ];
  } catch (error) {
    const message = (error as Error).message.replace(/([^.])$/, '$1.');
    const hint =
      error instanceof GraphError && error.code !== undefined
        ? ' Check that META_APP_ID and META_APP_SECRET belong to the same app.'
        : '';
    return [
      {
        id: 'graph.app',
        status: 'blocking',
        title: 'Could not read the app settings from the Graph API',
        detail: `${message}${hint}`,
      },
    ];
  }
}

/**
 * Runs the pre-submission checks and returns a report. It reads the app ID and secret
 * from the environment and never includes the secret in the report.
 */
export async function runDoctor(options: DoctorOptions = {}): Promise<Report> {
  const env = options.env ?? process.env;
  const appId = env.META_APP_ID?.trim() || undefined;
  const appSecret = env.META_APP_SECRET;
  const findings = [checkAppId(appId), checkAppSecret(appSecret)];
  if (appId && appSecret && findings.every((finding) => finding.status === 'pass')) {
    findings.push(...(await checkGraph(appId, appSecret, options.fetch)));
  }

  const summary: Record<FindingStatus, number> = { pass: 0, manual: 0, blocking: 0 };
  for (const finding of findings) summary[finding.status]++;
  return { version, appId: appId ?? null, findings, summary };
}

export interface FormatOptions {
  /** Use ANSI colors. Default false. */
  color?: boolean;
}

const MARKS: Record<FindingStatus, { symbol: string; rgb: string }> = {
  pass: { symbol: '✓', rgb: '43;214;123' },
  manual: { symbol: '!', rgb: '242;169;59' },
  blocking: { symbol: '✗', rgb: '240;87;79' },
};

/** Formats a report as plain text for the terminal. */
export function formatReport(report: Report, options: FormatOptions = {}): string {
  const paint = (status: FindingStatus, text: string) =>
    options.color ? `\x1b[38;2;${MARKS[status].rgb}m${text}\x1b[39m` : text;
  const order: FindingStatus[] = ['blocking', 'manual', 'pass'];
  const findings = [...report.findings].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status),
  );

  const lines = [`cleared doctor ${report.version}`, ''];
  for (const finding of findings) {
    lines.push(`  ${paint(finding.status, MARKS[finding.status].symbol)} ${finding.title}`);
    if (finding.detail) lines.push(`    ${finding.detail}`);
  }

  const { blocking, manual, pass } = report.summary;
  lines.push('', `${blocking} blocking, ${manual} to check by hand, ${pass} passed.`);
  if (blocking > 0) {
    lines.push('', 'Still blocked after fixing these? contact@omarelnasherty.com');
  }
  return `${lines.join('\n')}\n`;
}
