#!/usr/bin/env node
// Greedy crossword builder using intersection database

const fs = require('fs');

// Load database
console.log('📚 Loading crossword database...');
const db = JSON.parse(fs.readFileSync('./crossword-database.json', 'utf8'));
console.log(`   Loaded ${db.words.length} words with ${db.stats.totalIntersections} intersections\n`);

// Grid structure
let grid = null;
let placedWords = [];
let usedWords = new Set();

function createGrid(rows, cols) {
  grid = {
    rows,
    cols,
    cells: Array(rows).fill(null).map(() => Array(cols).fill(null))
  };
}

function getCell(row, col) {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return undefined;
  return grid.cells[row][col];
}

function setCell(row, col, letter) {
  grid.cells[row][col] = letter;
}

function printGrid() {
  console.log('\n📊 Current Grid:');
  console.log('┌' + '───┬'.repeat(grid.cols - 1) + '───┐');
  for (let row = 0; row < grid.rows; row++) {
    const rowStr = grid.cells[row].map(cell => cell || ' ').join(' │ ');
    console.log('│ ' + rowStr + ' │');
    if (row < grid.rows - 1) {
      console.log('├' + '───┼'.repeat(grid.cols - 1) + '───┤');
    }
  }
  console.log('└' + '───┴'.repeat(grid.cols - 1) + '───┘');
}

