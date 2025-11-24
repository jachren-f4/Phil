#!/usr/bin/env node
// Premium Crossword Builder - 80%+ Coverage Target
// Multi-pass filling with seed selection

const fs = require('fs');

console.log('🎯 Premium Crossword Builder - 80%+ Coverage Target\n');

// Load database
const db = JSON.parse(fs.readFileSync('./crossword-database.json', 'utf8'));
console.log(`📚 Loaded ${db.words.length} words\n`);

// Grid configuration
const ROWS = 7;
const COLS = 9;
const TARGET_COVERAGE = 80;
const NUM_ATTEMPTS = 30;

// Helper functions
function createEmptyGrid(rows, cols) {
  return Array(rows).fill(null).map(() => Array(cols).fill(' '));
}

function getVerticalWord(grid, row, col, newLetter) {
  // Find start of vertical word
  let startRow = row;
  while (startRow > 0 && grid[startRow - 1][col] !== ' ') {
    startRow--;
  }

  // Build the word
  let word = '';
  let r = startRow;
  while (r < ROWS && (grid[r][col] !== ' ' || (r === row && newLetter))) {
    word += (r === row) ? newLetter : grid[r][col];
    r++;
  }

  return { word, length: word.length };
}

function getHorizontalWord(grid, row, col, newLetter) {
  // Find start of horizontal word
  let startCol = col;
  while (startCol > 0 && grid[row][startCol - 1] !== ' ') {
    startCol--;
  }

  // Build the word
  let word = '';
  let c = startCol;
  while (c < COLS && (grid[row][c] !== ' ' || (c === col && newLetter))) {
    word += (c === col) ? newLetter : grid[row][c];
    c++;
  }

  return { word, length: word.length };
}

function canPlaceWord(grid, word, row, col, direction) {
  if (direction === 'across') {
    if (col + word.length > COLS) return false;

    // Check boundaries
    if (col > 0 && grid[row][col - 1] !== ' ') return false;
    if (col + word.length < COLS && grid[row][col + word.length] !== ' ') return false;

    // Check each position
    for (let i = 0; i < word.length; i++) {
      const cell = grid[row][col + i];
      if (cell !== ' ' && cell !== word[i]) return false;

      // CRITICAL: Validate perpendicular words
      if (cell === ' ') {
        const vertWord = getVerticalWord(grid, row, col + i, word[i]);
        if (vertWord.length >= 3) {
          // Must be a valid word from dictionary
          if (!db.words.includes(vertWord.word)) {
            return false;
          }
        }
      }
    }
    return true;
  } else { // down
    if (row + word.length > ROWS) return false;

    // Check boundaries
    if (row > 0 && grid[row - 1][col] !== ' ') return false;
    if (row + word.length < ROWS && grid[row + word.length][col] !== ' ') return false;

    // Check each position
    for (let i = 0; i < word.length; i++) {
      const cell = grid[row + i][col];
      if (cell !== ' ' && cell !== word[i]) return false;

      // CRITICAL: Validate perpendicular words
      if (cell === ' ') {
        const horizWord = getHorizontalWord(grid, row + i, col, word[i]);
        if (horizWord.length >= 3) {
          // Must be a valid word from dictionary
          if (!db.words.includes(horizWord.word)) {
            return false;
          }
        }
      }
    }
    return true;
  }
}

function placeWord(grid, word, row, col, direction) {
  if (direction === 'across') {
    for (let i = 0; i < word.length; i++) {
      grid[row][col + i] = word[i];
    }
  } else {
    for (let i = 0; i < word.length; i++) {
      grid[row + i][col] = word[i];
    }
  }
}

function countIntersections(grid, word, row, col, direction) {
  let count = 0;
  if (direction === 'across') {
    for (let i = 0; i < word.length; i++) {
      if (grid[row][col + i] !== ' ') count++;
    }
  } else {
    for (let i = 0; i < word.length; i++) {
      if (grid[row + i][col] !== ' ') count++;
    }
  }
  return count;
}

function countPotentialIntersections(grid, word, row, col, direction, usedWords) {
  let potential = 0;
  const availableWords = db.words.filter(w => !usedWords.has(w));

  if (direction === 'across') {
    // Check each letter position for potential vertical words
    for (let i = 0; i < word.length; i++) {
      const letter = word[i];
      const c = col + i;

      // Count words that could intersect here
      for (const w of availableWords) {
        if (w.includes(letter) && w.length <= ROWS) {
          potential++;
          break; // Just need to know there's at least one
        }
      }
    }
  } else {
    // Check each letter position for potential horizontal words
    for (let i = 0; i < word.length; i++) {
      const letter = word[i];
      const r = row + i;

      for (const w of availableWords) {
        if (w.includes(letter) && w.length <= COLS) {
          potential++;
          break;
        }
      }
    }
  }

  return potential;
}

