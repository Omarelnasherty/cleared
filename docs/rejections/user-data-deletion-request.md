# User Data Deletion Request

**Where you see it.** As the subject of an email in your developer inbox, with the ID of the app and the user who asked for deletion.

**What it means.** A user of your app asked Meta to delete the data your app holds about them, and you are expected to delete it. It is a real notice from Meta, not spam, and Meta expects you to act on it promptly.

## Fix

1. **Delete the data now.** Remove everything you hold for the app-scoped user ID in the email, the same work your `onDelete` hook does. Don't wait for a second notice.
2. **Check the callback.** If you have one, look for this user ID in your logs. If the request never arrived, go through the checks on [Unable to confirm request was received](unable-to-confirm-request-was-received.md). The usual causes are a URL that isn't set, isn't public, or doesn't answer with `url` and `confirmation_code`.
3. **Look for other users.** If the callback has been broken for a while, other deletion requests may have been lost. In the App Dashboard, the advanced settings page has a card to download the user IDs of recent deletion requests. Delete the data for each one.
4. **Make the hook safe to repeat.** After the fix, Meta may call the callback again for users you already removed by hand. `onDelete` should succeed for a user who is already gone.

## Source

- [Data Deletion Request Callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback), Meta for Developers: the FAQ about this email and where to download the user IDs.
- [User data deletion requests](https://developers.facebook.com/blog/post/2024/11/15/user-data-deletion-requests/), Meta for Developers blog: why the email is sent and what it contains.
