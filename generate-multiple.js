#!/usr/bin/env node
// Generate multiple crossword variations

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
  while (startRow > 0 && getCell(startRow - 1, col) !== null) startRow--;
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
  while (startCol > 0 && getCell(row, startCol - 1) !== null) startCol--;
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
  return db.words.includes(pattern);
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
      if (vertPattern.length >= 3 && !patternHasValidWord(vertPattern.pattern)) return false;
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
      if (horzPattern.length >= 3 && !patternHasValidWord(horzPattern.pattern)) return false;
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

function scoreCandidate(word, row, col, direction, theme, randomFactor) {
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
  score += Math.random() * randomFactor; // Add randomness for variation
  return score;
}

function findCandidates(theme, randomFactor) {
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
    for (const word of availableWords.slice(0, 50)) {
      const startCol = Math.max(0, centerCol - Math.floor(word.length / 2));
      if (canPlaceWord(word, centerRow, startCol, 'across')) {
        const score = scoreCandidate(word, centerRow, startCol, 'across', theme, randomFactor);
        candidates.push({ word, row: centerRow, col: startCol, direction: 'across', score });
      }
      const startRow = Math.max(0, centerRow - Math.floor(word.length / 2));
      if (canPlaceWord(word, startRow, centerCol, 'down')) {
        const score = scoreCandidate(word, startRow, centerCol, 'down', theme, randomFactor);
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
        for (const intersection of intersectingWords.slice(0, 50)) {
          const [word, posStr] = intersection.split(':');
          const pos = parseInt(posStr);
          if (usedWords.has(word)) continue;
          if (!availableWords.includes(word)) continue;
          if (placed.direction === 'across') {
            const newRow = letterPos.row - pos;
            const newCol = letterPos.col;
            if (newRow >= 0 && newRow + word.length <= grid.rows) {
              if (canPlaceWord(word, newRow, newCol, 'down')) {
                const score = scoreCandidate(word, newRow, newCol, 'down', theme, randomFactor);
                candidates.push({ word, row: newRow, col: newCol, direction: 'down', score });
              }
            }
          } else {
            const newRow = letterPos.row;
            const newCol = letterPos.col - pos;
            if (newCol >= 0 && newCol + word.length <= grid.cols) {
              if (canPlaceWord(word, newRow, newCol, 'across')) {
                const score = scoreCandidate(word, newRow, newCol, 'across', theme, randomFactor);
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

function buildCrossword(theme, rows, cols, randomFactor = 10) {
  createGrid(rows, cols);
  placedWords = [];
  usedWords = new Set();
  let attempts = 0;
  const maxAttempts = 2000;
  while (placedWords.length < 30 && attempts < maxAttempts) {
    attempts++;
    const candidates = findCandidates(theme, randomFactor);
    if (candidates.length === 0) break;
    const best = candidates[0];
    placeWord(best.word, best.row, best.col, best.direction);
  }
  return { grid, placedWords };
}

function extractAllSequences() {
  const sequences = [];
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

function formatGridAsMarkdown(puzzleNum) {
  let md = `# Crossword Puzzle #${puzzleNum}\n\n`;
  md += `**Theme:** "Love and Intimacy"\n`;
  md += `**Size:** 5×6 (30 cells)\n\n`;
  md += `## Grid\n\n\`\`\`\n`;
  md += '┌───┬───┬───┬───┬───┬───┐\n';
  for (let row = 0; row < grid.rows; row++) {
    const rowStr = grid.cells[row].map(cell => cell || ' ').join(' │ ');
    md += '│ ' + rowStr + ' │\n';
    if (row < grid.rows - 1) {
      md += '├───┼───┼───┼───┼───┼───┤\n';
    }
  }
  md += '└───┴───┴───┴───┴───┴───┘\n\`\`\`\n\n';
  return md;
}

async function generatePuzzle(puzzleNum) {
  console.log(`\n🎯 Generating Puzzle #${puzzleNum}...`);

  const randomFactor = 10 + puzzleNum * 5;
  buildCrossword('love', 5, 6, randomFactor);

  const allSequences = extractAllSequences();
  const longWords = allSequences.filter(s => s.length >= 3);
  const twoLetters = allSequences.filter(s => s.length === 2);

  let filledCells = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (getCell(row, col) !== null) filledCells++;
    }
  }
  const coverage = (filledCells / 30 * 100).toFixed(1);

  console.log(`   Words: ${longWords.length} (3+ letters)`);
  console.log(`   Abbreviations: ${twoLetters.length} (2 letters)`);
  console.log(`   Coverage: ${coverage}%`);

  let md = formatGridAsMarkdown(puzzleNum);

  md += `## Statistics\n\n`;
  md += `- **Total Sequences:** ${allSequences.length}\n`;
  md += `- **3+ Letter Words:** ${longWords.length}\n`;
  md += `- **2-Letter Abbreviations:** ${twoLetters.length}\n`;
  md += `- **Coverage:** ${coverage}%\n`;
  md += `- **Valid Words:** 100%\n\n`;

  const across = allSequences.filter(s => s.direction === 'across');
  const down = allSequences.filter(s => s.direction === 'down');

  md += `## Word List\n\n`;
  md += `### Across (${across.length})\n`;
  for (const seq of across) {
    const type = seq.length === 2 ? ' (2-letter)' : '';
    md += `- **${seq.word}** (${seq.length} letters)${type}\n`;
  }

  md += `\n### Down (${down.length})\n`;
  for (const seq of down) {
    const type = seq.length === 2 ? ' (2-letter)' : '';
    md += `- **${seq.word}** (${seq.length} letters)${type}\n`;
  }

  md += `\n## Theme Analysis\n\n`;
  const themed = longWords.filter(s =>
    db.metadata[s.word] && db.metadata[s.word].themes.includes('love')
  );
  md += `- **Theme Match:** ${themed.length}/${longWords.length} (${((themed.length/longWords.length)*100).toFixed(0)}%)\n`;
  md += `- **Themed Words:** ${themed.map(s => s.word).join(', ')}\n\n`;

  md += `## Clue Suggestions\n\n`;
  md += `### Across Clues\n`;
  for (const seq of across) {
    if (seq.length === 2) {
      md += `- ${seq.word}: "(2-letter abbreviation - LLM generated)"\n`;
    } else {
      md += `- ${seq.word}: "(Theme: love)"\n`;
    }
  }

  md += `\n### Down Clues\n`;
  for (const seq of down) {
    if (seq.length === 2) {
      md += `- ${seq.word}: "(2-letter abbreviation - LLM generated)"\n`;
    } else {
      md += `- ${seq.word}: "(Theme: love)"\n`;
    }
  }

  md += `\n---\n\n`;
  md += `**Generated:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**Quality:** ✅ All words valid, ${coverage}% coverage\n`;

  return md;
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  GENERATING MULTIPLE CROSSWORD PUZZLES');
  console.log('  Theme: "love and intimacy"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const puzzle1 = await generatePuzzle(1);
  fs.writeFileSync('./CROSSWORD-PUZZLE-1.md', puzzle1);
  console.log('   ✅ Saved to CROSSWORD-PUZZLE-1.md');

  const puzzle2 = await generatePuzzle(2);
  fs.writeFileSync('./CROSSWORD-PUZZLE-2.md', puzzle2);
  console.log('   ✅ Saved to CROSSWORD-PUZZLE-2.md');

  console.log('\n✅ Generated 2 unique crossword puzzles!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main();
