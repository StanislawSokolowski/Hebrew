/* app.js */

// -----------------------
// IndexedDB Setup (v2)
// -----------------------
let db;
function openDB() {
  return new Promise((resolve, reject) => {
    // Use version 2 to add the "progress" store
    const request = indexedDB.open("HebrewDB", 2);
    request.onupgradeneeded = function(e) {
      db = e.target.result;
      if (!db.objectStoreNames.contains("lists")) {
        db.createObjectStore("lists", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("progress")) {
        // Use the date (YYYY-MM-DD) as the key
        db.createObjectStore("progress", { keyPath: "date" });
      }
    };
    request.onsuccess = function(e) {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = function(e) {
      reject(e);
    };
  });
}

function addListToDB(list) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["lists"], "readwrite");
    const store = transaction.objectStore("lists");
    const request = store.add(list);
    request.onsuccess = function(e) {
      list.id = e.target.result;
      resolve(list);
    };
    request.onerror = function(e) {
      reject(e);
    };
  });
}

function getAllListsFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["lists"], "readonly");
    const store = transaction.objectStore("lists");
    const request = store.getAll();
    request.onsuccess = function(e) {
      resolve(e.target.result);
    };
    request.onerror = function(e) {
      reject(e);
    };
  });
}

function getListFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["lists"], "readonly");
    const store = transaction.objectStore("lists");
    const request = store.get(Number(id));
    request.onsuccess = function(e) {
      resolve(e.target.result);
    };
    request.onerror = function(e) {
      reject(e);
    };
  });
}

function updateListInDB(list) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["lists"], "readwrite");
    const store = transaction.objectStore("lists");
    const request = store.put(list);
    request.onsuccess = function(e) {
      resolve(e.target.result);
    };
    request.onerror = function(e) {
      reject(e);
    };
  });
}

function deleteListFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["lists"], "readwrite");
    const store = transaction.objectStore("lists");
    const request = store.delete(Number(id));
    request.onsuccess = function(e) {
      resolve(e.target.result);
    };
    request.onerror = function(e) {
      reject(e);
    };
  });
}

// -----------------------
// Progress Store Functions
// -----------------------
function getProgressRecord(date) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["progress"], "readonly");
    const store = transaction.objectStore("progress");
    const request = store.get(date);
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e);
  });
}

function addProgressRecord(record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["progress"], "readwrite");
    const store = transaction.objectStore("progress");
    const request = store.add(record);
    request.onsuccess = e => resolve(record);
    request.onerror = e => reject(e);
  });
}

function updateProgressRecord(record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["progress"], "readwrite");
    const store = transaction.objectStore("progress");
    const request = store.put(record);
    request.onsuccess = e => resolve(record);
    request.onerror = e => reject(e);
  });
}

function getAllProgressRecords() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["progress"], "readonly");
    const store = transaction.objectStore("progress");
    const request = store.getAll();
    request.onsuccess = e => resolve(e.target.result);
    request.onerror = e => reject(e);
  });
}

// -----------------------
// Utility Functions
// -----------------------
function containsNikkud(text) {
  return /[\u0591-\u05C7]/.test(text);
}

function getCanonicalHebrew(variants) {
  for (let variant of variants) {
    if (containsNikkud(variant)) {
      return variant;
    }
  }
  return variants[0];
}

function parseDCPText(text) {
  const wordsArray = [];
  const lines = text.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (line === "@") break;
    if (!line) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex > 0) {
      const english = line.substring(0, eqIndex).trim();
      const hebrewPart = line.substring(eqIndex + 1).trim();
      const hebrewVariants = hebrewPart.split("|").map(s => s.trim());
      wordsArray.push({
        english: english,
        hebrew: hebrewVariants,
        status: "default",
        correctStreak: 0,
        correctCount: 0,
        incorrectCount: 0
      });
    }
  }
  return wordsArray;
}

// -----------------------
// Global Variables & UI Elements
// -----------------------
let currentList = null; // Loaded list object
let sessionWords = [];  // Deep copies for the current session
let currentWordIndex = -1;
let globalSessionMode = false;
let progressRecorded = false; // To ensure progress is recorded only once per session

