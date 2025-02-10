/* 
  Hebrew Flashcards App
  ---------------------
  (Database, file parsing, import/export, and statistics code remains unchanged.)
*/

// Global “database” object to hold lists and daily progress.
let database = JSON.parse(localStorage.getItem("hebrewDB")) || {
  lists: {},
  dailyProgress: []
};

// -------------------------
// NEW SESSION MANAGEMENT
// -------------------------
// Instead of shuffling the list, we keep the words in the original order
// (for the indicators) and choose the next word randomly among those that
// are still “not mastered” (i.e. not marked green).
let currentListID = null;
let currentList = [];         // The words from the chosen list (in list order)
let sessionStatus = [];       // For each word, "default" (white), "red", or "green"
let currentWordIndex = null;  // The index (in currentList) of the word currently being attempted
let mode = "eng-to-heb";      // default flashcard mode

// ----- Utility functions for persistence -----
function saveDatabase() {
  localStorage.setItem("hebrewDB", JSON.stringify(database));
}

function updateTotalWordsDisplay() {
  const totalWords = Object.values(database.lists).reduce(
    (sum, list) => sum + list.words.length,
    0
  );
  document.getElementById("total-words").textContent = totalWords;
}

// -------------------------
// File Parsing and Database Management (unchanged)
// -------------------------
function parseDCP(text) {
  const lines = text.split(/\r?\n/);
  const words = [];
  for (let line of lines) {
    line = line.trim();
    // Skip header if it starts with "HtE"
    if (line === "HtE") continue;
    if (line === "@") break;
    if (!line) continue;
    // Expected format: question=answer1|answer2|...
    const parts = line.split("=");
    if (parts.length !== 2) continue;
    const question = parts[0].trim();
    const answerParts = parts[1].split("|").map((a) => a.trim());
    words.push({
      question,
      answers: answerParts,
      stats: { correct: 0, incorrect: 0 }
    });
  }
  return words;
}

function loadFiles(files) {
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const words = parseDCP(text);
      // Use file name (without extension) as list name.
      const listName = file.name.replace(/\.dcp$/i, "");
      const listID = Date.now() + "-" + Math.random();
      database.lists[listID] = {
        name: listName,
        words: words
      };
      saveDatabase();
      updateListSelect();
      updateTotalWordsDisplay();
      alert(`Loaded list "${listName}" with ${words.length} words.`);
    };
    reader.readAsText(file);
  });
}

function updateListSelect() {
  const select = document.getElementById("list-select");
  select.innerHTML = "";
  // Order lists alphabetically by name:
  const listsArr = Object.entries(database.lists).sort((a, b) =>
    a[1].name.localeCompare(b[1].name)
  );
  listsArr.forEach(([id, list]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = list.name;
    select.appendChild(option);
  });
}

function deleteCurrentList() {
  if (!currentListID) return;
  if (!confirm("Are you sure you want to delete this list?")) return;
  delete database.lists[currentListID];
  saveDatabase();
  updateListSelect();
  updateTotalWordsDisplay();
  // Clear current session
  currentListID = null;
  currentList = [];
  sessionStatus = [];
  currentWordIndex = null;
  document.getElementById("word-display").textContent = "";
  document.getElementById("indicators").innerHTML = "";
}

// -------------------------
// NEW Session Functions
// -------------------------

// Start a session using the original list order.
function startSession(listID, wordsArray) {
  currentListID = listID;
  currentList = wordsArray; // Keep the order as provided (the order in the file)
  sessionStatus = new Array(wordsArray.length).fill("default"); // All indicators white initially
  
  // Build the indicator squares in the order of the list.
  const indicators = document.getElementById("indicators");
  indicators.innerHTML = "";
  currentList.forEach((word, idx) => {
    const sq = document.createElement("div");
    sq.className = "indicator";
    // Save the index as a data attribute so we can update it later.
    sq.dataset.index = idx;
    sq.style.backgroundColor = "white";
    indicators.appendChild(sq);
  });
  updateWordCountDisplay();
  chooseNextWord();
}

// Choose randomly from words that have not yet been answered correctly.
function chooseNextWord() {
  const availableIndices = [];
  for (let i = 0; i < sessionStatus.length; i++) {
    if (sessionStatus[i] !== "green") {
      availableIndices.push(i);
    }
  }
  if (availableIndices.length === 0) {
    recordDailyProgress();
    alert("Session complete!");
    return;
  }
  currentWordIndex =
    availableIndices[Math.floor(Math.random() * availableIndices.length)];
  displayCurrentWord();
}

