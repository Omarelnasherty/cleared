/** The version of this package. */
export const version = '0.0.0';

export {
  createDataDeletionHandler,
  createMemoryStatusStore,
  type DataDeletionOptions,
  type DeletionRequest,
  type DeletionState,
  type DeletionStatus,
  type StatusStore,
} from './deletion.js';
export {
  type ParseSignedRequestOptions,
  parseSignedRequest,
  SignedRequestError,
  type SignedRequestPayload,
} from './signed-request.js';
export {
  createDeletionStatusHandler,
  type StatusPageOptions,
} from './status-page.js';
