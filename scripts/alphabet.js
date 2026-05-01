export function setupAlphabet() {
  // DOM refs
  const rail = document.getElementById("alphabet-rail");
  const torusGlow = document.getElementById("torus-glow");
  const scrollHint = document.getElementById("scroll-hint");
  const selectedLetterOverlay = document.getElementById("selected-letter-overlay");
  const backButton = document.getElementById("carousel-back-button");
  const wordCarousel = document.getElementById("word-carousel");
  const selectInstruction = document.getElementById("select-instruction");
  const holdCursor = document.getElementById("hold-cursor");
  const holdCursorFill = document.getElementById("hold-cursor-fill");

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  if (!rail) return;

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const letterLinks = [];
  const LEFT_COUNT = 13;

  // app state
  const appState = {
    mode: "rail", // "rail" | "carousel"
    phase: "idle", // "idle" | "entering" | "active" | "restoring" | "exiting"
    selectedLetter: null,
    carouselProgress: 0,
    carouselReady: false
  };

  // layout / rail state
  let hoveredIndex = null;
  let assemblyProgress = 0;
  let layoutCache = [];
  let railsVisible = false;

  // carousel data
  const carouselWordsByLetter = {
    A: ["Algorithm", "Aperture", "Ash", "Arc", "Anchor", "Axiom", "Afterimage", "Array", "Abyss", "Animal", "Altitude"]
  };

  let wordItems = [];

  // pointer state
  let mouseTiltX = 0;
  let mouseTiltY = 0;
  let mouseClientX = 0;
  let mouseClientY = 0;

  // hold-to-select state
  let holdTargetWord = null;
  let holdStartTime = 0;
  let holdDuration = 700;
  let isHoldingSelect = false;
  let holdRaf = null;

  // rail letters
  letters.forEach((letter, index) => {
    const link = document.createElement("a");
    link.href = `letter.html?char=${encodeURIComponent(letter)}`;
    link.className = "letter-link";
    link.classList.add(index < LEFT_COUNT ? "left-side" : "right-side");
    link.innerText = letter;
    link.dataset.index = index;
    rail.appendChild(link);
    letterLinks.push(link);
  });

  function isCarouselMode() {
    return appState.mode === "carousel";
  }

  function isCarouselReady() {
    return appState.mode === "carousel" && appState.carouselReady;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getValidLetter(value) {
    const normalized = String(value || "").toUpperCase();
    return /^[A-Z]$/.test(normalized) ? normalized : null;
  }

  function getValidProgress(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function syncBodyClasses() {
    document.body.classList.toggle("in-carousel-mode", appState.mode === "carousel");
    document.body.classList.toggle("carousel-ready", appState.carouselReady);
    document.body.classList.toggle("transitioning", appState.phase === "entering");
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

      return {
        isLeft,
        sideIndex,
        endX: isLeft ? leftRailX : rightRailX,
        endY: topMargin + sideIndex * step
      };
    });
  }

  function clearHoverStates() {
    rail.classList.remove("is-hovering");
    letterLinks.forEach((link) => {
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

      if (distance === 0) link.classList.add("is-active");
      else if (distance === 1) link.classList.add("is-near-1");
      else if (distance === 2) link.classList.add("is-near-2");
    });
  }

  function markSelectedRailLetter(letter) {
    letterLinks.forEach((link) => {
      link.classList.remove("selected");
      if (link.textContent === letter) {
        link.classList.add("selected");
      }
    });
  }

  function clearSelectedRailLetter() {
    letterLinks.forEach((link) => {
      link.classList.remove("selected", "is-active", "is-near-1", "is-near-2");
    });
  }

  function renderLetters() {
    const progress = railsVisible ? 1 : 0;
    assemblyProgress = progress;

    const hoverReady = progress > 0.94 && !document.body.classList.contains("transitioning");
    rail.style.pointerEvents = hoverReady && !isCarouselMode() ? "auto" : "none";

    if (!hoverReady) {
      hoveredIndex = null;
      clearHoverStates();
    }

    if (isCarouselMode()) {
      rail.style.pointerEvents = "none";
      letterLinks.forEach((link) => {
        link.style.opacity = "0";
      });
      return;
    }

    letterLinks.forEach((link, index) => {
      const { endX, endY } = layoutCache[index];

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
      link.style.transform = `translate(${endX}px, ${endY}px) translate(-50%, -50%) scale(${baseScale * hoverScale})`;
    });

    if (hoverReady && hoveredIndex !== null) {
      applyHoverStates(hoveredIndex);
    }

    if (torusGlow && !document.body.classList.contains("transitioning")) {
      torusGlow.style.opacity = hoveredIndex !== null && hoverReady ? "1" : "0";
    }
  }

  function updateRailVisibilityFromScroll() {
    const scrollY = window.scrollY;
    const vh = window.innerHeight;

    const revealThreshold = 0.45 * vh;
    const hideThreshold = 0.42 * vh;

    if (!railsVisible && scrollY >= revealThreshold) {
      railsVisible = true;
    } else if (railsVisible && scrollY <= hideThreshold) {
      railsVisible = false;
    }
  }

  function clearWordCarousel() {
    if (!wordCarousel) return;
    wordCarousel.innerHTML = "";
    wordItems = [];
    cancelHoldSelection();
  }

  function resetCarouselVisualState() {
    if (selectedLetterOverlay) {
      selectedLetterOverlay.classList.remove("is-visible");
      selectedLetterOverlay.textContent = "";
    }

    clearWordCarousel();

    if (torusGlow && appState.mode !== "carousel") {
      torusGlow.style.opacity = "0";
    }
  }

  function buildWordCarousel(letter) {
    if (!wordCarousel) return;

    wordCarousel.innerHTML = "";
    wordItems = [];

    const words = [letter, ...(carouselWordsByLetter[letter] || [])];

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
  }

  function clampCarouselProgressToWordRange() {
    const maxProgress = Math.max(0, wordItems.length - 1);
    appState.carouselProgress = clamp(appState.carouselProgress, 0, maxProgress);
  }

  function renderWordCarousel() {
    if (!wordItems.length || !isCarouselReady()) return;

    clampCarouselProgressToWordRange();

    const dirX = mouseTiltX * 42;
    const dirY = mouseTiltY * 28;

    wordItems.forEach((el, index) => {
      const distance = index - appState.carouselProgress;
      const absDistance = Math.abs(distance);

      if (absDistance > 3.2) {
        el.style.opacity = "0";
        el.style.filter = "blur(8px)";
        el.style.transform = `translate(-50%, -50%) translate(0px, 0px) scale(0.32)`;
        return;
      }

      const axisX = distance * dirX * 0.55;
      const axisY = distance * dirY * 0.55;

      const depthX = distance * 6;
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

  function getFocusedCarouselWord() {
    if (!isCarouselReady() || !wordItems.length) return null;

    const focusedIndex = Math.round(appState.carouselProgress);
    const clampedIndex = clamp(focusedIndex, 0, wordItems.length - 1);
    return wordItems[clampedIndex]?.textContent || null;
  }

  function writeRailHistoryState() {
    history.replaceState(
      {
        mode: "rail",
        railsVisible
      },
      "",
      window.location.pathname
    );
  }

  function writeCarouselHistoryState() {
    if (!appState.selectedLetter) return;

    history.replaceState(
      {
        mode: "carousel",
        letter: appState.selectedLetter,
        progress: appState.carouselProgress,
        carouselReady: appState.carouselReady
      },
      "",
      `?letter=${encodeURIComponent(appState.selectedLetter)}&progress=${encodeURIComponent(appState.carouselProgress)}`
    );
  }

  function dispatchCarouselSelect(letter, source = "fresh") {
    const targetIndex = letters.indexOf(letter);
    if (targetIndex === -1) return;

    window.dispatchEvent(
      new CustomEvent("lapsa:letter-select", {
        detail: {
          letter,
          char: letter,
          index: targetIndex,
          source
        }
      })
    );
  }

  function dispatchCarouselDeselect() {
    window.dispatchEvent(new CustomEvent("lapsa:letter-deselect"));
  }

  function enterRailModeFromRestore() {
    appState.mode = "rail";
    appState.phase = "idle";
    appState.selectedLetter = null;
    appState.carouselProgress = 0;
    appState.carouselReady = false;

    hoveredIndex = null;
    clearHoverStates();
    clearSelectedRailLetter();
    resetCarouselVisualState();

    railsVisible = true;
    syncBodyClasses();
    dispatchCarouselDeselect();
    renderLetters();
    writeRailHistoryState();
  }

  function restoreCarouselMode({ letter, progress = 0, source = "url" }) {
    const selectedLetter = getValidLetter(letter);
    if (!selectedLetter) {
      enterRailModeFromRestore();
      return;
    }

    appState.mode = "carousel";
    appState.phase = "restoring";
    appState.selectedLetter = selectedLetter;
    appState.carouselProgress = getValidProgress(progress);
    appState.carouselReady = true;

    hoveredIndex = null;
    clearHoverStates();
    markSelectedRailLetter(selectedLetter);

    if (selectedLetterOverlay) {
      selectedLetterOverlay.classList.remove("is-visible");
      selectedLetterOverlay.textContent = "";
    }

    buildWordCarousel(selectedLetter);
    clampCarouselProgressToWordRange();

    if (torusGlow) {
      torusGlow.style.opacity = "1";
    }

    syncBodyClasses();
    renderLetters();
    renderWordCarousel();
    dispatchCarouselSelect(selectedLetter, "restore");

    appState.phase = "active";
    syncBodyClasses();
    writeCarouselHistoryState();
  }

  function enterCarouselModeForLetter(letter) {
    const selectedLetter = getValidLetter(letter);
    if (!selectedLetter) return;

    appState.mode = "carousel";
    appState.phase = "entering";
    appState.selectedLetter = selectedLetter;
    appState.carouselProgress = 0;
    appState.carouselReady = false;

    hoveredIndex = null;
    clearHoverStates();
    clearWordCarousel();
    markSelectedRailLetter(selectedLetter);

    if (selectedLetterOverlay) {
      selectedLetterOverlay.textContent = selectedLetter;
      selectedLetterOverlay.classList.remove("is-visible");
    }

    if (torusGlow) {
      torusGlow.style.opacity = "1";
    }

    syncBodyClasses();
    renderLetters();
    dispatchCarouselSelect(selectedLetter, "fresh");
    writeCarouselHistoryState();

    setTimeout(() => {
      if (appState.mode !== "carousel" || appState.selectedLetter !== selectedLetter) return;
      if (selectedLetterOverlay) {
        selectedLetterOverlay.classList.add("is-visible");
      }
    }, 950);

    setTimeout(() => {
      if (appState.mode !== "carousel" || appState.selectedLetter !== selectedLetter) return;

      buildWordCarousel(selectedLetter);
      appState.carouselReady = true;
      appState.phase = "active";

      syncBodyClasses();
      renderWordCarousel();
      writeCarouselHistoryState();
    }, 1850);
  }

  function exitCarouselMode() {
    if (!isCarouselMode()) return;

    appState.phase = "exiting";
    appState.carouselReady = false;

    cancelHoldSelection();
    syncBodyClasses();

    if (selectedLetterOverlay) {
      selectedLetterOverlay.classList.remove("is-visible");
      selectedLetterOverlay.textContent = "";
    }

    clearWordCarousel();

    if (torusGlow) {
      torusGlow.style.opacity = "0";
    }

    dispatchCarouselDeselect();

    setTimeout(() => {
      appState.mode = "rail";
      appState.phase = "idle";
      appState.selectedLetter = null;
      appState.carouselProgress = 0;
      appState.carouselReady = false;

      hoveredIndex = null;
      clearHoverStates();
      clearSelectedRailLetter();
      railsVisible = true;

      syncBodyClasses();
      computeLayout();
      renderLetters();
      writeRailHistoryState();
    }, 1450);
  }

  function parseCarouselRestoreFromHistory(state) {
    if (!state || state.mode !== "carousel") return null;

    const letter = getValidLetter(state.letter);
    if (!letter) return null;

    return {
      letter,
      progress: getValidProgress(state.progress)
    };
  }

  function parseCarouselRestoreFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const letter = getValidLetter(params.get("letter"));
    if (!letter) return null;

    return {
      letter,
      progress: getValidProgress(params.get("progress"))
    };
  }

  function handleScroll() {
    if (isCarouselMode()) return;

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

    if (isCarouselReady()) {
      renderWordCarousel();
    }
  }

  function handleWheel(event) {
    if (!isCarouselReady() || !wordItems.length) return;

    event.preventDefault();

    const maxProgress = Math.max(0, wordItems.length - 1);
    appState.carouselProgress += event.deltaY * 0.006;
    appState.carouselProgress = clamp(appState.carouselProgress, 0, maxProgress);

    renderWordCarousel();
    writeCarouselHistoryState();
  }

  function handleMouseMove(event) {
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

    if (isCarouselReady() && wordItems.length) {
      renderWordCarousel();
    }

    mouseClientX = event.clientX;
    mouseClientY = event.clientY;

    if (holdCursor) {
      holdCursor.style.transform = `translate(${mouseClientX}px, ${mouseClientY}px)`;
    }
  }

  function handleGlobalMouseDown(event) {
    if (event.button !== 0) return;
    if (!isCarouselReady()) return;

    const backButtonClicked = event.target.closest("#carousel-back-button");
    if (backButtonClicked) return;

    const focusedWord = getFocusedCarouselWord();
    if (!focusedWord) return;

    startHoldSelection(focusedWord);
  }

  function getShopUrl(word) {
    const letter = appState.selectedLetter || "";
    const progress = appState.carouselProgress || 0;
    return `shop.html?word=${encodeURIComponent(word)}&letter=${encodeURIComponent(letter)}&progress=${encodeURIComponent(progress)}`;
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

  // rail listeners
  letterLinks.forEach((link, index) => {
    link.addEventListener("mouseenter", () => {
      if (assemblyProgress < 0.94) return;
      if (document.body.classList.contains("transitioning")) return;
      if (isCarouselMode()) return;

      hoveredIndex = index;
      applyHoverStates(index);

      if (torusGlow) {
        torusGlow.style.opacity = "1";
      }

      renderLetters();
    });

    link.addEventListener("mouseleave", () => {
      if (document.body.classList.contains("transitioning")) return;
      if (isCarouselMode()) return;

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
      if (isCarouselMode()) return;
      if (!railsVisible) return;

      enterCarouselModeForLetter(link.textContent);
    });
  });

  rail.addEventListener("mouseleave", () => {
    if (document.body.classList.contains("transitioning")) return;
    if (isCarouselMode()) return;

    hoveredIndex = null;
    clearHoverStates();
    renderLetters();
  });

  if (backButton) {
    backButton.addEventListener("click", () => {
      exitCarouselMode();
    });
  }

  // initial render
  computeLayout();
  syncBodyClasses();
  renderLetters();

  // startup restore priority: history -> URL -> rail
  const historyRestore = parseCarouselRestoreFromHistory(history.state);
  if (historyRestore) {
    setTimeout(() => {
      restoreCarouselMode({ ...historyRestore, source: "history" });
    }, 80);
  } else {
    const urlRestore = parseCarouselRestoreFromUrl();
    if (urlRestore) {
      setTimeout(() => {
        restoreCarouselMode({ ...urlRestore, source: "url" });
      }, 80);
    } else {
      writeRailHistoryState();
    }
  }

  // window listeners
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize);
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", () => {
    cancelHoldSelection();
  });
  window.addEventListener("mousedown", handleGlobalMouseDown);
  window.addEventListener("popstate", (event) => {
    const historyRestore = parseCarouselRestoreFromHistory(event.state);
    if (historyRestore) {
      restoreCarouselMode({ ...historyRestore, source: "history" });
      return;
    }

    const urlRestore = parseCarouselRestoreFromUrl();
    if (urlRestore) {
      restoreCarouselMode({ ...urlRestore, source: "url" });
      return;
    }

    enterRailModeFromRestore();
  });
}