// script.js

"use strict";

// Global database object
let database = {
  lists: {}, // { listName: [ { english, hebrewOptions, stats: { correct, incorrect } }, ... ] }
  dailyProgress: [] // [ { date, knownCount, listsCompleted }, ... ]
};

// Test session state
let currentListName = "";
let currentSession = [];  // Array holding the randomized words for the current test
let currentWordIndex = -1;
let mode = "en-to-he";    // "en-to-he" or "he-to-en"
let answeredThisWord = false;

document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
  updateListDropdown();
  updateTestListDropdown();
  addEventListeners();
  // Register service worker if supported
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js")
      .then(registration => console.log("Service Worker registered with scope:", registration.scope))
      .catch(error => console.error("Service Worker registration failed:", error));
  }
});


// ===== Dropdown Toggling =====

function toggleDropdown(button) {
  const dropdownContent = button.parentElement.querySelector(".dropdown-content");
  if (dropdownContent) {
    dropdownContent.classList.toggle("show");
  }
}

// Only close dropdowns if the click is outside any dropdown container.
window.onclick = function (event) {
  if (!event.target.closest('.dropdown')) {
    const dropdowns = document.getElementsByClassName("dropdown-content");
    for (let i = 0; i < dropdowns.length; i++) {
      dropdowns[i].classList.remove("show");
    }
  }
};


// ===== Database Functions =====

function loadDatabase() {
  const data = localStorage.getItem("hebrewDatabase");
  if (data) {
    try {
      database = JSON.parse(data);
    } catch (e) {
      console.error("Error parsing database", e);
      database = { lists: {}, dailyProgress: [] };
    }
  }
}

function saveDatabase() {
  localStorage.setItem("hebrewDatabase", JSON.stringify(database));
}

function updateListDropdown() {
  const listSelect = document.getElementById("list-select");
  listSelect.innerHTML = '<option value="">--Select List--</option>';
  const listNames = Object.keys(database.lists).sort((a, b) => a.localeCompare(b));
  listNames.forEach(listName => {
    const option = document.createElement("option");
    option.value = listName;
    option.textContent = listName;
    listSelect.appendChild(option);
  });
}

function updateTestListDropdown() {
  const testListSelect = document.getElementById("test-list-select");
  testListSelect.innerHTML = '<option value="">--Select List--</option>';
  const listNames = Object.keys(database.lists).sort((a, b) => a.localeCompare(b));
  listNames.forEach(listName => {
    const option = document.createElement("option");
    option.value = listName;
    option.textContent = listName;
    testListSelect.appendChild(option);
  });
}

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
  document.getElementById("mode-select").addEventListener("change", e => { mode = e.target.value; });
  document.getElementById("check-answer-btn").addEventListener("click", checkAnswer);
  document.getElementById("next-word-btn").addEventListener("click", nextWord);
  document.getElementById("load-least-known-btn").addEventListener("click", loadLeastKnown);
  document.getElementById("start-test-btn").addEventListener("click", startTest);
}


// ===== File Loading and Parsing =====

function loadFiles() {
  const fileInput = document.getElementById("file-input");
  const files = fileInput.files;
  if (!files.length) {
    alert("Please select at least one .dcp file.");
    return;
  }
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target.result;
      // Use the file name (without extension) as the list name
      const listName = file.name.replace(/\.[^/.]+$/, "");
      const words = parseDCPFile(content);
      if (words.length) {
        database.lists[listName] = words;
        updateListDropdown();
        updateTestListDropdown();
        saveDatabase();
        // Optionally clear indicators if the loaded list is active
        if (currentListName === listName) {
          document.getElementById("feedback-indicators").innerHTML = "";
        }
      }
    };
    reader.readAsText(file);
  });
}

