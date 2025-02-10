/* 
  This file contains the logic for:
    • Loading and parsing .dcp files
    • Managing the “database” (saved via localStorage for simplicity)
    • Flashcard test functionality (randomizing questions, checking answers, updating indicators)
    • Statistics (using Chart.js for histogram and daily progress graphs)
    • UI interactions (dropdown open/close on outside click, resetting indicators, etc.)
*/

const dbKey = 'hebrewFlashcardDB';
let database = {
  lists: {},  // each list (file) is stored by name; each contains an array of words with stats
  dailyProgress: [] // Array of { date: 'dd.mm.yyyy', known: number, completedLists: number }
};
let currentList = null;   // the key for the current list
let currentTest = [];     // the words in the current test (array of word objects)
let currentTestIndicators = []; // array of booleans or status values
let currentTestIndex = 0;
let currentWord = null;

// When the app loads, load database from localStorage if present
document.addEventListener('DOMContentLoaded', () => {
  loadDatabase();
  populateListSelector();
  setupEventListeners();
  registerServiceWorker();
});

// Utility: Save the database to localStorage
function saveDatabase() {
  localStorage.setItem(dbKey, JSON.stringify(database));
}

// Utility: Load the database from localStorage
function loadDatabase() {
  const data = localStorage.getItem(dbKey);
  if (data) {
    try {
      database = JSON.parse(data);
    } catch (e) {
      console.error('Error parsing database:', e);
      database = { lists: {}, dailyProgress: [] };
    }
  }
}

// Populate the “choose a list” selector in the Database Management dropdown.
function populateListSelector() {
  const selector = document.getElementById('listSelector');
  // Clear out previous options (except default)
  selector.innerHTML = '<option value="">-- Choose a List --</option>';
  // Get the list names, ignoring “HtE” at the beginning if present.
  let listNames = Object.keys(database.lists);
  // Optionally filter out names starting with "HtE"
  listNames = listNames.filter(name => !name.startsWith('HtE'));
  // Order them (alphabetically)
  listNames.sort((a, b) => a.localeCompare(b));
  listNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    selector.appendChild(option);
  });
  // Also update the overall word count display in Statistics
  updateWordCountDisplay();
}

function updateWordCountDisplay() {
  let totalWords = 0;
  Object.values(database.lists).forEach(list => {
    totalWords += list.words.length;
  });
  document.getElementById('wordCountDisplay').textContent = `Total words in DB: ${totalWords}`;
}

// Setup event listeners for all UI elements.
function setupEventListeners() {
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    const dropdowns = document.querySelectorAll('.dropdown-content');
    dropdowns.forEach(dd => {
      if (!dd.contains(e.target) && !dd.previousElementSibling.contains(e.target)) {
        dd.style.display = 'none';
      }
    });
  });

  // Toggle dropdown when clicking on dropbtn
  const dropBtns = document.querySelectorAll('.dropbtn');
  dropBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Prevent click from bubbling to document
      e.stopPropagation();
      const content = btn.nextElementSibling;
      // Toggle display
      content.style.display = content.style.display === 'block' ? 'none' : 'block';
    });
  });

  // File input for loading .dcp files
  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', handleFileLoad);

  // Import DB button
  const importInput = document.getElementById('importDbInput');
  importInput.addEventListener('change', handleDbImport);

  // Export DB button
  document.getElementById('exportDbBtn').addEventListener('click', handleDbExport);

  // Delete DB button
  document.getElementById('deleteDbBtn').addEventListener('click', handleDbDelete);

  // List selector change: load selected list for testing
  document.getElementById('listSelector').addEventListener('change', (e) => {
    currentList = e.target.value;
    if (currentList) {
      startNewTest(database.lists[currentList].words);
    }
  });

  // Check answer button
  document.getElementById('checkBtn').addEventListener('click', checkAnswer);

  // Next Word button
  document.getElementById('nextWordBtn').addEventListener('click', loadNextWord);

  // Load 20 least known words button
  document.getElementById('leastKnownBtn').addEventListener('click', loadLeastKnownWords);

  // Statistics buttons (these functions are stubs – implement as needed)
  document.getElementById('listStatsBtn').addEventListener('click', showListStatistics);
  document.getElementById('histogramBtn').addEventListener('click', showHistogram);
  document.getElementById('dailyProgressGraphBtn').addEventListener('click', showDailyProgressGraph);
  document.getElementById('dailyProgressTableBtn').addEventListener('click', showDailyProgressTable);
}