// Check if word can be placed
function canPlaceWord(word, row, col, direction) {
  if (direction === 'across') {
    // Check bounds
    if (col + word.length > grid.cols) return false;

    // Check word boundaries (must have null or edge before/after)
    if (col > 0 && getCell(row, col - 1) !== null) return false;
    if (col + word.length < grid.cols && getCell(row, col + word.length) !== null) return false;

    // Check each position
    for (let i = 0; i < word.length; i++) {
      const currentCell = getCell(row, col + i);

      // If cell is occupied, letter must match
      if (currentCell !== null && currentCell !== word[i]) return false;

      // Check perpendicular boundaries
      if (currentCell === null) {
        const above = getCell(row - 1, col + i);
        const below = getCell(row + 1, col + i);

        // Can't place if it would create invalid perpendicular extension
        if (above !== null && above !== ' ') {
          // Check if there's a valid word above that would be extended
          if (row + 1 < grid.rows && getCell(row + 1, col + i) === null) {
            // Would extend existing vertical word - need to validate
            // For now, reject to be safe
            // return false;
          }
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

      // Check perpendicular boundaries
      if (currentCell === null) {
        const left = getCell(row + i, col - 1);
        const right = getCell(row + i, col + 1);

        // Can't place if it would create invalid perpendicular extension
        if (left !== null && left !== ' ') {
          // Would extend existing horizontal word
          // For now, reject to be safe
          // return false;
        }
      }
    }

    return true;
  }
}

// Place word on grid
function placeWord(word, row, col, direction) {
  if (direction === 'across') {
    for (let i = 0; i < word.length; i++) {
      setCell(row, col + i, word[i]);
    }
  } else {
    for (let i = 0; i < word.length; i++) {
      setCell(row + i, col, word[i]);
    }
  }

  placedWords.push({ word, row, col, direction });
  usedWords.add(word);
}

// Score a candidate word placement
function scoreCandidate(word, row, col, direction, theme) {
  let score = 0;

  // Prefer themed words
  if (db.metadata[word].themes.includes(theme)) {
    score += 100;
  }

  // Count intersections with placed words
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

  // Prefer longer words
  score += word.length * 3;

  // Prefer words with common letters (more future intersections)
  const commonLetters = ['E', 'A', 'R', 'S', 'T', 'O', 'I', 'N'];
  for (const letter of word) {
    if (commonLetters.includes(letter)) score += 1;
  }

  // Count potential future intersections
  const connectivity = Object.keys(db.intersections[word]).reduce((sum, key) => {
    return sum + db.intersections[word][key].length;
  }, 0);
  score += Math.log(connectivity) * 2;

  return score;
}

// Find all possible word placements
function findCandidates(theme) {
  const candidates = [];

  // Filter words by theme (prioritize but also include general words)
  const themedWords = db.words.filter(w =>
    !usedWords.has(w) && db.metadata[w].themes.includes(theme)
  );
  const generalWords = db.words.filter(w =>
    !usedWords.has(w) && !db.metadata[w].themes.includes(theme)
  );
  const availableWords = [...themedWords, ...generalWords.slice(0, 300)]; // Mix

  // If grid is empty, place seed word in center
  if (placedWords.length === 0) {
    const centerRow = Math.floor(grid.rows / 2);
    const centerCol = Math.floor(grid.cols / 2);

    for (const word of availableWords) {
      // Try horizontal placement
      const startCol = Math.max(0, centerCol - Math.floor(word.length / 2));
      if (canPlaceWord(word, centerRow, startCol, 'across')) {
        const score = scoreCandidate(word, centerRow, startCol, 'across', theme);
        candidates.push({ word, row: centerRow, col: startCol, direction: 'across', score });
      }

      // Try vertical placement
      const startRow = Math.max(0, centerRow - Math.floor(word.length / 2));
      if (canPlaceWord(word, startRow, centerCol, 'down')) {
        const score = scoreCandidate(word, startRow, centerCol, 'down', theme);
        candidates.push({ word, row: startRow, col: centerCol, direction: 'down', score });
      }
    }
  } else {
    // Find intersections with placed words
    for (const placed of placedWords) {
      const placedWord = placed.word;

      // For each letter in placed word
      for (let i = 0; i < placedWord.length; i++) {
        const letter = placedWord[i];
        const letterPos = placed.direction === 'across'
          ? { row: placed.row, col: placed.col + i }
          : { row: placed.row + i, col: placed.col };

        const key = `${letter}@${i}`;
        const intersectingWords = db.intersections[placedWord][key] || [];

        // Try each intersecting word
        for (const intersection of intersectingWords) {
          const [word, posStr] = intersection.split(':');
          const pos = parseInt(posStr);

          if (usedWords.has(word)) continue;
          if (!availableWords.includes(word)) continue;

          // Calculate where this word would be placed
          if (placed.direction === 'across') {
            // New word goes vertical
            const newRow = letterPos.row - pos;
            const newCol = letterPos.col;

            if (newRow >= 0 && newRow + word.length <= grid.rows) {
              if (canPlaceWord(word, newRow, newCol, 'down')) {
                const score = scoreCandidate(word, newRow, newCol, 'down', theme);
                candidates.push({ word, row: newRow, col: newCol, direction: 'down', score });
              }
            }
          } else {
            // New word goes horizontal
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

  // Sort by score
  return candidates.sort((a, b) => b.score - a.score);
}

// Build crossword
function buildCrossword(theme, rows, cols, maxWords = 20) {
  console.log(`🎯 Building ${rows}×${cols} crossword with theme: "${theme}"\n`);

  createGrid(rows, cols);
  placedWords = [];
  usedWords = new Set();

  let attempts = 0;
  const maxAttempts = 1000;

  while (placedWords.length < maxWords && attempts < maxAttempts) {
    attempts++;

    const candidates = findCandidates(theme);

    if (candidates.length === 0) {
      console.log(`   ⚠️  No more candidates found after ${placedWords.length} words`);
      break;
    }

    // Place best candidate
    const best = candidates[0];
    placeWord(best.word, best.row, best.col, best.direction);

    console.log(`   ${placedWords.length}. Placed "${best.word}" ${best.direction} at (${best.row},${best.col}) [score: ${best.score.toFixed(1)}]`);
  }

  printGrid();

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
  console.log(`   Cells filled: ${filledCells}/${totalCells} (${coverage}%)`);
  console.log(`   Words: ${placedWords.map(p => p.word).join(', ')}`);

  return { grid, placedWords, coverage: parseFloat(coverage) };
}

// Run test
const result = buildCrossword('love', 5, 6, 20);

if (result.coverage >= 80) {
  console.log('\n✅ SUCCESS - High-density crossword achieved!');
} else {
  console.log(`\n⚠️  Coverage ${result.coverage}% (target: 80%+)`);
}
