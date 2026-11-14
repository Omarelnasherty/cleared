# Changelog

## Unreleased

- Add `parseSignedRequest` to verify and decode signed requests.
- Add `createDataDeletionHandler` for the data deletion callback, with a pluggable status store.
- Add `createDeletionStatusHandler`, a plain HTML status page in English and Arabic.
- Add `createDeauthorizeHandler` for the deauthorize callback.
- Add the Express adapter, `cleared/express`, with `express` as an optional peer dependency.
- Add the Next.js adapter, `cleared/next`, for App Router route handlers.
- Add an Express example app and `docs/callbacks.md`, a guide to setting up and testing the callbacks.
- Add `docs/rejections/`, pages for the messages Meta sends about the data deletion callback, each with the fix.
