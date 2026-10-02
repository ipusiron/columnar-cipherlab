# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Columnar CipherLab is a web-based educational tool for columnar transposition cipher encryption/decryption. Pure client-side application (no backend, no external CDN) hosted on GitHub Pages.

## Development Commands

```bash
# Run the tests (Node.js 22+, no dependencies)
npm test

# Serve locally. ES modules do not load from file://, so always use HTTP
python -m http.server 8000
# then open http://localhost:8000/
```

## Architecture

### JavaScript Modules (ES modules)
- `js/columnar-core.js`: DOM-free logic. `normalizeText`, `parseKeyword`, `parseNumericKey`, `parseColumnCount`, `parseKey`, `validatePadChar`, `encrypt`, `decrypt`, `columnHeights`, `stripTrailingPadding`, `markTrailingPadding`, `reorderGrid`. Errors are returned as `{ error: { key, params } }`, never as text
- `js/messages.js`: All UI strings produced by JavaScript (`t(key, params)`, `tr({ key, params })`). Scripts other than this file must not contain Japanese string literals (checked by `test/messages.test.js`)
- `js/encryption.js` / `js/decryption.js`: Tab UI. One `validate()` per tab is shared by the button state, the Enter key and the run button
- `js/utils.js`: DOM helpers (`el`, `renderGrid`, `showMessages`, `showToast`, `copyToClipboard`). Text is always inserted with `textContent`
- `js/presets.js`: Loads and validates `data/presets.json`, falls back to one built-in preset
- `js/main.js`: Entry point. Initializes each module separately; `window.debugLog` prints only with `?debug=1`
- `js/tabs.js`, `js/help.js`, `js/theme.js`: WAI-ARIA tabs, help dialog (focus trap), theme toggle
- `js/theme-init.js`, `js/file-check.js`: Classic scripts loaded before the modules (theme before first paint, notice when opened via file://)

### CSS Organization
- `css/base.css`: CSS variables for theming (dark default, light via `data-theme="light"`), inputs (16px), buttons (44px)
- `css/layout.css`: Header (centered title), tabs, cards, mobile spacing, reduced motion
- `css/components.css`, `css/cipher.css`, `css/modal.css`, `css/study.css`: UI components, matrix and highlight, help dialog, study tab

## Key Implementation Details

### Cipher Algorithm
- One grid cell = one Unicode code point after NFC normalization
- Encryption: write row-wise, read columns in key order. In complete mode the last row is padded with the pad character; padding cells are identified by position (`kind: 'pad'`), not by character
- Decryption: complete mode requires `length % n === 0` (otherwise error `dec.notMultiple`). Incomplete mode: the leftmost `length % n` columns are one row longer
- Padding removal strips at most `n - 1` trailing pad characters and reports the count. A plaintext ending with the pad character cannot be distinguished (warned at encryption time via `endsWithPad`)
- Keyword order is case-insensitive; equal letters are numbered left to right
- Numeric keys accept spaces, commas and 、. Without separators each digit is one column (up to 9 columns)

### Security Measures
- CSP meta without `'unsafe-inline'`; no inline scripts, `<style>` elements, `style` attributes or event handler attributes
- Input limited to 10,000 code points (truncation is shown to the user); keys limited to 64 columns
- `localStorage` (theme only) is wrapped in try/catch

### State Synchronization
Encryption results are stored in `window.encryptionState`; the decryption tab's sync button reads it via `window.updateSyncButtonState()`. When inputs change after a run, result sections get `is-stale` and a notice is shown.

## Testing

`npm test` runs `test/*.test.js` with `node --test`:
- `core.test.js`: known answers (Wikipedia ZEBRAS example, five presets), 1,200 round trips checked against an independent reference implementation
- `readme.test.js`: examples and tables in README.md and the study tab are recomputed with the core module; YAML front matter structure; directory tree lists every tracked file with a description; image references exist
- `html.test.js`, `contrast.test.js`, `format.test.js`, `messages.test.js`: static checks of index.html, color contrast (4.5:1 in both themes), file format, message keys

Do not change expected values to make a test pass; fix the implementation instead.
