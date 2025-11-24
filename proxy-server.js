#!/usr/bin/env node
// Simple proxy server for OpenAI API calls
// This prevents CORS issues and keeps the API key secure

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

// Load config
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (error) {
  console.error('Failed to load config.json:', error.message);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Only accept POST requests to /api/chat
  if (req.method !== 'POST' || req.url !== '/api/chat') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const requestData = JSON.parse(body);

      // Validate request
      if (!requestData.messages || !Array.isArray(requestData.messages)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request: messages array required' }));
        return;
      }

      // Prepare OpenAI API request
      const openaiData = {
        model: requestData.model || config.openai.model,
        messages: requestData.messages,
        temperature: requestData.temperature !== undefined ? requestData.temperature : config.openai.temperature,
        max_tokens: requestData.max_tokens || config.openai.max_tokens
      };

      const postData = JSON.stringify(openaiData);

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

      console.log(`[${new Date().toISOString()}] Proxying request to OpenAI (${openaiData.model})...`);

      const proxyReq = https.request(options, (proxyRes) => {
        let responseData = '';

        proxyRes.on('data', (chunk) => {
          responseData += chunk;
        });

        proxyRes.on('end', () => {
          console.log(`[${new Date().toISOString()}] OpenAI response received (status: ${proxyRes.statusCode})`);

          res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(responseData);
        });
      });

      proxyReq.on('error', (error) => {
        console.error('Proxy request error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy request failed', details: error.message }));
      });

      proxyReq.write(postData);
      proxyReq.end();

    } catch (error) {
      console.error('Error processing request:', error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

server.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  OpenAI Proxy Server Running');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Port: ${PORT}`);
  console.log(`  Model: ${config.openai.model}`);
  console.log(`  Fallback: ${config.openai.fallback_model}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Waiting for requests...\n');
});
