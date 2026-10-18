# Page Tint — Sepia & Night Inverter

User-triggered page tint for the active tab.

**What it does**
- Pick **Sepia**, **Night**, or **Invert** to tint the current tab; adjust
  **strength** (20–100%).
- Sepia/night use a blend-mode overlay; invert uses a document filter.
  Everything is applied to the page surface — no content is modified.
- **Turn off** removes every element and style the extension added. The page
  is left completely untouched.

**Honest scope**
- Reversible, user-triggered, current-tab-only. It does not work on browser
  internal pages (`chrome://`, Chrome Web Store, etc. — the browser forbids
  injection there). It is a visual comfort tool, not a real dark-mode
  re-theme: some pages may look odd.

**Permissions**
- `activeTab` + `scripting` — apply/remove the tint on the tab you clicked from.
- `storage` — remember your mode/strength/on-off state only.

No network calls. Everything stays on your device.