// Show the current word according to the mode.
function displayCurrentWord() {
  const wordObj = currentList[currentWordIndex];
  const display = document.getElementById("word-display");
  if (mode === "eng-to-heb") {
    display.textContent = wordObj.question;
  } else {
    // For Hebrew-to-English, display the first answer (assumed to be the main one)
    display.textContent = wordObj.answers[0];
  }
  document.getElementById("answer-input").value = "";
  document.getElementById("correct-answer-display").textContent = "";
}

// Update the counter to show how many words remain unmastered.
function updateWordCountDisplay() {
  const remaining = sessionStatus.filter((s) => s !== "green").length;
  document.getElementById("word-count").textContent =
    "Remaining Words: " + remaining + " / " + currentList.length;
}

// When the user checks an answer, update the indicator and database stats.
function checkAnswer() {
  const input = document.getElementById("answer-input").value.trim();
  const wordObj = currentList[currentWordIndex];
  let correctAnswers;
  if (mode === "eng-to-heb") {
    correctAnswers = wordObj.answers;
  } else {
    correctAnswers = [wordObj.question];
  }
  const isCorrect = correctAnswers.some(
    (ans) => ans.toLowerCase() === input.toLowerCase()
  );
  // Always show the correct answer (the first acceptable one) above the input.
  document.getElementById("correct-answer-display").textContent =
    correctAnswers[0];
  
  // Update the session state and the corresponding indicator:
  const indicator = document
    .getElementById("indicators")
    .querySelector(`[data-index="${currentWordIndex}"]`);
  if (isCorrect) {
    sessionStatus[currentWordIndex] = "green";
    indicator.style.backgroundColor = "limegreen";
    wordObj.stats.correct++;
  } else {
    sessionStatus[currentWordIndex] = "red";
    indicator.style.backgroundColor = "red";
    wordObj.stats.incorrect++;
  }
  saveDatabase();
  updateWordCountDisplay();
}

// Next word: choose a new word randomly (only from default/red ones).
function nextWord() {
  chooseNextWord();
}

// -------------------------
// “20 Least Known Words” Loader (unchanged logic)
// -------------------------
function loadWeakWords() {
  const allWords = [];
  Object.values(database.lists).forEach((list) => {
    list.words.forEach((word) => {
      allWords.push(word);
    });
  });
  // Compute ratio: correct / (correct + incorrect), or 0 if no attempts.
  allWords.forEach((w) => {
    const total = w.stats.correct + w.stats.incorrect;
    w.ratio = total ? w.stats.correct / total : 0;
  });
  // Sort by ratio ascending and take 20
  const weakest = allWords.sort((a, b) => a.ratio - b.ratio).slice(0, 20);
  // Start a session with these words (the indicators will be in the order of this list)
  startSession("weak-words", weakest);
}

// -------------------------
// Statistics Display (unchanged)
// -------------------------
function showWordStats() {
  const select = document.getElementById("list-select");
  const listID = select.value;
  if (!listID) {
    alert("No list selected");
    return;
  }
  const list = database.lists[listID];
  let msg = `Statistics for list "${list.name}":\n`;
  list.words.forEach((w) => {
    const total = w.stats.correct + w.stats.incorrect;
    const ratio = total ? (w.stats.correct / total).toFixed(2) : "N/A";
    msg += `${w.question}: ${w.stats.correct} correct, ${w.stats.incorrect} incorrect (ratio: ${ratio})\n`;
  });
  alert(msg);
}

function showHistogram() {
  const allWords = [];
  Object.values(database.lists).forEach((list) => {
    list.words.forEach((w) => {
      const total = w.stats.correct + w.stats.incorrect;
      const ratio = total ? w.stats.correct / total : 0;
      allWords.push(ratio);
    });
  });
  const bins = new Array(20).fill(0);
  allWords.forEach((ratio) => {
    const idx = Math.min(19, Math.floor(ratio * 20));
    bins[idx]++;
  });
  let histo = "Ratio Histogram (bins):\n";
  bins.forEach((count, i) => {
    histo += `[${(i / 20).toFixed(2)}-${((i + 1) / 20).toFixed(2)}]: ${count}\n`;
  });
  alert(histo);
}

