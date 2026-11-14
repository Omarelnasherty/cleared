# Rejection pages

When Meta tells you something is wrong with your app, the message is often short and doesn't say what to change. Each page here is titled with the exact message, says where you see it, and gives the fix.

A message gets a page only when its wording appears in Meta's documentation or in a public report from a developer who saw it. Each page links to that source. If you got a message that isn't listed, send the exact text and where it appeared to [contact@omarelnasherty.com](mailto:contact@omarelnasherty.com).

## Data deletion callback

| Message                                                                             | Where you see it                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [Unable to confirm request was received](unable-to-confirm-request-was-received.md) | A user's Facebook settings, after they ask your app to delete their data |
| [User Data Deletion Request](user-data-deletion-request.md)                         | An email in your developer inbox                                         |

## Deauthorize callback

Meta doesn't report failed deauthorize calls: it sends the request once and doesn't show an error to you or the user. If your hook never runs, check the URL in the Facebook Login settings and test it with a signed request as described in the [callbacks guide](../callbacks.md#test-it).

## Format

Every page has the same parts:

1. The title is the message, copied exactly.
2. **Where you see it** and **What it means**, in a few lines.
3. **Fix**, as a list of things to check, most common first.
4. **Source**, links to the official page or the public report the wording comes from.
