// Theme Analyzer - Expands user themes into semantic word fields

class ThemeAnalyzer {
  constructor(llmService) {
    this.llmService = llmService;
  }

  // Analyze theme and expand into related concepts
  async analyzeTheme(themeKeywords, difficulty = 'medium') {
    if (!themeKeywords || themeKeywords.trim() === '') {
      throw new Error('Please enter a theme for your crossword puzzle');
    }

    console.log(`Analyzing theme: "${themeKeywords}" (${difficulty})`);

    const prompt = this.buildThemePrompt(themeKeywords, difficulty);

    try {
      const response = await this.llmService.callAPI(prompt);
      return this.parseThemeResponse(response, themeKeywords);
    } catch (error) {
      console.error('Theme analysis failed:', error);
      throw new Error(`Failed to analyze theme: ${error.message}`);
    }
  }

  // Build the prompt for theme analysis
  buildThemePrompt(theme, difficulty) {
    const difficultyGuidance = {
      easy: 'Focus on common, everyday words that most people would know.',
      medium: 'Include a mix of common and moderately specialized terms.',
      hard: 'Include specialized terminology and less common words.'
    };

    return `You are helping create a crossword puzzle with the theme: "${theme}"

Difficulty level: ${difficulty}
${difficultyGuidance[difficulty]}

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
  }

  // Parse the LLM response
  parseThemeResponse(response, originalTheme) {
    try {
      // Try to extract JSON from response
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const themeData = JSON.parse(jsonStr);

      // Validate structure
      if (!themeData.core_words || !Array.isArray(themeData.core_words)) {
        throw new Error('Invalid response structure');
      }

      // Combine all words
      const allWords = [
        ...(themeData.core_words || []),
        ...(themeData.related_words || []),
        ...(themeData.action_words || []),
        ...(themeData.descriptive_words || [])
      ];

      // Clean and validate words
      const cleanedWords = allWords
        .map(word => word.toUpperCase().trim())
        .filter(word => word.length >= 3 && word.length <= 15)
        .filter(word => /^[A-Z]+$/.test(word)); // Only letters

      // Remove duplicates
      const uniqueWords = [...new Set(cleanedWords)];

      console.log(`Theme analysis complete: ${uniqueWords.length} unique words generated`);

      return {
        theme: originalTheme,
        summary: themeData.theme_summary || originalTheme,
        words: uniqueWords,
        categories: {
          core: themeData.core_words || [],
          related: themeData.related_words || [],
          actions: themeData.action_words || [],
          descriptive: themeData.descriptive_words || []
        },
        difficulty: 'medium'
      };

    } catch (error) {
      console.error('Failed to parse theme response:', error);
      console.error('Response was:', response);
      throw new Error('Failed to parse theme analysis. Please try again.');
    }
  }

  // Quick validation of theme
  isValidTheme(theme) {
    if (!theme || typeof theme !== 'string') return false;
    const trimmed = theme.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
  }
}