function wouldCreateIsolation(grid, word, row, col, direction) {
  // Check if placement would create unreachable cells
  // Simplified check: look for cells surrounded by filled cells
  const tempGrid = grid.map(r => [...r]);
  placeWord(tempGrid, word, row, col, direction);

  let isolatedCount = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tempGrid[r][c] === ' ') {
        // Check if surrounded
        let filledNeighbors = 0;
        if (r > 0 && tempGrid[r-1][c] !== ' ') filledNeighbors++;
        if (r < ROWS-1 && tempGrid[r+1][c] !== ' ') filledNeighbors++;
        if (c > 0 && tempGrid[r][c-1] !== ' ') filledNeighbors++;
        if (c < COLS-1 && tempGrid[r][c+1] !== ' ') filledNeighbors++;

        if (filledNeighbors >= 3) isolatedCount++;
      }
    }
  }

  return isolatedCount >= 3;
}

function scoreCandidate(grid, word, row, col, direction, usedWords) {
  let score = 0;

  // Theme bonus
  score += 100;

  // Intersection bonus (INCREASED)
  const intersections = countIntersections(grid, word, row, col, direction);
  score += intersections * 50;

  // Length bonus (prioritize longer words)
  if (word.length >= 6) score += 30;
  else if (word.length >= 4) score += 10;
  else score += 3;

  // Look-ahead bonus
  const potential = countPotentialIntersections(grid, word, row, col, direction, usedWords);
  score += potential * 20;

  // Isolation penalty
  if (wouldCreateIsolation(grid, word, row, col, direction)) {
    score -= 100;
  }

  // Small randomness for variety
  score += Math.random() * 5;

  return score;
}

function findBestPlacement(grid, words, usedWords) {
  let best = null;
  let bestScore = -Infinity;

  for (const word of words) {
    if (usedWords.has(word)) continue;

    // Try all positions
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Try across
        if (canPlaceWord(grid, word, row, col, 'across')) {
          const score = scoreCandidate(grid, word, row, col, 'across', usedWords);
          if (score > bestScore) {
            bestScore = score;
            best = { word, row, col, direction: 'across', score };
          }
        }

        // Try down
        if (canPlaceWord(grid, word, row, col, 'down')) {
          const score = scoreCandidate(grid, word, row, col, 'down', usedWords);
          if (score > bestScore) {
            bestScore = score;
            best = { word, row, col, direction: 'down', score };
          }
        }
      }
    }
  }

  return best;
}

function fillGridMultiPass(startWord) {
  const grid = createEmptyGrid(ROWS, COLS);
  const usedWords = new Set();

  // Pass 1: Long anchor words (6-8 letters)
  const longWords = db.words.filter(w => w.length >= 6 && w.length <= 8);

  // Place starting word in strategic position
  if (startWord && startWord.length <= COLS) {
    const startRow = Math.floor(ROWS / 2);
    const startCol = 0;
    if (canPlaceWord(grid, startWord, startRow, startCol, 'across')) {
      placeWord(grid, startWord, startRow, startCol, 'across');
      usedWords.add(startWord);
    }
  }

  // Place 1-2 more long words
  for (let i = 0; i < 2; i++) {
    const best = findBestPlacement(grid, longWords, usedWords);
    if (best && best.score > 50) {
      placeWord(grid, best.word, best.row, best.col, best.direction);
      usedWords.add(best.word);
    }
  }

  // Pass 2: Medium words (4-6 letters)
  const mediumWords = db.words.filter(w => w.length >= 4 && w.length <= 6);
  for (let i = 0; i < 20; i++) {
    const best = findBestPlacement(grid, mediumWords, usedWords);
    if (!best || best.score < 40) break;

    placeWord(grid, best.word, best.row, best.col, best.direction);
    usedWords.add(best.word);
  }

  // Pass 3: Short words (3 letters)
  const shortWords = db.words.filter(w => w.length === 3);
  for (let i = 0; i < 15; i++) {
    const best = findBestPlacement(grid, shortWords, usedWords);
    if (!best || best.score < 20) break;

    placeWord(grid, best.word, best.row, best.col, best.direction);
    usedWords.add(best.word);
  }

  // Pass 4: Any remaining words that fit
  for (let i = 0; i < 10; i++) {
    const best = findBestPlacement(grid, db.words, usedWords);
    if (!best || best.score < 10) break;

    placeWord(grid, best.word, best.row, best.col, best.direction);
    usedWords.add(best.word);
  }

  return { grid, usedWords };
}

function calculateCoverage(grid) {
  let filled = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== ' ') filled++;
    }
  }
  return (filled / (ROWS * COLS) * 100);
}

function extractSequences(grid) {
  const sequences = [];

  // Horizontal sequences
  for (let row = 0; row < ROWS; row++) {
    let word = '';
    let startCol = 0;

    for (let col = 0; col < COLS; col++) {
      if (grid[row][col] !== ' ') {
        if (word === '') startCol = col;
        word += grid[row][col];
      } else {
        if (word.length >= 2) {
          sequences.push({ word, row, col: startCol, direction: 'across' });
        }
        word = '';
      }
    }
    if (word.length >= 2) {
      sequences.push({ word, row, col: startCol, direction: 'across' });
    }
  }

  // Vertical sequences
  for (let col = 0; col < COLS; col++) {
    let word = '';
    let startRow = 0;

    for (let row = 0; row < ROWS; row++) {
      if (grid[row][col] !== ' ') {
        if (word === '') startRow = row;
        word += grid[row][col];
      } else {
        if (word.length >= 2) {
          sequences.push({ word, row: startRow, col, direction: 'down' });
        }
        word = '';
      }
    }
    if (word.length >= 2) {
      sequences.push({ word, row: startRow, col, direction: 'down' });
    }
  }

  return sequences;
}

