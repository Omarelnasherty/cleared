# Changelog

## Unreleased

- Add the `cleared doctor` command. It checks that `META_APP_ID` and `META_APP_SECRET` are set, prints a text or JSON report and exits with 1 on blocking issues.
- `cleared doctor` reads the app settings through Graph API v25.0 and checks the privacy policy URL, terms of service URL, app icon, category, app domains and deauthorize callback URL.
- `cleared doctor` loads the privacy policy and terms of service pages and blocks when one is not HTTPS, needs a login, redirects to a sign-in page or fails to load. It also flags a privacy policy that doesn't mention data deletion.
- `cleared doctor` reads the webhook subscriptions, blocks on inactive ones or a callback that can't be reached over HTTPS, and sends each callback a verification request with a random verify token to check that it rejects tokens it doesn't know.
- `cleared doctor --deletion-url <url>` sends the data deletion callback a signed test request for user ID 0, blocks unless it answers 200 with `url` and `confirmation_code`, loads the status page and checks that a wrong signature is rejected.
- `cleared doctor` ends every report with the checks the Graph API can't answer: one successful API call per permission in the 30 days before you submit, business verification, and when to switch to Live mode.

## 0.1.0 (2026-11-15)

- Add `parseSignedRequest` to verify and decode signed requests.
- Add `createDataDeletionHandler` for the data deletion callback, with a pluggable status store.
- Add `createDeletionStatusHandler`, a plain HTML status page in English and Arabic.
- Add `createDeauthorizeHandler` for the deauthorize callback.
- Add the Express adapter, `cleared/express`, with `express` as an optional peer dependency.
- Add the Next.js adapter, `cleared/next`, for App Router route handlers.
- Add an Express example app and `docs/callbacks.md`, a guide to setting up and testing the callbacks.
- Add `docs/rejections/`, pages for the messages Meta sends about the data deletion callback, each with the fix.
