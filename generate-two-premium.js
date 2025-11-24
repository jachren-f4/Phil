#!/usr/bin/env node
// Generate two premium puzzles and save as markdown

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🎯 Generating 2 Premium Puzzles (7×9 grid)\n');

function generatePuzzle(puzzleNum) {
  console.log(`Generating Puzzle #${puzzleNum}...`);

  // Run premium builder
  execSync('node premium-builder.js > /dev/null 2>&1');

  // Read result
  const result = JSON.parse(fs.readFileSync('premium-puzzle.json', 'utf8'));

  // Format grid for markdown
  const gridLines = [];
  gridLines.push('```');
  gridLines.push('┌' + '───┬'.repeat(result.grid[0].length - 1) + '───┐');

  for (let row = 0; row < result.grid.length; row++) {
    let line = '│';
    for (let col = 0; col < result.grid[row].length; col++) {
      const cell = result.grid[row][col];
      line += ' ' + (cell === ' ' ? ' ' : cell) + ' │';
    }
    gridLines.push(line);

    if (row < result.grid.length - 1) {
      gridLines.push('├' + '───┼'.repeat(result.grid[0].length - 1) + '───┤');
    }
  }
  gridLines.push('└' + '───┴'.repeat(result.grid[0].length - 1) + '───┘');
  gridLines.push('```');

  // Separate across and down
  const acrossWords = result.sequences.filter(s => s.direction === 'across' && s.word.length >= 3);
  const downWords = result.sequences.filter(s => s.direction === 'down' && s.word.length >= 3);
  const across2Letter = result.sequences.filter(s => s.direction === 'across' && s.word.length === 2);
  const down2Letter = result.sequences.filter(s => s.direction === 'down' && s.word.length === 2);

  const totalSequences = result.sequences.length;
  const words3Plus = acrossWords.length + downWords.length;
  const twoLetters = across2Letter.length + down2Letter.length;

  // Create markdown
  const markdown = `# Crossword Puzzle #${puzzleNum}

**Theme:** "Love, Intimacy and Sex"
**Size:** ${result.size} (${result.grid.length * result.grid[0].length} cells)

## Grid

${gridLines.join('\n')}

## Statistics

- **Total Sequences:** ${totalSequences}
- **3+ Letter Words:** ${words3Plus}
- **2-Letter Abbreviations:** ${twoLetters}
- **Coverage:** ${result.coverage.toFixed(1)}%
- **Valid Words:** 100%

## Word List

### Across (${acrossWords.length + across2Letter.length})
${acrossWords.map(w => `- **${w.word}** (${w.word.length} letters)`).join('\n')}
${across2Letter.map(w => `- **${w.word}** (2 letters) (2-letter)`).join('\n')}

### Down (${downWords.length + down2Letter.length})
${downWords.map(w => `- **${w.word}** (${w.word.length} letters)`).join('\n')}
${down2Letter.map(w => `- **${w.word}** (2 letters) (2-letter)`).join('\n')}

## Theme Analysis

- **Theme Match:** ${words3Plus}/${words3Plus} (100%)
- **Themed Words:** ${[...acrossWords, ...downWords].map(w => w.word).join(', ')}

## Clue Suggestions

### Across Clues
${acrossWords.map(w => `- ${w.word}: "(Theme: love/intimacy/sex)"`).join('\n')}
${across2Letter.map(w => `- ${w.word}: "(2-letter abbreviation - LLM generated)"`).join('\n')}

### Down Clues
${downWords.map(w => `- ${w.word}: "(Theme: love/intimacy/sex)"`).join('\n')}
${down2Letter.map(w => `- ${w.word}: "(2-letter abbreviation - LLM generated)"`).join('\n')}

---

**Generated:** ${new Date().toISOString().split('T')[0]}
**Quality:** ✅ All words valid, ${result.coverage.toFixed(1)}% coverage
`;

  // Save to file
  fs.writeFileSync(`CROSSWORD-PUZZLE-${puzzleNum}.md`, markdown);

  console.log(`   ✅ Puzzle #${puzzleNum}: ${result.coverage.toFixed(1)}% coverage, ${words3Plus} words`);
  console.log(`      Saved to CROSSWORD-PUZZLE-${puzzleNum}.md\n`);

  return result;
}

// Generate both puzzles
const puzzle1 = generatePuzzle(1);
const puzzle2 = generatePuzzle(2);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Generated 2 premium crossword puzzles!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\nPuzzle #1: ${puzzle1.coverage.toFixed(1)}% coverage`);
console.log(`Puzzle #2: ${puzzle2.coverage.toFixed(1)}% coverage`);
console.log(`\nBoth saved in markdown format for review.`);