function parseDCPFile(content) {
  const lines = content.split(/\r?\n/);
  const words = [];
  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith("@") || line.startsWith("HtE")) return;
    const parts = line.split("=");
    if (parts.length < 2) return;
    const english = parts[0].trim();
    const hebrewPart = parts.slice(1).join("=").trim();
    const hebrewOptions = hebrewPart.split("|").map(s => s.trim());
    words.push({ english, hebrewOptions, stats: { correct: 0, incorrect: 0 } });
  });
  return words;
}

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
    updateTestListDropdown();
    saveDatabase();
    alert("List deleted.");
  }
}

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
  reader.onload = event => {
    try {
      database = JSON.parse(event.target.result);
      updateListDropdown();
      updateTestListDropdown();
      saveDatabase();
      alert("Database imported successfully.");
    } catch (e) {
      alert("Error importing database: " + e);
    }
  };
  reader.readAsText(file);
}


// ===== Statistics Functions =====

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
  words.forEach(word => {
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

function showHistogram() {
  const statsDisplay = document.getElementById("stats-display");
  const allWords = [];
  for (const list in database.lists) {
    allWords.push(...database.lists[list]);
  }
  if (!allWords.length) {
    statsDisplay.innerHTML = "<p>No words available.</p>";
    return;
  }
  const bins = Array(20).fill(0);
  allWords.forEach(word => {
    const attempts = word.stats.correct + word.stats.incorrect;
    const ratio = attempts ? word.stats.correct / attempts : 0;
    let index = Math.floor(ratio * 20);
    if (index === 20) index = 19;
    bins[index]++;
  });
  const maxCount = Math.max(...bins);
  let html = "<h3>Histogram of Correct Ratios (20 bins)</h3>";
  html += '<div class="histogram-container">';
  bins.forEach(count => {
    const barHeight = maxCount > 0 ? (count / maxCount * 100) : 0;
    html += `<div class="histogram-bar" style="height: ${barHeight}%;"><span>${count}</span></div>`;
  });
  html += "</div>";
  statsDisplay.innerHTML = html;
}

function showDailyProgressGraph() {
  const statsDisplay = document.getElementById("stats-display");
  if (!database.dailyProgress.length) {
    statsDisplay.innerHTML = "<p>No daily progress data available.</p>";
    return;
  }
  let html = "<h3>Daily Progress Graph</h3>";
  database.dailyProgress.forEach(entry => {
    html += `<div>${entry.date}: ${"*".repeat(entry.knownCount)} (${entry.knownCount} words known)</div>`;
  });
  statsDisplay.innerHTML = html;
}

function showDailyProgressTable() {
  const statsDisplay = document.getElementById("stats-display");
  if (!database.dailyProgress.length) {
    statsDisplay.innerHTML = "<p>No daily progress data available.</p>";
    return;
  }
  let html = "<h3>Daily Progress Table</h3>";
  html += "<table border='1' style='margin:auto;'>";
  html += "<tr><th>Date</th><th>Words Known</th><th>Lists Completed</th></tr>";
  database.dailyProgress.forEach(entry => {
    html += `<tr>
      <td>${entry.date}</td>
      <td>${entry.knownCount}</td>
      <td>${entry.listsCompleted || 0}</td>
    </tr>`;
  });
  html += "</table>";
  statsDisplay.innerHTML = html;
}

function showDatabaseStats() {
  const statsDisplay = document.getElementById("stats-display");
  let totalWords = 0;
  for (const list in database.lists) {
    totalWords += database.lists[list].length;
  }
  let html = `<h3>Database Statistics</h3>`;
  html += `<p>Total words in database: ${totalWords}</p>`;
  statsDisplay.innerHTML = html;
}


// ===== Flashcard Practice Functions =====

// Resets the session state and creates fresh indicators based on the new test’s word count.
function initializeSession(wordsArray) {
  currentSession = shuffle([...wordsArray]); // Randomize order
  currentWordIndex = -1;
  answeredThisWord = false;
  // Clear any previous answer, feedback, or indicators
  document.getElementById("answer-input").value = "";
  document.getElementById("correct-answer-display").textContent = "";
  populateIndicators(currentSession.length);
  document.getElementById("test-info").textContent = `Words in test: ${currentSession.length}`;
  // Set the prompt (do not show any word until "Next Word" is clicked)
  document.getElementById("question-display").textContent = "Press 'Next Word' to begin";
}

// Fisher–Yates shuffle to randomize the array
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Creates indicator squares for each word in the current randomized session.
function populateIndicators(count) {
  const indicatorsDiv = document.getElementById("feedback-indicators");
  indicatorsDiv.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const square = document.createElement("div");
    square.style.backgroundColor = "#fff";
    square.style.width = "20px";
    square.style.height = "20px";
    square.style.margin = "3px";
    square.style.borderRadius = "4px";
    square.style.textAlign = "center";
    square.style.lineHeight = "20px";
    square.style.fontSize = "0.8rem";
    square.style.color = "#000";
    square.textContent = i + 1; // Label with order in the session
    indicatorsDiv.appendChild(square);
  }
}

// Advances to the next word in the current session.
function nextWord() {
  if (currentSession.length === 0) {
    alert("No active test session. Please click 'Start Test' first.");
    return;
  }
  currentWordIndex++;
  if (currentWordIndex >= currentSession.length) {
    alert("You have reached the end of this session.");
    recordDailyProgress();
    // Clear the session state (new test will be needed)
    currentSession = [];
    currentWordIndex = -1;
    return;
  }
  answeredThisWord = false;
  const word = currentSession[currentWordIndex];
  // Clear previous input and feedback
  document.getElementById("answer-input").value = "";
  document.getElementById("correct-answer-display").textContent = "";
  // Display the next word prompt based on the selected mode
  document.getElementById("question-display").textContent = 
    mode === "en-to-he" ? word.english : word.hebrewOptions[0];
}

// Checks the answer for the current word and updates its corresponding indicator.
function checkAnswer() {
  if (currentWordIndex < 0 || currentWordIndex >= currentSession.length) {
    alert("Please click 'Next Word' first.");
    return;
  }
  if (answeredThisWord) return; // Avoid double-checking
  const word = currentSession[currentWordIndex];
  const userAnswer = document.getElementById("answer-input").value.trim();
  let isCorrect = false;
  if (mode === "en-to-he") {
    isCorrect = word.hebrewOptions.some(option => option === userAnswer);
  } else {
    isCorrect = word.english.toLowerCase() === userAnswer.toLowerCase();
  }
  // Always display the correct answer
  document.getElementById("correct-answer-display").textContent = 
    mode === "en-to-he" ? word.hebrewOptions[0] : word.english;
  // Update stats
  if (isCorrect) {
    word.stats.correct++;
  } else {
    word.stats.incorrect++;
  }
  saveDatabase();
  // Update the corresponding indicator square (by session order)
  const indicatorsDiv = document.getElementById("feedback-indicators");
  if (indicatorsDiv.children[currentWordIndex]) {
    indicatorsDiv.children[currentWordIndex].style.backgroundColor =
      isCorrect ? "var(--success-color)" : "var(--error-color)";
  }
  answeredThisWord = true;
}

// Records daily progress and saves it to the database.
function recordDailyProgress() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const dateStr = `${dd}.${mm}.${yyyy}`;
  let progress = database.dailyProgress.find(d => d.date === dateStr);
  if (!progress) {
    progress = { date: dateStr, knownCount: 0, listsCompleted: 0 };
    database.dailyProgress.push(progress);
  }
  const sessionCorrect = currentSession.filter(word => word.stats.correct > 0).length;
  progress.knownCount += sessionCorrect;
  saveDatabase();
}

// Starts a new test session based on the selected list from the test selection dropdown.
// It resets all test state and creates a fresh randomized session and indicators.
function startTest() {
  const testListSelect = document.getElementById("test-list-select");
  const selectedList = testListSelect.value;
  if (!selectedList) {
    alert("Please select a list to start the test.");
    return;
  }
  // Reset any previous session state completely
  currentSession = [];
  currentWordIndex = -1;
  answeredThisWord = false;
  document.getElementById("feedback-indicators").innerHTML = "";
  document.getElementById("answer-input").value = "";
  document.getElementById("correct-answer-display").textContent = "";
  // Set current list and initialize new session
  currentListName = selectedList;
  const wordList = database.lists[selectedList] || [];
  if (wordList.length === 0) {
    alert("The selected list is empty.");
    return;
  }
  initializeSession(wordList);
}
