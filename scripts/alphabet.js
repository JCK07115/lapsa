export function setupAlphabet() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const row1 = document.getElementById("row-1");
  const row2 = document.getElementById("row-2");
  const row3 = document.getElementById("row-3");

  const groups = [
    letters.slice(0, 10),
    letters.slice(10, 20),
    letters.slice(20)
  ];
  const rows = [row1, row2, row3];

  groups.forEach((group, i) => {
    group.forEach(char => {
      const a = document.createElement("a");
      a.href = `letter.html?char=${encodeURIComponent(char)}`;
      a.className = "letter-link";
      a.innerText = char;
      rows[i].appendChild(a);
    });
  });

  const torusGlow = document.getElementById("torus-glow");
  const letterLinks = document.querySelectorAll(".letter-link");

  letterLinks.forEach(link => {
    link.addEventListener("mouseenter", () => {
      torusGlow.style.opacity = "1";
    });

    link.addEventListener("mouseleave", () => {
      torusGlow.style.opacity = "0";
    });
  });

  const scrollHint = document.getElementById("scroll-hint");
  const alphabetContainer = document.getElementById("alphabet-container");

  function handleScroll() {
    const scrollY = window.scrollY;
    const vh = window.innerHeight;

    const hintProgress = Math.min(scrollY / (0.5 * vh), 1);
    scrollHint.style.opacity = String(1 - hintProgress);

    const showStart = 1 * vh;
    const fadeSpan = 0.6 * vh;

    let alpha = (scrollY - showStart) / fadeSpan;
    if (alpha < 0) alpha = 0;
    if (alpha > 1) alpha = 1;

    alphabetContainer.style.opacity = String(alpha);
    alphabetContainer.style.pointerEvents = alpha > 0.05 ? "auto" : "none";
  }

  window.addEventListener("scroll", handleScroll);
  handleScroll();
}