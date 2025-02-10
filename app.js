/* 
  Hebrew Flashcards App
  ---------------------
  This script handles:
    • Parsing .dcp files (ignoring any "HtE" header and ending at "@")
    • Storing lists and word statistics in localStorage
    • Managing the flashcard session (mode selection, checking answers,
      randomizing words, and updating on-screen indicators)
    • Database import/export and deletion of lists
    • Displaying statistics (word stats, ratio histogram, daily progress)
*/

// Global “database” object to hold lists and daily progress.
// Structure example:
// {
//   lists: { listID: { name, words: [{question, answers, stats: {correct, incorrect}}] } },
//   dailyProgress: [{ date: 'dd.mm.yyyy', listsCompleted: N }]
// }
let database = JSON.parse(localStorage.getItem("hebrewDB")) || {
  lists: {},
  dailyProgress: []
};

// For the current flashcard session:
let currentListID = null;
let currentWords = []; // randomized order
let currentWordIndex = 0;
let mode = "eng-to-heb"; // default

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

// ----- File Parsing and Database Management -----
function parseDCP(text) {
  const lines = text.split(/\r?\n/);
  const words = [];
  for (let line of lines) {
    line = line.trim();
    // Skip header if it starts with "HtE"
    if (line === "HtE") continue;
    if (line === "@") break;
    if (!line) continue;
    // Expect format: question=answer1|answer2|...
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
  // Process each file
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const words = parseDCP(text);
      // Use the file name (without extension) as list name, ordering out any HtE.
      const listName = file.name.replace(/\.dcp$/i, "");
      // Use a timestamp as a unique list ID.
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
  // Clear previous options
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
  // Clear current session if needed
  currentListID = null;
  currentWords = [];
  currentWordIndex = 0;
  document.getElementById("word-display").textContent = "";
  document.getElementById("indicators").innerHTML = "";
}

// ----- Flashcard Session Management -----
function startSession(listID, wordsArray) {
  currentListID = listID;
  // Shuffle the words (simple Fisher-Yates)
  currentWords = [...wordsArray];
  for (let i = currentWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [currentWords[i], currentWords[j]] = [currentWords[j], currentWords[i]];
  }
  currentWordIndex = 0;
  // Build indicators: one square per word.
  const indicators = document.getElementById("indicators");
  indicators.innerHTML = "";
  currentWords.forEach(() => {
    const sq = document.createElement("div");
    sq.className = "indicator";
    indicators.appendChild(sq);
  });
  updateWordCountDisplay();
  displayCurrentWord();
}

function updateWordCountDisplay() {
  document.getElementById("word-count").textContent =
    "Words: " + currentWords.length;
}

function displayCurrentWord() {
  const wordObj = currentWords[currentWordIndex];
  const display = document.getElementById("word-display");
  // Depending on mode, display the “question” or one of the answers.
  if (mode === "eng-to-heb") {
    display.textContent = wordObj.question;
  } else {
    // For Hebrew-to-English, display first answer (assumes that is the main answer)
    display.textContent = wordObj.answers[0];
  }
  // Clear answer input and the correct answer display
  document.getElementById("answer-input").value = "";
  document.getElementById("correct-answer-display").textContent = "";
}

function checkAnswer() {
  const input = document.getElementById("answer-input").value.trim();
  const wordObj = currentWords[currentWordIndex];
  // Determine which field is expected based on mode
  let correctAnswers;
  if (mode === "eng-to-heb") {
    correctAnswers = wordObj.answers;
  } else {
    correctAnswers = [wordObj.question];
  }
  // Simple case-insensitive check
  const isCorrect = correctAnswers.some(
    (ans) => ans.toLowerCase() === input.toLowerCase()
  );
  // Always show the correct answer (first acceptable answer, with nikkud if available)
  document.getElementById("correct-answer-display").textContent =
    correctAnswers[0];
  // Update indicator for this word
  const indicator = document.getElementById("indicators").children[
    currentWordIndex
  ];
  if (isCorrect) {
    indicator.style.backgroundColor = "limegreen";
    wordObj.stats.correct++;
  } else {
    indicator.style.backgroundColor = "red";
    wordObj.stats.incorrect++;
  }
  // Save stats in the database:
  // (Assuming that the word objects in currentWords are references into database.lists)
  saveDatabase();
}

function nextWord() {
  // Advance to next word in session. Wrap around if at the end.
  currentWordIndex++;
  if (currentWordIndex >= currentWords.length) {
    // Optionally record that this list has been “completed”
    recordDailyProgress();
    alert("Session complete!");
    currentWordIndex = 0; // restart the session if desired
  }
  displayCurrentWord();
}

function recordDailyProgress() {
  // Record that a list was fully completed today.
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

// ----- “20 Least Known Words” Loader -----
// Here we compute a “known ratio” for each word and pick the 20 with lowest ratio.
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
  // Start a session with these words (using a dummy list ID)
  startSession("weak-words", weakest);
}

// ----- Statistics Display -----
// (For brevity these functions are simplified.)
function showWordStats() {
  // For the currently selected list, show each word’s stats in an alert
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
  // Create a simple histogram (n=20 bins) of ratios over all words.
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
    // Ratio in [0,1] so multiply by 19 and floor for index (0-19)
    const idx = Math.min(19, Math.floor(ratio * 20));
    bins[idx]++;
  });
  // For simplicity, show the bins in an alert.
  let histo = "Ratio Histogram (bins):\n";
  bins.forEach((count, i) => {
    histo += `[${(i / 20).toFixed(2)}-${((i + 1) / 20).toFixed(2)}]: ${count}\n`;
  });
  alert(histo);
}

// Draw the daily progress graph in the canvas
function updateDailyProgressDisplay() {
  const canvas = document.getElementById("daily-progress-canvas");
  if (!canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Sort progress by date (assuming dd.mm.yyyy)
  const progress = database.dailyProgress.sort((a, b) => {
    const [d1, m1, y1] = a.date.split(".").map(Number);
    const [d2, m2, y2] = b.date.split(".").map(Number);
    return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
  });
  if (progress.length === 0) return;
  // Draw a simple line graph
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
  // Also update the daily progress table.
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

// ----- Event Listeners & UI wiring -----

document.getElementById("load-files").addEventListener("click", () => {
  const files = document.getElementById("file-input").files;
  if (files.length === 0) {
    alert("Please select one or more .dcp files.");
    return;
  }
  loadFiles(files);
});

// When a list is chosen, start a session with that list.
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

// Mode selection change
document.querySelectorAll("input[name='mode']").forEach((el) => {
  el.addEventListener("change", (e) => {
    mode = e.target.value;
    // When the mode changes, update the displayed word.
    displayCurrentWord();
  });
});

// Check answer button
document.getElementById("check-answer").addEventListener("click", () => {
  checkAnswer();
});

// Next word button
document.getElementById("next-word").addEventListener("click", () => {
  nextWord();
});

// Load 20 least known words
document.getElementById("load-weak-words").addEventListener("click", () => {
  loadWeakWords();
});

// Close any open dropdown if user clicks outside.
document.addEventListener("click", function (e) {
  document.querySelectorAll(".dropdown-content").forEach((drop) => {
    if (!drop.contains(e.target) && !drop.previousElementSibling.contains(e.target)) {
      drop.style.display = "none";
    }
  });
});
// Re-show dropdown on hover (this makes them easier to use on mobile)
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
