import { createHmac, timingSafeEqual } from 'node:crypto';

/** The decoded payload of a verified signed request. */
export interface SignedRequestPayload {
  algorithm: 'HMAC-SHA256';
  /** Unix time in seconds when the request was issued. */
  issued_at: number;
  /** App-scoped ID of the user the request is about. */
  user_id?: string;
  [key: string]: unknown;
}

export interface ParseSignedRequestOptions {
  /** Reject requests issued more than this many seconds ago. Default 3600. */
  maxAgeSeconds?: number;
  /** Current time in milliseconds. Meant for tests. */
  now?: number;
}

/** Thrown when a signed request is malformed, forged or expired. */
export class SignedRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignedRequestError';
  }
}

const CLOCK_SKEW_SECONDS = 60;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function decodeBase64Url(value: string): Buffer {
  if (!BASE64URL.test(value)) throw new SignedRequestError('Signed request is not base64url');
  return Buffer.from(value, 'base64url');
}

/**
 * Verifies a signed request with the app secret and returns its payload.
 * Throws SignedRequestError if the format, signature, algorithm or age is wrong.
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
  options: ParseSignedRequestOptions = {},
): SignedRequestPayload {
  if (!appSecret) throw new SignedRequestError('App secret is required');
  const parts = signedRequest.split('.');
  const [encodedSignature, encodedPayload] = parts;
  if (parts.length !== 2 || !encodedSignature || !encodedPayload) {
    throw new SignedRequestError('Signed request must have the form signature.payload');
  }

  const signature = decodeBase64Url(encodedSignature);
  const expected = createHmac('sha256', appSecret).update(encodedPayload).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new SignedRequestError('Signature does not match');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8'));
  } catch {
    throw new SignedRequestError('Payload is not valid JSON');
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new SignedRequestError('Payload must be a JSON object');
  }
  const data = payload as Record<string, unknown>;

  if (typeof data.algorithm !== 'string' || data.algorithm.toUpperCase() !== 'HMAC-SHA256') {
    throw new SignedRequestError('Unsupported algorithm');
  }
  if (typeof data.issued_at !== 'number' || !Number.isFinite(data.issued_at)) {
    throw new SignedRequestError('Payload has no issued_at');
  }

  const nowSeconds = (options.now ?? Date.now()) / 1000;
  const maxAge = options.maxAgeSeconds ?? 3600;
  if (nowSeconds - data.issued_at > maxAge) throw new SignedRequestError('Request has expired');
  if (data.issued_at - nowSeconds > CLOCK_SKEW_SECONDS) {
    throw new SignedRequestError('Request was issued in the future');
  }

  return { ...data, algorithm: 'HMAC-SHA256', issued_at: data.issued_at } as SignedRequestPayload;
}
