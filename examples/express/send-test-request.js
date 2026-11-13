// Sends a signed request to a running callback, the same shape Meta sends.
// Usage: node send-test-request.js [url] [user_id]
import { createHmac } from 'node:crypto';

const appSecret = process.env.META_APP_SECRET;
if (!appSecret) {
  console.error('Set META_APP_SECRET to the secret the server uses.');
  process.exit(1);
}

const url = process.argv[2] ?? 'http://localhost:3000/meta/deletion';
const userId = process.argv[3] ?? 'test-user-1';

const payload = Buffer.from(
  JSON.stringify({
    algorithm: 'HMAC-SHA256',
    issued_at: Math.floor(Date.now() / 1000),
    user_id: userId,
  }),
).toString('base64url');
const signature = createHmac('sha256', appSecret).update(payload).digest('base64url');

const response = await fetch(url, {
  method: 'POST',
  body: new URLSearchParams({ signed_request: `${signature}.${payload}` }),
});
console.log(response.status, await response.text());