const fileInput = document.getElementById("fileInput");
const uploadFileButton = document.getElementById("uploadFileButton");
const dbListSelect = document.getElementById("dbListSelect");
const loadListButton = document.getElementById("loadListButton");
const deleteListButton = document.getElementById("deleteListButton");
const leastKnownButton = document.getElementById("leastKnownButton");
const statsButton = document.getElementById("statsButton");
const wordGraphButton = document.getElementById("wordGraphButton");
const progressGraphButton = document.getElementById("progressGraphButton");
const progressTableButton = document.getElementById("progressTableButton");

const questionDiv = document.getElementById("question");
const correctAnswerDiv = document.getElementById("correctAnswer");
const answerInput = document.getElementById("answer");
const checkButton = document.getElementById("checkButton");
const nextButton = document.getElementById("nextButton");
const feedbackDiv = document.getElementById("feedback");
const sidePanel = document.getElementById("sidePanel");

const statsModal = document.getElementById("statsModal");
const closeStatsModal = document.getElementById("closeStatsModal");
const statsTableBody = document.querySelector("#statsTable tbody");

const graphModal = document.getElementById("graphModal");
const closeGraphModal = document.getElementById("closeGraphModal");
const wordGraphCanvas = document.getElementById("wordGraphCanvas");

const progressModal = document.getElementById("progressModal");
const closeProgressModal = document.getElementById("closeProgressModal");
const progressGraphCanvas = document.getElementById("progressGraphCanvas");

const progressTableModal = document.getElementById("progressTableModal");
const closeProgressTableModal = document.getElementById("closeProgressTableModal");
const progressTableBody = document.querySelector("#progressTable tbody");

// -----------------------
// Helper Function: Shuffle (Fisher-Yates)
// -----------------------
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// -----------------------
// Side Panel Update
// -----------------------
function updateSidePanel() {
  sidePanel.innerHTML = "";
  if (!sessionWords || sessionWords.length === 0) return;
  sessionWords.forEach(word => {
    const bar = document.createElement("div");
    bar.className = "word-bar";
    if (word.status === "known") {
      bar.style.backgroundColor = "#388e3c";
    } else if (word.status === "wrong") {
      bar.style.backgroundColor = "#d32f2f";
    } else {
      bar.style.backgroundColor = "#ffffff";
    }
    sidePanel.appendChild(bar);
  });
}

// -----------------------
// Flashcard Session Functions
// -----------------------
function startSession(wordsArray, isGlobalMode = false) {
  progressRecorded = false; // Reset flag for this session
  sessionWords = wordsArray.map(word => {
    return {
      english: word.english,
      hebrew: word.hebrew.slice(),
      status: "default",
      correctCount: word.correctCount,
      incorrectCount: word.incorrectCount,
      correctStreak: 0
      // For global sessions, parentListId will be added later as needed.
    };
  });
  shuffle(sessionWords);
  currentWordIndex = -1;
  globalSessionMode = isGlobalMode;
  nextWord();
}

function nextWord() {
  if (!sessionWords || sessionWords.length === 0) {
    questionDiv.textContent = "No words available in this session.";
    return;
  }
  currentWordIndex = (currentWordIndex + 1) % sessionWords.length;
  displayCurrentWord();
}

function displayCurrentWord() {
  const currentWord = sessionWords[currentWordIndex];
  const mode = document.querySelector('select#modeSelect')?.value || "engToHeb";
  if (mode === "engToHeb") {
    questionDiv.textContent = currentWord.english;
  } else {
    const randomIndex = Math.floor(Math.random() * currentWord.hebrew.length);
    questionDiv.textContent = currentWord.hebrew[randomIndex];
  }
  correctAnswerDiv.textContent = "";
  answerInput.value = "";
  answerInput.classList.remove("known", "wrong");
  feedbackDiv.textContent = "";
  answerInput.focus();
}

