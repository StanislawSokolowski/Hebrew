/* app.js */

// -----------------------
// IndexedDB Setup (version 2 with a progress store)
// -----------------------
let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("HebrewDB", 2);
    request.onupgradeneeded = function(e) {
      db = e.target.result;
      if (!db.objectStoreNames.contains("lists")) {
        db.createObjectStore("lists", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("progress")) {
        // Use date (YYYY-MM-DD) as key
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

// Clear a given object store.
function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = e => resolve();
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
let currentList = null;
let sessionWords = [];
let currentWordIndex = -1;
let globalSessionMode = false;
let progressRecorded = false;

const fileInput = document.getElementById("fileInput");
const uploadFileButton = document.getElementById("uploadFileButton");
const dbListSelect = document.getElementById("dbListSelect");
const loadListButton = document.getElementById("loadListButton");
const deleteListButton = document.getElementById("deleteListButton");
const exportDBButton = document.getElementById("exportDBButton");
const importDBButton = document.getElementById("importDBButton");
const importDBInput = document.getElementById("importDBInput");
const leastKnownButton = document.getElementById("leastKnownButton");
const statsButton = document.getElementById("statsButton");
const wordGraphButton = document.getElementById("wordGraphButton");
const progressGraphButton = document.getElementById("progressGraphButton");
const progressTableButton = document.getElementById("progressTableButton");

const overallWordCountEl = document.getElementById("overallWordCount");

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
  progressRecorded = false;
  sessionWords = wordsArray.map(word => {
    return {
      english: word.english,
      hebrew: word.hebrew.slice(),
      status: "default",
      correctCount: word.correctCount,
      incorrectCount: word.incorrectCount,
      correctStreak: 0
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
  
  // Update database record (store status always as "default")
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
      console.log("List updated (single-list mode).");
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
          console.log("Parent list updated (global mode).");
        });
      }
    });
  }
  
  // If all words are known, show "Well done!" and record progress.
  if (sessionWords.every(word => word.status === "known")) {
    feedbackDiv.textContent += " Well done!";
    recordProgress(sessionWords.length);
  }
}

// -----------------------
// Progress Recording Functions
// -----------------------
function recordProgress(wordsLearned) {
  if (progressRecorded) return;
  progressRecorded = true;
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
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
// Statistics & Graph Functions
// -----------------------
function displayStatistics() {
  getAllListsFromDB().then(lists => {
    let allWords = [];
    lists.forEach(list => {
      list.words.forEach(word => {
        allWords.push({ english: word.english, correctCount: word.correctCount, incorrectCount: word.incorrectCount });
      });
    });
    statsTableBody.innerHTML = "";
    allWords.forEach(word => {
      const total = word.correctCount + word.incorrectCount;
      const ratio = total > 0 ? (word.incorrectCount / total).toFixed(2) : "0.00";
      const row = document.createElement("tr");
      row.innerHTML = `<td>${word.english}</td><td>${word.correctCount}</td><td>${word.incorrectCount}</td><td>${ratio}</td>`;
