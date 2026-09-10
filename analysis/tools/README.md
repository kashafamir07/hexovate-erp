# Figma .fig decoding & extraction tools

The exported `.fig` uses Figma's modern binary container (`fig-kiwi` magic, not the old ZIP-of-JSON).
These scripts decode it into the internal change-log message and rebuild the node tree.

## Setup

```bash
npm init -y && npm install kiwi-schema fzstd fflate base64-js
```

## Steps

1. `node decode.js canvas.fig message.json`
   → `message.json`: decoded document (message with 58k `nodeChanges` + schema-driven fields).
   GUID canonical form is `sessionID:localID`; parenting is `parentIndex.guid`
   (children ordered by the fractional-index string `parentIndex.position`).
   Text lives in `textData.characters`; fills in `fillPaints` (SOLID: `{r,g,b,a}` 0..1).

2. `node tree.js <depth>` → `tree.txt` — indented inventory (frames, sizes, text counts).
3. `node screens.js` → `screens.txt` — per-section artboard scan (best-effort caption pairing).
4. `node dump.js` → role dashboard text dumps + Design/component-library sheet content.
5. `node tokens.js` → variables (design tokens), fonts, symbol inventory, color histogram.

Known quirks of this design file: role sections use different screen container names
(`artboard`, `div#NN_*`, `sNN-desktop`, `canvas-row`), captions are `frame-label` TEXT nodes where
present; component instances (INSTANCE) hold no children in the kiwi tree — their content lives under
the SYMBOL definitions on the internal canvas.
