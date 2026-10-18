# GraphMind — Personal Knowledge Graph Visualizer

Build your own knowledge graphs: create concept nodes, link them with typed
edges, and explore the result on an interactive canvas with pan, zoom, and
drag. Everything stays on your device — no accounts, no servers.

## Features

- **Named graphs** — create and switch between multiple graphs.
- **Nodes** — label, color, and free-text notes per concept.
- **Typed edges** — relates to, is a, part of, depends on, causes, opposite of,
  example of. Shown as labeled arrows on the canvas.
- **Interactive canvas** — drag nodes, drag the background to pan, scroll to
  zoom, click a node to see its details and all connections (click a neighbor
  to jump to it).
- **JSON export / import** — back up or share graphs as plain JSON files.

## Install

1. Unzip `personal-knowledge-graph-visualizer.zip`.
2. Open `chrome://extensions` (Edge: `edge://extensions`), enable
   **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Click the toolbar icon to open GraphMind.

Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
select `manifest.json`. (Temporary installs are removed on browser restart.)

## Permissions

- `storage` — persists your graphs on-device. Nothing is sent anywhere.

## Publishing notes

- Manifest V3, no host permissions, no remote code, no network calls.
- Icons are generated PNGs (16/48/128).
- Privacy policy summary: the extension collects no data.
