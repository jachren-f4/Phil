#!/usr/bin/env node
// Complete test with black squares and pattern matching

const http = require('http');
const fs = require('fs');

const xw = { rows: 5, cols: 6, fill: [] };
for (let i = 0; i < xw.rows; i++) {
  xw.fill.push(' '.repeat(xw.cols));
}

// Helper to call proxy
async function callAPI(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates crossword puzzle content. Always respond with valid JSON when requested.' },
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 1000
    });

    const reqOptions = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            resolve(response.choices[0].message.content);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          reject(new Error(`API returned status ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Theme analysis
async function analyzeTheme(theme, difficulty) {
  const prompt = `You are helping create a crossword puzzle with the theme: "${theme}"

Difficulty level: ${difficulty}

Please analyze this theme and provide 60-80 words of varying lengths (3-6 letters for a 5×6 grid).

Return ONLY a JSON object with this structure:
{
  "core_words": ["WORD1", "WORD2", ...],
  "related_words": ["WORD3", "WORD4", ...],
  "action_words": ["VERB1", "VERB2", ...],
  "descriptive_words": ["ADJ1", "ADJ2", ...]
}

Requirements:
- All words must be in UPPERCASE
- Words should be 3-6 letters long (optimal for 5×6 grid)
- Provide at least 60 total words
- Focus on common, crossword-friendly words

Return ONLY the JSON object.`;

  const response = await callAPI(prompt, { temperature: 0.7, max_tokens: 1500 });
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  }
  return JSON.parse(jsonStr);
}

// Score words
function scoreWords(themeData) {
  const allWords = [
    ...(themeData.core_words || []),
    ...(themeData.related_words || []),
    ...(themeData.action_words || []),
    ...(themeData.descriptive_words || [])
  ];

  return allWords
    .filter(word => word.length >= 3 && word.length <= 6)
    .map(word => ({ word, length: word.length, score: Math.random() }))
    .sort((a, b) => b.score - a.score);
}

// Pattern matching functions
function matchesPattern(word, pattern) {
  if (word.length !== pattern.length) return false;
  for (let i = 0; i < word.length; i++) {
    if (pattern[i] !== '_' && pattern[i] !== word[i]) return false;
  }
  return true;
}

function getHorizontalPattern(row, col) {
  if (col > 0 && xw.fill[row][col - 1] !== ' ' && xw.fill[row][col - 1] !== '.') return null;
  let pattern = '';
  for (let c = col; c < xw.cols; c++) {
    const char = xw.fill[row][c];
    if (char === '.') break;
    pattern += (char === ' ') ? '_' : char;
  }
  return pattern.length >= 3 ? pattern : null;
}

function getVerticalPattern(row, col) {
  if (row > 0 && xw.fill[row - 1][col] !== ' ' && xw.fill[row - 1][col] !== '.') return null;
  let pattern = '';
  for (let r = row; r < xw.rows; r++) {
    const char = xw.fill[r][col];
    if (char === '.') break;
    pattern += (char === ' ') ? '_' : char;
  }
  return pattern.length >= 3 ? pattern : null;
}

// Placement functions
function canPlaceWordHorizontal(row, col, word) {
  if (col + word.length > xw.cols) return false;
  if (col > 0 && xw.fill[row][col - 1] !== ' ' && xw.fill[row][col - 1] !== '.') return false;
  if (col + word.length < xw.cols && xw.fill[row][col + word.length] !== ' ' && xw.fill[row][col + word.length] !== '.') return false;

  for (let i = 0; i < word.length; i++) {
    const currentChar = xw.fill[row][col + i];
    if (currentChar === '.') return false;
    if (currentChar !== ' ' && currentChar !== word[i]) return false;
  }
  return true;
}

function canPlaceWordVertical(row, col, word) {
  if (row + word.length > xw.rows) return false;
  if (row > 0 && xw.fill[row - 1][col] !== ' ' && xw.fill[row - 1][col] !== '.') return false;
  if (row + word.length < xw.rows && xw.fill[row + word.length][col] !== ' ' && xw.fill[row + word.length][col] !== '.') return false;

  for (let i = 0; i < word.length; i++) {
    const currentChar = xw.fill[row + i][col];
    if (currentChar === '.') return false;
    if (currentChar !== ' ' && currentChar !== word[i]) return false;
  }
  return true;
}

function placeWordHorizontal(row, col, word) {
  for (let i = 0; i < word.length; i++) {
    xw.fill[row] = xw.fill[row].substring(0, col + i) + word[i] + xw.fill[row].substring(col + i + 1);
  }
}

function placeWordVertical(row, col, word) {
  for (let i = 0; i < word.length; i++) {
    xw.fill[row + i] = xw.fill[row + i].substring(0, col) + word[i] + xw.fill[row + i].substring(col + 1);
  }
}

// Add black squares
function addBlackSquares() {
  const candidates = [];
  for (let row = 0; row < xw.rows; row++) {
    for (let col = 0; col < xw.cols; col++) {
      if (xw.fill[row][col] !== ' ') continue;
      let adjacentBlanks = 0;
      if (row > 0 && xw.fill[row-1][col] === ' ') adjacentBlanks++;
      if (row < xw.rows - 1 && xw.fill[row+1][col] === ' ') adjacentBlanks++;
      if (col > 0 && xw.fill[row][col-1] === ' ') adjacentBlanks++;
      if (col < xw.cols - 1 && xw.fill[row][col+1] === ' ') adjacentBlanks++;
      if (adjacentBlanks >= 3) {
        candidates.push({ row, col, score: adjacentBlanks });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const numBlackSquares = Math.min(candidates.length, Math.floor(xw.rows * xw.cols * 0.15));

  for (let i = 0; i < numBlackSquares; i++) {
    const { row, col } = candidates[i];
    xw.fill[row] = xw.fill[row].substring(0, col) + '.' + xw.fill[row].substring(col + 1);

    const symRow = xw.rows - 1 - row;
    const symCol = xw.cols - 1 - col;
    if (xw.fill[symRow][symCol] === ' ') {
      xw.fill[symRow] = xw.fill[symRow].substring(0, symCol) + '.' + xw.fill[symRow].substring(symCol + 1);
    }
  }
}

// Fill grid
function fillGrid(words) {
  const usedWords = new Set();
  const placedWords = [];

  // Phase 1: Place at key positions
  console.log('Phase 1: Initial placement...');
  for (let row = 0; row < xw.rows; row += 2) {
    const suitable = words.filter(w => w.length <= xw.cols && !usedWords.has(w.word));
    for (let attempt = 0; attempt < Math.min(suitable.length, 10); attempt++) {
      const { word } = suitable[attempt];
      if (canPlaceWordHorizontal(row, 0, word)) {
        placeWordHorizontal(row, 0, word);
        usedWords.add(word);
        placedWords.push({ word, direction: 'horizontal', row, col: 0 });
        console.log(`  Placed "${word}" horizontally at (${row}, 0)`);
        break;
      }
    }
  }

  for (let col = 0; col < xw.cols; col += 2) {
    const suitable = words.filter(w => w.length <= xw.rows && !usedWords.has(w.word));
    for (let attempt = 0; attempt < Math.min(suitable.length, 10); attempt++) {
      const { word } = suitable[attempt];
      if (canPlaceWordVertical(0, col, word)) {
        placeWordVertical(0, col, word);
        usedWords.add(word);
        placedWords.push({ word, direction: 'vertical', row: 0, col });
        console.log(`  Placed "${word}" vertically at (0, ${col})`);
        break;
      }
    }
  }

  // Phase 2: Add black squares
  console.log('\nPhase 2: Adding black squares...');
  addBlackSquares();

  // Phase 3: Pattern matching fill
  console.log('\nPhase 3: Pattern matching fill...');
  for (let row = 0; row < xw.rows; row++) {
    for (let col = 0; col < xw.cols; col++) {
      const pattern = getHorizontalPattern(row, col);
      if (!pattern) continue;

      const matching = words.filter(w => !usedWords.has(w.word) && matchesPattern(w.word, pattern));
      for (const { word } of matching) {
        if (canPlaceWordHorizontal(row, col, word)) {
          placeWordHorizontal(row, col, word);
          usedWords.add(word);
          placedWords.push({ word, direction: 'horizontal', row, col });
          console.log(`  Filled "${word}" at (${row}, ${col}) matching "${pattern}"`);
          break;
        }
      }
    }
  }

  for (let col = 0; col < xw.cols; col++) {
    for (let row = 0; row < xw.rows; row++) {
      const pattern = getVerticalPattern(row, col);
      if (!pattern) continue;

      const matching = words.filter(w => !usedWords.has(w.word) && matchesPattern(w.word, pattern));
      for (const { word } of matching) {
        if (canPlaceWordVertical(row, col, word)) {
          placeWordVertical(row, col, word);
          usedWords.add(word);
          placedWords.push({ word, direction: 'vertical', row, col });
          console.log(`  Filled "${word}" at (${row}, ${col}) matching "${pattern}"`);
          break;
        }
      }
    }
  }

  return placedWords;
}

// Print grid
function printGrid() {
  console.log('\n📊 Final Grid:');
  console.log('┌' + '───┬'.repeat(xw.cols - 1) + '───┐');
  for (let i = 0; i < xw.rows; i++) {
    const row = xw.fill[i].split('').map(c => {
      if (c === '.') return '■';
      if (c === ' ') return ' ';
      return c;
    }).join(' │ ');
    console.log('│ ' + row + ' │');
    if (i < xw.rows - 1) {
      console.log('├' + '───┼'.repeat(xw.cols - 1) + '───┤');
    }
  }
  console.log('└' + '───┴'.repeat(xw.cols - 1) + '───┘');
}

// Main
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  COMPLETE CROSSWORD GENERATION TEST');
  console.log('  Theme: "love and intimacy"');
  console.log('  Grid: 5×6');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('Step 1: Analyzing theme...');
    const themeData = await analyzeTheme('love and intimacy', 'medium');
    const allWords = [
      ...(themeData.core_words || []),
      ...(themeData.related_words || []),
      ...(themeData.action_words || []),
      ...(themeData.descriptive_words || [])
    ];
    console.log(`  Generated ${allWords.length} themed words\n`);

    console.log('Step 2: Scoring words...');
    const scoredWords = scoreWords(themeData);
    console.log(`  ${scoredWords.length} words suitable for 5×6 grid`);
    console.log(`  Top 10: ${scoredWords.slice(0, 10).map(w => w.word).join(', ')}\n`);

    console.log('Step 3: Filling grid...');
    const placedWords = fillGrid(scoredWords);

    printGrid();

    // Calculate stats
    let filledCells = 0, blackCells = 0;
    for (let i = 0; i < xw.rows; i++) {
      for (let j = 0; j < xw.cols; j++) {
        if (xw.fill[i][j] !== ' ') filledCells++;
        if (xw.fill[i][j] === '.') blackCells++;
      }
    }

    const totalCells = xw.rows * xw.cols;
    const whiteCells = totalCells - blackCells;
    const coverage = whiteCells > 0 ? ((filledCells - blackCells) / whiteCells * 100).toFixed(1) : 0;

    console.log('\n✅ Quality Metrics:');
    console.log(`   Words placed: ${placedWords.length}`);
    console.log(`   Unique words: ${placedWords.map(p => p.word).join(', ')}`);
    console.log(`   Black squares: ${blackCells} (${(blackCells/totalCells*100).toFixed(1)}%)`);
    console.log(`   White square coverage: ${coverage}%`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (parseFloat(coverage) >= 70) {
      console.log('✅ SUCCESS - Coverage target achieved!');
    } else {
      console.log(`⚠️  Coverage: ${coverage}% (target: 70%+)`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
