// script.js

// Global database object
let database = {
  lists: {}, // Each key is a list name; value is an array of word objects: { english, hebrewOptions, stats: { correct, incorrect } }
  dailyProgress: [] // Array of { date, knownCount, listsCompleted }
};

let currentListName = ""; // Name of the current list being practiced
let currentSession = []; // Array of word objects for the current session
let currentWordIndex = -1;
let mode = "en-to-he"; // default mode
let answeredThisWord = false;

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  updateListDropdown();
  addEventListeners();

  // Register service worker for PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").then(
      (registration) => {
        console.log("Service Worker registered with scope:", registration.scope);
      },
      (err) => {
        console.error("Service Worker registration failed:", err);
      }
    );
  }
});

// Load database from localStorage
function loadDatabase() {
  let data = localStorage.getItem("hebrewDatabase");
  if (data) {
    try {
      database = JSON.parse(data);
    } catch (e) {
      console.error("Error parsing database", e);
      database = { lists: {}, dailyProgress: [] };
    }
  }
}

// Save database to localStorage
function saveDatabase() {
  localStorage.setItem("hebrewDatabase", JSON.stringify(database));
}

// Update the dropdown list of loaded lists
function updateListDropdown() {
  const listSelect = document.getElementById("list-select");
  listSelect.innerHTML = '<option value="">--Select List--</option>';
  for (let listName in database.lists) {
    const option = document.createElement("option");
    option.value = listName;
    option.textContent = listName;
    listSelect.appendChild(option);
  }
}

// Add event listeners to all buttons and inputs
function addEventListeners() {
  document.getElementById("load-files-btn").addEventListener("click", loadFiles);
  document.getElementById("delete-list-btn").addEventListener("click", deleteList);
  document.getElementById("export-db-btn").addEventListener("click", exportDatabase);
  document.getElementById("import-db-btn").addEventListener("click", importDatabase);
  document.getElementById("show-list-stats-btn").addEventListener("click", showListStats);
  document.getElementById("show-histogram-btn").addEventListener("click", showHistogram);
  document.getElementById("show-daily-progress-graph-btn").addEventListener("click", showDailyProgressGraph);
  document.getElementById("show-daily-progress-table-btn").addEventListener("click", showDailyProgressTable);
  document.getElementById("show-db-stats-btn").addEventListener("click", showDatabaseStats);
  document.getElementById("mode-select").addEventListener("change", (e) => {
    mode = e.target.value;
  });
  document.getElementById("check-answer-btn").addEventListener("click", checkAnswer);
  document.getElementById("next-word-btn").addEventListener("click", nextWord);
  document.getElementById("load-least-known-btn").addEventListener("click", loadLeastKnown);

  // Dropdown toggle on click
  const dropdowns = document.querySelectorAll('.dropdown');
  dropdowns.forEach(dropdown => {
    const button = dropdown.querySelector('.dropbtn');
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      // Toggle active class for this dropdown
      dropdown.classList.toggle('active');
    });
  });

  // Close dropdowns if clicking outside
  document.addEventListener('click', function(e) {
    dropdowns.forEach(dropdown => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });
  });
}

// --- File Loading and Parsing ---

// When user clicks "Load Selected Files"
function loadFiles() {
  const fileInput = document.getElementById("file-input");
  const files = fileInput.files;
  if (!files.length) {
    alert("Please select at least one .dcp file.");
    return;
  }
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      // Use file name (without extension) as the list name
      const listName = file.name.replace(/\.[^/.]+$/, "");
      const words = parseDCPFile(content);
      if (words.length) {
        database.lists[listName] = words;
        updateListDropdown();
        saveDatabase();
      }
    };
    reader.readAsText(file);
  });
}

// Parse a .dcp file (each line: english=hebrew1|hebrew2, "@" denotes end-of-file)
function parseDCPFile(content) {
  const lines = content.split(/\r?\n/);
  const words = [];
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("@")) continue;
    const parts = line.split("=");
    if (parts.length < 2) continue;
    const english = parts[0].trim();
    const hebrewPart = parts.slice(1).join("=").trim();
    const hebrewOptions = hebrewPart.split("|").map((s) => s.trim());
    words.push({ english, hebrewOptions, stats: { correct: 0, incorrect: 0 } });
  }
  return words;
}

// Delete the selected list from the database
function deleteList() {
  const listSelect = document.getElementById("list-select");
  const listName = listSelect.value;
  if (!listName) {
    alert("Please select a list to delete.");
    return;
  }
  if (confirm(`Delete the list "${listName}"?`)) {
    delete database.lists[listName];
    updateListDropdown();
    saveDatabase();
    alert("List deleted.");
  }
}

// --- Database Export/Import ---

