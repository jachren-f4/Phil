#!/usr/bin/env node
// Automated test to generate and evaluate crossword quality

const http = require('http');

// Simulate the xw object
const xw = {
  rows: 5,
  cols: 6,
  fill: []
};

// Initialize grid
for (let i = 0; i < xw.rows; i++) {
  xw.fill.push(' '.repeat(xw.cols));
}

// Helper to call the proxy
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
          reject(new Error(`API returned status ${res.statusCode}: ${data}`));
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
Include a mix of common and moderately specialized terms.

Please analyze this theme and provide:
1. Core concept words directly related to the theme
2. Related concepts and associations
3. Action words (verbs) related to the theme
4. Descriptive words (adjectives) related to the theme

Return your response as a JSON object with this structure:
{
  "theme_summary": "brief description of the theme",
  "core_words": ["WORD1", "WORD2", ...],
  "related_words": ["WORD3", "WORD4", ...],
  "action_words": ["VERB1", "VERB2", ...],
  "descriptive_words": ["ADJ1", "ADJ2", ...]
}

Requirements:
- All words must be in UPPERCASE
- Words should be 3-15 letters long
- Suitable for crossword puzzles
- Provide at least 30-40 total words
- Focus on words that would intersect well

Return ONLY the JSON object, no additional text.`;

  const response = await callAPI(prompt, { temperature: 0.7, max_tokens: 1000 });
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  }
  return JSON.parse(jsonStr);
}

// Word scoring
function scoreWords(themeData, dimensions) {
  const allWords = [
    ...(themeData.core_words || []),
    ...(themeData.related_words || []),
    ...(themeData.action_words || []),
    ...(themeData.descriptive_words || [])
  ];

  const maxLength = Math.max(dimensions.rows, dimensions.cols);
  const minLength = 3;

  return allWords
    .filter(word => word.length >= minLength && word.length <= maxLength)
    .map(word => {
      let score = 0.5;
      const idealLength = Math.floor(maxLength * 0.6);
      const lengthDiff = Math.abs(word.length - idealLength);
      score += (1 - lengthDiff / maxLength) * 0.2;

      const commonLetters = 'ERSTLNAOI';
      const commonCount = word.split('').filter(c => commonLetters.includes(c)).length;
      score += (commonCount / word.length) * 0.1;

      return { word, length: word.length, score: Math.min(score, 1.0) };
    })
    .sort((a, b) => b.score - a.score);
}

// Check if word can be placed
function canPlaceWordHorizontal(row, col, word) {
  if (col + word.length > xw.cols) return false;

  // Check word boundaries
  if (col > 0 && xw.fill[row][col - 1] !== ' ') return false;
  if (col + word.length < xw.cols && xw.fill[row][col + word.length] !== ' ') return false;

  for (let i = 0; i < word.length; i++) {
    const currentChar = xw.fill[row][col + i];
    if (currentChar !== ' ' && currentChar !== word[i]) {
      return false;
    }

    // Check perpendicular words don't get extended
    if (currentChar === ' ') {
      if (row > 0 && xw.fill[row - 1][col + i] !== ' ') {
        if (row < xw.rows - 1 && xw.fill[row + 1][col + i] !== ' ') {
          return false;
        }
      }
      if (row < xw.rows - 1 && xw.fill[row + 1][col + i] !== ' ') {
        if (row > 0 && xw.fill[row - 1][col + i] !== ' ') {
          return false;
        }
      }
    }
  }
  return true;
}

function canPlaceWordVertical(row, col, word) {
  if (row + word.length > xw.rows) return false;

  // Check word boundaries
  if (row > 0 && xw.fill[row - 1][col] !== ' ') return false;
  if (row + word.length < xw.rows && xw.fill[row + word.length][col] !== ' ') return false;

  for (let i = 0; i < word.length; i++) {
    const currentChar = xw.fill[row + i][col];
    if (currentChar !== ' ' && currentChar !== word[i]) {
      return false;
    }

    // Check perpendicular words don't get extended
    if (currentChar === ' ') {
      if (col > 0 && xw.fill[row + i][col - 1] !== ' ') {
        if (col < xw.cols - 1 && xw.fill[row + i][col + 1] !== ' ') {
          return false;
        }
      }
      if (col < xw.cols - 1 && xw.fill[row + i][col + 1] !== ' ') {
        if (col > 0 && xw.fill[row + i][col - 1] !== ' ') {
          return false;
        }
      }
    }
  }
  return true;
}

// Place words
function placeWordHorizontal(row, col, word) {
  for (let i = 0; i < word.length; i++) {
    const before = xw.fill[row].substring(0, col + i);
    const after = xw.fill[row].substring(col + i + 1);
    xw.fill[row] = before + word[i] + after;
  }
}

function placeWordVertical(row, col, word) {
  for (let i = 0; i < word.length; i++) {
    const before = xw.fill[row + i].substring(0, col);
    const after = xw.fill[row + i].substring(col + 1);
    xw.fill[row + i] = before + word[i] + after;
  }
}

// Fill grid
function fillGrid(scoredWords, dimensions) {
  const words = scoredWords.map(w => w.word);
  const usedWords = new Set();
  const placedWords = [];

  // Phase 1: Place at key positions
  for (let row = 0; row < dimensions.rows; row += 2) {
    const suitable = words.filter(w => w.length <= dimensions.cols && w.length >= 3 && !usedWords.has(w));
    for (let attempt = 0; attempt < Math.min(suitable.length, 10); attempt++) {
      const word = suitable[attempt];
      if (canPlaceWordHorizontal(row, 0, word)) {
        placeWordHorizontal(row, 0, word);
        usedWords.add(word);
        placedWords.push({ word, direction: 'horizontal', row, col: 0 });
        break;
      }
    }
  }

  for (let col = 0; col < dimensions.cols; col += 2) {
    const suitable = words.filter(w => w.length <= dimensions.rows && w.length >= 3 && !usedWords.has(w));
    for (let attempt = 0; attempt < Math.min(suitable.length, 10); attempt++) {
      const word = suitable[attempt];
      if (canPlaceWordVertical(0, col, word)) {
        placeWordVertical(0, col, word);
        usedWords.add(word);
        placedWords.push({ word, direction: 'vertical', row: 0, col });
        break;
      }
    }
  }

  // Phase 2: Fill remaining spaces with pattern matching
  function getHorizontalPattern(row, col) {
    if (col > 0 && xw.fill[row][col - 1] !== ' ') return null;
    let pattern = '';
    for (let c = col; c < xw.cols; c++) {
      const char = xw.fill[row][c];
      pattern += (char === ' ') ? '_' : char;
      if (c + 1 < xw.cols && xw.fill[row][c + 1] === ' ' && char === ' ') break;
    }
    let wordEnd = pattern.length;
    for (let i = 0; i < pattern.length; i++) {
      if (i > 0 && pattern[i] === '_' && pattern[i - 1] === '_') {
        wordEnd = i;
        break;
      }
    }
    return pattern.substring(0, wordEnd);
  }

  function getVerticalPattern(row, col) {
    if (row > 0 && xw.fill[row - 1][col] !== ' ') return null;
    let pattern = '';
    for (let r = row; r < xw.rows; r++) {
      const char = xw.fill[r][col];
      pattern += (char === ' ') ? '_' : char;
      if (r + 1 < xw.rows && xw.fill[r + 1][col] === ' ' && char === ' ') break;
    }
    let wordEnd = pattern.length;
    for (let i = 0; i < pattern.length; i++) {
      if (i > 0 && pattern[i] === '_' && pattern[i - 1] === '_') {
        wordEnd = i;
        break;
      }
    }
    return pattern.substring(0, wordEnd);
  }

  function matchesPattern(word, pattern) {
    if (word.length !== pattern.length) return false;
    for (let i = 0; i < word.length; i++) {
      if (pattern[i] !== '_' && pattern[i] !== word[i]) return false;
    }
    return true;
  }

  function shouldPlace(row, col, word, direction) {
    let intersections = 0;
    if (direction === 'horizontal') {
      for (let i = 0; i < word.length; i++) {
        if (xw.fill[row][col + i] !== ' ') intersections++;
      }
    } else {
      for (let i = 0; i < word.length; i++) {
        if (xw.fill[row + i][col] !== ' ') intersections++;
      }
    }
    let totalFilled = 0;
    for (let i = 0; i < xw.rows; i++) {
      for (let j = 0; j < xw.cols; j++) {
        if (xw.fill[i][j] !== ' ') totalFilled++;
      }
    }
    return intersections > 0 || totalFilled < 10;
  }

  // Try all horizontal positions with pattern matching
  for (let row = 0; row < dimensions.rows; row++) {
    for (let col = 0; col < dimensions.cols; col++) {
      const pattern = getHorizontalPattern(row, col);
      if (!pattern || pattern.length < 3) continue;

      const matching = words.filter(w =>
        w.length === pattern.length &&
        !usedWords.has(w) &&
        matchesPattern(w, pattern)
      );

      for (const word of matching) {
        if (canPlaceWordHorizontal(row, col, word) && shouldPlace(row, col, word, 'horizontal')) {
          placeWordHorizontal(row, col, word);
          usedWords.add(word);
          placedWords.push({ word, direction: 'horizontal', row, col });
          break;
        }
      }
    }
  }

  // Try all vertical positions with pattern matching
  for (let col = 0; col < dimensions.cols; col++) {
    for (let row = 0; row < dimensions.rows; row++) {
      const pattern = getVerticalPattern(row, col);
      if (!pattern || pattern.length < 3) continue;

      const matching = words.filter(w =>
        w.length === pattern.length &&
        !usedWords.has(w) &&
        matchesPattern(w, pattern)
      );

      for (const word of matching) {
        if (canPlaceWordVertical(row, col, word) && shouldPlace(row, col, word, 'vertical')) {
          placeWordVertical(row, col, word);
          usedWords.add(word);
          placedWords.push({ word, direction: 'vertical', row, col });
          break;
        }
      }
    }
  }

  return placedWords;
}

// Print grid
function printGrid() {
  console.log('\n📊 Generated Grid:');
  console.log('┌' + '───┬'.repeat(xw.cols - 1) + '───┐');
  for (let i = 0; i < xw.rows; i++) {
    const row = xw.fill[i].split('').map(c => c === ' ' ? ' ' : c).join(' │ ');
    console.log('│ ' + row + ' │');
    if (i < xw.rows - 1) {
      console.log('├' + '───┼'.repeat(xw.cols - 1) + '───┤');
    }
  }
  console.log('└' + '───┴'.repeat(xw.cols - 1) + '───┘');
}

// Validate quality
function validateQuality(placedWords) {
  console.log('\n✅ Quality Validation:');

  // Check for duplicates
  const wordCounts = {};
  placedWords.forEach(({word}) => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });

  const duplicates = Object.entries(wordCounts).filter(([w, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`   ❌ Duplicate words found: ${duplicates.map(([w, c]) => `${w}(×${c})`).join(', ')}`);
  } else {
    console.log('   ✅ No duplicate words');
  }

  // Check word count
  console.log(`   ✅ Total words placed: ${placedWords.length}`);

  // List all words
  console.log(`   ✅ Words: ${placedWords.map(p => p.word).join(', ')}`);

  // Check coverage
  const totalCells = xw.rows * xw.cols;
  let filledCells = 0;
  for (let i = 0; i < xw.rows; i++) {
    for (let j = 0; j < xw.cols; j++) {
      if (xw.fill[i][j] !== ' ') filledCells++;
    }
  }
  const coverage = (filledCells / totalCells * 100).toFixed(1);
  console.log(`   ✅ Grid coverage: ${coverage}% (${filledCells}/${totalCells} cells)`);

  return duplicates.length === 0 && placedWords.length >= 4;
}

// Main test
async function runTest() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  AUTOMATED GENERATION QUALITY TEST');
  console.log('  Theme: "love and intimacy"');
  console.log('  Grid: 5×6');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Step 1: Analyze theme
    console.log('\n🔷 Step 1: Analyzing theme...');
    const themeData = await analyzeTheme('love and intimacy', 'medium');
    console.log(`   ✅ Generated ${Object.values(themeData).flat().length} words`);

    // Step 2: Score words
    console.log('\n🔷 Step 2: Scoring words...');
    const scoredWords = scoreWords(themeData, { rows: 5, cols: 6 });
    console.log(`   ✅ ${scoredWords.length} words suitable for 5×6 grid`);
    console.log(`   Top 10: ${scoredWords.slice(0, 10).map(w => w.word).join(', ')}`);

    // Step 3: Fill grid
    console.log('\n🔷 Step 3: Filling grid...');
    const placedWords = fillGrid(scoredWords, { rows: 5, cols: 6 });
    console.log(`   ✅ Placed ${placedWords.length} words`);

    // Step 4: Display
    printGrid();

    // Step 5: Validate
    const isValid = validateQuality(placedWords);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (isValid) {
      console.log('✅ TEST PASSED - Quality is acceptable!');
    } else {
      console.log('❌ TEST FAILED - Quality issues detected');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(isValid ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
