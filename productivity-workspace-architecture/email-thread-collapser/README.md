# Email Thread Collapser v1.0.0

Long Gmail threads hide the reply under walls of quoted history. This
extension collapses every quoted-history block (`Show trimmed content`
sections) into a slim **"··· show quoted history"** button, so you read
only what's new. Click any button to expand just that thread's history.

- Runs only on pages **you** open in **mail.google.com**.
- Fully reversible — emails are never modified, only hidden on screen.
- Master toggle in the popup collapses/restores everything instantly.

## Install

**Chrome / Edge**
1. Unzip `email-thread-collapser.zip`.
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
3. **Load unpacked** → select the unzipped folder.

**Firefox** (temporary, for testing)
1. Unzip, open `about:debugging#/runtime/this-firefox`.
2. **Load Temporary Add-on** → pick `manifest.json` inside the folder.

## Permissions
- `storage` — remembers the on/off toggle. On-device only.
- Host access to `https://mail.google.com/*` — needed to find and hide
  quoted blocks in the Gmail page you are viewing. No email content is
  collected, stored, or sent anywhere.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee; justify the Gmail host
  permission as "collapses quoted content in the Gmail UI".
- Firefox: free account, add-on must be signed by Mozilla for release.
