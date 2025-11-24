#!/usr/bin/env node
// Quick test of pattern matching

function matchesPattern(word, pattern) {
  if (word.length !== pattern.length) return false;
  for (let i = 0; i < word.length; i++) {
    if (pattern[i] !== '_' && pattern[i] !== word[i]) {
      return false;
    }
  }
  return true;
}

console.log('Testing pattern matching:');
console.log('');
console.log('Pattern "__VE" matches:');
const words = ['LOVE', 'HAVE', 'GAVE', 'SAVE', 'LIVE', 'FIVE', 'DOVE', 'MOVE', 'KISS', 'DATE'];
words.forEach(w => {
  if (matchesPattern(w, '__VE')) {
    console.log(`  ✅ ${w}`);
  }
});

console.log('');
console.log('Pattern "S_X_" matches:');
['SEXY', 'TAXI', 'SIXS', 'SEXT'].forEach(w => {
  if (matchesPattern(w, 'S_X_')) {
    console.log(`  ✅ ${w}`);
  }
});

console.log('');
console.log('Pattern "L_VE" matches:');
words.forEach(w => {
  if (matchesPattern(w, 'L_VE')) {
    console.log(`  ✅ ${w}`);
  }
});
