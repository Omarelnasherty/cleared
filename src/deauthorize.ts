import { parseSignedRequest, SignedRequestError } from './signed-request.js';

export interface DeauthorizeRequest {
  /** App-scoped ID of the user who removed the app. */
  userId: string;
}

export interface DeauthorizeOptions {
  /** The app secret. Read it from the environment, for example process.env.META_APP_SECRET. */
  appSecret: string;
  /** Runs when a user removes your app. If it throws, the response is a 500 so the failure is visible. */
  onDeauthorize: (request: DeauthorizeRequest) => Promise<void> | void;
  /** Maximum age of the signed request in seconds. Default 3600. */
  maxAgeSeconds?: number;
}

function reply(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

/**
 * Creates a handler for the deauthorize callback. It verifies the signed request,
 * calls onDeauthorize and answers 200.
 */
export function createDeauthorizeHandler(
  options: DeauthorizeOptions,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST')
      return reply(405, { error: 'Method not allowed' }, { allow: 'POST' });

    let signedRequest: FormDataEntryValue | null;
    try {
      signedRequest = (await request.formData()).get('signed_request');
    } catch {
      return reply(400, { error: 'Expected a form body' });
    }
    if (typeof signedRequest !== 'string') return reply(400, { error: 'Missing signed_request' });

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
      if (error instanceof SignedRequestError) return reply(400, { error: error.message });
      throw error;
    }

    try {
      await options.onDeauthorize({ userId });
    } catch {
      return reply(500, { error: 'Deauthorize failed' });
    }
    return reply(200, { success: true });
  };
}
