import type { IncomingMessage, ServerResponse } from 'node:http';
import { createDeauthorizeHandler, type DeauthorizeOptions } from './deauthorize.js';
import { createDataDeletionHandler, type DataDeletionOptions } from './deletion.js';
import { createDeletionStatusHandler, type StatusPageOptions } from './status-page.js';

/** The parts of an Express request the adapter reads. */
export type ExpressRequest = IncomingMessage & {
  body?: unknown;
  originalUrl?: string;
  protocol?: string;
};

/** An Express middleware function. */
export type ExpressHandler = (
  req: ExpressRequest,
  res: ServerResponse,
  next: (error?: unknown) => void,
) => void;

function formBody(body: unknown): URLSearchParams | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === 'string') params.append(key, item);
    }
  }
  return params;
}

async function readBody(req: ExpressRequest, headers: Headers): Promise<BodyInit | undefined> {
  // A body parser such as express.urlencoded() has already read the stream.
  if (req.readableEnded) {
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return new Uint8Array(req.body);
    const params = formBody(req.body);
    if (params) headers.set('content-type', 'application/x-www-form-urlencoded');
    return params;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

async function toRequest(req: ExpressRequest): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    // The body is buffered below, so the original framing headers no longer apply.
    if (value === undefined || name === 'content-length' || name === 'transfer-encoding') continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.originalUrl ?? req.url ?? '/', `${req.protocol ?? 'http'}://${host}`);
  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req, headers);
  return new Request(url, { method, headers, ...(body === undefined ? {} : { body }) });
}

async function send(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Wraps a Web `Request`/`Response` handler as Express middleware. Errors go to `next`. */
export function toExpress(handler: (request: Request) => Promise<Response>): ExpressHandler {
  return (req, res, next) => {
    toRequest(req)
      .then(handler)
      .then((response) => send(response, res))
      .catch(next);
  };
}

/** Express middleware for the data deletion callback. Mount it with `app.post`. */
export function dataDeletion(options: DataDeletionOptions): ExpressHandler {
  return toExpress(createDataDeletionHandler(options));
}

/** Express middleware for the deletion status page. Mount it with `app.get`. */
export function deletionStatus(options: StatusPageOptions): ExpressHandler {
  return toExpress(createDeletionStatusHandler(options));
}

/** Express middleware for the deauthorize callback. Mount it with `app.post`. */
export function deauthorize(options: DeauthorizeOptions): ExpressHandler {
  return toExpress(createDeauthorizeHandler(options));
}