function exportDatabase() {
  const dataStr = JSON.stringify(database, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hebrew-database.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importDatabase() {
  const input = document.getElementById("import-db-input");
  if (!input.files.length) {
    alert("Please select a JSON file to import.");
    return;
  }
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      database = JSON.parse(event.target.result);
      updateListDropdown();
      saveDatabase();
      alert("Database imported successfully.");
    } catch (e) {
      alert("Error importing database: " + e);
    }
  };
  reader.readAsText(file);
}

// --- Statistics Functions ---

// Show per–word statistics for the selected list
function showListStats() {
  const listSelect = document.getElementById("list-select");
  const listName = listSelect.value;
  const statsDisplay = document.getElementById("stats-display");
  if (!listName || !database.lists[listName]) {
    statsDisplay.innerHTML = "<p>Please select a list first.</p>";
    return;
  }
  const words = database.lists[listName];
  let html = `<h3>Statistics for list: ${listName}</h3>`;
  html += "<table border='1' style='margin:auto;'>";
  html += "<tr><th>English</th><th>Hebrew Options</th><th>Correct</th><th>Incorrect</th><th>Ratio</th></tr>";
  words.forEach((word) => {
    const attempts = word.stats.correct + word.stats.incorrect;
    const ratio = attempts ? (word.stats.correct / attempts).toFixed(2) : "N/A";
    html += `<tr>
      <td>${word.english}</td>
      <td>${word.hebrewOptions.join(" / ")}</td>
      <td>${word.stats.correct}</td>
      <td>${word.stats.incorrect}</td>
      <td>${ratio}</td>
    </tr>`;
  });
  html += "</table>";
  statsDisplay.innerHTML = html;
}

// Show a 20–bin histogram of correct ratios (across all words)
function showHistogram() {
  const statsDisplay = document.getElementById("stats-display");
  const allWords = [];
  for (let list in database.lists) {
    allWords.push(...database.lists[list]);
  }
  if (!allWords.length) {
    statsDisplay.innerHTML = "<p>No words available.</p>";
    return;
  }
  const bins = Array(20).fill(0);
  allWords.forEach((word) => {
    const attempts = word.stats.correct + word.stats.incorrect;
    const ratio = attempts ? word.stats.correct / attempts : 0;
    // Determine bin index (0–19)
    let index = Math.floor(ratio * 20);
    if (index === 20) index = 19;
    bins[index]++;
  });
  let html = "<h3>Histogram of Correct Ratios (20 bins)</h3>";
  bins.forEach((count, i) => {
    const binStart = (i / 20).toFixed(2);
    const binEnd = ((i + 1) / 20).toFixed(2);
    html += `<div style="margin:2px;">${binStart}–${binEnd}: ${"*".repeat(count)}</div>`;
  });
  statsDisplay.innerHTML = html;
}

// Show a daily progress graph (simple text–based graph for this example)
function showDailyProgressGraph() {
  const statsDisplay = document.getElementById("stats-display");
  if (!database.dailyProgress.length) {
    statsDisplay.innerHTML = "<p>No daily progress data available.</p>";
    return;
  }
  let html = "<h3>Daily Progress Graph</h3>";
  database.dailyProgress.forEach((entry) => {
    html += `<div>${entry.date}: ${"*".repeat(entry.knownCount)} (${entry.knownCount} words known)</div>`;
  });
  statsDisplay.innerHTML = html;
}

// Show a daily progress table with lists completed on given dates
function showDailyProgressTable() {
  const statsDisplay = document.getElementById("stats-display");
  if (!database.dailyProgress.length) {
    statsDisplay.innerHTML = "<p>No daily progress data available.</p>";
    return;
  }
  let html = "<h3>Daily Progress Table</h3>";
  html += "<table border='1' style='margin:auto;'>";
  html += "<tr><th>Date</th><th>Words Known</th><th>Lists Completed</th></tr>";
  database.dailyProgress.forEach((entry) => {
    html += `<tr>
      <td>${entry.date}</td>
      <td>${entry.knownCount}</td>
      <td>${entry.listsCompleted || 0}</td>
    </tr>`;
  });
  html += "</table>";
  statsDisplay.innerHTML = html;
}

// Show database statistics (total words count)
function showDatabaseStats() {
  const statsDisplay = document.getElementById("stats-display");
  let totalWords = 0;
  for (let list in database.lists) {
    totalWords += database.lists[list].length;
  }
  let html = `<h3>Database Statistics</h3>`;
  html += `<p>Total words in database: ${totalWords}</p>`;
  statsDisplay.innerHTML = html;
}

// --- Flashcard Practice Functions ---

