# Group Project Task Allocation Matrix

A manual project task board for small teams — no accounts, no sync, nothing leaves your browser.

## What it does

- **Tasks tab** — add tasks with a name, assignee, hour estimate, and a "depends on" dependency. Mark done / reopen / delete.
- **Members tab** — add or remove team members. Removing a member unassigns their tasks (flagged, not lost).
- **Matrix tab**
  - **Allocation matrix** (who × task) showing exactly who owns what.
  - **Workload bars** — total estimated hours per member vs your overload threshold.
  - **Flags** — warns on unassigned tasks and on members over the threshold.
- **Overload threshold** — editable hours limit for the workload flags.

## Honest scope

**100% manual:** you enter every task, member, and estimate. The extension computes assignments and workload math from your entries — it never tracks activity, never contacts a server, and never syncs with anyone else. Estimates are just numbers you type.

## Install (developer mode)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension and click it to open the 380px popup.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Manifest V3, `storage` only |
| `popup.html` / `popup.css` / `popup.js` | UI and all logic |
| `icons/` | 16 / 48 / 128 px icons |
