/** What to prepare for one permission before you submit it for App Review. */
export interface Playbook {
  /** The permission name, as it appears in App Review. */
  permission: string;
  /** The product the permission belongs to. */
  product: string;
  /** What the permission gives your app, in one sentence. */
  summary: string;
  /** Other permissions to request with it. */
  requires: string[];
  /** What the reviewer has to see in your app and your submission. */
  reviewerNeeds: string[];
  /** The screencast, step by step, after the login steps every recording needs. */
  screencast: string[];
  /** A starting point for the reviewer notes. Replace every <placeholder>. */
  notes: string;
  /** Meta's official pages for this permission. */
  docs: string[];
}

const PERMISSIONS_REFERENCE = 'https://developers.facebook.com/docs/permissions';
const SCREEN_RECORDINGS =
  'https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings';

/** Steps that open every screencast, whatever the permission. */
export const SCREENCAST_START = [
  'Start logged out, in a clean browser window.',
  'Show the full login: open your app, log in with Facebook Login and show the permission dialog.',
  'If people can also sign up without Facebook Login, show that path too and add a test account to the notes.',
];

const PLAYBOOKS: readonly Playbook[] = [
  {
    permission: 'pages_show_list',
    product: 'Pages',
    summary: 'Lets your app read the list of Facebook Pages a person manages.',
    requires: [],
    reviewerNeeds: [
      'A person choosing which of their Pages to connect, in your app, from a list your app reads through the API.',
      'The list showing only Pages that person manages, so it is clear you use it to show their Pages or to confirm they manage one.',
      'If you request it only because another permission needs it, the use case description naming that main permission.',
    ],
    screencast: [
      'In the Facebook Login dialog, pick the Pages to share with your app.',
      'Back in your app, show the screen that lists those Pages (read from GET /me/accounts).',
      'Select a Page and show what your app does with it next, for example the settings screen for that Page.',
    ],
    notes: `We use pages_show_list to show the person the Facebook Pages they manage, so they can choose which Page to connect to <app name>.

Steps to test:
1. Open <app URL> and log in with Facebook Login. <Test account, if needed: email and password.>
2. In the login dialog, select one or more Pages.
3. On <screen name>, you will see the list of Pages you manage. Select one to connect it.

<If requested for another permission:> We request pages_show_list as a dependency of <main permission>.`,
    docs: [PERMISSIONS_REFERENCE, SCREEN_RECORDINGS],
  },
];

/** Every playbook, sorted by permission name. */
export function listPlaybooks(): readonly Playbook[] {
  return [...PLAYBOOKS].sort((a, b) => a.permission.localeCompare(b.permission));
}

/** Finds the playbook for a permission, ignoring case and surrounding spaces. */
export function getPlaybook(permission: string): Playbook | undefined {
  const name = permission.trim().toLowerCase();
  return PLAYBOOKS.find((playbook) => playbook.permission === name);
}

const GREEN = '43;214;123';

/** Formats a playbook as plain text for the terminal. */
export function formatPlaybook(playbook: Playbook, options: { color?: boolean } = {}): string {
  const heading = (text: string) => (options.color ? `\x1b[38;2;${GREEN}m${text}\x1b[39m` : text);
  const numbered = (steps: string[], start = 1) =>
    steps.map((step, index) => `  ${index + start}. ${step}`);

  const lines = [`${playbook.permission} (${playbook.product})`, playbook.summary, ''];
  if (playbook.requires.length > 0) {
    lines.push(`Request it with: ${playbook.requires.join(', ')}`, '');
  }
  lines.push(heading('What the reviewer needs to see'));
  lines.push(...playbook.reviewerNeeds.map((item) => `  - ${item}`), '');
  lines.push(heading('Screencast'));
  lines.push(...numbered(SCREENCAST_START));
  lines.push(...numbered(playbook.screencast, SCREENCAST_START.length + 1), '');
  lines.push(heading('Reviewer notes'));
  lines.push(...playbook.notes.split('\n').map((line) => (line ? `  ${line}` : '')), '');
  lines.push(heading('Docs'));
  lines.push(...playbook.docs.map((url) => `  ${url}`), '');
  lines.push(
    'A complete submission makes a rejection less likely, but the reviewer always makes the final call.',
  );
  return `${lines.join('\n')}\n`;
}