function checkAnswer() {
  if (!sessionWords || sessionWords.length === 0) return;
  const currentWord = sessionWords[currentWordIndex];
  const mode = document.querySelector('select#modeSelect')?.value || "engToHeb";
  const userAnswer = answerInput.value.trim();
  let isCorrect = false;
  
  if (mode === "engToHeb") {
    isCorrect = currentWord.hebrew.some(ans => ans === userAnswer);
  } else {
    isCorrect = (currentWord.english.toLowerCase() === userAnswer.toLowerCase());
  }
  
  const canonicalAnswer = (mode === "engToHeb") ? getCanonicalHebrew(currentWord.hebrew) : currentWord.english;
  
  if (isCorrect) {
    currentWord.correctCount++;
    if (currentWord.status === "wrong") {
      currentWord.correctStreak++;
      if (currentWord.correctStreak >= 2) {
        currentWord.status = "known";
        feedbackDiv.textContent = "Correct! Word is now marked as known.";
      } else {
        feedbackDiv.textContent = "Correct! (Answer it correctly once more to mark as known.)";
      }
    } else {
      currentWord.status = "known";
      feedbackDiv.textContent = "Correct! Word marked as known.";
    }
  } else {
    currentWord.incorrectCount++;
    currentWord.status = "wrong";
    currentWord.correctStreak = 0;
    feedbackDiv.textContent = "Incorrect. Try again.";
  }
  
  correctAnswerDiv.innerHTML = `Correct Answer:<br><span class="nikkud-answer">${canonicalAnswer}</span>`;
  
  updateSidePanel();
  
  // Update overall statistics in the database (save with default status).
  if (!globalSessionMode && currentList) {
    for (let word of currentList.words) {
      if (word.english === currentWord.english &&
          JSON.stringify(word.hebrew) === JSON.stringify(currentWord.hebrew)) {
        word.correctCount = currentWord.correctCount;
        word.incorrectCount = currentWord.incorrectCount;
        word.correctStreak = currentWord.correctStreak;
        word.status = "default";
        break;
      }
    }
    updateListInDB(currentList).then(() => {
      console.log("List updated in DB (single-list mode).");
    });
  } else if (globalSessionMode && currentWord.parentListId) {
    getListFromDB(currentWord.parentListId).then(list => {
      if (list) {
        for (let word of list.words) {
          if (word.english === currentWord.english &&
              JSON.stringify(word.hebrew) === JSON.stringify(currentWord.hebrew)) {
            word.correctCount = currentWord.correctCount;
            word.incorrectCount = currentWord.incorrectCount;
            word.correctStreak = currentWord.correctStreak;
            word.status = "default";
            break;
          }
        }
        updateListInDB(list).then(() => {
          console.log("Parent list updated in DB (global mode).");
        });
      }
    });
  }
  
  // If all words in the session are known, display a "Well done" message and record progress.
  if (sessionWords.every(word => word.status === "known")) {
    feedbackDiv.textContent += " Well done!";
    recordProgress(sessionWords.length);
  }
}

// -----------------------
// Progress Recording
// -----------------------
function recordProgress(wordsLearned) {
  if (progressRecorded) return;
  progressRecorded = true;
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  getProgressRecord(dateStr).then(record => {
    if (record) {
      record.wordsLearned += wordsLearned;
      record.testsDone += 1;
      updateProgressRecord(record);
    } else {
      const newRecord = { date: dateStr, wordsLearned: wordsLearned, testsDone: 1 };
      addProgressRecord(newRecord);
    }
  }).catch(err => console.error(err));
}

// -----------------------
// Statistics Modal Functions (Word Stats)
// -----------------------
function displayStatistics() {
  getAllListsFromDB().then(lists => {
    let allWords = [];
    lists.forEach(list => {
      list.words.forEach(word => {
        allWords.push({ english: word.english, correctCount: word.correctCount, incorrectCount: word.incorrectCount });
      });
    });
    // Build table rows.
    statsTableBody.innerHTML = "";
    allWords.forEach(word => {
      const total = word.correctCount + word.incorrectCount;
      const ratio = total > 0 ? (word.incorrectCount / total).toFixed(2) : "0.00";
      const row = document.createElement("tr");
      row.innerHTML = `<td>${word.english}</td><td>${word.correctCount}</td><td>${word.incorrectCount}</td><td>${ratio}</td>`;
      statsTableBody.appendChild(row);
    });
    statsModal.style.display = "block";
  });
}

