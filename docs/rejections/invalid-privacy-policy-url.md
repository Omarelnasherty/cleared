# Invalid Privacy Policy URL

**Where you see it.** In the App Dashboard, when you switch your app from Development to Live mode. The dialog goes on with `You must provide a valid Privacy Policy URL in order take your app Live.` and points you to the app settings.

**What it means.** The Privacy Policy URL field is empty, or Meta tried to load the URL and didn't get a working public page. Meta wants a page that anyone, including its crawler, can open without signing in, from any country, and that is clearly your privacy policy. Until it gets one, the app stays in Development mode and only people with a role on the app can use it.

## Fix

1. **The field is set.** Open App settings > Basic in the App Dashboard, fill in Privacy Policy URL with the full `https://` address, and save before you try the switch again.
2. **The page loads in a private window.** Open the URL signed out, on another network if you can. It must answer `200`, not a redirect to a sign-in page, a `401` or `403`, or a `404` on a path that moved.
3. **The certificate is complete.** A page that works in your browser can still fail for Meta if the server doesn't send the intermediate certificates. Check the chain with an SSL test tool and install the full chain.
4. **Nothing blocks the crawler.** Bot protection, a firewall rule, a CDN challenge page or blocking by country can stop Meta's servers while people get through. Allow its requests in your firewall or CDN, and check the logs for blocked requests to the page.
5. **The policy is in the HTML.** If the page is rendered only by JavaScript, the crawler may see an empty shell. Serve the policy text in the page itself, or as a static page.
6. **The page is yours and says what it is.** Host it on your own domain, not on a Facebook page. Title it as a privacy policy for your app or company, not someone else's policy or a generic template page.

Then run `cleared doctor`. It reads the URL from your app settings, loads it the way a crawler would and links to this page when the URL is missing or doesn't load.

The text of the policy is your responsibility. The page only has to be reachable for this message to go away; App Review then reads what it says.

## Source

- [Privacy Policy Expectations](https://developers.facebook.com/docs/development/terms-and-policies/privacy-policy/), Meta for Developers: what Meta expects from the page and the link.
- [You must provide a valid Privacy Policy URL](https://developers.facebook.com/community/threads/1162902358313881/), Meta Developer Community Forum: developers who saw the message when going live.
- [Invalid Privacy Policy URL](https://github.com/specious/facebook-cli/issues/23), GitHub: the full message, after switching the app to Live.
