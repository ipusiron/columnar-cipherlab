# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Columnar CipherLab is a web-based cryptographic tool for columnar transposition cipher encryption and decryption. It's a static HTML/CSS/JavaScript application that runs entirely in the browser.

## Architecture

- **Frontend Only**: Pure client-side application with no backend dependencies
- **Core Files**:
  - `index.html`: Main UI with tabbed interface (Encryption, Decryption, Double Transposition, Variants)
  - `script.js`: All cipher logic and UI interaction handlers
  - `style.css`: Dark theme styling with CSS variables

## Key Implementation Details

### Cipher Algorithm (script.js)
- **Encryption**: Text is written row-wise into a matrix, columns are rearranged by key order, then read column-wise
- **Decryption**: Inverse process considering column heights based on cipher text length
- **Key Types**: 
  - Keyword: Converted to numeric order using `localeCompare('ja')`, duplicates prioritize left position
  - Numeric: Direct sequence (e.g., "3 1 4 2"), validates for duplicates

### UI Components
- Tab system for different cipher modes
- Real-time grid visualization showing the transposition matrix
- Complete/Incomplete mode toggle (with/without padding)
- Input normalization options (space removal, uppercase conversion)

## Development Commands

This is a static website with no build process. To run locally:
```bash
# Open directly in browser
start index.html

# Or use any static server
python -m http.server 8000
```

## Testing Approach

Manual testing via the browser interface. Use the sample button in the encryption tab for a standard test case:
- Plaintext: "WE ARE DISCOVERED FLEE AT ONCE"
- Keyword: "ZEBRAS"
- Expected output with complete mode and padding 'X'

## Future Development Areas

Per README.md, planned features include:
- Double transposition (vertical→vertical, vertical→horizontal)
- Variant forms (diagonal, spiral readout)
- Clipboard integration and operation history