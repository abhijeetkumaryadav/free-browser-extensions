# LinkedIn Notion Lead Pusher v1.0.0

Lead capture cards that work from any page. Save leads with name,
headline, company, profile URL, notes, and tags — or hit the prefill
button to pull the page's title/meta into the form. Export all leads
as Notion-friendly Markdown (paste straight into Notion — headings
and bullets convert automatically) or download a CSV. Optionally
configure your own webhook URL to push the leads as JSON.

## Try it
1. Unzip `linkedin-notion-lead-pusher.zip`.
2. Chrome/Edge: `chrome://extensions` (or `edge://extensions`) → Developer mode → **Load unpacked** → select the folder.
   Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `manifest.json`.
3. Open any profile page, press ⤓ to prefill, adjust, **Save lead**.

## Permissions
- `activeTab` + `scripting` — only to read the current page's title/meta
  when YOU press the prefill button. Never runs in the background.
- `storage` — saves your leads and your webhook URL on-device.

## Webhook
Stored locally. A network request is made only when you press
**Push all leads as JSON**, and only to the URL you entered. No keys
or credentials are ever handled by this extension.

## Publishing notes
- Minimal justified permissions; store-friendly.
- Chrome Web Store: $5 one-time developer registration; Edge free; Firefox free (add-on must be signed).
