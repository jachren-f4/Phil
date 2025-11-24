// AI Generator - Main orchestrator for AI-powered puzzle generation

let themeAnalyzer = null;
let wordGenerator = null;
let clueGenerator = null;
let isGenerating = false;

// Toggle custom size inputs
function toggleCustomSize() {
  const gridSizeSelect = document.getElementById('grid-size');
  const customInputs = document.getElementById('custom-size-inputs');

  if (gridSizeSelect.value === 'custom') {
    customInputs.style.display = 'flex';
  } else {
    customInputs.style.display = 'none';
  }
}

// Get grid dimensions
function getGridDimensions() {
  const gridSizeSelect = document.getElementById('grid-size');

  if (gridSizeSelect.value === 'custom') {
    const rows = parseInt(document.getElementById('custom-rows').value) || 5;
    const cols = parseInt(document.getElementById('custom-cols').value) || 6;
    return { rows, cols };
  } else {
    const size = parseInt(gridSizeSelect.value);
    return { rows: size, cols: size };
  }
}

// Initialize AI services when page loads
async function initializeAI() {
  try {
    await llmService.initialize();
    themeAnalyzer = new ThemeAnalyzer(llmService);
    wordGenerator = new WordGenerator(llmService);
    clueGenerator = new ClueGenerator(llmService);
    console.log('AI services initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize AI services:', error);
    showError('Failed to initialize AI services. Please check config.json');
    return false;
  }
}

// Main function called when "Generate with AI" button is clicked
async function generateWithAI() {
  if (isGenerating) {
    console.log('Generation already in progress');
    return;
  }

  // Get user inputs
  const themeInput = document.getElementById('theme-input');
  const difficultySelect = document.getElementById('difficulty');

  const theme = themeInput.value.trim();
  const dimensions = getGridDimensions();
  const difficulty = difficultySelect.value;

  // Validate theme
  if (!theme) {
    showError('Please enter a theme for your crossword puzzle');
    themeInput.focus();
    return;
  }

  // Start generation
  isGenerating = true;
  setGenerating(true);

  try {
    console.log('🔷 Generation started');
    console.log(`   Theme: ${theme}`);
    console.log(`   Dimensions: ${dimensions.rows}×${dimensions.cols}`);
    console.log(`   Difficulty: ${difficulty}`);

    // Initialize AI if needed
    if (!llmService.isReady()) {
      console.log('🔷 Initializing AI services...');
      updateProgress('Initializing AI services...', 5);
      const initialized = await initializeAI();
      if (!initialized) {
        throw new Error('Failed to initialize AI services');
      }
      console.log('✅ AI services initialized');
    } else {
      console.log('✅ AI services already initialized');
    }

    // Step 1: Analyze theme
    console.log('🔷 Step 1: Analyzing theme...');
    updateProgress('Analyzing theme...', 15);
    const themeData = await themeAnalyzer.analyzeTheme(theme, difficulty);
    console.log(`✅ Theme "${theme}" analyzed:`, themeData);

    // Step 2: Generate and score words
    console.log('🔷 Step 2: Generating word list...');
    updateProgress('Generating word list...', 30);
    const scoredWords = await wordGenerator.generateWords(themeData, dimensions, difficulty);
    console.log(`✅ Word generation complete: ${scoredWords.length} words`);
    console.log(`   Top 5 words: ${scoredWords.slice(0, 5).map(w => w.word).join(', ')}`);

    // Step 3: Create new crossword grid
    console.log('🔷 Step 3: Creating crossword grid...');
    updateProgress('Creating crossword grid...', 45);
    createNewPuzzle(dimensions.rows, dimensions.cols);

    // Fix the current object to use actual grid dimensions
    current.acrossEndIndex = xw.cols;
    current.downEndIndex = xw.rows;

    console.log(`✅ Grid created: ${xw.rows}×${xw.cols}`);

    // Set theme as title
    xw.title = theme.charAt(0).toUpperCase() + theme.slice(1);
    document.getElementById('puzzle-title').textContent = xw.title;
    console.log(`✅ Title set to: ${xw.title}`);

    // Step 4: Fill grid with words
    console.log('🔷 Step 4: Filling grid with words...');
    updateProgress('Filling grid with themed words...', 60);
    await fillGridWithWords(scoredWords, dimensions);
    console.log('✅ Grid filling complete');

    // Step 5: Generate clues
    console.log('🔷 Step 5: Generating clues...');
    updateProgress('Generating clues...', 75);
    const wordsInGrid = extractWordsFromGrid();
    console.log(`✅ Extracted ${wordsInGrid.length} words from grid: ${wordsInGrid.join(', ')}`);

    if (wordsInGrid.length === 0) {
      console.warn('⚠️  WARNING: No words in grid! Skipping clue generation.');
      throw new Error('No words were placed in the grid');
    }

    const clues = await clueGenerator.generateClues(wordsInGrid, theme, difficulty);
    console.log(`✅ Clue generation complete: ${Object.keys(clues).length} clues`);

    // Step 6: Add clues to crossword
    console.log('🔷 Step 6: Adding clues to puzzle...');
    updateProgress('Adding clues to puzzle...', 90);
    applyCluestoGrid(clues);
    console.log('✅ Clues applied');

    console.log('🔷 Step 7: Finalizing...');
    updateProgress('Puzzle complete!', 100);

    setTimeout(() => {
      showSuccess(`✨ Crossword generated successfully!<br>
                  Theme: ${theme}<br>
                  Size: ${dimensions.rows}×${dimensions.cols}<br>
                  Words: ${wordsInGrid.length}<br>
                  <small>You can now export or edit your puzzle!</small>`);
      setGenerating(false);
      isGenerating = false;
    }, 1000);

  } catch (error) {
    console.error('Generation failed:', error);
    showError(`Generation failed: ${error.message}`);
    setGenerating(false);
    isGenerating = false;
  }
}

