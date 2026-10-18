# CharMap — Character Relationship Visualizer v1.0.0

Build interactive character relationship maps for any story, series, or RPG campaign.

## Features
- **Canvas graph**: characters as nodes, relationships as color-coded edges with type labels
- **Interactions**: drag nodes, drag to pan, scroll to zoom, click a node for its connection details
- **6 relationship types**: Ally, Rival, Family, Romantic, Mentor, Neutral — each with its own color and legend
- **People tab**: add characters with name, series, and custom color
- **Links tab**: create typed, annotated relationships between any two characters
- **Multiple maps**: create/switch/delete named maps
- **Backup**: export the active map as JSON, import maps back (added as new maps)
- Ships with a sample Odyssey map so the graph is alive on first run

## Install
1. Unzip `character-relationship-visualizer-overlay.zip`
2. Open `chrome://extensions` (Edge: `edge://extensions`)
3. Enable **Developer mode**
4. **Load unpacked** → select the unzipped folder

## Permissions
- `storage` — persists your maps on-device. No other permission, no network access; everything works offline.

## Publishing notes
- MV3, no content scripts, no host permissions — safe for all stores
- Firefox: fully compatible
- Honest scope: works entirely on user-created data
