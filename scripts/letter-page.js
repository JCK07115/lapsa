const params = new URLSearchParams(window.location.search);
const char = (params.get("char") || "A").toUpperCase();

const selectedLetter = document.getElementById("selected-letter");
const letterDescription = document.getElementById("letter-description");

const valid = /^[A-Z]$/.test(char);
const finalChar = valid ? char : "A";

selectedLetter.textContent = finalChar;
document.title = `LAPSA – ${finalChar}`;

letterDescription.textContent = `This is the MVP destination page for ${finalChar}. You can replace this with unique content, branching interactions, media, or a second-stage navigation flow later.`;