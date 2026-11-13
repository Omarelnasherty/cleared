# Callbacks

Apps that use Meta's login or read user data must give users a way to delete that data. One way to do that is the data deletion callback: Meta sends your server a signed request when a user asks for deletion, and your server answers with a link where the user can follow it. The deauthorize callback is separate and optional: Meta calls it when a user removes your app.

cleared handles both, plus the status page the deletion link points to. A working setup is in [examples/express](../examples/express).

Official references:

- [Data Deletion Request Callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback)
- [Facebook Login, deauthorize callback](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)

## How a deletion request flows

1. The user removes your app and asks for their data to be deleted.
2. Meta sends a `POST` to your data deletion URL. The body is a form with one field, `signed_request`.
3. The handler checks the signature with your app secret, rejects stale requests, and reads `user_id`, the app-scoped ID of the user.
4. It stores a `pending` status under a new confirmation code and calls your `onDelete` hook.
5. When `onDelete` returns, the status becomes `completed` and the handler answers with JSON:

   ```json
   { "url": "https://example.com/meta/deletion-status?code=3f9c...", "confirmation_code": "3f9c..." }
   ```

6. Meta shows the user the link and the code. The link opens your status page, which reads the code from the store.

If `onDelete` throws, the status becomes `failed` and the handler answers 500. If the signature is wrong or the request is too old, it answers 400 and `onDelete` is not called.

## Set up the routes

| Route                        | Method | Handler                                                        |
| ---------------------------- | ------ | -------------------------------------------------------------- |
| Data deletion URL            | `POST` | `createDataDeletionHandler`, or `dataDeletion` from an adapter |
| Status page, the `statusUrl` | `GET`  | `createDeletionStatusHandler`, or `deletionStatus`             |
| Deauthorize URL              | `POST` | `createDeauthorizeHandler`, or `deauthorize`                   |

The README has the code for the Web handlers, Express, Next.js, Hono, Bun, Deno and Workers. The data deletion handler and the status page must share one `StatusStore`.

## Add the URLs to your app

Both URLs must be public and use HTTPS.

- **Data deletion.** In the App Dashboard, open your app's settings and find the data deletion field. Pick the callback option and paste the full URL of your `POST` route, for example `https://example.com/meta/deletion`.
- **Deauthorize.** In the Facebook Login settings, paste the URL of the deauthorize route, for example `https://example.com/meta/deauthorize`.

The dashboard layout changes from time to time. If a field isn't where this page says, search the settings for "data deletion" or "deauthorize", and check the official pages linked above.

## Before going live

- **Use a real store.** `createMemoryStatusStore` loses everything on restart and isn't shared between servers or serverless invocations. Implement `StatusStore` with your database: it has a `get(code)` and a `set(code, status)`.
- **Delete everything.** `onDelete` should remove all data you hold about that user from Meta's platform, including copies in caches, search indexes and analytics you control. Log the confirmation code, not the data.
- **Long deletions.** The status becomes `completed` as soon as `onDelete` returns. If you hand the work to a background job instead, the page says completed before the job ends, so do the deletion in the hook when you can. If a job does fail later, set that code to `failed` in the store.
- **Repeat requests.** A request for the same user can arrive more than once. Make `onDelete` safe to run again for a user who is already gone.
- **Keep the secret secret.** Read the app secret from the environment. The handlers never log it.
- **Clock.** Requests older than one hour are rejected by default. Change it with `maxAgeSeconds` if you need to, and keep the server clock in sync.

## Test it

Send yourself a signed request with your app secret, the same shape Meta sends:

```
META_APP_SECRET=... node examples/express/send-test-request.js https://example.com/meta/deletion
```

You should get a 200 with `url` and `confirmation_code`, and the `url` should open the status page with the state "Completed". A 400 with `Signature does not match` means the server is using a different secret than the one you signed with.

## Status page

The page is plain HTML with no scripts or external assets. It shows the confirmation code and the state in English or Arabic. The language comes from `?lang=en` or `?lang=ar`, then the browser's `Accept-Language`. It answers 400 when the code is missing and 404 when the code is unknown, and asks search engines not to index it.