// Update progress indicator
function updateProgress(message, percentage) {
  const progressDiv = document.getElementById('ai-progress');
  const progressFill = progressDiv.querySelector('.ai-progress-fill');
  const progressMessage = progressDiv.querySelector('.ai-progress-message');

  progressDiv.classList.remove('hidden');
  progressFill.style.width = `${percentage}%`;
  progressMessage.textContent = message;
}

// Set UI to generating state
function setGenerating(generating) {
  const generateBtn = document.getElementById('generate-ai-btn');
  const themeInput = document.getElementById('theme-input');
  const gridSizeSelect = document.getElementById('grid-size');
  const difficultySelect = document.getElementById('difficulty');
  const progressDiv = document.getElementById('ai-progress');

  if (generating) {
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating...';
    themeInput.disabled = true;
    gridSizeSelect.disabled = true;
    difficultySelect.disabled = true;
    progressDiv.classList.remove('hidden');
  } else {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fa fa-magic"></i> Generate with AI';
    themeInput.disabled = false;
    gridSizeSelect.disabled = false;
    difficultySelect.disabled = false;
    progressDiv.classList.add('hidden');
  }
}

// Show error message
function showError(message) {
  const progressDiv = document.getElementById('ai-progress');
  const progressMessage = progressDiv.querySelector('.ai-progress-message');

  progressDiv.classList.remove('hidden');
  progressDiv.style.background = '#fee2e2';
  progressMessage.innerHTML = `<i class="fa fa-exclamation-triangle" style="color: #dc2626;"></i> ${message}`;

  setTimeout(() => {
    progressDiv.classList.add('hidden');
    progressDiv.style.background = '';
  }, 5000);
}

// Show success message
function showSuccess(message) {
  const progressDiv = document.getElementById('ai-progress');
  const progressMessage = progressDiv.querySelector('.ai-progress-message');

  progressDiv.classList.remove('hidden');
  progressDiv.style.background = '#d1fae5';
  progressMessage.innerHTML = `<i class="fa fa-check-circle" style="color: #10b981;"></i> ${message}`;

  setTimeout(() => {
    progressDiv.classList.add('hidden');
    progressDiv.style.background = '';
  }, 5000);
}

