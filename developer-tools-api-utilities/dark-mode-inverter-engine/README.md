# Dark Mode Inverter Engine v1.0.0

One-click dark mode for any page. Uses smart CSS inversion
(`invert` + `hue-rotate`) and re-inverts images, video, and canvas
elements so media keeps its natural colors. Flip the switch to
remember a site — dark mode then applies automatically on every
visit (via a dynamically registered content script). Dim and
contrast sliders fine-tune the result per site.

## Try it
1. Unzip `dark-mode-inverter-engine.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select the folder.
3. Click the icon, flip the switch, adjust dim/contrast to taste.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json`.

## Permissions (all justified)
- `activeTab` + `scripting`: inject/remove the inversion stylesheet
  in the current tab on toggle.
- `storage`: per-site settings (dim/contrast) and the remembered
  site list, on-device only.
- Host access (`http/https`): register auto-apply content scripts
  only for sites you explicitly enable — nothing is injected
  anywhere else.

## Publishing notes
- Chrome Web Store: $5 one-time developer fee.
- No data ever leaves the device; no remote code.
