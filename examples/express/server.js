import { createApp } from './app.js';

const appSecret = process.env.META_APP_SECRET;
if (!appSecret) {
  console.error('Set META_APP_SECRET before starting the example.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const publicUrl = process.env.PUBLIC_URL ?? `http://localhost:${port}`;

createApp({ appSecret, publicUrl }).listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
  console.log(`Data deletion callback URL: ${publicUrl}/meta/deletion`);
  console.log(`Deauthorize callback URL:   ${publicUrl}/meta/deauthorize`);
});
