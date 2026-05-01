export function setupAlphabet() {
  // reference to DOM elements 
  const rail = document.getElementById("alphabet-rail");
  const torusGlow = document.getElementById("torus-glow");
  const scrollHint = document.getElementById("scroll-hint");
  const selectedLetterOverlay = document.getElementById("selected-letter-overlay");
  const backButton = document.getElementById("letter-back-button");
  const wordCarousel = document.getElementById("word-carousel");
  const selectInstruction = document.getElementById("select-instruction");
  const holdCursor = document.getElementById("hold-cursor");
  const holdCursorFill = document.getElementById("hold-cursor-fill");

  if (!rail) return;

  // LOCAL VARIABLES
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const letterLinks = [];

  // STATE VARIABLES
  let hoveredIndex = null;
  let assemblyProgress = 0;
  let layoutCache = [];
  let isLetterMode = false;
  let selectedChar = null;
  let railsVisible = false;

  const LEFT_COUNT = 13; // A-M left, N-Z right


  /* CAROUSEL */
  // dictionary of words for each letter (for word carousel overlay)
  const letterWords = {
    A: ["Algorithm", "Aperture", "Ash", "Arc", "Anchor", "Axiom", "Afterimage", "Array", "Abyss", "Animal", "Altitude"]
  };

  let wordItems = [];
  let activeWordIndex = 0;
  let wordsAreActive = false;
  let carouselProgress = 0;
  let wheelLock = false;

  let mouseTiltX = 0;
  let mouseTiltY = 0;

  // RAILING LETTERS PROPERTIES
  letters.forEach((char, index) => {
    const link = document.createElement("a");
    link.href = `letter.html?char=${encodeURIComponent(char)}`;
    link.className = "letter-link";
    link.classList.add(index < LEFT_COUNT ? "left-side" : "right-side");
    link.innerText = char;
    link.dataset.index = index;
    rail.appendChild(link);
    letterLinks.push(link);
  });

  // CUSTOM LETTER-MODE CURSOR AND HOLD-TO-SELECT WORD PROPERTIES
  let hoveredSelectableWord = null;
  let mouseClientX = 0;
  let mouseClientY = 0;

  let holdTargetWord = null;
  let holdStartTime = 0;
  let holdDuration = 700;
  let isHoldingSelect = false;
  let holdRaf = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function computeLayout() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw <= 700;

    const leftRailX = isMobile ? 22 : 38;
    const rightRailX = vw - (isMobile ? 22 : 38);

    const topMargin = vh * 0.17;
    const bottomMargin = vh * 0.17;
    const usableHeight = vh - topMargin - bottomMargin;
    const step = usableHeight / (LEFT_COUNT - 1);

    layoutCache = letterLinks.map((_, index) => {
      const isLeft = index < LEFT_COUNT;
      const sideIndex = isLeft ? index : index - LEFT_COUNT;

      const endX = isLeft ? leftRailX : rightRailX;
      const endY = topMargin + sideIndex * step;

      return {
        isLeft,
        sideIndex,
        endX,
        endY
      };
    });
  }

  function clearHoverStates() {
    rail.classList.remove("is-hovering");
    letterLinks.forEach(link => {
      link.classList.remove("is-active", "is-near-1", "is-near-2");
    });
  }

  function applyHoverStates(activeIndex) {
    if (assemblyProgress < 0.94 || document.body.classList.contains("transitioning")) {
      clearHoverStates();
      return;
    }

    rail.classList.add("is-hovering");

    letterLinks.forEach((link, index) => {
      link.classList.remove("is-active", "is-near-1", "is-near-2");

      const distance = Math.abs(index - activeIndex);
      const sameSide =
        (activeIndex < LEFT_COUNT && index < LEFT_COUNT) ||
        (activeIndex >= LEFT_COUNT && index >= LEFT_COUNT);

      if (!sameSide) return;

      if (distance === 0) {
        link.classList.add("is-active");
      } else if (distance === 1) {
        link.classList.add("is-near-1");
      } else if (distance === 2) {
        link.classList.add("is-near-2");
      }
    });
  }

  function renderLetters() {
    // don't use scroll progress as reveal interpolant (make it binary)
    const progress = railsVisible ? 1 : 0;
    assemblyProgress = progress;

    const hoverReady = progress > 0.94 && !document.body.classList.contains("transitioning");
    rail.style.pointerEvents = hoverReady ? "auto" : "none";

    if (!hoverReady) {
      hoveredIndex = null;
      clearHoverStates();
    }

    if (isLetterMode) {
      rail.style.pointerEvents = "none";
      letterLinks.forEach((link) => {
        link.style.opacity = "0";
      });
      return;
    }

    letterLinks.forEach((link, index) => {
      const { endX, endY } = layoutCache[index];

      const sideIndex = index < LEFT_COUNT ? index : index - LEFT_COUNT;
      const stagger = railsVisible ? sideIndex * 0.035 : 0;
      // const t = railsVisible ? 1 - stagger : 0;

      const x = endX;
      const y = endY;

      const opacity = railsVisible ? 0.92 : 0;
      const blur = railsVisible ? 0 : 8;

      let baseScale = railsVisible ? 1.0 : 0.92;

      let hoverScale = 1;
      if (hoverReady && hoveredIndex !== null) {
        const distance = Math.abs(index - hoveredIndex);
        const sameSide =
          (hoveredIndex < LEFT_COUNT && index < LEFT_COUNT) ||
          (hoveredIndex >= LEFT_COUNT && index >= LEFT_COUNT);

        if (sameSide) {
          if (distance === 0) hoverScale = 1.45;
          else if (distance === 1) hoverScale = 1.22;
          else if (distance === 2) hoverScale = 1.1;
        }
      }

      if (document.body.classList.contains("transitioning")) {
        hoverScale = link.classList.contains("selected") ? 1.7 : 0.96;
      }

      link.style.opacity = String(opacity);
      link.style.filter = `blur(${blur}px)`;
      link.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${baseScale * hoverScale})`;
    });

    if (hoverReady && hoveredIndex !== null) {
      applyHoverStates(hoveredIndex);
    }

    if (torusGlow && !document.body.classList.contains("transitioning")) {
      torusGlow.style.opacity = hoveredIndex !== null && hoverReady ? "1" : "0";
    }
  }

  function handleScroll() {
    if (isLetterMode) {
      return;
    }

    // update visibility before rendering
    updateRailVisibilityFromScroll();

    if (!document.body.classList.contains("transitioning")) {
      const scrollY = window.scrollY;
      const vh = window.innerHeight;

      if (scrollHint) {
        const hintProgress = Math.min(scrollY / (0.5 * vh), 1);
        scrollHint.style.opacity = String(1 - hintProgress);
      }
    }

    renderLetters();
  }

  function handleResize() {
    computeLayout();
    renderLetters();
  }

  // wheel handler for word carousel navigation in letter mode
  function handleWheel(event) {
    if (!isLetterMode || !wordsAreActive || !wordItems.length) return;

    event.preventDefault();

    const delta = event.deltaY;
    const maxProgress = Math.max(0, wordItems.length - 1);

    carouselProgress += delta * 0.006;
    carouselProgress = clamp(carouselProgress, 0, maxProgress);

    activeWordIndex = carouselProgress;
    renderWordCarousel();
  }

  function handleMouseMove(event) {
    /* update mouse tilt values for word carousel */
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const nx = (event.clientX / vw) * 2 - 1;
    const ny = (event.clientY / vh) * 2 - 1;

    mouseTiltX = nx;
    mouseTiltY = ny;

    window.dispatchEvent(
      new CustomEvent("lapsa:pointer-move", {
        detail: { x: nx, y: ny }
      })
    );

    if (isLetterMode && wordsAreActive && wordItems.length) {
      renderWordCarousel();
    }

    /* custom cursor follows mouse in letter mode */
    mouseClientX = event.clientX;
    mouseClientY = event.clientY;

    if (holdCursor) {
      holdCursor.style.transform = `translate(${mouseClientX}px, ${mouseClientY}px)`;
    }
  }

  function handleGlobalMouseDown(event) {
    if (event.button !== 0) return;
    if (!isLetterMode) return;

    const backButtonClicked = event.target.closest("#letter-back-button");
    if (backButtonClicked) return;

    const focusedWord = getFocusedCarouselWord();
    if (!focusedWord) return;

    startHoldSelection(focusedWord);
  }

  // enter letter mode from rail
  function enterLetterModeForChar(clickedChar) {
    const targetIndex = letters.indexOf(clickedChar);
    if (targetIndex === -1) return;

    selectedChar = clickedChar;
    isLetterMode = true;
    wordsAreActive = false;
    carouselProgress = 0;
    activeWordIndex = 0;

    if (selectedLetterOverlay) {
      selectedLetterOverlay.textContent = clickedChar;
      selectedLetterOverlay.classList.remove("is-visible");
    }

    clearWordCarousel();

    window.dispatchEvent(
      new CustomEvent("lapsa:letter-select", {
        detail: { char: clickedChar, index: targetIndex, href: null }
      })
    );

    document.body.classList.add("in-letter-mode");
    hoveredIndex = null;
    clearHoverStates();

    letterLinks.forEach((link) => {
      link.classList.remove("selected");
      if (link.textContent === clickedChar) {
        link.classList.add("selected");
      }
    });

    if (torusGlow) {
      torusGlow.style.opacity = "1";
    }

    renderLetters();

    if (selectedLetterOverlay) {
      setTimeout(() => {
        selectedLetterOverlay.classList.add("is-visible");
      }, 950);
    }

    setTimeout(() => {
      buildWordCarousel(clickedChar);
      wordsAreActive = true;
      document.body.classList.add("words-active");
      renderWordCarousel();
    }, 1850);
  }

  // exit letter mode and return to rail
  if (backButton) {
    backButton.addEventListener("click", () => {
      if (!isLetterMode) return;

      hoveredIndex = null;
      selectedChar = null;
      wordsAreActive = false;
      carouselProgress = 0;
      activeWordIndex = 0;

      // reset prior held state
      hoveredSelectableWord = null;
      cancelHoldSelection();

      document.body.classList.remove("words-active");

      if (selectedLetterOverlay) {
        selectedLetterOverlay.classList.remove("is-visible");
        selectedLetterOverlay.textContent = "";
      }

      clearWordCarousel();

      if (torusGlow) {
        torusGlow.style.opacity = "0";
      }

      window.dispatchEvent(
        new CustomEvent("lapsa:letter-deselect")
      );

      // Keep letter mode active during torus reset so rails stay hidden
      setTimeout(() => {
        isLetterMode = false;
        railsVisible = true;

        document.body.classList.remove("in-letter-mode");
        document.body.classList.remove("transitioning");

        letterLinks.forEach((link) => {
          link.classList.remove("selected", "is-active", "is-near-1", "is-near-2");
        });

        computeLayout();
        renderLetters();
      }, 1450);
    });
  }

  // event listeners for rail letter selection
  letterLinks.forEach((link, index) => {
    link.addEventListener("mouseenter", () => {
      if (assemblyProgress < 0.94) return;
      if (document.body.classList.contains("transitioning")) return;

      hoveredIndex = index;
      applyHoverStates(index);

      if (torusGlow) {
        torusGlow.style.opacity = "1";
      }

      renderLetters();
    });

    link.addEventListener("mouseleave", () => {
      if (document.body.classList.contains("transitioning")) return;

      hoveredIndex = null;
      clearHoverStates();

      if (torusGlow) {
        torusGlow.style.opacity = "0";
      }

      renderLetters();
    });

    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (document.body.classList.contains("transitioning")) return;
      if (isLetterMode) return;
      if (!railsVisible) return;

      const clickedChar = link.textContent;
      enterLetterModeForChar(clickedChar);
    });
  });

  // event listeners for rails
  rail.addEventListener("mouseleave", () => {
    if (document.body.classList.contains("transitioning")) return;

    hoveredIndex = null;
    clearHoverStates();
    renderLetters();
  });

  // CAROUSEL LOGIC FOR WORDS ASSOCIATED WITH EACH LETTER
  function buildWordCarousel(char) {
    if (!wordCarousel) return;

    wordCarousel.innerHTML = "";
    wordItems = [];

    const words = [char, ...(letterWords[char] || [])];

    words.forEach((word, index) => {
      const el = document.createElement("div");
      el.className = "carousel-word";
      el.textContent = word;

      if (index === 0) {
        el.classList.add("carousel-word-letter");
      }

      wordCarousel.appendChild(el);
      wordItems.push(el);
    });

    carouselProgress = 0;
    activeWordIndex = 0;
    renderWordCarousel();
  }

  function renderWordCarousel() {
    if (!wordItems.length) return;

    const dirX = mouseTiltX * 42;
    const dirY = mouseTiltY * 28;

    wordItems.forEach((el, index) => {
      const distance = index - carouselProgress;
      const absDistance = Math.abs(distance);

      // only show a focused neighborhood
      if (absDistance > 3.2) {
        el.style.opacity = "0";
        el.style.filter = "blur(8px)";
        el.style.transform = `translate(-50%, -50%) translate(0px, 0px) scale(0.32)`;
        return;
      }

      // all words align along one shared mouse-defined axis
      const axisX = distance * dirX * 0.55;
      const axisY = distance * dirY * 0.55;

      // add subtle default depth drift so the stack still reads in/out of screen
      const depthX = distance * 6
      const depthY = distance * 18;

      const x = axisX + depthX;
      const y = axisY + depthY;

      const scale = Math.max(0.34, 1 - absDistance * 0.18);
      const opacity = Math.max(0.08, 1 - absDistance * 0.24);
      const blur = absDistance * 1.4;

      el.style.opacity = String(opacity);
      el.style.filter = `blur(${blur}px)`;
      el.style.transform = `
        translate(-50%, -50%)
        translate(${x}px, ${y}px)
        scale(${scale})
      `;
      el.style.zIndex = String(200 - Math.round(absDistance * 20));
    });
  }

  function clearWordCarousel() {
    if (!wordCarousel) return;

    wordCarousel.innerHTML = "";
    wordItems = [];
    activeWordIndex = 0;
    wordsAreActive = false;
    hoveredSelectableWord = null;

    cancelHoldSelection();
    document.body.classList.remove("words-active");
  }

  function getFocusedCarouselWord() {
    if (selectedChar && !wordsAreActive) {
      return selectedChar;
    }

    if (!wordItems.length) return selectedChar || null;

    const focusedIndex = Math.round(carouselProgress);
    const clampedIndex = clamp(focusedIndex, 0, wordItems.length - 1);
    return wordItems[clampedIndex]?.textContent || selectedChar || null;
  }

  function updateRailVisibilityFromScroll() {
    const scrollY = window.scrollY;
    const vh = window.innerHeight;

    const revealThreshold = 0.45 * vh;  
    const hideThreshold = 0.42 * vh;    // should be less than reveal threshold to prevent jitter, but low enough to allow quick scrolls to still hide the rails, so keep it close to reveal threshold

    if (!railsVisible && scrollY >= revealThreshold) {
      railsVisible = true;
    } else if (railsVisible && scrollY <= hideThreshold) {
      railsVisible = false;
    }
  }

  /* HOLD-TO-SELECT LOGIC FOR WORDS IN CAROUSEL */
  function getShopUrl(word) {
    const letter = selectedChar || "";
    return `shop.html?word=${encodeURIComponent(word)}&letter=${encodeURIComponent(letter)}`;
  }

  function setHoldCursorProgress(progress) {
    if (!holdCursorFill) return;
    const clamped = clamp(progress, 0, 1);
    holdCursorFill.style.transform = `scaleY(${clamped})`;
  }

  function cancelHoldSelection() {
    isHoldingSelect = false;
    holdTargetWord = null;
    holdStartTime = 0;

    if (holdRaf) {
      cancelAnimationFrame(holdRaf);
      holdRaf = null;
    }

    setHoldCursorProgress(0);
  }

  function completeHoldSelection(word) {
    cancelHoldSelection();
    window.location.href = getShopUrl(word);
  }

  function tickHoldSelection() {
    if (!isHoldingSelect || !holdTargetWord) return;

    const elapsed = performance.now() - holdStartTime;
    const progress = clamp(elapsed / holdDuration, 0, 1);

    setHoldCursorProgress(progress);

    if (progress >= 1) {
      completeHoldSelection(holdTargetWord);
      return;
    }

    holdRaf = requestAnimationFrame(tickHoldSelection);
  }

  function startHoldSelection(word) {
    if (!word) return;

    cancelHoldSelection();

    holdTargetWord = word;
    isHoldingSelect = true;
    holdStartTime = performance.now();
    setHoldCursorProgress(0);

    holdRaf = requestAnimationFrame(tickHoldSelection);
  }

  computeLayout();
  renderLetters();

  // auto-enter letter mode if "letter" param is present in URL and valid
  const params = new URLSearchParams(window.location.search);
  const initialLetter = params.get("letter");

  if (initialLetter && letters.includes(initialLetter.toUpperCase())) {
    setTimeout(() => {
      enterLetterModeForChar(initialLetter.toUpperCase());
    }, 120);
  }

  // WINDOW EVENT LISTENERS
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize);
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", () => {
    cancelHoldSelection();
  });
  window.addEventListener("mousedown", handleGlobalMouseDown);
}