// --- File Loading and Parsing ---

// Handle loading of .dcp files. Files should be in the format:
//   "to investigate=לַחֲקוֹר|לחקור"
// with "@" marking the end. Also ignore an initial "HtE" if present.
function handleFileLoad(e) {
  const files = e.target.files;
  if (!files.length) return;
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      parseDcpFile(file.name, content);
      // Repopulate list selector after adding new list(s)
      populateListSelector();
      saveDatabase();
    };
    reader.readAsText(file, 'UTF-8');
  });
}

// Parse a .dcp file and add its words to the database.
function parseDcpFile(filename, content) {
  // Remove the "HtE" at the beginning if present
  if (content.startsWith("HtE")) {
    content = content.substring(3).trim();
  }
  // Split by newlines and stop at "@" marker
  const lines = content.split(/\r?\n/);
  const words = [];
  for (let line of lines) {
    line = line.trim();
    if (line === "@" || line === "") break;
    // Expected format: question=answer1|answer2
    const [question, answerStr] = line.split('=');
    if (!question || !answerStr) continue;
    const answers = answerStr.split('|').map(ans => ans.trim());
    // Each word is an object containing:
    // question (english or hebrew), answers (array), and stats (correct/incorrect count)
    words.push({
      question: question.trim(),
      answers: answers,
      stats: { correct: 0, incorrect: 0 }
    });
  }
  // Store in database under a key based on the filename (without extension)
  const listName = filename.replace(/\.[^/.]+$/, "");
  database.lists[listName] = { words: words };
}

// --- Flashcard Test Logic ---

// Start a new test with a given list of words.
function startNewTest(words) {
  // Reset test state
  currentTest = [...words];
  // Shuffle words randomly
  currentTest.sort(() => Math.random() - 0.5);
  currentTestIndex = 0;
  currentTestIndicators = Array(currentTest.length).fill('default');
  updateIndicators();
  updateWordsInTestCount();
  loadNextWord();
}

// Update the display for the number of words in test.
function updateWordsInTestCount() {
  document.getElementById('wordsInTestCount').textContent = currentTest.length;
}

// Load the next word from the current test.
function loadNextWord() {
  if (currentTestIndex >= currentTest.length) {
    // End of test – update daily progress, etc.
    alert('Test complete!');
    // (Here you can update database.dailyProgress if needed.)
    return;
  }
  currentWord = currentTest[currentTestIndex];
  // Determine which mode is selected:
  const mode = document.querySelector('input[name="mode"]:checked').value;
  let questionText = "";
  if (mode === 'eng2heb') {
    questionText = currentWord.question;
  } else {
    // For heb2eng: choose one of the answers as question.
    // (You might need to store the Hebrew “nikkud” version separately if desired.)
    questionText = currentWord.answers[0];
  }
  document.getElementById('questionDisplay').textContent = questionText;
  // Clear answer field and correct answer display
  document.getElementById('answerInput').value = "";
  document.getElementById('correctAnswer').textContent = "";
}

// Check the user's answer against the correct answers.
function checkAnswer() {
  const userAnswer = document.getElementById('answerInput').value.trim();
  if (!currentWord) return;
  // Check if the answer matches any of the acceptable answers (case-insensitive)
  const isCorrect = currentWord.answers.some(ans => ans.toLowerCase() === userAnswer.toLowerCase());
  // Always display the correct answer (with proper nikkud if available – here we just show the first answer)
  document.getElementById('correctAnswer').textContent = currentWord.answers[0];
  // Update word stats in the database for the current list
  const list = database.lists[currentList];
  if (isCorrect) {
    currentWord.stats.correct++;
    currentTestIndicators[currentTestIndex] = 'correct';
  } else {
    currentWord.stats.incorrect++;
    currentTestIndicators[currentTestIndex] = 'incorrect';
  }
  saveDatabase();
  updateIndicators();
}

// Update the indicator squares based on currentTestIndicators.
function updateIndicators() {
  const container = document.getElementById('indicatorArea');
  container.innerHTML = "";
  currentTestIndicators.forEach(status => {
    const div = document.createElement('div');
    div.classList.add('indicator');
    if (status === 'correct') {
      div.style.background = 'green';
    } else if (status === 'incorrect') {
      div.style.background = 'red';
    } else {
      div.style.background = '#fff';
    }
    container.appendChild(div);
  });
}

