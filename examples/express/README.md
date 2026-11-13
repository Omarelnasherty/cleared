# Express example

A small Express app with the data deletion callback, the deletion status page and the deauthorize callback.

## Run it

From the repository root:

```
npm ci
npm run build
META_APP_SECRET=any-local-secret node examples/express/server.js
```

In a second terminal, send a signed request the way Meta does:

```
META_APP_SECRET=any-local-secret node examples/express/send-test-request.js
```

The reply has a `url` and a `confirmation_code`. Open the `url` to see the status page. To try the deauthorize callback, pass its URL:

```
META_APP_SECRET=any-local-secret node examples/express/send-test-request.js http://localhost:3000/meta/deauthorize
```

## Use it with a real app

Meta only calls public HTTPS URLs. Deploy the app, or put a tunnel in front of it, then start it with your real app secret and public address:

```
META_APP_SECRET=... PUBLIC_URL=https://example.com node examples/express/server.js
```

Then add the two callback URLs it prints to your app's settings in the App Dashboard. [docs/callbacks.md](../../docs/callbacks.md) explains where they go and what to change before going live.

The example keeps statuses in memory. They are lost on restart, so use a store backed by your database in production.
