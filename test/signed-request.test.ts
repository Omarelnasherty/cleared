import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { parseSignedRequest, SignedRequestError } from '../src/index.js';

const secret = 'test-secret';
const now = 1_700_000_000_000;

function sign(payload: unknown, key = secret): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', key).update(body).digest().toString('base64url');
  return `${sig}.${body}`;
}

const valid = { algorithm: 'HMAC-SHA256', issued_at: now / 1000 - 10, user_id: '1234' };

describe('parseSignedRequest', () => {
  test('returns the payload of a valid request', () => {
    expect(parseSignedRequest(sign(valid), secret, { now })).toEqual(valid);
  });

  test('rejects a wrong secret', () => {
    expect(() => parseSignedRequest(sign(valid, 'other'), secret, { now })).toThrow(
      SignedRequestError,
    );
  });

  test('rejects a tampered payload', () => {
    const [sig] = sign(valid).split('.');
    const body = Buffer.from(JSON.stringify({ ...valid, user_id: '999' })).toString('base64url');
    expect(() => parseSignedRequest(`${sig}.${body}`, secret, { now })).toThrow(/Signature/);
  });

  test('rejects other algorithms', () => {
    const request = sign({ ...valid, algorithm: 'HMAC-SHA1' });
    expect(() => parseSignedRequest(request, secret, { now })).toThrow(/algorithm/);
  });

  test('rejects expired requests', () => {
    const request = sign({ ...valid, issued_at: now / 1000 - 7200 });
    expect(() => parseSignedRequest(request, secret, { now })).toThrow(/expired/);
    expect(parseSignedRequest(request, secret, { now, maxAgeSeconds: 86400 })).toBeTruthy();
  });

  test('rejects requests from the future', () => {
    const request = sign({ ...valid, issued_at: now / 1000 + 600 });
    expect(() => parseSignedRequest(request, secret, { now })).toThrow(/future/);
  });

  test('rejects a missing issued_at', () => {
    const request = sign({ algorithm: 'HMAC-SHA256' });
    expect(() => parseSignedRequest(request, secret, { now })).toThrow(/issued_at/);
  });

  test('rejects malformed input', () => {
    for (const input of ['', 'abc', 'a.b.c', '.x', 'x.', 'a b.c d']) {
      expect(() => parseSignedRequest(input, secret, { now })).toThrow(SignedRequestError);
    }
  });

  test('rejects an empty secret', () => {
    expect(() => parseSignedRequest(sign(valid, ''), '', { now })).toThrow(/secret/);
  });
});
