# Webinar Attendee Grabber v1.0.0

On any webinar or event page you're viewing, click **Extract attendees from
this page** to pull the visible participant names into a clean,
deduplicated, numbered list. Copy them all to the clipboard or download a
CSV for your follow-up workflow.

Best-effort by design: it reads only the names already visible to you on
the current tab (participant panels, roster lists, video-tile labels).
Open the participants panel first for the best results.

## Try it
1. Unzip `webinar-attendee-grabber.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Open a webinar page, open its participants panel, click the toolbar icon, then **Extract**.

## Publishing notes
- Permissions: `activeTab` + `scripting` — read the visible page only when
  you click Extract. No storage, no network calls, nothing uploaded.
- Chrome Web Store: $5 one-time developer registration.
- Edge Add-ons: free. Firefox: free, requires signing.