function updateDailyProgressDisplay() {
  const canvas = document.getElementById("daily-progress-canvas");
  if (!canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const progress = database.dailyProgress.sort((a, b) => {
    const [d1, m1, y1] = a.date.split(".").map(Number);
    const [d2, m2, y2] = b.date.split(".").map(Number);
    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
  });
  if (progress.length === 0) return;
  const padding = 20;
  const width = canvas.width - 2 * padding;
  const height = canvas.height - 2 * padding;
  const maxCompleted = Math.max(...progress.map((p) => p.listsCompleted));
  const pointSpacing = width / (progress.length - 1);
  ctx.beginPath();
  progress.forEach((p, i) => {
    const x = padding + i * pointSpacing;
    const y =
      padding +
      height -
      (p.listsCompleted / maxCompleted) * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = "limegreen";
  ctx.lineWidth = 2;
  ctx.stroke();
  
  const tbody = document.querySelector("#daily-progress-table tbody");
  tbody.innerHTML = "";
  progress.forEach((p) => {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    dateCell.textContent = p.date;
    const countCell = document.createElement("td");
    countCell.textContent = p.listsCompleted;
    row.append(dateCell, countCell);
    tbody.appendChild(row);
  });
}

function recordDailyProgress() {
  const today = new Date();
  const dateStr =
    ("0" + today.getDate()).slice(-2) +
    "." +
    ("0" + (today.getMonth() + 1)).slice(-2) +
    "." +
    today.getFullYear();
  const existing = database.dailyProgress.find((entry) => entry.date === dateStr);
  if (existing) {
    existing.listsCompleted++;
  } else {
    database.dailyProgress.push({ date: dateStr, listsCompleted: 1 });
  }
  saveDatabase();
  updateDailyProgressDisplay();
}

// -------------------------
// Event Listeners & UI Wiring
// -------------------------

document.getElementById("load-files").addEventListener("click", () => {
  const files = document.getElementById("file-input").files;
  if (files.length === 0) {
    alert("Please select one or more .dcp files.");
    return;
  }
  loadFiles(files);
});

document.getElementById("list-select").addEventListener("change", (e) => {
  const listID = e.target.value;
  if (listID && database.lists[listID]) {
    startSession(listID, database.lists[listID].words);
  }
});

document.getElementById("delete-list").addEventListener("click", () => {
  deleteCurrentList();
});

document.getElementById("export-db").addEventListener("click", () => {
  const dataStr = JSON.stringify(database, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hebrew_db.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-db").addEventListener("click", () => {
  document.getElementById("import-db-input").click();
});

document.getElementById("import-db-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      database = JSON.parse(ev.target.result);
      saveDatabase();
      updateListSelect();
      updateTotalWordsDisplay();
      updateDailyProgressDisplay();
      alert("Database imported successfully!");
    } catch (err) {
      alert("Failed to import database.");
    }
  };
  reader.readAsText(file);
});

document.getElementById("show-word-stats").addEventListener("click", () => {
  showWordStats();
});

document.getElementById("show-histogram").addEventListener("click", () => {
  showHistogram();
});

document.querySelectorAll("input[name='mode']").forEach((el) => {
  el.addEventListener("change", (e) => {
    mode = e.target.value;
    displayCurrentWord();
  });
});

document.getElementById("check-answer").addEventListener("click", () => {
  checkAnswer();
});

document.getElementById("next-word").addEventListener("click", () => {
  nextWord();
});

document.getElementById("load-weak-words").addEventListener("click", () => {
  loadWeakWords();
});

// Close dropdowns when clicking outside.
document.addEventListener("click", function (e) {
  document.querySelectorAll(".dropdown-content").forEach((drop) => {
    if (!drop.contains(e.target) && !drop.previousElementSibling.contains(e.target)) {
      drop.style.display = "none";
    }
  });
});
document.querySelectorAll(".dropdown").forEach((drop) => {
  drop.addEventListener("mouseenter", () => {
    drop.querySelector(".dropdown-content").style.display = "block";
  });
  drop.addEventListener("mouseleave", () => {
    drop.querySelector(".dropdown-content").style.display = "none";
  });
});

// On load, initialize UI.
updateListSelect();
updateTotalWordsDisplay();
updateDailyProgressDisplay();
