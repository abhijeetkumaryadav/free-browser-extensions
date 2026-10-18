# GitHub Talent Sourcer v1.0.0

On any **github.com/&lt;username&gt;** profile you're viewing, hit
**Extract this profile**: name, bio, location, company, follower
count, and pinned repositories (with languages and star counts) are
pulled into a candidate card. Add interview **notes** and **tags**,
save to a persistent **shortlist**, and export everything to **CSV**
for your ATS or spreadsheet.

Works on the profile page you're already viewing — it never logs
into anything and never leaves your device.

## Try it
1. Unzip `github-talent-sourcer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open any GitHub profile (e.g. `github.com/torvalds`) → click the icon → **Extract this profile**.

## Permissions
- `activeTab` + `scripting` — read the public GitHub profile tab you
  are viewing, only when you click Extract.
- `storage` — shortlist, notes, and tags saved on-device. Nothing uploaded.

## Publishing notes
- Chrome Web Store: $5 one-time developer registration.
- Privacy tab: no data collected, all processing on-device.
- GitHub occasionally redesigns profile markup; the extractor uses
  fallback selectors and degrades gracefully.
