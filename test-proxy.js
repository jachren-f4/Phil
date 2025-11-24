#!/usr/bin/env node
// Test the proxy server

const http = require('http');

const postData = JSON.stringify({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Say "Hello, proxy is working!" and nothing else.' }
  ],
  max_tokens: 20
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing proxy server...');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        const message = response.choices[0].message.content;
        console.log('✅ Proxy test successful!');
        console.log(`Response: ${message}`);
        process.exit(0);
      } catch (error) {
        console.error('❌ Failed to parse response:', error.message);
        console.error('Raw response:', data);
        process.exit(1);
      }
    } else {
      console.error(`❌ Proxy returned status ${res.statusCode}`);
      console.error('Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  process.exit(1);
});

req.write(postData);
req.end();
