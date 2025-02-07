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

// Class to represent a word entry
class WordEntry {
  constructor(english, hebrew) {
    this.english = english;
    this.hebrew = hebrew; // array of acceptable Hebrew answers
    this.status = "default"; // can be "default", "wrong", or "known"
    this.correctStreak = 0; // used when in "wrong" state
  }
}

// Returns a random word from the loaded list
function getRandomWord() {
  if (words.length === 0) return null;
  const index = Math.floor(Math.random() * words.length);
  return words[index];
}

// Parse the contents of the .dcp file
function parseDCPFile(text) {
  words = []; // Reset words array
  const lines = text.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (line === "@") break; // "@" indicates end of file
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

// Display the next word
function nextWord() {
  currentWord = getRandomWord();
  if (!currentWord) {
    questionDiv.textContent = "No words available.";
    return;
  }
  mode = modeSelect.value; // Update mode based on selection
  if (mode === "engToHeb") {
    questionDiv.textContent = currentWord.english;
  } else {
    // For Hebrew to English, choose a random Hebrew variant for display.
    const randomIndex = Math.floor(Math.random() * currentWord.hebrew.length);
    questionDiv.textContent = currentWord.hebrew[randomIndex];
  }
  answerInput.value = "";
  answerInput.classList.remove("known", "wrong");
  feedbackDiv.textContent = "";
  answerInput.focus();
}

// Check the user's answer
function checkAnswer() {
  if (!currentWord) return;
  const userAnswer = answerInput.value.trim();
  let isCorrect = false;
  
  if (mode === "engToHeb") {
    // Check if the answer exactly matches one of the Hebrew variants.
    isCorrect = currentWord.hebrew.some(ans => ans === userAnswer);
  } else {
    // Hebrew to English: compare case-insensitively.
    isCorrect = (currentWord.english.toLowerCase() === userAnswer.toLowerCase());
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
      // In default state, mark as known immediately.
      currentWord.status = "known";
      feedbackDiv.textContent = "Correct! Word marked as known.";
    }
  } else {
    // On an incorrect answer, mark the word as "wrong" and reset its streak.
    currentWord.status = "wrong";
    currentWord.correctStreak = 0;
    feedbackDiv.textContent = "Incorrect. Try again.";
  }
  updateAnswerInputStyle();
}

// Update the input’s background color based on the word’s status.
function updateAnswerInputStyle() {
  answerInput.classList.remove("known", "wrong");
  if (currentWord.status === "known") {
    answerInput.classList.add("known");
  } else if (currentWord.status === "wrong") {
    answerInput.classList.add("wrong");
  }
}

// Event listeners

// When the file is loaded, read it as text (specifying "utf-16le")
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.readAsText(file, "utf-16le");
  reader.onload = function() {
    parseDCPFile(reader.result);
  };
  reader.onerror = function() {
    feedbackDiv.textContent = "Error reading file.";
  };
});

checkButton.addEventListener("click", checkAnswer);
nextButton.addEventListener("click", nextWord);
