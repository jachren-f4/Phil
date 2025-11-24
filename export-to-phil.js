#!/usr/bin/env node
// Export premium puzzles to Phil's .xw JSON format

const fs = require('fs');

console.log('📤 Exporting Puzzles to Phil Format\n');

function parseMarkdownPuzzle(filename) {
  const content = fs.readFileSync(filename, 'utf8');

  // Extract grid
  const gridMatch = content.match(/```\n([\s\S]+?)\n```/);
  if (!gridMatch) throw new Error('Could not find grid in markdown');

  const gridLines = gridMatch[1].split('\n').filter(line => line.includes('│') && !line.includes('┌') && !line.includes('└') && !line.includes('├'));
  const grid = [];

  gridLines.forEach(row => {
    const cells = row.split('│').slice(1, -1); // Remove first and last empty elements
    cells.forEach(cell => {
      const letter = cell.trim();
      grid.push(letter === '' ? ' ' : letter);
    });
  });

  // Extract dimensions from "Size: 7×9"
  const sizeMatch = content.match(/Size:\*\* (\d+)×(\d+)/);
  const rows_count = parseInt(sizeMatch[1]);
  const cols_count = parseInt(sizeMatch[2]);

  // Extract title
  const titleMatch = content.match(/# Crossword Puzzle #(\d+)/);
  const puzzleNum = titleMatch[1];

  // Extract clues
  const acrossSection = content.match(/### Across Clues\n([\s\S]+?)(?=\n### Down Clues)/);
  const downSection = content.match(/### Down Clues\n([\s\S]+?)(?=\n---)/);

  const acrossClues = [];
  const downClues = [];

  if (acrossSection) {
    const clueLines = acrossSection[1].trim().split('\n');
    clueLines.forEach(line => {
      const match = line.match(/- ([A-Z0-9]+): "(.+)"/);
      if (match) {
        // We'll need to add numbers later when we know word positions
        acrossClues.push({ word: match[1], clue: match[2] });
      }
    });
  }

  if (downSection) {
    const clueLines = downSection[1].trim().split('\n');
    clueLines.forEach(line => {
      const match = line.match(/- ([A-Z0-9]+): "(.+)"/);
      if (match) {
        downClues.push({ word: match[1], clue: match[2] });
      }
    });
  }

  return {
    puzzleNum,
    rows: rows_count,
    cols: cols_count,
    grid,
    acrossClues,
    downClues
  };
}

function findWordStarts(grid, rows, cols) {
  const starts = [];
  let label = 1;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const idx = i * cols + j;
      if (grid[idx] === '.' || grid[idx] === ' ') continue;

      let isAcrossStart = false;
      let isDownStart = false;

      // Check if this is start of across word
      if (j === 0 || grid[i * cols + (j - 1)] === ' ' || grid[i * cols + (j - 1)] === '.') {
        // Check if there's at least one more letter to the right
        if (j < cols - 1 && grid[i * cols + (j + 1)] !== ' ' && grid[i * cols + (j + 1)] !== '.') {
          isAcrossStart = true;
        }
      }

      // Check if this is start of down word
      if (i === 0 || grid[(i - 1) * cols + j] === ' ' || grid[(i - 1) * cols + j] === '.') {
        // Check if there's at least one more letter below
        if (i < rows - 1 && grid[(i + 1) * cols + j] !== ' ' && grid[(i + 1) * cols + j] !== '.') {
          isDownStart = true;
        }
      }

      if (isAcrossStart || isDownStart) {
        starts.push({
          label,
          row: i,
          col: j,
          isAcrossStart,
          isDownStart
        });
        label++;
      }
    }
  }

  return starts;
}

function getWordAtPosition(grid, rows, cols, row, col, direction) {
  let word = '';

  if (direction === 'across') {
    for (let c = col; c < cols; c++) {
      const cell = grid[row * cols + c];
      if (cell === ' ' || cell === '.') break;
      word += cell;
    }
  } else { // down
    for (let r = row; r < rows; r++) {
      const cell = grid[r * cols + col];
      if (cell === ' ' || cell === '.') break;
      word += cell;
    }
  }

  return word;
}

function convertToPhilFormat(puzzleData) {
  const { puzzleNum, rows, cols, grid, acrossClues, downClues } = puzzleData;

  // Find all word starts
  const starts = findWordStarts(grid, rows, cols);

  // Build clue arrays with labels
  const philAcross = [];
  const philDown = [];

  starts.forEach(start => {
    if (start.isAcrossStart) {
      const word = getWordAtPosition(grid, rows, cols, start.row, start.col, 'across');
      const clueData = acrossClues.find(c => c.word === word);
      if (clueData && word.length >= 3) {
        philAcross.push(`${start.label}. ${clueData.clue}`);
      } else if (word.length === 2) {
        philAcross.push(`${start.label}. ${word} (abbreviation)`);
      }
    }

    if (start.isDownStart) {
      const word = getWordAtPosition(grid, rows, cols, start.row, start.col, 'down');
      const clueData = downClues.find(c => c.word === word);
      if (clueData && word.length >= 3) {
        philDown.push(`${start.label}. ${clueData.clue}`);
      } else if (word.length === 2) {
        philDown.push(`${start.label}. ${word} (abbreviation)`);
      }
    }
  });

  // Create Phil format
  const phil = {
    title: `Love & Intimacy Puzzle #${puzzleNum}`,
    author: "Premium Crossword Builder",
    size: {
      rows: rows,
      cols: cols
    },
    grid: grid,
    clues: {
      across: philAcross,
      down: philDown
    }
  };

  return phil;
}

// Export both puzzles
try {
  console.log('Converting Puzzle #1...');
  const puzzle1 = parseMarkdownPuzzle('CROSSWORD-PUZZLE-1.md');
  const phil1 = convertToPhilFormat(puzzle1);
  fs.writeFileSync('puzzle-1.xw', JSON.stringify(phil1, null, 2));
  console.log(`✅ Exported puzzle-1.xw`);
  console.log(`   Size: ${phil1.size.rows}×${phil1.size.cols}`);
  console.log(`   Across clues: ${phil1.clues.across.length}`);
  console.log(`   Down clues: ${phil1.clues.down.length}\n`);

  console.log('Converting Puzzle #2...');
  const puzzle2 = parseMarkdownPuzzle('CROSSWORD-PUZZLE-2.md');
  const phil2 = convertToPhilFormat(puzzle2);
  fs.writeFileSync('puzzle-2.xw', JSON.stringify(phil2, null, 2));
  console.log(`✅ Exported puzzle-2.xw`);
  console.log(`   Size: ${phil2.size.rows}×${phil2.size.cols}`);
  console.log(`   Across clues: ${phil2.clues.across.length}`);
  console.log(`   Down clues: ${phil2.clues.down.length}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Both puzzles exported to Phil format!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nTo import into Phil:');
  console.log('1. Open Phil in your browser');
  console.log('2. Click "Open puzzle" button');
  console.log('3. Select puzzle-1.xw or puzzle-2.xw');
  console.log('\nNote: Phil only supports 15×15 grids by default.');
  console.log('These are 7×9 grids - may need Phil modification to open.');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
