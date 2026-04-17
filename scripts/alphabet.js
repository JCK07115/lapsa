export function setupAlphabet() {
  const rail = document.getElementById("alphabet-rail");
  const torusGlow = document.getElementById("torus-glow");
  const scrollHint = document.getElementById("scroll-hint");

  if (!rail) return;

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  letters.forEach((char, index) => {
    const link = document.createElement("a");
    link.href = `letter.html?char=${encodeURIComponent(char)}`;
    link.className = "letter-link";
    link.innerText = char;
    link.dataset.index = index;
    rail.appendChild(link);
  });

  const letterLinks = Array.from(document.querySelectorAll(".letter-link"));

  function clearProximityStates() {
    rail.classList.remove("is-hovering");
    letterLinks.forEach(link => {
      link.classList.remove("is-active", "is-near-1", "is-near-2");
    });
  }

  function applyProximityStates(activeIndex) {
    rail.classList.add("is-hovering");

    letterLinks.forEach((link, index) => {
      link.classList.remove("is-active", "is-near-1", "is-near-2");

      const distance = Math.abs(index - activeIndex);

      if (distance === 0) {
        link.classList.add("is-active");
      } else if (distance === 1) {
        link.classList.add("is-near-1");
      } else if (distance === 2) {
        link.classList.add("is-near-2");
      }
    });
  }

  letterLinks.forEach((link, index) => {
    link.addEventListener("mouseenter", () => {
      if (document.body.classList.contains("transitioning")) return;

      applyProximityStates(index);

      if (torusGlow) {
        torusGlow.style.opacity = "1";
      }
    });

    link.addEventListener("mouseleave", () => {
      if (document.body.classList.contains("transitioning")) return;

      clearProximityStates();

      if (torusGlow) {
        torusGlow.style.opacity = "0";
      }
    });

    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (document.body.classList.contains("transitioning")) return;

      const href = link.href;

      document.body.classList.add("transitioning");
      link.classList.add("selected");

      if (torusGlow) {
        torusGlow.style.opacity = "1";
      }

      setTimeout(() => {
        window.location.href = href;
      }, 650);
    });
  });

  rail.addEventListener("mouseleave", () => {
    if (document.body.classList.contains("transitioning")) return;
    clearProximityStates();

    if (torusGlow) {
      torusGlow.style.opacity = "0";
    }
  });

  function handleScroll() {
    if (document.body.classList.contains("transitioning")) return;

    const scrollY = window.scrollY;
    const vh = window.innerHeight;

    if (scrollHint) {
      const hintProgress = Math.min(scrollY / (0.5 * vh), 1);
      scrollHint.style.opacity = String(1 - hintProgress);
    }

    const showStart = 1 * vh;
    const fadeSpan = 0.6 * vh;

    let alpha = (scrollY - showStart) / fadeSpan;
    alpha = Math.max(0, Math.min(1, alpha));

    rail.style.opacity = String(alpha);
    rail.style.pointerEvents = alpha > 0.05 ? "auto" : "none";
  }

  window.addEventListener("scroll", handleScroll);
  handleScroll();
}