// -----------------------
// Graph Functions using Chart.js
// -----------------------
let wordChart;
function showWordGraph() {
  getAllListsFromDB().then(lists => {
    let allWords = [];
    lists.forEach(list => {
      list.words.forEach(word => {
        const total = word.correctCount + word.incorrectCount;
        const ratio = total > 0 ? (word.incorrectCount / total) : 0;
        allWords.push({ label: word.english, ratio: ratio });
      });
    });
    const labels = allWords.map(w => w.label);
    const data = allWords.map(w => w.ratio);
    const ctx = document.getElementById("wordGraphCanvas").getContext("2d");
    if (wordChart) wordChart.destroy();
    wordChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Incorrect Ratio',
          data: data,
          backgroundColor: 'rgba(211,47,47,0.7)'
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 1
          }
        }
      }
    });
    document.getElementById("graphModal").style.display = "block";
  });
}

let progressChart;
function showProgressGraph() {
  getAllProgressRecords().then(records => {
    records.sort((a, b) => a.date.localeCompare(b.date));
    const labels = records.map(r => r.date);
    const data = records.map(r => r.wordsLearned);
    const ctx = document.getElementById("progressGraphCanvas").getContext("2d");
    if (progressChart) progressChart.destroy();
    progressChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Words Learned',
          data: data,
          backgroundColor: 'rgba(56,142,60,0.7)'
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
    document.getElementById("progressModal").style.display = "block";
  });
}

