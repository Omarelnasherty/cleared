import { createDeauthorizeHandler, type DeauthorizeOptions } from './deauthorize.js';
import { createDataDeletionHandler, type DataDeletionOptions } from './deletion.js';
import { createDeletionStatusHandler, type StatusPageOptions } from './status-page.js';

/** A Next.js App Router route handler. */
export type RouteHandler = (request: Request) => Promise<Response>;

/** Route handlers for the data deletion callback. Use it as `export const { POST } = dataDeletion(...)`. */
export function dataDeletion(options: DataDeletionOptions): { POST: RouteHandler } {
  return { POST: createDataDeletionHandler(options) };
}

/** Route handlers for the deletion status page. Use it as `export const { GET } = deletionStatus(...)`. */
export function deletionStatus(options: StatusPageOptions): { GET: RouteHandler } {
  return { GET: createDeletionStatusHandler(options) };
}

/** Route handlers for the deauthorize callback. Use it as `export const { POST } = deauthorize(...)`. */
export function deauthorize(options: DeauthorizeOptions): { POST: RouteHandler } {
  return { POST: createDeauthorizeHandler(options) };
}
