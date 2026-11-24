# We've noticed your app is missing a privacy policy URL or has a privacy policy URL that is returning an error

**Where you see it.** In an email or developer notification about an app that is already set up, often one that is live. Developers report getting it when Meta checks the Privacy Policy URL in the app settings and the check fails, sometimes with a reference to the Platform Terms section on privacy policies.

**What it means.** Meta tried to load the Privacy Policy URL from your app settings and got no usable page: the field is empty, or the request ended in an error, a timeout or a page that isn't your policy. The Platform Terms require a public privacy policy link in that field for as long as the app exists, so this is a compliance notice, not a reminder. Read the full notice for any deadline it gives and fix it before then.

## Fix

1. **The field is set and saved.** Open App settings > Basic in the App Dashboard and check Privacy Policy URL. It must be the full `https://` address of the policy, saved, not a draft.
2. **The URL answers `200` to a request that isn't signed in.** Run `curl -I` on it from a server, not your laptop. A redirect to a login page, a `401` or `403`, a `404` after a site migration, or a `5xx` from a sleeping host all count as an error.
3. **The certificate chain is complete.** Browsers often fill in a missing intermediate certificate; Meta's crawler may not. Test the domain with an SSL checker and install the full chain.
4. **Bot protection lets Meta in.** A CDN challenge page, an "under attack" mode, a firewall rule or a block by country can stop Meta's servers while the page works for you. Add an exception for the policy page and look for blocked requests in the logs.
5. **The page is hosted by you.** Meta doesn't accept a policy hosted on facebook.com. Put it on your own domain, as a page whose text is in the HTML, not rendered only by JavaScript.
6. **It stays up.** Meta can check the link again at any time. Watch the URL with an uptime monitor, and keep the old address working or redirecting to the new one when you move your site.

Then run `cleared doctor`. It reads the URL from your app settings, loads it the way a crawler would and links to this page when the URL is set but not HTTPS, behind a login or doesn't load. When you switch a new app to Live mode, the same problem shows up as [Invalid Privacy Policy URL](invalid-privacy-policy-url.md) instead.

The text of the policy is your responsibility. This notice is only about the link working; what the policy says is checked separately, for example in App Review.

## Source

- [Platform Terms](https://developers.facebook.com/terms/dfc_platform_terms/), Meta for Developers: the requirement to keep a public privacy policy link in the App Dashboard.
- [Privacy Policy Expectations](https://developers.facebook.com/docs/development/terms-and-policies/privacy-policy/), Meta for Developers: what Meta expects from the page and the link.
- [Platform Term 4.f (privacy policy) violation](https://developers.facebook.com/community/threads/725168536069837/), Meta Developer Community Forum: developers who got the notice, and the certificate chain fix.
- [Facebook privacy policy URL missing or returning an error](https://meta.discourse.org/t/facebook-privacy-policy-url-missing-or-returning-an-error/197265), Discourse Meta: the full message, and the note that policies on facebook.com aren't supported.
- [Facebook Platform Term or Policy 4.f](https://community.cloudflare.com/t/facebook-platform-term-or-policy-4-f/510704), Cloudflare Community: bot protection that blocked Meta's crawler from the policy page.
