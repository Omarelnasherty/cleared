# The URL couldn't be validated. Response does not match challenge

**Where you see it.** In the Webhooks settings of the App Dashboard (or the Webhooks step of the Messenger, Instagram or WhatsApp setup), right after you click **Verify and save**. The message goes on with `expected value="..."` and `received="..."`.

**What it means.** Meta reached your callback URL and got a `200`, but the body wasn't the `hub.challenge` value it sent. Meta only accepts the challenge, as is, with nothing around it. The `received` value shows what your server sent instead, which usually points straight at the cause.

## Fix

1. **Answer with the challenge only.** Send the `hub.challenge` query parameter back as the whole body, as plain text. Not `OK`, not `{"success":true}`, not the challenge inside JSON.
2. **No HTML around it.** If `received` starts with `<!DOCTYPE html>`, the request reached a web page instead of your handler: a framework's catch-all route, a static site on the same host, or an error page. Check the path and the route order.
3. **No JSON wrapping.** Frameworks and automation tools often serialize the response. Use the plain text response type, so `12345` is sent as `12345` and not as `"12345"`.
4. **Check the verify token, then answer.** Compare `hub.verify_token` with your own token. If they match, answer `200` with the challenge. If not, answer `403`. Don't answer `200` with an empty body or a message.
5. **Read the parameter with the dots.** The names are `hub.mode`, `hub.challenge` and `hub.verify_token`. Some query parsers turn dots into nested objects or underscores, so log the parsed query once to see where the challenge ends up.

In a handler on the Web `Request` API, the check looks like this:

```ts
const url = new URL(request.url);
if (
  url.searchParams.get('hub.mode') === 'subscribe' &&
  url.searchParams.get('hub.verify_token') === process.env.WEBHOOK_VERIFY_TOKEN
) {
  return new Response(url.searchParams.get('hub.challenge'), {
    headers: { 'content-type': 'text/plain' },
  });
}
return new Response(null, { status: 403 });
```

`cleared doctor` sends each webhook callback a verification request with a random token. If the callback answers `200` without echoing the challenge, it links to this page.

## Source

- [Get started with webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started), Meta for Developers: the verification request and the answer Meta expects.
- [For webhook setup call back URL and token cant be verify](https://developers.facebook.com/community/threads/340944138228135/), Meta Developer Community Forum: the message with an HTML page in `received`.
- [The URL couldn't be validated. Response does not match challenge](https://github.com/howdyai/botkit/issues/287), GitHub: the message with `OK` in `received`.
