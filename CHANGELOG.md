# Changelog

## Unreleased

- Add the `cleared doctor` command. It checks that `META_APP_ID` and `META_APP_SECRET` are set, prints a text or JSON report and exits with 1 on blocking issues.
- `cleared doctor` reads the app settings through Graph API v25.0 and checks the privacy policy URL, terms of service URL, app icon, category, app domains and deauthorize callback URL.

## 0.1.0 (2026-11-15)

- Add `parseSignedRequest` to verify and decode signed requests.
- Add `createDataDeletionHandler` for the data deletion callback, with a pluggable status store.
- Add `createDeletionStatusHandler`, a plain HTML status page in English and Arabic.
- Add `createDeauthorizeHandler` for the deauthorize callback.
- Add the Express adapter, `cleared/express`, with `express` as an optional peer dependency.
- Add the Next.js adapter, `cleared/next`, for App Router route handlers.
- Add an Express example app and `docs/callbacks.md`, a guide to setting up and testing the callbacks.
- Add `docs/rejections/`, pages for the messages Meta sends about the data deletion callback, each with the fix.
