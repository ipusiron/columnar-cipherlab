# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Columnar CipherLab is a web-based educational tool for columnar transposition cipher encryption/decryption. Pure client-side application (no backend) hosted on GitHub Pages.

## Development Commands

```bash
# Open in browser (Windows)
start index.html

# Or use a static server
python -m http.server 8000
```

## Architecture

### JavaScript Modules (ES6)
- `js/main.js`: Entry point, initializes all modules on DOMContentLoaded
- `js/encryption.js`: Encryption tab logic, maintains `window.encryptionState` for sync with decryption
- `js/decryption.js`: Decryption tab logic, uses `decryptColumnar()` for inverse algorithm
- `js/utils.js`: Core cipher functions (`keywordOrder`, `numericOrder`, `buildGridByRows`, `renderGrid`)
- `js/presets.js`: Loads sample presets from `data/presets.json`
- `js/tabs.js`, `js/theme.js`, `js/help.js`: UI components

### CSS Organization
- `css/base.css`: CSS variables for theming (dark/light via `data-theme` attribute)
- `css/cipher.css`: Encryption/decryption grid and result styles
- `css/components.css`, `css/layout.css`, `css/modal.css`, `css/study.css`: UI components

### Data-Driven Presets
Sample presets are defined in `data/presets.json`. Add new presets by editing this file without code changes.

## Key Implementation Details

### Cipher Algorithm
- **Encryption** (`js/encryption.js`): Text written row-wise into matrix → columns rearranged by key order → read column-wise
- **Decryption** (`js/decryption.js`): Calculates column heights from cipher length, distributes characters by key order, reads row-wise
- **Key Processing** (`js/utils.js`):
  - `keywordOrder()`: Uses `localeCompare('ja')`, left position wins for duplicates
  - `numericOrder()`: Validates 1-n consecutive integers without duplicates

### Security Measures
- XSS prevention: `escapeHtml()` in `js/utils.js` for all user content rendering
- DoS prevention: Input length limited to 10,000 characters in `normalizeInput()`

### State Synchronization
Encryption results stored in `window.encryptionState`, accessed by decryption tab's sync button via `window.updateSyncButtonState()`.

## Testing

Manual testing via browser. Standard test case (サンプル②):
- Plaintext: "WE ARE DISCOVERED FLEE AT ONCE"
- Keyword: "ZEBRAS"
- Mode: Complete with padding 'X'