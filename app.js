/* app.js */

// =======================
// IndexedDB Setup
// =======================
let db;
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("HebrewDB", 1);
    request.onupgradeneeded = function(e) {
      db = e.target.result;
      if (!db.objectStoreNames.contains("lists")) {
        db.createObjectStore("lists", { keyPath: "id", autoIncrement: true });
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

// =======================
// Utility Functions
// =======================
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
        status: "default",      // overall DB field (will be reset to default on new session)
        correctStreak: 0,
        correctCount: 0,
        incorrectCount: 0
      });
    }
  }
  return wordsArray;
}

// =======================
// Global Variables & UI Elements
// =======================
let currentList = null;     // Loaded list object {id, name, words: [...]}
let sessionWords = [];      // For current flashcard session (deep copies of words)
let currentWordIndex = -1;  // Index into sessionWords
let globalSessionMode = false; // false = single list session; true = global session.

const fileInput         = document.getElementById("fileInput");
const uploadFileButton  = document.getElementById("uploadFileButton");
const dbListSelect      = document.getElementById("dbListSelect");
const loadListButton    = document.getElementById("loadListButton");
const deleteListButton  = document.getElementById("deleteListButton");
const leastKnownButton  = document.getElementById("leastKnownButton");
const statsButton       = document.getElementById("statsButton");

const questionDiv       = document.getElementById("question");
const correctAnswerDiv  = document.getElementById("correctAnswer");
const answerInput       = document.getElementById("answer");
const checkButton       = document.getElementById("checkButton");
const nextButton        = document.getElementById("nextButton");
const feedbackDiv       = document.getElementById("feedback");
const sidePanel         = document.getElementById("sidePanel");

const statsModal        = document.getElementById("statsModal");
const closeModal        = document.getElementById("closeModal");
const statsTableBody    = document.querySelector("#statsTable tbody");

// =======================
// Helper Function: Shuffle (Fisher-Yates)
// =======================
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// =======================
// Side Panel Update: Small, multi-column indicators
// =======================
function updateSidePanel() {
  sidePanel.innerHTML = "";
  if (!sessionWords || sessionWords.length === 0) return;
  sessionWords.forEach(word => {
    const bar = document.createElement("div");
    bar.className = "word-bar";
    if (word.status === "known") {
      bar.style.backgroundColor = "#388e3c"; // green
    } else if (word.status === "wrong") {
      bar.style.backgroundColor = "#d32f2f"; // red
    } else {
      bar.style.backgroundColor = "#ffffff"; // default white
    }
    sidePanel.appendChild(bar);
  });
}

// =======================
// Flashcard Session Functions
// =======================

// When starting a session, create deep copies of words, reset status to default, and shuffle the order.
function startSession(wordsArray, isGlobalMode = false) {
  sessionWords = wordsArray.map(word => {
    return {
      english: word.english,
      hebrew: word.hebrew.slice(), // copy array
      status: "default",           // reset session indicator to default
      correctCount: word.correctCount,
      incorrectCount: word.incorrectCount,
      correctStreak: 0             // reset session streak
      // For global sessions, parentListId will be added later as needed.
    };
  });
  
  // Randomize the order of words.
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
  
  correctAnswerDiv.textContent = `Correct Answer: ${canonicalAnswer}`;
  updateSidePanel();
  
  // Update overall statistics in the database.
  // In the database, we always save the word's status as "default" (so next session starts fresh)
  if (!globalSessionMode && currentList) {
    for (let word of currentList.words) {
      if (word.english === currentWord.english &&
          JSON.stringify(word.hebrew) === JSON.stringify(currentWord.hebrew)) {
        word.correctCount = currentWord.correctCount;
        word.incorrectCount = currentWord.incorrectCount;
        word.correctStreak = currentWord.correctStreak;
        word.status = "default"; // stored DB status is always default
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
            word.status = "default"; // reset for DB storage
            break;
          }
        }
        updateListInDB(list).then(() => {
          console.log("Parent list updated in DB (global mode).");
        });
      }
    });
  }
}

