# BlurBuddy

**Kid-comfort image blur** — blur exactly the images you choose, nothing else.

## What it does

- **Click-to-blur mode** — flip the toggle, then click any image on the page to blur it.
  Clicks are intercepted so links aren't followed while the mode is on.
- **Blur all images** — one click blurs every visible image on the page
  (tiny icons, hidden images, and tracking pixels are skipped).
- **Click to reveal** — click any blurred image to unblur it instantly.
- **Blur strength slider** — 4px to 24px, applies live to already-blurred images.
- Settings persist locally and are pushed to the page when the popup opens.

## Honest scope

BlurBuddy **does not detect scary, inappropriate, or sensitive images** — no image-content
analysis of any kind happens. It blurs only what you explicitly choose. This is a comfort
tool controlled entirely by the user.

## Privacy

100% local. No network requests, no analytics, no data leaves your device. Only your
toggle/slider preferences are stored in `chrome.storage.local`.

## Permissions

- `activeTab` — modify images on the page you explicitly open the popup for.
- `scripting` — inject the blur controller into that tab.
- `storage` — remember your blur-strength and toggle preferences.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open any http/https page and click the toolbar icon.

## Publishing notes

- Manifest V3, no remote code, no data collection — store-friendly.
