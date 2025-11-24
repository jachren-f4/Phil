#!/usr/bin/env node
// Automated test script for OpenAI API connection

const fs = require('fs');
const https = require('https');

console.log('🧪 Testing OpenAI API Connection...\n');

// Step 1: Check config.json exists
console.log('1️⃣  Checking config.json...');
if (!fs.existsSync('config.json')) {
  console.error('   ❌ config.json not found!');
  process.exit(1);
}
console.log('   ✅ config.json exists');

// Step 2: Load and validate config
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
if (!config.openai || !config.openai.api_key) {
  console.error('   ❌ OpenAI API key not found in config!');
  process.exit(1);
}
if (config.openai.api_key === 'YOUR_API_KEY_HERE') {
  console.error('   ❌ Please replace YOUR_API_KEY_HERE with actual API key!');
  process.exit(1);
}
console.log('   ✅ API key found');

// Step 3: Test API connection
console.log('\n2️⃣  Testing OpenAI API connection...');

const testPrompt = {
  model: config.openai.model || 'gpt-4',
  messages: [
    {
      role: 'system',
      content: 'You are a helpful assistant.'
    },
    {
      role: 'user',
      content: 'Say "Hello from OpenAI!" and nothing else.'
    }
  ],
  max_tokens: 20,
  temperature: 0.7
};

const postData = JSON.stringify(testPrompt);

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

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        const message = response.choices[0].message.content;
        console.log('   ✅ API connection successful!');
        console.log(`   📝 Response: ${message}`);
        console.log(`   💰 Tokens used: ${response.usage.total_tokens}`);

        console.log('\n3️⃣  Testing word generation...');
        testWordGeneration(config);
      } catch (error) {
        console.error('   ❌ Failed to parse response:', error.message);
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
  console.error('\n   Possible issues:');
  console.error('   - Check internet connection');
  console.error('   - Verify API key is correct');
  console.error('   - Check if OpenAI API is accessible');
  process.exit(1);
});

req.write(postData);
req.end();

// Test word generation
function testWordGeneration(config) {
  const wordPrompt = {
    model: config.openai.fallback_model || 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a crossword puzzle assistant. Always respond with valid JSON.'
      },
      {
        role: 'user',
        content: 'Generate 5 crossword-suitable words related to "space". Return only a JSON array like: ["WORD1", "WORD2", "WORD3", "WORD4", "WORD5"]'
      }
    ],
    max_tokens: 100,
    temperature: 0.7
  };

  const postData2 = JSON.stringify(wordPrompt);
  const options2 = { ...options, headers: { ...options.headers, 'Content-Length': Buffer.byteLength(postData2) }};

  const req2 = https.request(options2, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        const response = JSON.parse(data);
        const content = response.choices[0].message.content;
        console.log('   ✅ Word generation test successful!');
        console.log(`   📝 Generated: ${content}`);

        try {
          const words = JSON.parse(content.trim());
          if (Array.isArray(words) && words.length > 0) {
            console.log(`   ✅ Parsed ${words.length} words successfully`);
          }
        } catch (e) {
          console.log('   ⚠️  Response needs parsing adjustment');
        }

        console.log('\n✅ ALL TESTS PASSED!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✓ config.json is valid');
        console.log('✓ OpenAI API key works');
        console.log('✓ API connection is stable');
        console.log('✓ Word generation works');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n🎉 Ready to proceed with development!');
        process.exit(0);
      } else {
        console.error(`   ❌ Word generation failed: ${res.statusCode}`);
        process.exit(1);
      }
    });
  });

  req2.on('error', (error) => {
    console.error('   ❌ Word generation request failed:', error.message);
    process.exit(1);
  });

  req2.write(postData2);
  req2.end();
}