// Initialize AI when page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('Page loaded, AI services will initialize on first use');
});

// Fill grid with themed words using an improved algorithm
async function fillGridWithWords(scoredWords, dimensions) {
  console.log('🔵 fillGridWithWords called');
  console.log(`   scoredWords count: ${scoredWords.length}`);
  console.log(`   dimensions: ${dimensions.rows}×${dimensions.cols}`);

  const words = scoredWords.map(w => w.word);
  console.log(`   words array: ${words.slice(0, 10).join(', ')}`);

  const usedWords = new Set();
  let placed = 0;

  // Phase 1: Place words at key positions (every other row/col)
  console.log('   Phase 1: Placing words at key positions...');

  // Horizontal words at key rows
  for (let row = 0; row < dimensions.rows; row += 2) {
    const suitable = words.filter(w => w.length <= dimensions.cols && w.length >= 3 && !usedWords.has(w));

    for (let attempt = 0; attempt < Math.min(suitable.length, 10); attempt++) {
      const word = suitable[attempt];
      if (canPlaceWordHorizontal(row, 0, word)) {
        console.log(`      → Placing "${word}" horizontally at (${row}, 0)`);
        placeWordHorizontal(row, 0, word);
        usedWords.add(word);
        placed++;
        break;
      }
    }
  }

  // Vertical words at key columns
  for (let col = 0; col < dimensions.cols; col += 2) {
    const suitable = words.filter(w => w.length <= dimensions.rows && w.length >= 3 && !usedWords.has(w));

    for (let attempt = 0; attempt < Math.min(suitable.length, 10); attempt++) {
      const word = suitable[attempt];
      if (canPlaceWordVertical(0, col, word)) {
        console.log(`      → Placing "${word}" vertically at (0, ${col})`);
        placeWordVertical(0, col, word);
        usedWords.add(word);
        placed++;
        break;
      }
    }
  }

  // Phase 2: Fill remaining spaces with pattern matching
  console.log('   Phase 2: Filling remaining spaces with pattern matching...');

  // Try all horizontal positions
  for (let row = 0; row < dimensions.rows; row++) {
    for (let col = 0; col < dimensions.cols; col++) {
      // Get the pattern for this position
      const pattern = getHorizontalPattern(row, col);
      if (!pattern || pattern.length < 3) continue; // Skip if too short or no space

      // Find words matching the pattern
      const matching = words.filter(w =>
        w.length === pattern.length &&
        !usedWords.has(w) &&
        matchesPattern(w, pattern)
      );

      for (const word of matching) {
        if (canPlaceWordHorizontal(row, col, word) && shouldPlaceWord(row, col, word, 'horizontal')) {
          console.log(`      → Filling "${word}" at (${row}, ${col}) matching pattern "${pattern}"`);
          placeWordHorizontal(row, col, word);
          usedWords.add(word);
          placed++;
          break;
        }
      }
    }
  }

  // Try all vertical positions
  for (let col = 0; col < dimensions.cols; col++) {
    for (let row = 0; row < dimensions.rows; row++) {
      // Get the pattern for this position
      const pattern = getVerticalPattern(row, col);
      if (!pattern || pattern.length < 3) continue; // Skip if too short or no space

      // Find words matching the pattern
      const matching = words.filter(w =>
        w.length === pattern.length &&
        !usedWords.has(w) &&
        matchesPattern(w, pattern)
      );

      for (const word of matching) {
        if (canPlaceWordVertical(row, col, word) && shouldPlaceWord(row, col, word, 'vertical')) {
          console.log(`      → Filling "${word}" at (${row}, ${col}) matching pattern "${pattern}"`);
          placeWordVertical(row, col, word);
          usedWords.add(word);
          placed++;
          break;
        }
      }
    }
  }

  // Phase 3: Add strategic black squares to enable more word placement
  console.log('   Phase 3: Adding strategic black squares...');
  addStrategicBlackSquares(dimensions);

  // Phase 4: Fill remaining spaces around black squares
  console.log('   Phase 4: Final filling with black squares...');
  for (let row = 0; row < dimensions.rows; row++) {
    for (let col = 0; col < dimensions.cols; col++) {
      const pattern = getHorizontalPattern(row, col);
      if (!pattern || pattern.length < 3) continue;

      const matching = words.filter(w =>
        w.length === pattern.length &&
        !usedWords.has(w) &&
        matchesPattern(w, pattern)
      );

      for (const word of matching) {
        if (canPlaceWordHorizontal(row, col, word)) {
          console.log(`      → Final fill "${word}" horizontally at (${row}, ${col})`);
          placeWordHorizontal(row, col, word);
          usedWords.add(word);
          placed++;
          break;
        }
      }
    }
  }

  for (let col = 0; col < dimensions.cols; col++) {
    for (let row = 0; row < dimensions.rows; row++) {
      const pattern = getVerticalPattern(row, col);
      if (!pattern || pattern.length < 3) continue;

      const matching = words.filter(w =>
        w.length === pattern.length &&
        !usedWords.has(w) &&
        matchesPattern(w, pattern)
      );

      for (const word of matching) {
        if (canPlaceWordVertical(row, col, word)) {
          console.log(`      → Final fill "${word}" vertically at (${row}, ${col})`);
          placeWordVertical(row, col, word);
          usedWords.add(word);
          placed++;
          break;
        }
      }
    }
  }

  // Calculate coverage
  let filledCells = 0;
  let blackCells = 0;
  for (let i = 0; i < xw.rows; i++) {
    for (let j = 0; j < xw.cols; j++) {
      if (xw.fill[i][j] !== ' ') filledCells++;
      if (xw.fill[i][j] === '.') blackCells++;
    }
  }
  const totalCells = xw.rows * xw.cols;
  const whiteCells = totalCells - blackCells;
  const whitesCoverage = whiteCells > 0 ? ((filledCells - blackCells) / whiteCells * 100).toFixed(1) : 0;

  console.log(`✅ Placed ${placed} words in grid`);
  console.log(`   Used ${usedWords.size} unique words: ${Array.from(usedWords).join(', ')}`);
  console.log(`   Black squares: ${blackCells} (${(blackCells/totalCells*100).toFixed(1)}%)`);
  console.log(`   White squares filled: ${whitesCoverage}%`);
  console.log('   Final grid state:');
  for (let i = 0; i < xw.rows; i++) {
    console.log(`      Row ${i}: "${xw.fill[i]}"`);
  }
}

