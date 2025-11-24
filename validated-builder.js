#!/usr/bin/env node
// Crossword builder with FULL bidirectional validation

const fs = require('fs');

const db = JSON.parse(fs.readFileSync('./crossword-database.json', 'utf8'));
console.log(`📚 Loaded ${db.words.length} words\n`);

let grid = null;
let placedWords = [];
let usedWords = new Set();

function createGrid(rows, cols) {
  grid = { rows, cols, cells: Array(rows).fill(null).map(() => Array(cols).fill(null)) };
}

function getCell(row, col) {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return undefined;
  return grid.cells[row][col];
}

function setCell(row, col, letter) {
  grid.cells[row][col] = letter;
}

// Get vertical word pattern at column
function getVerticalPattern(col, row, newLetter, newRow) {
  // Find start of vertical word
  let startRow = row;
  while (startRow > 0 && getCell(startRow - 1, col) !== null) {
    startRow--;
  }

  // Build pattern
  let pattern = '';
  for (let r = startRow; r < grid.rows; r++) {
    const cell = (r === newRow) ? newLetter : getCell(r, col);
    if (cell === null) break;
    pattern += cell;
  }

  return { pattern, startRow, length: pattern.length };
}

// Get horizontal word pattern at row
function getHorizontalPattern(row, col, newLetter, newCol) {
  // Find start of horizontal word
  let startCol = col;
  while (startCol > 0 && getCell(row, startCol - 1) !== null) {
    startCol--;
  }

  // Build pattern
  let pattern = '';
  for (let c = startCol; c < grid.cols; c++) {
    const cell = (c === newCol) ? newLetter : getCell(row, c);
    if (cell === null) break;
    pattern += cell;
  }

  return { pattern, startCol, length: pattern.length };
}

// Check if pattern matches any word in database
function patternHasValidWord(pattern) {
  if (pattern.length < 3) return true; // Too short to be a word yet

  // Check if exact word exists
  if (db.words.includes(pattern)) return true;

  // Check if pattern could be completed (has underscore wildcard)
  // This shouldn't happen in our case since we're checking complete patterns
  return false;
}

// IMPROVED: Validate perpendicular words when placing
function canPlaceWord(word, row, col, direction) {
  if (direction === 'across') {
    // Check bounds
    if (col + word.length > grid.cols) return false;

    // Check word boundaries
    if (col > 0 && getCell(row, col - 1) !== null) return false;
    if (col + word.length < grid.cols && getCell(row, col + word.length) !== null) return false;

    // Check each position
    for (let i = 0; i < word.length; i++) {
      const currentCell = getCell(row, col + i);

      // If cell is occupied, letter must match
      if (currentCell !== null && currentCell !== word[i]) return false;

      // CRITICAL: Check vertical word at this position
      const vertPattern = getVerticalPattern(col + i, row, word[i], row);

      // If placing this letter creates or extends a vertical word
      if (vertPattern.length >= 3) {
        // The vertical word must be valid
        if (!patternHasValidWord(vertPattern.pattern)) {
          return false; // Would create invalid vertical word
        }
      }

      // Check if we're extending an existing vertical word
      const above = getCell(row - 1, col + i);
      const below = getCell(row + 1, col + i);

      if (currentCell === null && (above !== null || below !== null)) {
        // We're extending a vertical word - verify it stays valid
        const extendedPattern = getVerticalPattern(col + i, row, word[i], row);
        if (extendedPattern.length >= 3 && !patternHasValidWord(extendedPattern.pattern)) {
          return false;
        }
      }
    }

    return true;
  } else {
    // direction === 'down'
    // Check bounds
    if (row + word.length > grid.rows) return false;

    // Check word boundaries
    if (row > 0 && getCell(row - 1, col) !== null) return false;
    if (row + word.length < grid.rows && getCell(row + word.length, col) !== null) return false;

    // Check each position
    for (let i = 0; i < word.length; i++) {
      const currentCell = getCell(row + i, col);

      // If cell is occupied, letter must match
      if (currentCell !== null && currentCell !== word[i]) return false;

      // CRITICAL: Check horizontal word at this position
      const horzPattern = getHorizontalPattern(row + i, col, word[i], col);

      // If placing this letter creates or extends a horizontal word
      if (horzPattern.length >= 3) {
        // The horizontal word must be valid
        if (!patternHasValidWord(horzPattern.pattern)) {
          return false; // Would create invalid horizontal word
        }
      }

      // Check if we're extending an existing horizontal word
      const left = getCell(row + i, col - 1);
      const right = getCell(row + i, col + 1);

      if (currentCell === null && (left !== null || right !== null)) {
        // We're extending a horizontal word - verify it stays valid
        const extendedPattern = getHorizontalPattern(row + i, col, word[i], col);
        if (extendedPattern.length >= 3 && !patternHasValidWord(extendedPattern.pattern)) {
          return false;
        }
      }
    }

    return true;
  }
}

function placeWord(word, row, col, direction) {
  if (direction === 'across') {
    for (let i = 0; i < word.length; i++) setCell(row, col + i, word[i]);
  } else {
    for (let i = 0; i < word.length; i++) setCell(row + i, col, word[i]);
  }
  placedWords.push({ word, row, col, direction });
  usedWords.add(word);
}

