#!/usr/bin/env node
// Build intersection database from word list

const fs = require('fs');

console.log('🔨 Building Intersection Database...\n');

// Load word list
const wordlistPath = './wordlist-combined.json';
const wordlist = JSON.parse(fs.readFileSync(wordlistPath, 'utf8'));

const words = Object.keys(wordlist.words);
console.log(`📚 Loaded ${words.length} words`);

// Build intersection database
const intersections = {};
const byLength = {};
const patterns = {};

// Initialize
for (const word of words) {
  intersections[word] = {};
  const len = word.length;
  if (!byLength[len]) byLength[len] = [];
  byLength[len].push(word);
}

console.log('\n🔍 Computing intersections...');
let totalIntersections = 0;

// For each word
for (let i = 0; i < words.length; i++) {
  const word1 = words[i];

  if (i % 100 === 0) {
    console.log(`   Progress: ${i}/${words.length} (${((i/words.length)*100).toFixed(1)}%)`);
  }

  // For each letter position in word1
  for (let pos1 = 0; pos1 < word1.length; pos1++) {
    const letter = word1[pos1];
    const key = `${letter}@${pos1}`;
    intersections[word1][key] = [];

    // Find all other words that share this letter
    for (const word2 of words) {
      if (word1 === word2) continue;

      // Check each position in word2
      for (let pos2 = 0; pos2 < word2.length; pos2++) {
        if (word2[pos2] === letter) {
          // These words can intersect!
          intersections[word1][key].push(`${word2}:${pos2}`);
          totalIntersections++;
        }
      }
    }
  }
}

console.log(`✅ Computed ${totalIntersections} total intersections`);

// Build pattern index
console.log('\n🎯 Building pattern index...');
let patternCount = 0;

// Generate all possible patterns for lengths 3-10
for (let length = 3; length <= 10; length++) {
  const wordsOfLength = byLength[length] || [];

  for (const word of wordsOfLength) {
    // Generate patterns with one unknown
    for (let i = 0; i < word.length; i++) {
      const pattern = word.substring(0, i) + '_' + word.substring(i + 1);
      if (!patterns[pattern]) {
        patterns[pattern] = [];
        patternCount++;
      }
      if (!patterns[pattern].includes(word)) {
        patterns[pattern].push(word);
      }
    }

    // Generate patterns with two unknowns (for more flexibility)
    for (let i = 0; i < word.length; i++) {
      for (let j = i + 1; j < word.length; j++) {
        let pattern = word.split('');
        pattern[i] = '_';
        pattern[j] = '_';
        pattern = pattern.join('');
        if (!patterns[pattern]) {
          patterns[pattern] = [];
          patternCount++;
        }
        if (!patterns[pattern].includes(word)) {
          patterns[pattern].push(word);
        }
      }
    }
  }
}

console.log(`✅ Generated ${patternCount} patterns`);

// Build final database with theme metadata
const metadata = {};
for (const word in wordlist.words) {
  metadata[word] = {
    themes: ['love'], // All words are love-themed
    category: wordlist.words[word].category,
    difficulty: wordlist.words[word].difficulty
  };
}

const database = {
  words: Object.keys(wordlist.words),
  metadata: metadata,
  intersections: intersections,
  byLength: byLength,
  patterns: patterns,
  theme: wordlist.theme,
  stats: {
    totalWords: words.length,
    totalIntersections: totalIntersections,
    totalPatterns: patternCount,
    generatedAt: new Date().toISOString()
  }
};

// Save to file
const outputPath = './crossword-database.json';
fs.writeFileSync(outputPath, JSON.stringify(database, null, 2));

const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
console.log(`\n💾 Database saved to ${outputPath} (${fileSizeKB} KB)`);

// Print statistics
console.log('\n📊 Database Statistics:');
console.log(`   Total words: ${database.stats.totalWords}`);
console.log(`   Total intersections: ${database.stats.totalIntersections}`);
console.log(`   Total patterns: ${database.stats.totalPatterns}`);
console.log(`   Average intersections per word: ${(totalIntersections / words.length).toFixed(1)}`);

// Sample some high-connectivity words
console.log('\n🌟 Top 10 most connectable words:');
const connectivity = words.map(word => {
  let count = 0;
  for (const key in intersections[word]) {
    count += intersections[word][key].length;
  }
  return { word, count };
}).sort((a, b) => b.count - a.count);

for (let i = 0; i < 10 && i < connectivity.length; i++) {
  console.log(`   ${i+1}. ${connectivity[i].word} (${connectivity[i].count} connections)`);
}

console.log('\n✅ Database build complete!');