// Add strategic black squares to create word boundaries
function addStrategicBlackSquares(dimensions) {
  // Identify cells that are isolated or prevent word placement
  const candidates = [];

  for (let row = 0; row < dimensions.rows; row++) {
    for (let col = 0; col < dimensions.cols; col++) {
      if (xw.fill[row][col] !== ' ') continue;

      // Check if this cell is isolated (surrounded by blanks)
      let adjacentBlanks = 0;
      let adjacentLetters = 0;

      // Check all 4 directions
      if (row > 0) {
        if (xw.fill[row-1][col] === ' ') adjacentBlanks++; else adjacentLetters++;
      }
      if (row < dimensions.rows - 1) {
        if (xw.fill[row+1][col] === ' ') adjacentBlanks++; else adjacentLetters++;
      }
      if (col > 0) {
        if (xw.fill[row][col-1] === ' ') adjacentBlanks++; else adjacentLetters++;
      }
      if (col < dimensions.cols - 1) {
        if (xw.fill[row][col+1] === ' ') adjacentBlanks++; else adjacentLetters++;
      }

      // Cells with many blank neighbors are good candidates
      if (adjacentBlanks >= 3) {
        candidates.push({ row, col, score: adjacentBlanks });
      }
    }
  }

  // Sort by score (most isolated first)
  candidates.sort((a, b) => b.score - a.score);

  // Place black squares at top candidates (with rotational symmetry)
  const numBlackSquares = Math.min(candidates.length, Math.floor(dimensions.rows * dimensions.cols * 0.15));

  for (let i = 0; i < numBlackSquares && i < candidates.length; i++) {
    const { row, col } = candidates[i];

    // Place black square
    xw.fill[row] = xw.fill[row].substring(0, col) + '.' + xw.fill[row].substring(col + 1);

    // Place symmetric black square (180° rotation)
    const symRow = dimensions.rows - 1 - row;
    const symCol = dimensions.cols - 1 - col;

    if (xw.fill[symRow][symCol] === ' ') {
      xw.fill[symRow] = xw.fill[symRow].substring(0, symCol) + '.' + xw.fill[symRow].substring(symCol + 1);
    }

    console.log(`      → Placed black squares at (${row},${col}) and (${symRow},${symCol})`);
  }

  updateGridUI();
  updateLabelsAndClues();
}

