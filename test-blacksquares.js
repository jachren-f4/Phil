#!/usr/bin/env node
// Quick test with black squares
const http = require('http');
const fs = require('fs');

const xw = { rows: 5, cols: 6, fill: [] };
for (let i = 0; i < xw.rows; i++) {
  xw.fill.push(' '.repeat(xw.cols));
}

// Simulate some initial words
xw.fill[0] = 'WOO   ';
xw.fill[2] = 'LOVE  ';
xw.fill[4] = 'DATE  ';
// Add KISS vertically
xw.fill[0] = xw.fill[0].substring(0, 4) + 'K' + xw.fill[0].substring(5);
xw.fill[1] = xw.fill[1].substring(0, 4) + 'I' + xw.fill[1].substring(5);
xw.fill[2] = xw.fill[2].substring(0, 4) + 'S' + xw.fill[2].substring(5);
xw.fill[3] = xw.fill[3].substring(0, 4) + 'S' + xw.fill[3].substring(5);

console.log('Before black squares:');
for (let i = 0; i < xw.rows; i++) {
  console.log(`  Row ${i}: "${xw.fill[i]}"`);
}

// Add strategic black squares
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
const numBlackSquares = Math.floor(xw.rows * xw.cols * 0.15);

console.log(`\nAdding ${numBlackSquares} black square pairs...`);
for (let i = 0; i < numBlackSquares && i < candidates.length; i++) {
  const { row, col } = candidates[i];
  xw.fill[row] = xw.fill[row].substring(0, col) + '.' + xw.fill[row].substring(col + 1);
  
  const symRow = xw.rows - 1 - row;
  const symCol = xw.cols - 1 - col;
  if (xw.fill[symRow][symCol] === ' ') {
    xw.fill[symRow] = xw.fill[symRow].substring(0, symCol) + '.' + xw.fill[symRow].substring(symCol + 1);
  }
  console.log(`  Placed at (${row},${col}) and (${symRow},${symCol})`);
}

console.log('\nAfter black squares:');
for (let i = 0; i < xw.rows; i++) {
  console.log(`  Row ${i}: "${xw.fill[i]}"`);
}

let blackCount = 0;
for (let i = 0; i < xw.rows; i++) {
  for (let j = 0; j < xw.cols; j++) {
    if (xw.fill[i][j] === '.') blackCount++;
  }
}
console.log(`\nBlack squares: ${blackCount} (${(blackCount/30*100).toFixed(1)}%)`);
