# Wayback Lens — Archive Version Checker

Click **Check Wayback Machine** to look up the current page in the Internet
Archive's Wayback Machine. Shows:

- The **closest snapshot** (date + status) with an **Open** button
- An estimated **total snapshot count** for the URL
- A **recent-snapshots timeline** (up to 20), each with its own Open link

All queries run only when you click the button, and only against the public
read-only Wayback Machine APIs (`archive.org/wayback/available` and the CDX
search API). Nothing is stored anywhere.

## Install (Chrome / Edge / Brave)

1. Unzip the release archive anywhere on your disk.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the unzipped folder.

## Firefox

Firefox supports MV3 and host permissions; load temporarily via
`about:debugging` → **This Firefox** → **Load Temporary Add-on** and select
`manifest.json`. Verify the CDX fetches succeed before shipping a signed build.

## Permissions

| Permission | Why it is needed |
|---|---|
| `activeTab` | Read the URL of the tab you click on, to look it up. |
| Host permissions for `web.archive.org` and `archive.org` | Required for the popup to fetch the public Wayback Machine availability and CDX APIs. Only these hosts are contacted, and only when you click the check button. |

## Publishing notes

- Chrome Web Store: single-purpose (archive lookup); justify the two archive.org
  hosts as the feature's only network dependency.
- The snapshot count is capped at 10,001 CDX rows and shown as "10,000+" for
  heavily archived URLs — document this in the store description.
- Include a privacy policy stating that the page URL is sent only to the
  Internet Archive, only on user request, and that nothing is collected.
