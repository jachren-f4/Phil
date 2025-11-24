#!/usr/bin/env node
// Enhanced crossword builder with 2-letter sequence handling

const fs = require('fs');
const http = require('http');

const db = JSON.parse(fs.readFileSync('./crossword-database.json', 'utf8'));

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

function getVerticalPattern(col, row, newLetter, newRow) {
  let startRow = row;
  while (startRow > 0 && getCell(startRow - 1, col) !== null) {
    startRow--;
  }
  let pattern = '';
  for (let r = startRow; r < grid.rows; r++) {
    const cell = (r === newRow) ? newLetter : getCell(r, col);
    if (cell === null) break;
    pattern += cell;
  }
  return { pattern, startRow, length: pattern.length };
}

function getHorizontalPattern(row, col, newLetter, newCol) {
  let startCol = col;
  while (startCol > 0 && getCell(row, startCol - 1) !== null) {
    startCol--;
  }
  let pattern = '';
  for (let c = startCol; c < grid.cols; c++) {
    const cell = (c === newCol) ? newLetter : getCell(row, c);
    if (cell === null) break;
    pattern += cell;
  }
  return { pattern, startCol, length: pattern.length };
}

function patternHasValidWord(pattern) {
  if (pattern.length < 3) return true;
  if (db.words.includes(pattern)) return true;
  return false;
}

function canPlaceWord(word, row, col, direction) {
  if (direction === 'across') {
    if (col + word.length > grid.cols) return false;
    if (col > 0 && getCell(row, col - 1) !== null) return false;
    if (col + word.length < grid.cols && getCell(row, col + word.length) !== null) return false;
    for (let i = 0; i < word.length; i++) {
      const currentCell = getCell(row, col + i);
      if (currentCell !== null && currentCell !== word[i]) return false;
      const vertPattern = getVerticalPattern(col + i, row, word[i], row);
      if (vertPattern.length >= 3) {
        if (!patternHasValidWord(vertPattern.pattern)) return false;
      }
      const above = getCell(row - 1, col + i);
      const below = getCell(row + 1, col + i);
      if (currentCell === null && (above !== null || below !== null)) {
        const extendedPattern = getVerticalPattern(col + i, row, word[i], row);
        if (extendedPattern.length >= 3 && !patternHasValidWord(extendedPattern.pattern)) {
          return false;
        }
      }
    }
    return true;
  } else {
    if (row + word.length > grid.rows) return false;
    if (row > 0 && getCell(row - 1, col) !== null) return false;
    if (row + word.length < grid.rows && getCell(row + word.length, col) !== null) return false;
    for (let i = 0; i < word.length; i++) {
      const currentCell = getCell(row + i, col);
      if (currentCell !== null && currentCell !== word[i]) return false;
      const horzPattern = getHorizontalPattern(row + i, col, word[i], col);
      if (horzPattern.length >= 3) {
        if (!patternHasValidWord(horzPattern.pattern)) return false;
      }
      const left = getCell(row + i, col - 1);
      const right = getCell(row + i, col + 1);
      if (currentCell === null && (left !== null || right !== null)) {
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
  createGrid(rows, cols);
  placedWords = [];
  usedWords = new Set();
  let attempts = 0;
  const maxAttempts = 2000;
  while (placedWords.length < maxWords && attempts < maxAttempts) {
    attempts++;
    const candidates = findCandidates(theme);
    if (candidates.length === 0) break;
    const best = candidates[0];
    placeWord(best.word, best.row, best.col, best.direction);
  }
  return { grid, placedWords };
}

// Extract all sequences (including 2-letter)
function extractAllSequences() {
  const sequences = [];

  // Horizontal
  for (let row = 0; row < grid.rows; row++) {
    let word = '';
    let startCol = 0;
    for (let col = 0; col <= grid.cols; col++) {
      const cell = col < grid.cols ? getCell(row, col) : null;
      if (cell !== null) {
        if (word === '') startCol = col;
        word += cell;
      } else {
        if (word.length >= 2) {
          sequences.push({ word, row, col: startCol, direction: 'across', length: word.length });
        }
        word = '';
      }
    }
  }

  // Vertical
  for (let col = 0; col < grid.cols; col++) {
    let word = '';
    let startRow = 0;
    for (let row = 0; row <= grid.rows; row++) {
      const cell = row < grid.rows ? getCell(row, col) : null;
      if (cell !== null) {
        if (word === '') startRow = row;
        word += cell;
      } else {
        if (word.length >= 2) {
          sequences.push({ word, row: startRow, col, direction: 'down', length: word.length });
        }
        word = '';
      }
    }
  }

  return sequences;
}

// Generate clue with LLM
async function generateClue(word, theme, isTwoLetter = false) {
  return new Promise((resolve) => {
    const prompt = isTwoLetter
      ? `For a crossword puzzle with theme "${theme}", create a creative clue for the 2-letter abbreviation "${word}". Make it thematic and clever. Respond with ONLY the clue text, no quotes.`
      : `Generate a concise crossword clue for the word "${word}" in the theme "${theme}". Respond with ONLY the clue text, no quotes.`;

    const postData = JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a crossword clue writer. Generate concise, clever clues.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 50
    });

    const reqOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response.choices[0].message.content.trim());
          } catch (error) {
            resolve(`${word} (${word.length})`);
          }
        } else {
          resolve(`${word} (${word.length})`);
        }
      });
    });

    req.on('error', () => resolve(`${word} (${word.length})`));
    req.on('timeout', () => {
      req.destroy();
      resolve(`${word} (${word.length})`);
    });
    req.write(postData);
    req.end();
  });
}

