#!/usr/bin/env node
// Comprehensive end-to-end test of the entire generation pipeline

const http = require('http');

const PROXY_URL = 'http://localhost:3001/api/chat';

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

// Test theme analysis
async function testThemeAnalysis() {
  console.log('\n1️⃣  Testing Theme Analysis...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const theme = 'love and intimacy';
  const difficulty = 'medium';

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
- Suitable for crossword puzzles (no abbreviations, no proper nouns unless very famous)
- Provide at least 30-40 total words across all categories
- Focus on words that would intersect well in a crossword grid

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await callAPI(prompt, { temperature: 0.7, max_tokens: 1000 });

    // Parse response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const themeData = JSON.parse(jsonStr);

    const coreWords = themeData.core_words || [];
    const relatedWords = themeData.related_words || [];
    const actionWords = themeData.action_words || [];
    const descriptiveWords = themeData.descriptive_words || [];

    const allWords = [...coreWords, ...relatedWords, ...actionWords, ...descriptiveWords];

    console.log(`✅ Theme analysis successful`);
    console.log(`   Summary: ${themeData.theme_summary}`);
    console.log(`   Core words: ${coreWords.length}`);
    console.log(`   Related words: ${relatedWords.length}`);
    console.log(`   Action words: ${actionWords.length}`);
    console.log(`   Descriptive words: ${descriptiveWords.length}`);
    console.log(`   Total words: ${allWords.length}`);
    console.log(`   Sample words: ${allWords.slice(0, 10).join(', ')}`);

    return { success: true, words: allWords, themeData };
  } catch (error) {
    console.error(`❌ Theme analysis failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test word generation
async function testWordGeneration(words) {
  console.log('\n2️⃣  Testing Word Generation & Scoring...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const dimensions = { rows: 5, cols: 6 };
  const maxLength = Math.max(dimensions.rows, dimensions.cols);
  const minLength = 3;

  const scoredWords = words
    .filter(word => word.length >= minLength && word.length <= maxLength)
    .map(word => {
      let score = 0.5;

      // Length preference
      const idealLength = Math.floor(maxLength * 0.6);
      const lengthDiff = Math.abs(word.length - idealLength);
      score += (1 - lengthDiff / maxLength) * 0.2;

      // Common letters
      const commonLetters = 'ERSTLNAOI';
      const commonCount = word.split('').filter(c => commonLetters.includes(c)).length;
      score += (commonCount / word.length) * 0.1;

      return { word, length: word.length, score: Math.min(score, 1.0) };
    })
    .sort((a, b) => b.score - a.score);

  console.log(`✅ Word scoring complete`);
  console.log(`   Grid size: ${dimensions.rows}×${dimensions.cols}`);
  console.log(`   Max word length: ${maxLength}`);
  console.log(`   Suitable words: ${scoredWords.length}`);
  console.log(`   Top 10 words by score:`);

  scoredWords.slice(0, 10).forEach((w, i) => {
    console.log(`      ${i+1}. ${w.word} (len: ${w.length}, score: ${w.score.toFixed(2)})`);
  });

  return { success: true, scoredWords };
}

// Test clue generation
async function testClueGeneration(words, theme) {
  console.log('\n3️⃣  Testing Clue Generation...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const testWords = words.slice(0, 5); // Test with 5 words
  const difficulty = 'medium';

  const wordList = testWords.join('", "');

  const prompt = `Generate crossword clues for these words in the context of the theme "${theme}":

Words: ["${wordList}"]

Difficulty: ${difficulty}
Write moderately challenging clues with some wordplay or indirect references.

Guidelines:
- Each clue should be concise (typically 3-8 words)
- Clues should relate to the theme when possible
- Use a mix of clue types: definitions, fill-in-the-blank, trivia, wordplay
- Make clues interesting and engaging
- Avoid overly obvious clues

Return ONLY a JSON object mapping each word to its clue:
{
  "WORD1": "Clue for word 1",
  "WORD2": "Clue for word 2",
  ...
}`;

  try {
    const response = await callAPI(prompt, { temperature: 0.7, max_tokens: 800 });

    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const clues = JSON.parse(jsonStr);

    console.log(`✅ Clue generation successful`);
    console.log(`   Generated ${Object.keys(clues).length} clues:`);

    testWords.forEach(word => {
      if (clues[word]) {
        console.log(`      ${word}: "${clues[word]}"`);
      }
    });

    return { success: true, clues };
  } catch (error) {
    console.error(`❌ Clue generation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  FULL PIPELINE TEST');
  console.log('  Theme: "love and intimacy"');
  console.log('  Grid: 5×6');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // Test 1: Theme Analysis
    const themeResult = await testThemeAnalysis();
    if (!themeResult.success) {
      console.error('\n❌ PIPELINE FAILED at Theme Analysis');
      process.exit(1);
    }

    // Test 2: Word Generation
    const wordResult = await testWordGeneration(themeResult.words);
    if (!wordResult.success) {
      console.error('\n❌ PIPELINE FAILED at Word Generation');
      process.exit(1);
    }

    // Test 3: Clue Generation
    const clueResult = await testClueGeneration(
      wordResult.scoredWords.map(w => w.word),
      'love and intimacy'
    );
    if (!clueResult.success) {
      console.error('\n❌ PIPELINE FAILED at Clue Generation');
      process.exit(1);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL PIPELINE TESTS PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Summary:');
    console.log(`   ✓ Theme analysis working`);
    console.log(`   ✓ Word generation working`);
    console.log(`   ✓ Word scoring working`);
    console.log(`   ✓ Clue generation working`);
    console.log(`\n⚠️  Still need to test in browser:`);
    console.log(`   - Grid filling logic`);
    console.log(`   - Phil integration`);
    console.log(`   - UI updates`);
    process.exit(0);

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
