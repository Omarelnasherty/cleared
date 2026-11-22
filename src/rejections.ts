const BASE = 'https://github.com/Omarelnasherty/cleared/blob/main/docs/rejections/';

/** The rejection pages in docs/rejections that doctor findings link to. */
export const REJECTION_PAGES = {
  deletionUnconfirmed: 'unable-to-confirm-request-was-received.md',
  webhookVerificationFailed: 'the-url-couldnt-be-validated-callback-verification-failed.md',
  webhookChallenge: 'the-url-couldnt-be-validated-response-does-not-match-challenge.md',
} as const;

export function rejectionPageUrl(page: keyof typeof REJECTION_PAGES): string {
  return `${BASE}${REJECTION_PAGES[page]}`;
}