function scorePuzzle(grid, usedWords) {
  const coverage = calculateCoverage(grid);
  const sequences = extractSequences(grid);
  const longWords = sequences.filter(s => s.word.length >= 3).length;
  const twoLetters = sequences.filter(s => s.word.length === 2).length;

  // Scoring formula
  let score = 0;
  score += coverage * 10;              // Coverage is most important
  score += longWords * 5;               // More real words is good
  score -= twoLetters * 10;             // Penalize 2-letter sequences

  return {
    score,
    coverage,
    wordCount: longWords,
    twoLetterCount: twoLetters,
    totalWords: usedWords.size
  };
}

// Main algorithm: Generate multiple attempts, keep best
console.log(`🎲 Generating ${NUM_ATTEMPTS} puzzles, keeping best...\n`);

let bestResult = null;
let bestScore = -Infinity;

// Get diverse starting words
const startingWords = [
  ...db.words.filter(w => w.length === 8).slice(0, 5),
  ...db.words.filter(w => w.length === 7).slice(0, 5),
  ...db.words.filter(w => w.length === 6).slice(0, 10)
];

for (let attempt = 0; attempt < NUM_ATTEMPTS; attempt++) {
  const startWord = startingWords[attempt % startingWords.length];
  const { grid, usedWords } = fillGridMultiPass(startWord);
  const metrics = scorePuzzle(grid, usedWords);

  console.log(`   Attempt ${attempt + 1}: ${metrics.coverage.toFixed(1)}% coverage, ${metrics.wordCount} words, score: ${metrics.score.toFixed(0)}`);

  if (metrics.score > bestScore) {
    bestScore = metrics.score;
    bestResult = { grid, usedWords, metrics, startWord };
  }
}

console.log(`\n✅ Best puzzle found!\n`);
console.log(`📊 Statistics:`);
console.log(`   Coverage: ${bestResult.metrics.coverage.toFixed(1)}%`);
console.log(`   Words (3+ letters): ${bestResult.metrics.wordCount}`);
console.log(`   2-letter sequences: ${bestResult.metrics.twoLetterCount}`);
console.log(`   Total unique words: ${bestResult.metrics.totalWords}`);
console.log(`   Starting word: ${bestResult.startWord}`);
console.log(`   Quality score: ${bestResult.metrics.score.toFixed(0)}`);

// Extract and display sequences
const sequences = extractSequences(bestResult.grid);
const wordsOnly = sequences.filter(s => s.word.length >= 3);
const twoLetterOnly = sequences.filter(s => s.word.length === 2);

console.log(`\n📝 Words placed:`);
console.log(`   ${wordsOnly.map(s => s.word).join(', ')}`);

if (twoLetterOnly.length > 0) {
  console.log(`\n⚠️  2-letter sequences:`);
  console.log(`   ${twoLetterOnly.map(s => s.word).join(', ')}`);
}

// Display grid
console.log(`\n📋 Grid:\n`);
console.log('┌' + '───┬'.repeat(COLS - 1) + '───┐');
for (let row = 0; row < ROWS; row++) {
  let line = '│';
  for (let col = 0; col < COLS; col++) {
    const cell = bestResult.grid[row][col];
    line += ' ' + (cell === ' ' ? ' ' : cell) + ' │';
  }
  console.log(line);
  if (row < ROWS - 1) {
    console.log('├' + '───┼'.repeat(COLS - 1) + '───┤');
  }
}
console.log('└' + '───┴'.repeat(COLS - 1) + '───┘');

// Save to file
const output = {
  theme: db.theme,
  size: `${ROWS}×${COLS}`,
  coverage: bestResult.metrics.coverage,
  grid: bestResult.grid,
  sequences: sequences,
  words: wordsOnly.map(s => s.word),
  twoLetterSequences: twoLetterOnly.map(s => s.word),
  usedWords: Array.from(bestResult.usedWords)
};

fs.writeFileSync('premium-puzzle.json', JSON.stringify(output, null, 2));
console.log(`\n💾 Saved to premium-puzzle.json`);

// Check if target met
if (bestResult.metrics.coverage >= TARGET_COVERAGE) {
  console.log(`\n🎉 TARGET MET! Achieved ${bestResult.metrics.coverage.toFixed(1)}% (target: ${TARGET_COVERAGE}%)`);
} else {
  console.log(`\n⚠️  Target not met: ${bestResult.metrics.coverage.toFixed(1)}% (target: ${TARGET_COVERAGE}%)`);
  console.log(`   Consider increasing NUM_ATTEMPTS or adjusting scoring parameters`);
}