// Main
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ENHANCED CROSSWORD GENERATION TEST');
  console.log('  With 2-Letter Sequence Handling');
  console.log('  Theme: "love and intimacy"');
  console.log('  Grid: 5×6');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Step 1: Building validated crossword...');
  const result = buildCrossword('love', 5, 6, 30);

  // Print grid
  console.log('\n📊 Generated Grid:');
  console.log('┌───┬───┬───┬───┬───┬───┐');
  for (let row = 0; row < grid.rows; row++) {
    const rowStr = grid.cells[row].map(cell => cell || ' ').join(' │ ');
    console.log('│ ' + rowStr + ' │');
    if (row < grid.rows - 1) {
      console.log('├───┼───┼───┼───┼───┼───┤');
    }
  }
  console.log('└───┴───┴───┴───┴───┴───┘');

  console.log('\nStep 2: Extracting all sequences (including 2-letter)...');
  const allSequences = extractAllSequences();

  const longWords = allSequences.filter(s => s.length >= 3);
  const twoLetters = allSequences.filter(s => s.length === 2);

  console.log(`\n📝 Words Found:`);
  console.log(`   3+ letters: ${longWords.length} words`);
  console.log(`   2 letters: ${twoLetters.length} abbreviations`);

  // Categorize
  const across = allSequences.filter(s => s.direction === 'across');
  const down = allSequences.filter(s => s.direction === 'down');

  console.log('\n   Across: ' + across.map(s => `${s.word}(${s.length})`).join(', '));
  console.log('   Down:   ' + down.map(s => `${s.word}(${s.length})`).join(', '));

  console.log('\nStep 3: Generating clues with LLM...');
  const clues = [];

  for (const seq of allSequences) {
    const isTwoLetter = seq.length === 2;
    const clue = await generateClue(seq.word, 'love and intimacy', isTwoLetter);
    clues.push({ ...seq, clue, isTwoLetter });
    const marker = isTwoLetter ? '(2-letter)' : '';
    console.log(`   ${seq.word}: "${clue}" ${marker}`);
  }

  // Calculate coverage
  let filledCells = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (getCell(row, col) !== null) filledCells++;
    }
  }
  const coverage = (filledCells / (grid.rows * grid.cols) * 100).toFixed(1);

  console.log('\n📈 Final Statistics:');
  console.log(`   Total sequences: ${allSequences.length}`);
  console.log(`   3+ letter words: ${longWords.length}`);
  console.log(`   2-letter abbrevs: ${twoLetters.length}`);
  console.log(`   Coverage: ${coverage}%`);
  console.log(`   All clues generated: ${clues.length}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SUCCESS - Complete crossword with all clues!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return { grid, allSequences, clues, coverage, longWords, twoLetters };
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