function showProgressTable() {
  getAllProgressRecords().then(records => {
    records.sort((a, b) => a.date.localeCompare(b.date));
    const tbody = document.querySelector("#progressTable tbody");
    tbody.innerHTML = "";
    records.forEach(record => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${record.date}</td><td>${record.wordsLearned}</td><td>${record.testsDone}</td>`;
      tbody.appendChild(row);
    });
    document.getElementById("progressTableModal").style.display = "block";
  });
}

// -----------------------
// Event Listeners for New Buttons and Modal Closes
// -----------------------
checkButton.addEventListener("click", checkAnswer);
nextButton.addEventListener("click", nextWord);
statsButton.addEventListener("click", displayStatistics);
wordGraphButton.addEventListener("click", showWordGraph);
progressGraphButton.addEventListener("click", showProgressGraph);
progressTableButton.addEventListener("click", showProgressTable);

leastKnownButton.addEventListener("click", function() {
  // Global least-known session: aggregate words from all lists.
  getAllListsFromDB().then(lists => {
    let aggregatedWords = [];
    lists.forEach(list => {
      list.words.forEach(word => {
        const total = word.correctCount + word.incorrectCount;
        const metric = total > 0 ? (word.incorrectCount / total) : 0;
        const wordClone = Object.assign({}, word);
        wordClone.parentListId = list.id;
        wordClone.metric = metric;
        aggregatedWords.push(wordClone);
      });
    });
    aggregatedWords.sort((a, b) => b.metric - a.metric);
    const leastKnown = aggregatedWords.slice(0, 20);
    startSession(leastKnown, true);
    updateSidePanel();
  });
});

// Allow multiple file upload with default name suggestion.
uploadFileButton.addEventListener("click", function() {
  const files = fileInput.files;
  if (!files || files.length === 0) {
    feedbackDiv.textContent = "Please select at least one file first.";
    return;
  }
  let filesProcessed = 0;
  let feedbackMessage = "";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reader = new FileReader();
    reader.readAsText(file, "utf-16le");
    reader.onload = function() {
      const text = reader.result;
      const wordsArray = parseDCPText(text);
      if (wordsArray.length === 0) {
        feedbackMessage += `No words found in file ${file.name}. `;
        filesProcessed++;
        if (filesProcessed === files.length) {
          feedbackDiv.textContent = feedbackMessage;
          populateListDropdown();
        }
        return;
      }
      let defaultName = file.name;
      defaultName = defaultName.replace(/^HtE/i, '');
      if (defaultName.toLowerCase().endsWith(".dcp")) {
        defaultName = defaultName.slice(0, -4);
      }
      const listName = prompt(`Enter a name for this list:`, defaultName);
      if (!listName) {
        feedbackMessage += `List name is required for file ${file.name}. `;
        filesProcessed++;
        if (filesProcessed === files.length) {
          feedbackDiv.textContent = feedbackMessage;
          populateListDropdown();
        }
        return;
      }
      const newList = {
        name: listName,
        words: wordsArray
      };
      addListToDB(newList).then(list => {
        feedbackMessage += `List "${list.name}" added with ${list.words.length} words. `;
        filesProcessed++;
        if (filesProcessed === files.length) {
          feedbackDiv.textContent = feedbackMessage;
          populateListDropdown();
        }
      }).catch(err => {
        feedbackMessage += `Error adding file ${file.name} to DB. `;
        filesProcessed++;
        if (filesProcessed === files.length) {
          feedbackDiv.textContent = feedbackMessage;
          populateListDropdown();
        }
      });
    };
    reader.onerror = function() {
      feedbackMessage += `Error reading file ${file.name}. `;
      filesProcessed++;
      if (filesProcessed === files.length) {
        feedbackDiv.textContent = feedbackMessage;
        populateListDropdown();
      }
    };
  }
});

loadListButton.addEventListener("click", function() {
  const selectedId = dbListSelect.value;
  if (!selectedId) {
    feedbackDiv.textContent = "Please select a list.";
    return;
  }
  getListFromDB(selectedId).then(list => {
    if (list) {
      currentList = list;
      startSession(currentList.words, false);
      globalSessionMode = false;
      updateSidePanel();
      feedbackDiv.textContent = `Loaded list "${currentList.name}" with ${currentList.words.length} words.`;
    }
  });
});

deleteListButton.addEventListener("click", function() {
  const selectedId = dbListSelect.value;
  if (!selectedId) {
    feedbackDiv.textContent = "Please select a list to delete.";
    return;
  }
  if (confirm("Are you sure you want to delete this list? This action cannot be undone.")) {
    deleteListFromDB(selectedId).then(() => {
      feedbackDiv.textContent = "List deleted.";
      populateListDropdown();
      if (currentList && currentList.id == selectedId) {
        currentList = null;
        sessionWords = [];
        questionDiv.textContent = "No list loaded.";
        sidePanel.innerHTML = "";
      }
    });
  }
});

// Populate the dropdown with lists sorted alphabetically.
function populateListDropdown() {
  getAllListsFromDB().then(lists => {
    lists.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    dbListSelect.innerHTML = "";
    lists.forEach(list => {
      const option = document.createElement("option");
      option.value = list.id;
      option.textContent = list.name;
      dbListSelect.appendChild(option);
    });
  });
}

// -----------------------
// Modal Close Event Listeners
// -----------------------
closeStatsModal.addEventListener("click", () => { statsModal.style.display = "none"; });
closeGraphModal.addEventListener("click", () => { graphModal.style.display = "none"; });
closeProgressModal.addEventListener("click", () => { progressModal.style.display = "none"; });
closeProgressTableModal.addEventListener("click", () => { progressTableModal.style.display = "none"; });

window.addEventListener("click", function(event) {
  if (event.target === statsModal) statsModal.style.display = "none";
  if (event.target === graphModal) graphModal.style.display = "none";
  if (event.target === progressModal) progressModal.style.display = "none";
  if (event.target === progressTableModal) progressTableModal.style.display = "none";
});

// -----------------------
// Initialization
// -----------------------
window.addEventListener("load", function() {
  openDB().then(() => {
    populateListDropdown();
  });
});
