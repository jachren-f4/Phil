# Phil Codebase Structure - Key Files for LLM Integration

## Overview
Phil is a client-side JavaScript crossword maker that runs entirely in the browser. No server-side code needed.

## Key Files

### HTML/CSS
- **index.html** - Main UI structure
  - Header: Puzzle title and author
  - Toolbar: Buttons for new, open, export, generate pattern, auto-fill
  - Main: Grid display area
  - Sidebar: Across/down clues and word suggestions
  - Uses Font Awesome icons

- **style.css** - All styling

### Core JavaScript Files (loaded in order)

1. **patterns.js** - Grid pattern generation
   - Pre-defined black square patterns
   - Used by "Generate pattern" button

2. **cross.js** - Main crossword logic (PRIMARY FILE TO MODIFY)
   - Classes:
     - `Crossword(rows, cols)` - Data model for puzzle
       - Properties: title, author, rows, cols, fill[], clues{}
     - `Grid(rows, cols)` - DOM management for grid
   - Constants:
     - DEFAULT_SIZE = 15
     - BLACK = "."
     - BLANK = " "
   - Global variables:
     - `grid` - Current Grid instance
     - `xw` - Current Crossword instance
     - `isSymmetrical` - Symmetry toggle
   - Key functions we'll need to understand:
     - Grid manipulation
     - Fill management
     - Clue handling

3. **wordlist.js** - Dictionary management
   - Loads and manages word lists
   - Word matching logic
   - This is where we'll integrate LLM-generated words

4. **files.js** - Import/export functionality
   - Read/write .xw (JSON format)
   - Read/write .puz (Across Lite format)
   - PDF generation
   - Keep this as-is, it already works

### Supporting Files

- **WL-MirriamWebster9thCollegiate.txt** - Default dictionary (~1.2MB)
- **WL-SP.txt** - Alternative dictionary (~1.4MB)
- **xw_worker.js** - Web worker for auto-fill
- **third_party/** - External dependencies (jsPDF, Font Awesome, Glucose solver)

## Architecture for LLM Integration

### Where to Add Our Code

Create new directory structure:
```
Phil/
├── js/
│   └── llm/
│       ├── llm-service.js      (OpenAI API wrapper)
│       ├── theme-analyzer.js   (Theme → semantic expansion)
│       ├── word-generator.js   (Theme → word list)
│       └── clue-generator.js   (Words → clues)
└── config.json                 (API keys, settings)
```

### Files to Modify

1. **index.html**
   - Add theme input UI above toolbar
   - Add "Generate with AI" button
   - Add loading indicators
   - Load our new JS files

2. **cross.js** (minimal changes)
   - Hook into existing auto-fill function
   - Add theme property to Crossword class
   - Integrate LLM word priority into fill logic

3. **wordlist.js** (minimal changes)
   - Merge LLM-generated words with existing dictionary
   - Add word scoring for theme relevance

### Integration Points

**Word Generation Flow:**
```
User enters theme → theme-analyzer.js → OpenAI API
                                          ↓
                                    Word list (100-150)
                                          ↓
                                    word-generator.js
                                          ↓
                                    Merge with wordlist.js
                                          ↓
                                    cross.js auto-fill
```

**Clue Generation Flow:**
```
Filled grid → Extract all words → clue-generator.js → OpenAI API
                                                           ↓
                                                      Clues (batch)
                                                           ↓
                                                      xw.clues{}
```

## Existing Features We Can Leverage

✅ Grid generation (patterns.js)
✅ Auto-fill algorithm (cross.js + xw_worker.js)
✅ Word validation (wordlist.js)
✅ Clue storage (cross.js - xw.clues object)
✅ Export formats (files.js)
✅ Symmetry enforcement (cross.js)

## What We Need to Build

🔨 Theme input UI
🔨 LLM service layer
🔨 Theme-based word generation
🔨 Automatic clue generation
🔨 Loading states and progress indicators
🔨 Error handling for API failures
🔨 Simple caching for API responses

## Current State

✅ Phil running on localhost:8000
✅ Repository cloned and explored
✅ Key files identified
✅ Integration strategy defined

## Next Steps (Day 2)

1. Create js/llm/ directory structure
2. Get OpenAI API key
3. Create config.json
4. Implement llm-service.js base class
5. Test API connection

## Notes

- Phil uses vanilla JavaScript (no frameworks)
- All code is client-side
- No build process required
- Web workers used for auto-fill performance
- Grid data stored in 2D array (xw.fill[row][col])
- Clues stored as object: xw.clues[direction][number] = "clue text"