// Get horizontal pattern at position (e.g., "L_VE" for partially filled row)
function getHorizontalPattern(row, col) {
  if (col > 0 && xw.fill[row][col - 1] !== ' ' && xw.fill[row][col - 1] !== '.') return null; // Not a word start

  let pattern = '';
  for (let c = col; c < xw.cols; c++) {
    const char = xw.fill[row][c];
    if (char === '.') break; // Stop at black square
    if (char === ' ') {
      pattern += '_';
    } else {
      pattern += char;
    }

    // Stop at next blank or edge
    if (c + 1 < xw.cols && xw.fill[row][c + 1] === ' ' && char === ' ') break;
  }

  // Find the actual word boundary
  let wordEnd = pattern.length;
  for (let i = 0; i < pattern.length; i++) {
    if (i > 0 && pattern[i] === '_' && pattern[i - 1] === '_') {
      wordEnd = i;
      break;
    }
  }

  return pattern.substring(0, wordEnd);
}

// Get vertical pattern at position
function getVerticalPattern(row, col) {
  if (row > 0 && xw.fill[row - 1][col] !== ' ' && xw.fill[row - 1][col] !== '.') return null; // Not a word start

  let pattern = '';
  for (let r = row; r < xw.rows; r++) {
    const char = xw.fill[r][col];
    if (char === '.') break; // Stop at black square
    if (char === ' ') {
      pattern += '_';
    } else {
      pattern += char;
    }

    // Stop at next blank or edge
    if (r + 1 < xw.rows && xw.fill[r + 1][col] === ' ' && char === ' ') break;
  }

  // Find the actual word boundary
  let wordEnd = pattern.length;
  for (let i = 0; i < pattern.length; i++) {
    if (i > 0 && pattern[i] === '_' && pattern[i - 1] === '_') {
      wordEnd = i;
      break;
    }
  }

  return pattern.substring(0, wordEnd);
}

// Check if a word matches a pattern (e.g., "LOVE" matches "L_VE")
function matchesPattern(word, pattern) {
  if (word.length !== pattern.length) return false;

  for (let i = 0; i < word.length; i++) {
    if (pattern[i] !== '_' && pattern[i] !== word[i]) {
      return false;
    }
  }
  return true;
}

// Check if we should place a word (avoids creating isolated words)
function shouldPlaceWord(row, col, word, direction) {
  // Count how many letters would intersect with existing letters
  let intersections = 0;

  if (direction === 'horizontal') {
    for (let i = 0; i < word.length; i++) {
      if (xw.fill[row][col + i] !== ' ') {
        intersections++;
      }
    }
  } else {
    for (let i = 0; i < word.length; i++) {
      if (xw.fill[row + i][col] !== ' ') {
        intersections++;
      }
    }
  }

  // Only place if it creates at least one intersection (connected crossword)
  // OR if the grid is still mostly empty
  let totalFilled = 0;
  for (let i = 0; i < xw.rows; i++) {
    for (let j = 0; j < xw.cols; j++) {
      if (xw.fill[i][j] !== ' ') totalFilled++;
    }
  }

  return intersections > 0 || totalFilled < 10;
}

