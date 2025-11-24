// Clue Generator - Generates crossword clues for words

class ClueGenerator {
  constructor(llmService) {
    this.llmService = llmService;
  }

  // Generate clues for all words in the puzzle
  async generateClues(words, theme, difficulty = 'medium') {
    console.log(`Generating clues for ${words.length} words...`);

    // Batch words for efficient API calls
    const batchSize = 15;
    const batches = [];

    for (let i = 0; i < words.length; i += batchSize) {
      batches.push(words.slice(i, i + batchSize));
    }

    const allClues = {};

    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i + 1}/${batches.length}...`);
      const batchClues = await this.generateBatchClues(batches[i], theme, difficulty);
      Object.assign(allClues, batchClues);
    }

    console.log(`Clue generation complete: ${Object.keys(allClues).length} clues created`);
    return allClues;
  }

  // Generate clues for a batch of words
  async generateBatchClues(words, theme, difficulty) {
    const difficultyGuidance = {
      easy: 'Write simple, straightforward clues that most people would understand.',
      medium: 'Write moderately challenging clues with some wordplay or indirect references.',
      hard: 'Write challenging clues with clever wordplay, cultural references, or cryptic elements.'
    };

    const wordList = words.join('", "');

    const prompt = `Generate crossword clues for these words in the context of the theme "${theme}":

Words: ["${wordList}"]

Difficulty: ${difficulty}
${difficultyGuidance[difficulty]}

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
      const response = await this.llmService.callAPI(prompt, {
        temperature: 0.7,
        max_tokens: 800
      });

      let jsonStr = response.trim();

      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }

      const clues = JSON.parse(jsonStr);

      // Validate and clean clues
      const cleanedClues = {};
      for (const word of words) {
        if (clues[word]) {
          cleanedClues[word] = this.cleanClue(clues[word]);
        } else {
          // Fallback: create a simple definition-style clue
          cleanedClues[word] = `Word related to ${theme}`;
        }
      }

      return cleanedClues;

    } catch (error) {
      console.error('Failed to generate batch clues:', error);

      // Fallback: create simple clues
      const fallbackClues = {};
      for (const word of words) {
        fallbackClues[word] = `${word.length}-letter word about ${theme}`;
      }
      return fallbackClues;
    }
  }

  // Clean and validate a clue
  cleanClue(clue) {
    // Remove quotes if present
    clue = clue.replace(/^["']|["']$/g, '');

    // Capitalize first letter
    clue = clue.charAt(0).toUpperCase() + clue.slice(1);

    // Ensure it ends with proper punctuation or none
    if (!/[.!?]$/.test(clue)) {
      // Don't add period for fill-in-the-blank style clues
      if (!clue.includes('___') && !clue.endsWith('...')) {
        // Most clues don't need periods in crosswords
      }
    }

    return clue.trim();
  }

  // Generate a single clue (for regeneration)
  async generateSingleClue(word, theme, difficulty = 'medium') {
    const clues = await this.generateBatchClues([word], theme, difficulty);
    return clues[word];
  }
}
