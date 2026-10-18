# Technology Stack Detector v1.0.0

Wappalyzer-lite for any page you visit: fingerprints script URLs,
meta tags, and DOM markers to detect JS libraries (jQuery, GSAP,
Three.js…), frameworks (React, Next.js, Vue, Angular…), analytics
trackers (GTM, Meta Pixel, Hotjar…), CMS platforms (WordPress,
Shopify, Webflow…), and CDN/infrastructure signals.

Results are grouped with **High / Medium / Low confidence chips** and
evidence notes, plus one-click report copy.

## Try it
1. Unzip `technology-stack-detector.zip`.
2. `chrome://extensions` (or `edge://extensions`) → Developer mode →
   **Load unpacked** → select the folder.
3. Visit any site → click the icon → **Analyze**.

## Permissions
- `activeTab` + `scripting`: read the tab you choose to analyze, only
  when you click Analyze. No background reading, no storage at all —
  the report lives only in the popup.

## Publishing notes
- Fully on-device; zero network calls, no data collection.
- Detection is fingerprint-based and best-effort — the popup says so.
- Chrome Web Store: $5 one-time dev fee. Firefox/Edge: MV3 compatible
  as-is.
