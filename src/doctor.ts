import { version } from './index.js';

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

/**
 * Runs the pre-submission checks and returns a report. It reads the app ID and secret
 * from the environment and never includes the secret in the report.
 */
export async function runDoctor(options: DoctorOptions = {}): Promise<Report> {
  const env = options.env ?? process.env;
  const appId = env.META_APP_ID?.trim() || undefined;
  const findings = [checkAppId(appId), checkAppSecret(env.META_APP_SECRET)];

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