// Check if a word can be placed horizontally without conflicts
function canPlaceWordHorizontal(row, col, word) {
  if (col + word.length > xw.cols) return false;

  // Check word boundaries - must have blank, black square, or edge before/after
  if (col > 0 && xw.fill[row][col - 1] !== ' ' && xw.fill[row][col - 1] !== '.') return false;
  if (col + word.length < xw.cols && xw.fill[row][col + word.length] !== ' ' && xw.fill[row][col + word.length] !== '.') return false;

  // Check each position
  for (let i = 0; i < word.length; i++) {
    const currentChar = xw.fill[row][col + i];

    // Letter must match or be blank
    if (currentChar !== ' ' && currentChar !== word[i]) {
      return false;
    }

    // Check perpendicular words don't get extended
    if (currentChar === ' ') {
      // If we're adding a letter, check it doesn't extend a vertical word
      if (row > 0 && xw.fill[row - 1][col + i] !== ' ') {
        // There's a letter above - check if there's a letter below too (word continues)
        if (row < xw.rows - 1 && xw.fill[row + 1][col + i] !== ' ') {
          return false; // Would extend existing vertical word
        }
      }
      if (row < xw.rows - 1 && xw.fill[row + 1][col + i] !== ' ') {
        // There's a letter below - check if there's a letter above too
        if (row > 0 && xw.fill[row - 1][col + i] !== ' ') {
          return false; // Would extend existing vertical word
        }
      }
    }
  }
  return true;
}

// Check if a word can be placed vertically without conflicts
function canPlaceWordVertical(row, col, word) {
  if (row + word.length > xw.rows) return false;

  // Check word boundaries - must have blank, black square, or edge before/after
  if (row > 0 && xw.fill[row - 1][col] !== ' ' && xw.fill[row - 1][col] !== '.') return false;
  if (row + word.length < xw.rows && xw.fill[row + word.length][col] !== ' ' && xw.fill[row + word.length][col] !== '.') return false;

  // Check each position
  for (let i = 0; i < word.length; i++) {
    const currentChar = xw.fill[row + i][col];

    // Letter must match or be blank
    if (currentChar !== ' ' && currentChar !== word[i]) {
      return false;
    }

    // Check perpendicular words don't get extended
    if (currentChar === ' ') {
      // If we're adding a letter, check it doesn't extend a horizontal word
      if (col > 0 && xw.fill[row + i][col - 1] !== ' ') {
        // There's a letter to the left - check if there's a letter to the right too
        if (col < xw.cols - 1 && xw.fill[row + i][col + 1] !== ' ') {
          return false; // Would extend existing horizontal word
        }
      }
      if (col < xw.cols - 1 && xw.fill[row + i][col + 1] !== ' ') {
        // There's a letter to the right - check if there's a letter to the left too
        if (col > 0 && xw.fill[row + i][col - 1] !== ' ') {
          return false; // Would extend existing horizontal word
        }
      }
    }
  }
  return true;
}

// Place a word horizontally
function placeWordHorizontal(row, col, word) {
  for (let i = 0; i < word.length && col + i < xw.cols; i++) {
    xw.fill[row] = xw.fill[row].substring(0, col + i) + word[i] + xw.fill[row].substring(col + i + 1);
  }
  updateGridUI();
  updateLabelsAndClues();
}

// Place a word vertically
function placeWordVertical(row, col, word) {
  for (let i = 0; i < word.length && row + i < xw.rows; i++) {
    xw.fill[row + i] = xw.fill[row + i].substring(0, col) + word[i] + xw.fill[row + i].substring(col + 1);
  }
  updateGridUI();
  updateLabelsAndClues();
}

// Extract all words from the filled grid
function extractWordsFromGrid() {
  const words = [];
  const seen = new Set();

  // Extract horizontal words
  for (let row = 0; row < xw.rows; row++) {
    let word = '';
    for (let col = 0; col < xw.cols; col++) {
      const char = xw.fill[row][col];
      if (char !== ' ' && char !== '.') {
        word += char;
      } else {
        if (word.length >= 3 && !seen.has(word)) {
          words.push(word);
          seen.add(word);
        }
        word = '';
      }
    }
    if (word.length >= 3 && !seen.has(word)) {
      words.push(word);
      seen.add(word);
    }
  }

  // Extract vertical words
  for (let col = 0; col < xw.cols; col++) {
    let word = '';
    for (let row = 0; row < xw.rows; row++) {
      const char = xw.fill[row][col];
      if (char !== ' ' && char !== '.') {
        word += char;
      } else {
        if (word.length >= 3 && !seen.has(word)) {
          words.push(word);
          seen.add(word);
        }
        word = '';
      }
    }
    if (word.length >= 3 && !seen.has(word)) {
      words.push(word);
      seen.add(word);
    }
  }

  console.log(`Extracted ${words.length} words from grid:`, words);
  return words;
}

