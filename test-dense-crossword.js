#!/usr/bin/env node
// Complete test: Build + Validate + Generate Clues

const fs = require('fs');
const http = require('http');

// Load database
const db = JSON.parse(fs.readFileSync('./crossword-database.json', 'utf8'));

// Grid structure (copy from greedy-builder.js)
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

function canPlaceWord(word, row, col, direction) {
  if (direction === 'across') {
    if (col + word.length > grid.cols) return false;
    if (col > 0 && getCell(row, col - 1) !== null) return false;
    if (col + word.length < grid.cols && getCell(row, col + word.length) !== null) return false;
    for (let i = 0; i < word.length; i++) {
      const currentCell = getCell(row, col + i);
      if (currentCell !== null && currentCell !== word[i]) return false;
    }
    return true;
  } else {
    if (row + word.length > grid.rows) return false;
    if (row > 0 && getCell(row - 1, col) !== null) return false;
    if (row + word.length < grid.rows && getCell(row + word.length, col) !== null) return false;
    for (let i = 0; i < word.length; i++) {
      const currentCell = getCell(row + i, col);
      if (currentCell !== null && currentCell !== word[i]) return false;
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
  const connectivity = Object.keys(db.intersections[word]).reduce((sum, key) => {
    return sum + db.intersections[word][key].length;
  }, 0);
  score += Math.log(connectivity) * 2;
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
  const availableWords = [...themedWords, ...generalWords.slice(0, 300)];

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

function buildCrossword(theme, rows, cols, maxWords = 20) {
  createGrid(rows, cols);
  placedWords = [];
  usedWords = new Set();
  let attempts = 0;
  const maxAttempts = 1000;
  while (placedWords.length < maxWords && attempts < maxAttempts) {
    attempts++;
    const candidates = findCandidates(theme);
    if (candidates.length === 0) break;
    const best = candidates[0];
    placeWord(best.word, best.row, best.col, best.direction);
  }
  return { grid, placedWords };
}

// Extract all words from grid
function extractAllWords() {
  const words = [];

  // Horizontal words
  for (let row = 0; row < grid.rows; row++) {
    let word = '';
    let startCol = 0;
    for (let col = 0; col <= grid.cols; col++) {
      const cell = col < grid.cols ? getCell(row, col) : null;
      if (cell !== null) {
        if (word === '') startCol = col;
        word += cell;
      } else {
        if (word.length >= 3) {
          words.push({ word, row, col: startCol, direction: 'across' });
        }
        word = '';
      }
    }
  }

  // Vertical words
  for (let col = 0; col < grid.cols; col++) {
    let word = '';
    let startRow = 0;
    for (let row = 0; row <= grid.rows; row++) {
      const cell = row < grid.rows ? getCell(row, col) : null;
      if (cell !== null) {
        if (word === '') startRow = row;
        word += cell;
      } else {
        if (word.length >= 3) {
          words.push({ word, row: startRow, col, direction: 'down' });
        }
        word = '';
      }
    }
  }

  return words;
}

// Validate all words
function validateAllWords() {
  const allWords = extractAllWords();
  const invalid = [];

  for (const entry of allWords) {
    if (!db.words.includes(entry.word)) {
      invalid.push(entry);
    }
  }

  return { allWords, invalid };
}

// Generate clue with LLM
async function generateClue(word, theme) {
  return new Promise((resolve, reject) => {
    const prompt = `Generate a short, clever crossword clue for the word "${word}" in the theme "${theme}". Respond with ONLY the clue text, no quotes or extra text.`;

    const postData = JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a crossword puzzle clue writer. Generate concise, clever clues.' },
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
            resolve(`${word} (${word.length})`); // Fallback
          }
        } else {
          resolve(`${word} (${word.length})`); // Fallback
        }
      });
    });

    req.on('error', () => resolve(`${word} (${word.length})`)); // Fallback
    req.on('timeout', () => {
      req.destroy();
      resolve(`${word} (${word.length})`); // Fallback
    });
    req.write(postData);
    req.end();
  });
}

// Main test
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  DENSE CROSSWORD GENERATION TEST');
  console.log('  Theme: "love and intimacy"');
  console.log('  Grid: 5×6');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('Step 1: Building crossword with greedy algorithm...');
  const result = buildCrossword('love', 5, 6, 20);

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

  console.log('\nStep 2: Validating all words...');
  const { allWords, invalid } = validateAllWords();

  console.log(`\n📝 All Words Found (${allWords.length} total):`);
  console.log('   Across: ' + allWords.filter(w => w.direction === 'across').map(w => w.word).join(', '));
  console.log('   Down:   ' + allWords.filter(w => w.direction === 'down').map(w => w.word).join(', '));

  if (invalid.length > 0) {
    console.log(`\n⚠️  Invalid Words (${invalid.length}):`);
    for (const entry of invalid) {
      console.log(`   "${entry.word}" at (${entry.row},${entry.col}) ${entry.direction}`);
    }
  } else {
    console.log('\n✅ All words are valid!');
  }

  // Calculate coverage
  let filledCells = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (getCell(row, col) !== null) filledCells++;
    }
  }
  const coverage = (filledCells / (grid.rows * grid.cols) * 100).toFixed(1);

  console.log('\nStep 3: Generating clues with LLM...');
  const clues = { across: [], down: [] };

  for (const entry of placedWords) {
    const clue = await generateClue(entry.word, 'love and intimacy');
    const direction = entry.direction === 'across' ? 'across' : 'down';
    clues[direction].push({ word: entry.word, clue });
    console.log(`   ${entry.word}: "${clue}"`);
  }

  console.log('\n📈 Final Statistics:');
  console.log(`   Words placed: ${placedWords.length}`);
  console.log(`   All words found: ${allWords.length}`);
  console.log(`   Valid words: ${allWords.length - invalid.length}/${allWords.length}`);
  console.log(`   Coverage: ${coverage}%`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (coverage >= 80 && invalid.length === 0) {
    console.log('✅ SUCCESS - High-density valid crossword!');
  } else if (coverage >= 80) {
    console.log(`⚠️  High coverage but ${invalid.length} invalid words`);
  } else {
    console.log(`⚠️  Coverage: ${coverage}% (target: 80%+)`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
