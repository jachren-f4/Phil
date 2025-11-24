#!/usr/bin/env node
// Test the theme UI and generation flow

const fs = require('fs');
const https = require('https');

console.log('🧪 Testing Theme UI and Generation Flow...\n');

// Load config
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

console.log('1️⃣  Testing theme analysis with OpenAI...');

const testTheme = 'space exploration';
const themePrompt = `You are helping create a crossword puzzle with the theme: "${testTheme}"

Difficulty level: medium
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

const requestBody = {
  model: config.openai.model,
  messages: [
    { role: 'system', content: 'You are a crossword puzzle assistant. Always respond with valid JSON.' },
    { role: 'user', content: themePrompt }
  ],
  max_tokens: 1000,
  temperature: 0.7
};

const postData = JSON.stringify(requestBody);

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.openai.api_key}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        const content = response.choices[0].message.content;

        console.log('   ✅ API response received');

        // Try to parse the theme data
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        }

        const themeData = JSON.parse(jsonStr);

        console.log(`   ✅ Theme data parsed successfully`);
        console.log(`   📝 Theme: ${testTheme}`);
        console.log(`   📝 Summary: ${themeData.theme_summary}`);
        console.log(`   📝 Core words: ${themeData.core_words?.length || 0}`);
        console.log(`   📝 Related words: ${themeData.related_words?.length || 0}`);
        console.log(`   📝 Action words: ${themeData.action_words?.length || 0}`);
        console.log(`   📝 Descriptive words: ${themeData.descriptive_words?.length || 0}`);

        const totalWords = [
          ...(themeData.core_words || []),
          ...(themeData.related_words || []),
          ...(themeData.action_words || []),
          ...(themeData.descriptive_words || [])
        ].length;

        console.log(`   📊 Total words generated: ${totalWords}`);
        console.log(`   💰 Tokens used: ${response.usage.total_tokens}`);

        if (totalWords >= 30) {
          console.log('\n✅ THEME UI TEST PASSED!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✓ Theme analysis works');
          console.log('✓ JSON parsing works');
          console.log('✓ Generated sufficient words for crossword');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('\n🎉 Ready to test in browser!');
          console.log('   Open: http://localhost:8000');
          console.log('   Enter theme: "space exploration"');
          console.log('   Click: Generate with AI');
          process.exit(0);
        } else {
          console.error(`\n   ⚠️  Warning: Only generated ${totalWords} words (need 30+)`);
          process.exit(1);
        }

      } catch (error) {
        console.error('   ❌ Failed to parse response:', error.message);
        console.error('   Response:', data);
        process.exit(1);
      }
    } else {
      console.error(`   ❌ API returned status ${res.statusCode}`);
      console.error('   Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('   ❌ Request failed:', error.message);
  process.exit(1);
});

req.write(postData);
req.end();