// Apply clues to the grid
function applyCluestoGrid(clues) {
  // Phil stores clues in xw.clues object
  // We need to map words to their clue numbers

  if (!xw.clues) {
    xw.clues = {};
  }

  // Get the across and down clue numbers from Phil's system
  const acrossStarts = getAcrossWordStarts();
  const downStarts = getDownWordStarts();

  // Apply across clues
  for (const start of acrossStarts) {
    const word = getWordAt(start.row, start.col, 'across');
    if (word && word.length >= 3 && clues[word]) {
      if (!xw.clues.across) xw.clues.across = {};
      xw.clues.across[start.number] = clues[word];
    }
  }

  // Apply down clues
  for (const start of downStarts) {
    const word = getWordAt(start.row, start.col, 'down');
    if (word && word.length >= 3 && clues[word]) {
      if (!xw.clues.down) xw.clues.down = {};
      xw.clues.down[start.number] = clues[word];
    }
  }

  // Refresh the clues display
  updateCluesUI();
  console.log('Clues applied to grid');
}

// Helper to get word starting at position
function getWordAt(row, col, direction) {
  let word = '';

  if (direction === 'across') {
    for (let c = col; c < xw.cols; c++) {
      const char = xw.fill[row][c];
      if (char === ' ' || char === '.') break;
      word += char;
    }
  } else { // down
    for (let r = row; r < xw.rows; r++) {
      const char = xw.fill[r][col];
      if (char === ' ' || char === '.') break;
      word += char;
    }
  }

  return word.length >= 3 ? word : null;
}

// Get all across word start positions
function getAcrossWordStarts() {
  const starts = [];
  const grid = document.getElementById('grid');
  if (!grid) return starts;

  const cells = grid.querySelectorAll('td');
  cells.forEach(cell => {
    const label = cell.querySelector('.label');
    if (label && label.textContent) {
      const row = parseInt(cell.parentElement.getAttribute('data-row'));
      const col = parseInt(cell.getAttribute('data-col'));

      // Check if this starts an across word
      const isAcrossStart = (col === 0 || xw.fill[row][col - 1] === ' ' || xw.fill[row][col - 1] === '.')
        && col < xw.cols - 1
        && xw.fill[row][col] !== ' '
        && xw.fill[row][col] !== '.'
        && xw.fill[row][col + 1] !== ' '
        && xw.fill[row][col + 1] !== '.';

      if (isAcrossStart) {
        starts.push({ row, col, number: parseInt(label.textContent) });
      }
    }
  });

  return starts;
}

// Get all down word start positions
function getDownWordStarts() {
  const starts = [];
  const grid = document.getElementById('grid');
  if (!grid) return starts;

  const cells = grid.querySelectorAll('td');
  cells.forEach(cell => {
    const label = cell.querySelector('.label');
    if (label && label.textContent) {
      const row = parseInt(cell.parentElement.getAttribute('data-row'));
      const col = parseInt(cell.getAttribute('data-col'));

      // Check if this starts a down word
      const isDownStart = (row === 0 || xw.fill[row - 1][col] === ' ' || xw.fill[row - 1][col] === '.')
        && row < xw.rows - 1
        && xw.fill[row][col] !== ' '
        && xw.fill[row][col] !== '.'
        && xw.fill[row + 1][col] !== ' '
        && xw.fill[row + 1][col] !== '.';

      if (isDownStart) {
        starts.push({ row, col, number: parseInt(label.textContent) });
      }
    }
  });

  return starts;
}