// Load the 20 least known words (based on ratio correct/incorrect) from the entire database.
function loadLeastKnownWords() {
  let allWords = [];
  Object.values(database.lists).forEach(list => {
    list.words.forEach(word => {
      // Calculate ratio – if no attempts, treat as low known.
      const attempts = word.stats.correct + word.stats.incorrect;
      const ratio = attempts ? word.stats.correct / attempts : 0;
      allWords.push({ ...word, ratio });
    });
  });
  // Sort by ratio ascending (least known first) and take 20.
  allWords.sort((a, b) => a.ratio - b.ratio);
  const leastKnown = allWords.slice(0, 20);
  // Start test with these words.
  startNewTest(leastKnown);
}

// --- Database Import/Export/Deletion ---

function handleDbExport() {
  const dataStr = JSON.stringify(database, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "hebrew_flashcards_db.json";
  a.click();
  URL.revokeObjectURL(url);
}

function handleDbImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      database = JSON.parse(event.target.result);
      saveDatabase();
      populateListSelector();
      alert("Database imported successfully.");
    } catch (err) {
      alert("Error importing database.");
      console.error(err);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function handleDbDelete() {
  if (confirm("Are you sure you want to delete the entire database?")) {
    localStorage.removeItem(dbKey);
    database = { lists: {}, dailyProgress: [] };
    populateListSelector();
    alert("Database deleted.");
  }
}

// --- Statistics Functions (stubs – implement your graphs/tables as needed) ---

function showListStatistics() {
  // For example, you could show per-word stats for the selected list.
  if (!currentList) {
    alert("Please choose a list first.");
    return;
  }
  const list = database.lists[currentList];
  let statsText = `Statistics for "${currentList}":\n`;
  list.words.forEach(word => {
    const { correct, incorrect } = word.stats;
    statsText += `${word.question}: Correct ${correct}, Incorrect ${incorrect}\n`;
  });
  alert(statsText);
}

function showHistogram() {
  // Example: create a histogram of correct ratios using Chart.js
  const ctx = document.getElementById('histogramChart').getContext('2d');
  // Gather ratio data from all words
  let ratios = [];
  Object.values(database.lists).forEach(list => {
    list.words.forEach(word => {
      const attempts = word.stats.correct + word.stats.incorrect;
      const ratio = attempts ? word.stats.correct / attempts : 0;
      ratios.push(ratio);
    });
  });
  // Create n=20 bins
  const bins = 20;
  const counts = new Array(bins).fill(0);
  ratios.forEach(ratio => {
    const bin = Math.min(Math.floor(ratio * bins), bins - 1);
    counts[bin]++;
  });
  const labels = counts.map((_, i) => `${(i / bins).toFixed(2)} - ${((i+1)/bins).toFixed(2)}`);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Number of words',
        data: counts,
        backgroundColor: 'rgba(0, 255, 0, 0.5)',
        borderColor: 'rgba(0, 255, 0, 1)',
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function showDailyProgressGraph() {
  const ctx = document.getElementById('dailyProgressChart').getContext('2d');
  const dates = database.dailyProgress.map(dp => dp.date);
  const knowns = database.dailyProgress.map(dp => dp.known);
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Words turned to known',
        data: knowns,
        backgroundColor: 'rgba(0, 200, 0, 0.5)',
        borderColor: 'rgba(0, 200, 0, 1)',
        fill: true
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function showDailyProgressTable() {
  // Create a simple table showing date and number of lists completed
  const container = document.getElementById('dailyProgressTable');
  container.innerHTML = "";
  const table = document.createElement('table');
  table.style.margin = "0 auto";
  const header = document.createElement('tr');
  header.innerHTML = `<th>Date</th><th>Lists Completed</th>`;
  table.appendChild(header);
  database.dailyProgress.forEach(dp => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${dp.date}</td><td>${dp.completedLists}</td>`;
    table.appendChild(row);
  });
  container.appendChild(table);
}

// --- Service Worker Registration ---
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log('Service worker registered.', reg);
      })
      .catch(err => {
        console.error('Service worker registration failed:', err);
      });
  }
}
