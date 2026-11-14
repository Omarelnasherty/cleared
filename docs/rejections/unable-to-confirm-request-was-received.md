# Unable to confirm request was received

**Where you see it.** In the user's Facebook settings, next to the deletion request they sent to your app. You won't see it in the App Dashboard, so the usual first sign is a user or a reviewer telling you about it.

**What it means.** Meta sent a `POST` to your data deletion URL and didn't get back the answer it expects: a 200 with JSON that has `url` and `confirmation_code`. Either the request never reached your code, or your code answered with something else.

## Fix

1. **The URL is set.** Open your app's settings in the App Dashboard and check that the data deletion field is set to the callback option, not the instructions option, and that the URL is the full path of your `POST` route.
2. **The URL is public and uses HTTPS.** Open it from outside your network. It must not sit behind a login, a VPN, a basic auth prompt or an IP allowlist.
3. **Nothing in front of the server blocks Meta.** Bot protection, a web application firewall or a CDN challenge page can answer Meta's servers before your app does. Check your firewall and CDN logs for blocked `POST` requests to the route.
4. **The route accepts `POST`.** A route that only handles `GET`, or a redirect from `http` to `https` or from one host to another, loses the request.
5. **`signed_request` is read from the form body.** Meta sends it as an `application/x-www-form-urlencoded` body, not in the query string. The cleared handlers read it from the body, with or without a body parser in front.
6. **The answer has the right shape.** It must be JSON with both `url` and `confirmation_code`. An empty 200, a redirect or an HTML page doesn't count. `createDataDeletionHandler` always answers this way on success.
7. **The same app secret.** A request signed with a different secret fails verification and gets a 400. If you have more than one app, or rotated the secret, check that the server uses the secret of the app the user removed.

Then send a signed request with your app secret the way Meta does and check that you get a 200 with `url` and `confirmation_code`:

```
META_APP_SECRET=... node examples/express/send-test-request.js https://example.com/meta/deletion
```

## Source

- [Facebook don't sent "Data Deletion Requests"](https://developers.facebook.com/community/threads/283327892978721/), Meta Developer Community Forum: developers who saw this message while the deletion request never reached their server.
- [Data Deletion Request Callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback), Meta for Developers: the request and the response Meta expects.
