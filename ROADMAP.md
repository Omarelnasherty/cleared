# Roadmap

One small step at a time. Checked items are done.

## 0.1 Callbacks

- [x] Workspace setup: TypeScript package, Biome, Vitest, CI on Node 20, 22 and 24, README, brand assets
- [x] `parseSignedRequest`: verify the HMAC-SHA256 signature with the app secret, decode the base64url payload, reject bad algorithms and expired requests
- [x] Data deletion handler on the Web `Request`/`Response` API: returns `{ url, confirmation_code }`, calls an `onDelete` hook, pluggable status store with an in-memory default
- [x] Deletion status page: plain HTML, English and Arabic, no scripts, shows the confirmation code and state
- [x] Deauthorize handler with an `onDeauthorize` hook
- [ ] Express adapter (`cleared/express`)
- [ ] Next.js route handler adapter (`cleared/next`), plus a note on Hono, Bun and Workers using the Web handlers directly
- [ ] Example app and `docs/callbacks.md`
- [ ] Rejection pages for callbacks: `docs/rejections/`, one page per message Meta sends about data deletion and deauthorize URLs, titled with that exact message and followed by the fix. Use only wording found in Meta's docs or public developer reports, never invented
- [ ] Prepare 0.1.0

## 0.2 Doctor

- [ ] `cleared doctor` CLI skeleton: reads `META_APP_ID` and `META_APP_SECRET` from the environment, never prints or stores the secret, text and JSON output, exit code 1 on blocking issues
- [ ] App settings checks through the Graph API: privacy policy, terms, app icon, category, app domains, deauthorize callback
- [ ] URL checks: HTTPS, loads without a login wall, no redirect to a sign-in page, privacy policy mentions how to request data deletion
- [ ] Webhook checks: read `/{app-id}/subscriptions`, flag inactive ones, test the verify token handshake against the callback URL
- [ ] Live callback test: send a signed test request to the data deletion URL and validate the response shape
- [ ] Manual checklist in the report for what the API can't see: live mode, business verification, one API call per permission in the last 30 days
- [ ] Rejection pages for app settings, policy URLs and webhooks, same format, and link each doctor finding to its page
- [ ] Prepare 0.2.0

## 0.3 Playbooks

- [ ] Playbook format and `cleared playbook <permission>`: what the reviewer needs to see, screencast steps, reviewer notes template
- [ ] Messenger: `pages_messaging`, `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`
- [ ] Instagram: `instagram_business_basic`, `instagram_business_manage_messages`
- [ ] WhatsApp: `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`
- [ ] Login: `email`, `public_profile`
- [ ] Privacy policy checklist: the sections reviewers look for, as a checklist, not generated legal text
- [ ] Rejection pages for screencasts, reviewer notes and permission use, same format
- [ ] Prepare 0.3.0

## 1.0

- [ ] `cleared init`: add the callbacks to an existing Express or Next.js project
- [ ] Docs site on GitHub Pages built from `docs/` with a small static script (no framework), a clear title and description on every page, a sitemap, and the brand colors
- [ ] Final docs pass
- [ ] Prepare 1.0.0

## Later

- Fastify adapter
- Python port
