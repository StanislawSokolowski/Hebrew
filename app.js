/* app.js */

// Global variables and element references
let words = [];
let currentWord = null;
let mode = "engToHeb"; // default mode: English to Hebrew

const fileInput = document.getElementById("fileInput");
const modeSelect = document.getElementById("modeSelect");
const questionDiv = document.getElementById("question");
const answerInput = document.getElementById("answer");
const checkButton = document.getElementById("checkButton");
const nextButton = document.getElementById("nextButton");
const feedbackDiv = document.getElementById("feedback");
const correctAnswerDiv = document.getElementById("correctAnswer");
const loadSavedButton = document.getElementById("loadSavedButton");
const clearSavedButton = document.getElementById("clearSavedButton");

// Represents one dictionary entry.
class WordEntry {
  constructor(english, hebrew) {
    this.english = english;
    this.hebrew = hebrew; // array of acceptable Hebrew answers
    this.status = "default"; // can be "default", "wrong", or "known"
    this.correctStreak = 0;  // used when in "wrong" state
  }
}

// Utility: Check if a text contains any Hebrew nikkud (diacritics)
// Hebrew diacritics are in the Unicode range \u0591-\u05C7.
function containsNikkud(text) {
  return /[\u0591-\u05C7]/.test(text);
}

// Get the canonical Hebrew answer (with nikkud if available)
// For English-to-Hebrew mode, this will be the answer shown.
function getCanonicalHebrew(variants) {
  for (let variant of variants) {
    if (containsNikkud(variant)) {
      return variant;
    }
  }
  return variants[0];
}

// Return a random word from the list.
function getRandomWord() {
  if (words.length === 0) return null;
  const index = Math.floor(Math.random() * words.length);
  return words[index];
}

// Parse the contents of the .dcp file (UTF-16LE BOM encoded).
// Expects each line to be in the format: english=hebrew1|hebrew2...
// A line containing "@" marks the end of the file.
function parseDCPFile(text) {
  words = [];
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
      words.push(new WordEntry(english, hebrewVariants));
    }
  }
  if (words.length > 0) {
    feedbackDiv.textContent = `Loaded ${words.length} words.`;
    nextWord();
  } else {
    feedbackDiv.textContent = "No words loaded. Please check your file.";
  }
}

// Save the uploaded file text to localStorage for later access.
function saveFileData(text) {
  localStorage.setItem("dcpFile", text);
}

// Load saved file data from localStorage.
function loadSavedFile() {
  const saved = localStorage.getItem("dcpFile");
  if (saved) {
    parseDCPFile(saved);
    feedbackDiv.textContent = `Loaded saved data with ${words.length} words.`;
  } else {
    feedbackDiv.textContent = "No saved data found.";
  }
}

// Clear saved file data from localStorage.
function clearSavedFile() {
  localStorage.removeItem("dcpFile");
  feedbackDiv.textContent = "Saved data cleared.";
}

// Choose the next word and display the question.
function nextWord() {
  currentWord = getRandomWord();
  if (!currentWord) {
    questionDiv.textContent = "No words available.";
    return;
  }
  mode = modeSelect.value; // Update mode based on selection.
  if (mode === "engToHeb") {
    questionDiv.textContent = currentWord.english;
  } else {
    // For Hebrew-to-English, randomly select one of the Hebrew variants.
    const randomIndex = Math.floor(Math.random() * currentWord.hebrew.length);
    questionDiv.textContent = currentWord.hebrew[randomIndex];
  }
  answerInput.value = "";
  answerInput.classList.remove("known", "wrong");
  feedbackDiv.textContent = "";
  correctAnswerDiv.textContent = "";
  answerInput.focus();
}

// Check the user's answer.
function checkAnswer() {
  if (!currentWord) return;
  const userAnswer = answerInput.value.trim();
  let isCorrect = false;
  
  if (mode === "engToHeb") {
    // Check if the answer exactly matches any Hebrew variant.
    isCorrect = currentWord.hebrew.some(ans => ans === userAnswer);
  } else {
    // In Hebrew-to-English mode, compare case-insensitively.
    isCorrect = (currentWord.english.toLowerCase() === userAnswer.toLowerCase());
  }
  
  // Determine the canonical answer to display.
  let canonicalAnswer = "";
  if (mode === "engToHeb") {
    canonicalAnswer = getCanonicalHebrew(currentWord.hebrew);
  } else {
    canonicalAnswer = currentWord.english;
  }
  
  if (isCorrect) {
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
    currentWord.status = "wrong";
    currentWord.correctStreak = 0;
    feedbackDiv.textContent = "Incorrect. Try again.";
  }
  
  updateAnswerInputStyle();
  // Always display the canonical answer after checking.
  correctAnswerDiv.textContent = `Correct Answer: ${canonicalAnswer}`;
}

// Update the answer input’s background based on the word’s status.
function updateAnswerInputStyle() {
  answerInput.classList.remove("known", "wrong");
  if (currentWord.status === "known") {
    answerInput.classList.add("known");
  } else if (currentWord.status === "wrong") {
    answerInput.classList.add("wrong");
  }
}

// Event listeners

// When a file is uploaded, read it (as UTF-16LE), parse it, and save it locally.
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.readAsText(file, "utf-16le");
  reader.onload = function() {
    const fileText = reader.result;
    parseDCPFile(fileText);
    saveFileData(fileText);
  };
  reader.onerror = function() {
    feedbackDiv.textContent = "Error reading file.";
  };
});

checkButton.addEventListener("click", checkAnswer);
nextButton.addEventListener("click", nextWord);
loadSavedButton.addEventListener("click", loadSavedFile);
clearSavedButton.addEventListener("click", clearSavedFile);

// On page load, automatically load saved data (if available).
window.addEventListener("load", () => {
  if (localStorage.getItem("dcpFile")) {
    loadSavedFile();
  }
});