// =======================
// Statistics Modal Functions
// =======================
function displayStatistics() {
  let listsToShow = [];
  if (globalSessionMode) {
    getAllListsFromDB().then(lists => {
      listsToShow = lists;
      populateStatsTable(listsToShow);
      statsModal.style.display = "block";
    });
  } else if (currentList) {
    populateStatsTable([currentList]);
    statsModal.style.display = "block";
  }
}

function populateStatsTable(lists) {
  statsTableBody.innerHTML = "";
  lists.forEach(list => {
    list.words.forEach(word => {
      const row = document.createElement("tr");
      const wordCell = document.createElement("td");
      wordCell.textContent = word.english;
      const correctCell = document.createElement("td");
      correctCell.textContent = word.correctCount;
      const incorrectCell = document.createElement("td");
      incorrectCell.textContent = word.incorrectCount;
      const total = word.correctCount + word.incorrectCount;
      const ratioCell = document.createElement("td");
      const ratio = total > 0 ? (word.incorrectCount / total).toFixed(2) : "0.00";
      ratioCell.textContent = ratio;
      row.appendChild(wordCell);
      row.appendChild(correctCell);
      row.appendChild(incorrectCell);
      row.appendChild(ratioCell);
      statsTableBody.appendChild(row);
    });
  });
}

closeModal.onclick = function() {
  statsModal.style.display = "none";
};

window.onclick = function(event) {
  if (event.target == statsModal) {
    statsModal.style.display = "none";
  }
};

// =======================
// Button Event Listeners
// =======================
checkButton.addEventListener("click", checkAnswer);
nextButton.addEventListener("click", nextWord);
statsButton.addEventListener("click", displayStatistics);

leastKnownButton.addEventListener("click", function() {
  // Global least-known session: aggregate words from all lists.
  getAllListsFromDB().then(lists => {
    let aggregatedWords = [];
    lists.forEach(list => {
      list.words.forEach(word => {
        const total = word.correctCount + word.incorrectCount;
        const metric = total > 0 ? word.incorrectCount / total : 0;
        const wordClone = Object.assign({}, word);
        wordClone.parentListId = list.id;
        wordClone.metric = metric;
        aggregatedWords.push(wordClone);
      });
    });
    aggregatedWords.sort((a, b) => b.metric - a.metric);
    const leastKnown = aggregatedWords.slice(0, 20);
    startSession(leastKnown, true); // global session mode
    updateSidePanel();
  });
});

uploadFileButton.addEventListener("click", function() {
  const file = fileInput.files[0];
  if (!file) {
    feedbackDiv.textContent = "Please select a file first.";
    return;
  }
  const reader = new FileReader();
  reader.readAsText(file, "utf-16le");
  reader.onload = function() {
    const text = reader.result;
    const wordsArray = parseDCPText(text);
    if (wordsArray.length === 0) {
      feedbackDiv.textContent = "No words found in the file.";
      return;
    }
    const listName = prompt("Enter a name for this list:", file.name);
    if (!listName) {
      feedbackDiv.textContent = "List name is required.";
      return;
    }
    const newList = {
      name: listName,
      words: wordsArray
    };
    addListToDB(newList).then(list => {
      feedbackDiv.textContent = `List "${list.name}" added with ${list.words.length} words.`;
      populateListDropdown();
    });
  };
  reader.onerror = function() {
    feedbackDiv.textContent = "Error reading file.";
  };
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
      // Start a new session with deep copies (status reset) and shuffle the order.
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

// Populate the dropdown with lists from the database.
function populateListDropdown() {
  getAllListsFromDB().then(lists => {
    dbListSelect.innerHTML = "";
    lists.forEach(list => {
      const option = document.createElement("option");
      option.value = list.id;
      option.textContent = list.name;
      dbListSelect.appendChild(option);
    });
  });
}

// =======================
// Initialization on Page Load
// =======================
window.addEventListener("load", function() {
  openDB().then(() => {
    populateListDropdown();
  });
});