// Initialize session: randomize words, reset index, pre-populate indicators, update test info.
function initializeSession(wordsArray) {
  currentSession = shuffle([...wordsArray]);
  currentWordIndex = -1;
  answeredThisWord = false;
  // Clear previous feedback
  document.getElementById("correct-answer-display").textContent = "";
  populateIndicators(currentSession.length);
  // Update test info display
  document.getElementById("test-info").textContent = `Words in test: ${currentSession.length}`;
}

// Fisher–Yates Shuffle
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Pre-populate the feedback indicators with default white squares
function populateIndicators(count) {
  const indicatorsDiv = document.getElementById("feedback-indicators");
  indicatorsDiv.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const square = document.createElement("div");
    square.style.backgroundColor = "#fff"; // default white
    indicatorsDiv.appendChild(square);
  }
}

// When "Next Word" is clicked
function nextWord() {
  // If no session is active, initialize session from selected list
  if (!currentSession.length) {
    const listSelect = document.getElementById("list-select");
    if (listSelect.value) {
      currentListName = listSelect.value;
      initializeSession(database.lists[currentListName]);
    } else {
      alert("Please select a list (or load the 20 least known words) first.");
      return;
    }
  }
  currentWordIndex++;
  if (currentWordIndex >= currentSession.length) {
    alert("You have reached the end of this session.");
    recordDailyProgress();
    // Reset session
    currentSession = [];
    currentWordIndex = -1;
    return;
  }
  answeredThisWord = false;
  const word = currentSession[currentWordIndex];
  // Clear answer input and previous correct answer display
  document.getElementById("answer-input").value = "";
  document.getElementById("correct-answer-display").textContent = "";
  // Display question according to mode
  const questionDisplay = document.getElementById("question-display");
  if (mode === "en-to-he") {
    questionDisplay.textContent = word.english;
  } else {
    // If Hebrew-to-English, show the first Hebrew option as prompt.
    questionDisplay.textContent = word.hebrewOptions[0];
  }
}

// When "Check" is clicked
function checkAnswer() {
  if (currentWordIndex < 0 || currentWordIndex >= currentSession.length) {
    alert("Please press 'Next Word' first.");
    return;
  }
  if (answeredThisWord) return; // prevent double–checking
  const word = currentSession[currentWordIndex];
  const userAnswer = document.getElementById("answer-input").value.trim();
  let isCorrect = false;
  if (mode === "en-to-he") {
    // Compare user answer to each Hebrew option (exact string match)
    isCorrect = word.hebrewOptions.some(
      (option) => option === userAnswer
    );
  } else {
    // Hebrew-to-English: compare against the English word (case-insensitive)
    isCorrect = word.english.toLowerCase() === userAnswer.toLowerCase();
  }
  // Always show the correct answer (for Hebrew, show with nikkud)
  document.getElementById("correct-answer-display").textContent =
    mode === "en-to-he" ? word.hebrewOptions[0] : word.english;
  // Update the database stats
  if (isCorrect) {
    word.stats.correct++;
  } else {
    word.stats.incorrect++;
  }
  saveDatabase();
  // Update the corresponding indicator square
  const indicatorsDiv = document.getElementById("feedback-indicators");
  if (indicatorsDiv.children[currentWordIndex]) {
    indicatorsDiv.children[currentWordIndex].style.backgroundColor = isCorrect ? "var(--success-color)" : "var(--error-color)";
  }
  answeredThisWord = true;
}

// Record daily progress (this example simply records the number of words answered correctly)
function recordDailyProgress() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const dateStr = `${dd}.${mm}.${yyyy}`;
  let progress = database.dailyProgress.find((d) => d.date === dateStr);
  if (!progress) {
    progress = { date: dateStr, knownCount: 0, listsCompleted: 0 };
    database.dailyProgress.push(progress);
  }
  // For simplicity, we count all words answered in this session as “known”
  const sessionCorrect = currentSession.filter(
    (word) => word.stats.correct > 0
  ).length;
  progress.knownCount += sessionCorrect;
  saveDatabase();
}

// Load 20 least known words (across all lists, based on lowest correct ratios)
function loadLeastKnown() {
  const allWords = [];
  for (let list in database.lists) {
    database.lists[list].forEach((word) => {
      const attempts = word.stats.correct + word.stats.incorrect;
      const ratio = attempts ? word.stats.correct / attempts : 0;
      allWords.push({ ...word, ratio });
    });
  }
  if (allWords.length === 0) {
    alert("No words available in the database.");
    return;
  }
  // Sort words by ratio ascending (least known first)
  allWords.sort((a, b) => a.ratio - b.ratio);
  // Take the 20 least known words
  currentListName = "20 Least Known Words";
  initializeSession(allWords.slice(0, 20));
  alert("20 least known words loaded. Click 'Next Word' to begin.");
  // Clear previous session feedback if any
  document.getElementById("question-display").textContent = "Press 'Next Word' to begin";
}