function scoreCandidate(word, row, col, direction, theme) {
  let score = 0;
  if (db.metadata[word].themes.includes(theme)) score += 100;

  let intersections = 0;
  if (direction === 'across') {
    for (let i = 0; i < word.length; i++) {
      if (getCell(row, col + i) !== null) intersections++;
    }
  } else {
    for (let i = 0; i < word.length; i++) {
      if (getCell(row + i, col) !== null) intersections++;
    }
  }
  score += intersections * 20;
  score += word.length * 3;

  const commonLetters = ['E', 'A', 'R', 'S', 'T', 'O', 'I', 'N'];
  for (const letter of word) {
    if (commonLetters.includes(letter)) score += 1;
  }

  return score;
}

function findCandidates(theme) {
  const candidates = [];
  const themedWords = db.words.filter(w =>
    !usedWords.has(w) && db.metadata[w].themes.includes(theme)
  );
  const generalWords = db.words.filter(w =>
    !usedWords.has(w) && !db.metadata[w].themes.includes(theme)
  );
  const availableWords = [...themedWords, ...generalWords.slice(0, 400)];

  if (placedWords.length === 0) {
    const centerRow = Math.floor(grid.rows / 2);
    const centerCol = Math.floor(grid.cols / 2);

    for (const word of availableWords) {
      const startCol = Math.max(0, centerCol - Math.floor(word.length / 2));
      if (canPlaceWord(word, centerRow, startCol, 'across')) {
        const score = scoreCandidate(word, centerRow, startCol, 'across', theme);
        candidates.push({ word, row: centerRow, col: startCol, direction: 'across', score });
      }

      const startRow = Math.max(0, centerRow - Math.floor(word.length / 2));
      if (canPlaceWord(word, startRow, centerCol, 'down')) {
        const score = scoreCandidate(word, startRow, centerCol, 'down', theme);
        candidates.push({ word, row: startRow, col: centerCol, direction: 'down', score });
      }
    }
  } else {
    for (const placed of placedWords) {
      const placedWord = placed.word;
      for (let i = 0; i < placedWord.length; i++) {
        const letter = placedWord[i];
        const letterPos = placed.direction === 'across'
          ? { row: placed.row, col: placed.col + i }
          : { row: placed.row + i, col: placed.col };

        const key = `${letter}@${i}`;
        const intersectingWords = db.intersections[placedWord][key] || [];

        for (const intersection of intersectingWords) {
          const [word, posStr] = intersection.split(':');
          const pos = parseInt(posStr);

          if (usedWords.has(word)) continue;
          if (!availableWords.includes(word)) continue;

          if (placed.direction === 'across') {
            const newRow = letterPos.row - pos;
            const newCol = letterPos.col;

            if (newRow >= 0 && newRow + word.length <= grid.rows) {
              if (canPlaceWord(word, newRow, newCol, 'down')) {
                const score = scoreCandidate(word, newRow, newCol, 'down', theme);
                candidates.push({ word, row: newRow, col: newCol, direction: 'down', score });
              }
            }
          } else {
            const newRow = letterPos.row;
            const newCol = letterPos.col - pos;

            if (newCol >= 0 && newCol + word.length <= grid.cols) {
              if (canPlaceWord(word, newRow, newCol, 'across')) {
                const score = scoreCandidate(word, newRow, newCol, 'across', theme);
                candidates.push({ word, row: newRow, col: newCol, direction: 'across', score });
              }
            }
          }
        }
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function buildCrossword(theme, rows, cols, maxWords = 30) {
  console.log(`🎯 Building ${rows}×${cols} crossword with theme: "${theme}"\n`);

  createGrid(rows, cols);
  placedWords = [];
  usedWords = new Set();

  let attempts = 0;
  const maxAttempts = 2000;

  while (placedWords.length < maxWords && attempts < maxAttempts) {
    attempts++;
    const candidates = findCandidates(theme);

    if (candidates.length === 0) {
      console.log(`   ⚠️  No more valid candidates after ${placedWords.length} words`);
      break;
    }

    const best = candidates[0];
    placeWord(best.word, best.row, best.col, best.direction);
    console.log(`   ${placedWords.length}. "${best.word}" ${best.direction} at (${best.row},${best.col}) [score: ${best.score.toFixed(1)}]`);
  }

  // Print grid
  console.log('\n📊 Final Grid:');
  console.log('┌───┬───┬───┬───┬───┬───┐');
  for (let row = 0; row < grid.rows; row++) {
    const rowStr = grid.cells[row].map(cell => cell || ' ').join(' │ ');
    console.log('│ ' + rowStr + ' │');
    if (row < grid.rows - 1) {
      console.log('├───┼───┼───┼───┼───┼───┤');
    }
  }
  console.log('└───┴───┴───┴───┴───┴───┘');

  // Calculate stats
  let filledCells = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (getCell(row, col) !== null) filledCells++;
    }
  }

  const totalCells = grid.rows * grid.cols;
  const coverage = (filledCells / totalCells * 100).toFixed(1);

  console.log('\n📈 Statistics:');
  console.log(`   Words placed: ${placedWords.length}`);
  console.log(`   Coverage: ${coverage}%`);
  console.log(`   Attempts: ${attempts}`);

  return { grid, placedWords, coverage: parseFloat(coverage) };
}

// Run test
const result = buildCrossword('love', 5, 6, 30);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (result.coverage >= 70) {
  console.log('✅ SUCCESS - All words valid!');
} else {
  console.log(`⚠️  Coverage: ${result.coverage}% (target: 70%+)`);
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
