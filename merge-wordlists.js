#!/usr/bin/env node
// Merge love-intimacy and sex wordlists

const fs = require('fs');

console.log('🔨 Merging Word Lists...\n');

// Load both wordlists
const loveList = JSON.parse(fs.readFileSync('./wordlist-love-intimacy.json', 'utf8'));
const sexList = JSON.parse(fs.readFileSync('./wordlist-sex.json', 'utf8'));

console.log(`📚 Love/Intimacy words: ${Object.keys(loveList.words).length}`);
console.log(`📚 Sex words: ${Object.keys(sexList.words).length}`);

// Merge words (love-intimacy words take precedence if duplicates)
const mergedWords = { ...loveList.words };
let added = 0;
let duplicates = 0;

for (const [word, data] of Object.entries(sexList.words)) {
  if (!mergedWords[word]) {
    mergedWords[word] = data;
    added++;
  } else {
    duplicates++;
    console.log(`   ⚠️  Duplicate: ${word} (keeping original)`);
  }
}

// Create merged wordlist
const combined = {
  theme: "love-intimacy-and-sex",
  description: "Combined word list: romantic love, intimacy, and explicit sexual content",
  words: mergedWords
};

// Save merged wordlist
fs.writeFileSync('./wordlist-combined.json', JSON.stringify(combined, null, 2));

console.log(`\n✅ Merged wordlist created:`);
console.log(`   Total words: ${Object.keys(mergedWords).length}`);
console.log(`   Added from sex list: ${added}`);
console.log(`   Duplicates skipped: ${duplicates}`);
console.log(`   Saved to: wordlist-combined.json`);
