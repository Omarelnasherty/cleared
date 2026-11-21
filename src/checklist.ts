import type { Finding } from './doctor.js';

const APP_REVIEW_GUIDE =
  'https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide';

/** The checks the Graph API can't answer, added to every report as manual findings. */
export function manualChecklist(): Finding[] {
  return [
    {
      id: 'manual.api-calls',
      status: 'manual',
      title: 'Make a successful API call with each permission you request',
      detail:
        'Advanced access needs at least one successful call per permission in the 30 days before you submit, from your app or the Graph API Explorer. Logging can lag, so check the API calls column in App Review > Permissions and Features before you submit.',
    },
    {
      id: 'manual.business-verification',
      status: 'manual',
      title: 'Complete business verification if you request advanced access',
      detail:
        'Advanced access requires a verified business, and the submission can stall until verification is done. Start it early in the App Dashboard; it can take several days.',
    },
    {
      id: 'manual.live-mode',
      status: 'manual',
      title: 'Switch to Live mode at the right time',
      detail: `For a consumer app, wait until the permissions you need are approved and business verification is done; in Live mode, permissions that are not approved stop working. Business apps have no app modes and use access levels instead. See ${APP_REVIEW_GUIDE}`,
    },
  ];
}
