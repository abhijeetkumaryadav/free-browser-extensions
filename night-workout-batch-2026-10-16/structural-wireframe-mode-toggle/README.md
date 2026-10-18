# Structural Wireframe Mode Toggle

A developer tool: one click outlines every visible element on the current
page with cyan boxes, plus floating labels showing each element's tag name
and dimensions.

## How it works

1. Click the extension icon and flip the **Wireframe this tab** switch.
2. One `<style>` node is injected (outlines) and up to 140 floating label
   badges are drawn for the largest visible elements.
3. Toggle the switch off: the stylesheet and every badge are removed, and the
   page is restored exactly as it was.

Options: tag-name labels and dimension (`w×h`) labels can be toggled
independently; preferences persist in `chrome.storage.local`.

## Honest scope

- Read-only dev analysis — the page DOM is never modified; only one temporary
  stylesheet and floating badges are added, both fully removed on toggle-off.
- Label count is capped at 140 elements for performance.
- 100% local, zero network.
- Permissions: `activeTab` + `scripting` (inject on explicit click), `storage`
  (label preferences).
