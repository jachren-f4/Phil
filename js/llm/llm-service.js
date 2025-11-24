// LLM Service - OpenAI Integration
// Handles all AI API interactions for crossword generation

class LLMService {
  constructor() {
    this.config = null;
    this.cache = new Map();
    this.isInitialized = false;
  }

  // Initialize the service by loading config
  async initialize() {
    try {
      const response = await fetch('config.json');
      if (!response.ok) {
        throw new Error('Failed to load config.json');
      }
      this.config = await response.json();
      this.isInitialized = true;
      console.log('LLM Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize LLM Service:', error);
      throw new Error('Please ensure config.json exists with your OpenAI API key');
    }
  }

  // Check if service is ready
  isReady() {
    return this.isInitialized && this.config && this.config.openai.api_key;
  }

  // Generate cache key from prompt and params
  getCacheKey(prompt, params = {}) {
    const key = JSON.stringify({ prompt, ...params });
    return key;
  }

  // Check cache for existing response
  getFromCache(cacheKey) {
    if (!this.config.cache.enabled) return null;

    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    const age = (now - cached.timestamp) / 1000 / 60; // age in minutes

    if (age > this.config.cache.ttl_minutes) {
      this.cache.delete(cacheKey);
      return null;
    }

    console.log(`Cache hit (age: ${age.toFixed(1)}min)`);
    return cached.data;
  }

  // Save response to cache
  saveToCache(cacheKey, data) {
    if (!this.config.cache.enabled) return;

    this.cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }

  // Main method to call OpenAI API
  async callAPI(prompt, options = {}) {
    if (!this.isReady()) {
      throw new Error('LLM Service not initialized. Call initialize() first.');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(prompt, options);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const model = options.model || this.config.openai.model;
    const temperature = options.temperature !== undefined
      ? options.temperature
      : this.config.openai.temperature;
    const maxTokens = options.max_tokens || this.config.openai.max_tokens;

    try {
      console.log(`Calling OpenAI API (${model})...`);
      const response = await this.makeRequest(prompt, model, temperature, maxTokens);

      // Save to cache
      this.saveToCache(cacheKey, response);

      return response;
    } catch (error) {
      console.error(`Error with ${model}:`, error.message);

      // Try fallback model if primary fails
      if (model !== this.config.openai.fallback_model) {
        console.log(`Trying fallback model: ${this.config.openai.fallback_model}`);
        try {
          const fallbackResponse = await this.makeRequest(
            prompt,
            this.config.openai.fallback_model,
            temperature,
            maxTokens
          );
          this.saveToCache(cacheKey, fallbackResponse);
          return fallbackResponse;
        } catch (fallbackError) {
          console.error('Fallback model also failed:', fallbackError.message);
          throw new Error('Both primary and fallback models failed. Please check your API key and connection.');
        }
      }

      throw error;
    }
  }

  // Make the actual HTTP request to OpenAI via proxy
  async makeRequest(prompt, model, temperature, maxTokens) {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates crossword puzzle content. Always respond with valid JSON when requested.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI');
    }

    return data.choices[0].message.content;
  }

  // Clear the cache
  clearCache() {
    this.cache.clear();
    console.log('Cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.cache.size,
      enabled: this.config?.cache.enabled || false,
      ttl_minutes: this.config?.cache.ttl_minutes || 0
    };
  }
}

// Create a global instance
const llmService = new LLMService();
