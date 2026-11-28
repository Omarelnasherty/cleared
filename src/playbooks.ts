/** The login products a playbook can use. */
export type Login = 'Facebook Login' | 'Business Login for Instagram';

/** What to prepare for one permission before you submit it for App Review. */
export interface Playbook {
  /** The permission name, as it appears in App Review. */
  permission: string;
  /** The product the permission belongs to. */
  product: string;
  /** What the permission gives your app, in one sentence. */
  summary: string;
  /** The login the screencast and the reviewer go through. */
  login: Login;
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
const reference = (permission: string) =>
  `https://developers.facebook.com/docs/permissions/reference/${permission}/`;
const SEND_API = 'https://developers.facebook.com/docs/messenger-platform/reference/send-api';
const PAGE_WEBHOOKS = 'https://developers.facebook.com/docs/graph-api/webhooks/reference/page';
const SCREEN_RECORDINGS =
  'https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings';

const INSTAGRAM_APP_REVIEW = 'https://developers.facebook.com/docs/instagram-platform/app-review';
const INSTAGRAM_LOGIN =
  'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login';
const INSTAGRAM_MESSAGING =
  'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api';
const INSTAGRAM_WEBHOOKS = 'https://developers.facebook.com/docs/instagram-platform/webhooks';

/** Steps that open every screencast, whatever the permission. */
export function screencastStart(login: Login): string[] {
  return [
    'Start logged out, in a clean browser window.',
    `Show the full login: open your app, log in with ${login} and show the permission dialog.`,
    `If people can also sign up without ${login}, show that path too and add a test account to the notes.`,
  ];
}

const PLAYBOOKS: readonly Playbook[] = [
  {
    permission: 'instagram_business_basic',
    product: 'Instagram',
    summary:
      'Lets your app read the profile and media of an Instagram professional account that logs in to your app.',
    login: 'Business Login for Instagram',
    requires: [],
    reviewerNeeds: [
      'A person connecting their Instagram professional account (Business or Creator) to your app with Business Login for Instagram.',
      'Data read through the API shown in your app right after, such as the username and account ID, so the reviewer sees the connection worked.',
      'Only basic account data used for that purpose. If you read media too, show the screen where your app uses it.',
    ],
    screencast: [
      'Record with an Instagram professional account, not a personal one, and approve the permissions on the Instagram consent screen.',
      'Back in your app, show the connected account with its username (read from GET /me on graph.instagram.com).',
      'Show what your app does next with that account, for example its settings screen.',
    ],
    notes: `We use instagram_business_basic to identify the Instagram professional account people connect to <app name> and to show its <username, profile picture, media> in <screen name>.

Steps to test:
1. Open <app URL> and log in. <Test account, if needed: email and password.>
2. Click <button name> and log in with an Instagram professional account. <Test Instagram account, if needed.>
3. Approve the permissions on the Instagram consent screen.
4. On <screen name>, you will see the connected account and its username.

<If requested for another permission:> We request instagram_business_basic as a dependency of <main permission>.`,
    docs: [PERMISSIONS_REFERENCE, INSTAGRAM_LOGIN, INSTAGRAM_APP_REVIEW],
  },
  {
    permission: 'instagram_business_manage_messages',
    product: 'Instagram',
    summary:
      'Lets your app read and answer the direct messages of an Instagram professional account that logs in to your app.',
    login: 'Business Login for Instagram',
    requires: ['instagram_business_basic'],
    reviewerNeeds: [
      'A direct message sent to the connected professional account from a second Instagram account showing up in your app.',
      'A reply sent from your app (by a person or by your bot) arriving in that same Instagram conversation.',
      'Both sides of the conversation: your app and the Instagram app or website of the second account, so the reviewer sees the message go through.',
      'Your app only messaging people who wrote first, and replying within 24 hours. The human agent tag, which allows a reply within 7 days, is reviewed on its own.',
      'A way for the person to reach a human, if a bot answers first.',
    ],
    screencast: [
      'Record with an Instagram professional account, not a personal one, and approve the messaging permission on the Instagram consent screen.',
      'Show that the account is connected and your app is receiving its messages (your app calls POST /me/subscribed_apps with the messages field here).',
      'From a second Instagram account, send a direct message to the connected account.',
      'Show the message arriving in your app.',
      'Reply from your app and show the reply in the conversation on the second account.',
    ],
    notes: `We use instagram_business_manage_messages so that <who: business owners, support agents, our bot> can read and answer the Instagram direct messages of their professional account from <app name>.

Steps to test:
1. Open <app URL> and log in. <Test account, if needed: email and password.>
2. Click <button name> and log in with the Instagram professional account <test account username>.
3. From any other Instagram account, send a direct message to <test account username>.
4. The message appears in <screen name> in our app. <Bot apps: say what the bot answers and how to reach a person.>
5. Reply from our app. The reply appears in the Instagram conversation.

We only reply to people who messaged the account first, within 24 hours of their last message. <If you use the human agent tag, say when.>`,
    docs: [PERMISSIONS_REFERENCE, INSTAGRAM_MESSAGING, INSTAGRAM_WEBHOOKS, INSTAGRAM_APP_REVIEW],
  },
  {
    permission: 'pages_show_list',
    product: 'Pages',
    summary: 'Lets your app read the list of Facebook Pages a person manages.',
    login: 'Facebook Login',
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
  {
    permission: 'pages_messaging',
    product: 'Messenger',
    summary: 'Lets your app read and send messages in the Messenger conversations of a Page.',
    login: 'Facebook Login',
    requires: ['pages_manage_metadata', 'pages_show_list'],
    reviewerNeeds: [
      'A message sent to the Page from a personal Messenger account showing up in your app.',
      'A reply sent from your app (by a person or by your bot) arriving in that same Messenger conversation.',
      'Both sides of the conversation: your app and the Messenger window, so the reviewer sees the message go through.',
      "Replies sent within 24 hours of the person's last message. Messages outside that window need a message tag, and features like Human Agent are reviewed on their own.",
    ],
    screencast: [
      'In the Facebook Login dialog, pick the Page that will receive messages.',
      'Connect that Page in your app and show that it is now listening for messages.',
      'From a second, personal account, open the Page in Messenger and send a message.',
      'Show the message arriving in your app.',
      'Reply from your app and show the reply in the Messenger window of the second account.',
    ],
    notes: `We use pages_messaging so that <who: Page admins, support agents, our bot> can read and answer messages sent to their Facebook Page from <app name>.

Steps to test:
1. Open <app URL> and log in with Facebook Login. <Test account, if needed: email and password.>
2. Select the Page <test Page name> and connect it on <screen name>.
3. From any personal account, send a message to <test Page name> in Messenger.
4. The message appears in <screen name> in our app. <Bot apps: say what the bot answers.>
5. Reply from our app. The reply appears in the Messenger conversation.

We only reply within 24 hours of the person's last message. <If you use a message tag, name it and say when.>`,
    docs: [reference('pages_messaging'), SEND_API, SCREEN_RECORDINGS],
  },
  {
    permission: 'pages_manage_metadata',
    product: 'Pages',
    summary:
      'Lets your app subscribe a Page to webhooks and update its settings, for example to receive its messages.',
    login: 'Facebook Login',
    requires: ['pages_show_list'],
    reviewerNeeds: [
      'The moment your app subscribes the Page, usually when a person connects it, so the reviewer sees why the app needs Page webhooks.',
      'An event from the Page reaching your app soon after, such as a new message or comment, to prove the subscription is used.',
      'If you request it for pages_messaging, the use case description naming pages_messaging as the main permission.',
    ],
    screencast: [
      'In the Facebook Login dialog, pick the Page to connect.',
      'Connect the Page in your app. Show the screen that confirms it is connected (your app calls POST /{page-id}/subscribed_apps here).',
      'Trigger an event on the Page, for example a message or a comment from a second account.',
      'Show the event arriving in your app.',
    ],
    notes: `We use pages_manage_metadata to subscribe the Pages people connect to <app name> to webhooks, so we receive <which events: messages, comments, feed updates> for those Pages.

Steps to test:
1. Open <app URL> and log in with Facebook Login. <Test account, if needed: email and password.>
2. Select the Page <test Page name> and connect it on <screen name>. This subscribes the Page to our webhooks.
3. <Send a message to the Page / comment on a Page post> from any personal account.
4. The event appears in <screen name> in our app.

<If requested for another permission:> We request pages_manage_metadata as a dependency of <main permission>.`,
    docs: [reference('pages_manage_metadata'), PAGE_WEBHOOKS, SCREEN_RECORDINGS],
  },
  {
    permission: 'pages_read_engagement',
    product: 'Pages',
    summary:
      'Lets your app read what a Page posts, such as posts, photos, videos and events, along with its followers and engagement data.',
    login: 'Facebook Login',
    requires: ['pages_show_list'],
    reviewerNeeds: [
      'Content of the connected Page, read through the API, shown inside your app.',
      'A clear link between that data and a feature of your app, for example a list of posts to reply to or a report.',
      'Only data from Pages the person manages and connected to your app.',
    ],
    screencast: [
      'In the Facebook Login dialog, pick the Page to connect.',
      'Connect the Page in your app.',
      'Open the screen that shows the Page data, for example its posts and their comments (read from GET /{page-id}/feed).',
      'Show what the person does with that data in your app.',
    ],
    notes: `We use pages_read_engagement to show <what: Page posts, comments, follower or engagement data> for the Pages people connect to <app name>, so they can <what they do with it>.

Steps to test:
1. Open <app URL> and log in with Facebook Login. <Test account, if needed: email and password.>
2. Select the Page <test Page name> and connect it on <screen name>.
3. Open <screen name>. You will see <what the screen shows> for that Page.

<If requested for another permission:> We request pages_read_engagement as a dependency of <main permission>.`,
    docs: [reference('pages_read_engagement'), SCREEN_RECORDINGS],
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
  const start = screencastStart(playbook.login);
  lines.push(...numbered(start));
  lines.push(...numbered(playbook.screencast, start.length + 1), '');
  lines.push(heading('Reviewer notes'));
  lines.push(...playbook.notes.split('\n').map((line) => (line ? `  ${line}` : '')), '');
  lines.push(heading('Docs'));
  lines.push(...playbook.docs.map((url) => `  ${url}`), '');
  lines.push(
    'A complete submission makes a rejection less likely, but the reviewer always makes the final call.',
  );
  return `${lines.join('\n')}\n`;
}
