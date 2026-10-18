# Breakpoint Visualizer v1.0.0

Hit **Toggle overlay on this tab** and a small glass panel appears
on the page showing the live viewport **width × height** and which
of your breakpoints is active. Define your own breakpoints
(name + min-width in px) in the popup — the overlay updates live
as you edit, and you can park it in any corner.

The overlay is injected only when you toggle it, on the tab you're
viewing. Nothing is tracked or uploaded.

## Try it
1. Unzip `breakpoint-visualizer.zip`.
2. `chrome://extensions` → Developer mode → **Load unpacked** → select folder.
3. Open any regular website → click the icon → **Toggle overlay**.
   (Chrome blocks injection on `chrome://` pages and the web store.)

## Publishing notes
- Permissions: `activeTab` (inject the overlay into the tab you
  toggle it on), `scripting` (the injection itself), `storage`
  (your breakpoints + position, on-device).
- Chrome Web Store: $5 one-time dev fee. Edge and Firefox accounts
  are free; Firefox builds need signing via AMO.
