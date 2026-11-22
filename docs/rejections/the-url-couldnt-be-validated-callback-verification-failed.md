# The URL couldn't be validated. Callback verification failed with the following errors

**Where you see it.** In the Webhooks settings of the App Dashboard (or the Webhooks step of the Messenger, Instagram or WhatsApp setup), right after you click **Verify and save** on a callback URL and verify token. The message goes on with the cause, for example `HTTP Status Code = 404; HTTP Message = Not Found`, `HTTP Status Code = 502`, or a `curl_errno` with a curl error such as a timeout or an SSL problem.

**What it means.** Meta sent its verification `GET` to your callback URL and never got a usable answer: the request failed, timed out, or your server answered with an error status. Your code didn't get the chance to check the verify token. The text after the message tells you which of these happened, so read it first.

## Fix

1. **Read the status code or curl error.** `404` means the path is wrong or the route doesn't handle `GET`. `5xx` means your server or the proxy in front of it failed. `curl_errno = 28` is a timeout. `curl_errno` 35, 51 or 60 is a certificate problem.
2. **The route handles `GET`.** Webhook events arrive as `POST`, but verification is a `GET` to the same URL with `hub.mode`, `hub.challenge` and `hub.verify_token` in the query string. A route that only handles `POST` answers 404 or 405.
3. **The URL is public.** `localhost`, a private IP, a VPN, basic auth or an IP allowlist all block Meta. During development, use a tunnel with a public HTTPS address, and keep it running while you verify.
4. **The certificate is valid.** Meta needs HTTPS with a certificate from a public authority that matches the host name and includes the full chain. Self-signed certificates don't work.
5. **No redirect or sign-in page.** A redirect from `http` to `https`, from one host to another, or to a login page fails verification. Paste the final address, and if the host is a workspace or a tunnel with access control, make it public.
6. **The server answers quickly.** A cold start or a workflow that only starts after the first request can miss the time limit. Make sure the server is up before you click **Verify and save**, and answer the verification request before doing any slow work.
7. **The production URL, not the test one.** Tools that give a separate test URL for webhooks stop answering it once you leave test mode. Save the URL that stays active.

Then check the handshake yourself with your real token. The answer should be `200` with the body `12345` and nothing else:

```
curl -i "https://example.com/webhook?hub.mode=subscribe&hub.verify_token=<your token>&hub.challenge=12345"
```

`cleared doctor` runs the same request with a random token for every webhook subscription it finds, and flags a callback that can't be reached.

## Source

- [Get started with webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started), Meta for Developers: the verification request and the certificate requirements.
- [Webhook - Facebook returns 404](https://github.com/watson-developer-cloud/botkit-middleware/issues/40), GitHub: the message with `HTTP Status Code = 404` for a route that wasn't defined.
- [Curl_errno = 28 in webhook](https://community.n8n.io/t/curl-errno-28-in-webhook/19486), n8n community: the message with a timeout.
