import { createMemoryStatusStore } from 'cleared';
import { dataDeletion, deauthorize, deletionStatus } from 'cleared/express';
import express from 'express';

/**
 * Builds the example app. `users` stands in for your database and `sessions`
 * for whatever keeps people signed in.
 *
 * @param {{
 *   appSecret: string,
 *   publicUrl: string,
 *   users?: Map<string, unknown>,
 *   sessions?: Set<string>,
 * }} options
 */
export function createApp({ appSecret, publicUrl, users = new Map(), sessions = new Set() }) {
  const app = express();
  // Replace this with a store backed by your database before going live.
  const store = createMemoryStatusStore();

  app.post(
    '/meta/deletion',
    dataDeletion({
      appSecret,
      statusUrl: new URL('/meta/deletion-status', publicUrl).toString(),
      store,
      onDelete: ({ userId }) => {
        users.delete(userId);
        sessions.delete(userId);
      },
    }),
  );

  app.get('/meta/deletion-status', deletionStatus({ store, appName: 'Example App' }));

  app.post(
    '/meta/deauthorize',
    deauthorize({
      appSecret,
      onDeauthorize: ({ userId }) => {
        sessions.delete(userId);
      },
    }),
  );

  return app;
}
