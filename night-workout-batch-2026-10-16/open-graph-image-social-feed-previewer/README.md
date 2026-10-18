# Open Graph Social Feed Previewer

See how this page's link will look when shared — card previews for Facebook, X and LinkedIn plus Open Graph / Twitter Card tag health checks.

## How it works

1. Click **Analyze this page** in the popup.
2. A content script (injected on-demand only, via `chrome.scripting` + `activeTab`) reads the page's `og:*` and `twitter:*` meta tags, checks whether `og:image` loads, and measures its real dimensions.
3. The popup renders:
   - A **0–100 share-readiness score** with stat tiles
   - **Card previews** for Facebook, X and LinkedIn styles using the actual tag values
   - **Tag health issues** ranked High / Medium / Low with plain-language explanations and fix hints

The last scan is saved locally and restored when you reopen the popup.

## Checks performed

- Missing `og:title` / `og:description` (with meta-description fallback)
- Missing or broken `og:image`; small images (<600px wide); suboptimal aspect ratio
- Over-long titles (>95 chars) and descriptions (>200 chars) that platforms truncate
- Missing `og:type`, missing `twitter:card`, and X falling back to `og:image`

## Honest scope

- **Read-only:** the page is never modified; nothing is sent anywhere — 100% local.
- The previews are close approximations of each platform's card layout, not pixel-perfect copies of how the platforms will render (crawlers may also cache or normalize your tags).
- The score is a heuristic based on tag completeness, not a guarantee of social engagement.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Remember the last scan |
| `activeTab` + `scripting` | Inject the read-only scanner only when you click “Analyze” |

## Privacy

No accounts, no analytics, no network requests beyond loading the page's own `og:image` to verify it.
