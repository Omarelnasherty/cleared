import { randomBytes } from 'node:crypto';
import { parseSignedRequest, SignedRequestError } from './signed-request.js';

/** State of a deletion request. */
export type DeletionState = 'pending' | 'completed' | 'failed';

export interface DeletionStatus {
  state: DeletionState;
  /** Unix time in seconds when the request was received. */
  createdAt: number;
}

/** Where deletion statuses are kept. Implement this to use a database. */
export interface StatusStore {
  get(code: string): Promise<DeletionStatus | undefined> | DeletionStatus | undefined;
  set(code: string, status: DeletionStatus): Promise<void> | void;
}

/** A status store that lives in process memory. Fine for one server, lost on restart. */
export function createMemoryStatusStore(): StatusStore {
  const entries = new Map<string, DeletionStatus>();
  return {
    get: (code) => entries.get(code),
    set: (code, status) => {
      entries.set(code, status);
    },
  };
}

export interface DeletionRequest {
  /** App-scoped ID of the user who asked for deletion. */
  userId: string;
  confirmationCode: string;
}

export interface DataDeletionOptions {
  /** The app secret. Read it from the environment, for example process.env.META_APP_SECRET. */
  appSecret: string;
  /** Public URL of your status page. The confirmation code is added as the `code` query parameter. */
  statusUrl: string | ((confirmationCode: string) => string);
  /** Deletes the user's data. If it throws, the request is marked failed and the response is a 500. */
  onDelete: (request: DeletionRequest) => Promise<void> | void;
  /** Defaults to an in-memory store. */
  store?: StatusStore;
  /** Maximum age of the signed request in seconds. Default 3600. */
  maxAgeSeconds?: number;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

/**
 * Creates a handler for the data deletion callback. It verifies the signed request,
 * calls onDelete, records the status and answers with the status URL and confirmation code.
 */
export function createDataDeletionHandler(
  options: DataDeletionOptions,
): (request: Request) => Promise<Response> {
  const store = options.store ?? createMemoryStatusStore();
  const buildUrl =
    typeof options.statusUrl === 'function'
      ? options.statusUrl
      : (code: string) => {
          const url = new URL(options.statusUrl as string);
          url.searchParams.set('code', code);
          return url.toString();
        };

  return async (request) => {
    if (request.method !== 'POST')
      return json({ error: 'Method not allowed' }, 405, { allow: 'POST' });

    let signedRequest: FormDataEntryValue | null;
    try {
      signedRequest = (await request.formData()).get('signed_request');
    } catch {
      return json({ error: 'Expected a form body' }, 400);
    }
    if (typeof signedRequest !== 'string') return json({ error: 'Missing signed_request' }, 400);

    let userId: string;
    try {
      const payload = parseSignedRequest(signedRequest, options.appSecret, {
        ...(options.maxAgeSeconds === undefined ? {} : { maxAgeSeconds: options.maxAgeSeconds }),
      });
      if (typeof payload.user_id !== 'string' || !payload.user_id) {
        throw new SignedRequestError('Payload has no user_id');
      }
      userId = payload.user_id;
    } catch (error) {
      if (error instanceof SignedRequestError) return json({ error: error.message }, 400);
      throw error;
    }

    const confirmationCode = randomBytes(12).toString('hex');
    const createdAt = Math.floor(Date.now() / 1000);
    await store.set(confirmationCode, { state: 'pending', createdAt });
    try {
      await options.onDelete({ userId, confirmationCode });
    } catch {
      await store.set(confirmationCode, { state: 'failed', createdAt });
      return json({ error: 'Deletion failed' }, 500);
    }
    await store.set(confirmationCode, { state: 'completed', createdAt });

    return json({ url: buildUrl(confirmationCode), confirmation_code: confirmationCode }, 200);
  };
}
