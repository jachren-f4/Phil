// Word Generator - Generates and scores words for crossword puzzles

class WordGenerator {
  constructor(llmService) {
    this.llmService = llmService;
  }

  // Generate words from theme data
  async generateWords(themeData, gridDimensions, difficulty = 'medium') {
    console.log(`Generating words for ${gridDimensions.rows}×${gridDimensions.cols} grid`);

    // Use words from theme analysis
    let words = [...themeData.words];

    // If we need more words, generate additional ones
    const estimatedWordsNeeded = this.estimateWordsNeeded(gridDimensions);

    if (words.length < estimatedWordsNeeded) {
      console.log(`Need more words, generating additional... (have: ${words.length}, need: ~${estimatedWordsNeeded})`);
      const additionalWords = await this.generateAdditionalWords(
        themeData.theme,
        estimatedWordsNeeded - words.length,
        difficulty
      );
      words = [...words, ...additionalWords];
    }

    // Score and filter words
    const scoredWords = this.scoreWords(words, themeData, gridDimensions);

    console.log(`Word generation complete: ${scoredWords.length} words ready`);
    return scoredWords;
  }

  // Estimate how many words we need for a grid
  estimateWordsNeeded(dimensions) {
    const totalCells = dimensions.rows * dimensions.cols;
    // Rough estimate: need about 40-60% of cells as word starts
    return Math.ceil(totalCells * 0.5);
  }

  // Generate additional words if needed
  async generateAdditionalWords(theme, count, difficulty) {
    const prompt = `Generate ${count} additional crossword-suitable words related to the theme: "${theme}"

Requirements:
- All words must be in UPPERCASE
- Words should be 3-15 letters long
- Mix of different lengths
- Suitable for crossword puzzles
- No abbreviations or proper nouns (unless very famous)

Return ONLY a JSON array of words: ["WORD1", "WORD2", "WORD3", ...]`;

    try {
      const response = await this.llmService.callAPI(prompt, { temperature: 0.8 });
      let jsonStr = response.trim();

      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const words = JSON.parse(jsonStr);
      return words
        .map(w => w.toUpperCase().trim())
        .filter(w => w.length >= 3 && w.length <= 15)
        .filter(w => /^[A-Z]+$/.test(w));
    } catch (error) {
      console.error('Failed to generate additional words:', error);
      return [];
    }
  }

  // Score words based on theme relevance and usability
  scoreWords(words, themeData, gridDimensions) {
    const maxLength = Math.max(gridDimensions.rows, gridDimensions.cols);
    const minLength = 3;

    return words
      .filter(word => word.length >= minLength && word.length <= maxLength)
      .map(word => {
        let score = 0.5; // Base score

        // Length preference (favor medium-length words)
        const idealLength = Math.floor(maxLength * 0.6);
        const lengthDiff = Math.abs(word.length - idealLength);
        score += (1 - lengthDiff / maxLength) * 0.2;

        // Theme relevance (higher for core words)
        if (themeData.categories?.core?.includes(word)) {
          score += 0.3;
        } else if (themeData.categories?.related?.includes(word)) {
          score += 0.2;
        } else if (themeData.categories?.actions?.includes(word)) {
          score += 0.15;
        } else if (themeData.categories?.descriptive?.includes(word)) {
          score += 0.15;
        }

        // Letter distribution (favor common letters)
        const commonLetters = 'ERSTLNAOI';
        const commonCount = word.split('').filter(c => commonLetters.includes(c)).length;
        score += (commonCount / word.length) * 0.1;

        return {
          word: word,
          length: word.length,
          score: Math.min(score, 1.0),
          isThemeWord: themeData.words.includes(word)
        };
      })
      .sort((a, b) => b.score - a.score); // Sort by score descending
  }

  // Get word list grouped by length (useful for grid filling)
  getWordsByLength(scoredWords) {
    const byLength = {};

    for (const wordData of scoredWords) {
      const len = wordData.length;
      if (!byLength[len]) {
        byLength[len] = [];
      }
      byLength[len].push(wordData);
    }

    return byLength;
  }
}
