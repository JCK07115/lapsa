export function setupAlphabet() {
  const rail = document.getElementById("alphabet-rail");
  const torusGlow = document.getElementById("torus-glow");
  const scrollHint = document.getElementById("scroll-hint");

  if (!rail) return;

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const letterLinks = [];

  let hoveredIndex = null;
  let assemblyProgress = 0;
  let layoutCache = [];

  const LEFT_COUNT = 13; // A-M left, N-Z right

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

  function getScrollAssemblyProgress() {
    const scrollY = window.scrollY;
    const vh = window.innerHeight;

    const showStart = 0.92 * vh;
    const showEnd = 1.64 * vh;

    const raw = (scrollY - showStart) / (showEnd - showStart);
    return clamp(raw, 0, 1);
  }

  // function computeCurvedStartPosition(isLeft, sideIndex, vw, vh, isMobile) {
  //   const centerX = vw * 0.5;
  //   const centerY = vh * 0.5;

  //   // normalized: -1 at top, 0 at middle, +1 at bottom
  //   const n = (sideIndex / (LEFT_COUNT - 1)) * 2 - 1;

  //   // vertical spread of the curved "C"
  //   const curveHeight = isMobile ? vh * 0.22 : vh * 0.28;

  //   // horizontal offset from center to place the lobe
  //   const lobeOffsetX = isMobile ? vw * 0.12 : vw * 0.15;

  //   // how pronounced the C curve is:
  //   // strongest at center, weaker at top/bottom
  //   const curveBulge = (1 - n * n); // parabola, max at middle

  //   // inward/outward shape control
  //   const bulgeAmount = isMobile ? 42 : 72;

  //   const baseX = centerX + (isLeft ? -lobeOffsetX : lobeOffsetX);
  //   const x = baseX + (isLeft ? -1 : 1) * curveBulge * bulgeAmount;
  //   const y = centerY + n * curveHeight;

  //   return { x, y };
  // }

  function computeCurvedStartPosition(isLeft, sideIndex, vw, vh, isMobile) {
    const centerX = vw * 0.5;
    const centerY = vh * 0.5;

    const profile = isMobile
      ? [
          { x: -4, y: -110 }, // A / N
          { x:  4, y: -92  },
          { x: 20, y: -72  },
          { x: 38, y: -50  },
          { x: 54, y: -28  },
          { x: 64, y: -10  },
          { x: 68, y:   0  },
          { x: 64, y:  10  },
          { x: 54, y:  28  },
          { x: 38, y:  50  },
          { x: 20, y:  72  },
          { x:  4, y:  92  },
          { x:  0, y: 110 }  // M / Z
        ]
      : [
          { x: -6, y: -150 }, // A / N
          { x:  6, y: -126 },
          { x: 28, y: -98  },
          { x: 54, y: -68  },
          { x: 80, y: -38  },
          { x: 98, y: -14  },
          { x: 104, y:   0  },
          { x: 98, y:  14  },
          { x: 80, y:  38  },
          { x: 54, y:  68  },
          { x: 28, y:  98  },
          { x:  8, y: 126  },
          { x:  0, y: 150 }  // M / Z
        ];

    const p = profile[sideIndex];
    const seamX = centerX;

    const x = seamX + (isLeft ? -p.x : p.x);
    const y = centerY + p.y;

    return { x, y };
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

      const start = computeCurvedStartPosition(isLeft, sideIndex, vw, vh, isMobile);

      const endX = isLeft ? leftRailX : rightRailX;
      const endY = topMargin + sideIndex * step;

      return {
        isLeft,
        sideIndex,
        startX: start.x,
        startY: start.y,
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
    const progress = getScrollAssemblyProgress();
    assemblyProgress = progress;

    const hoverReady = progress > 0.94 && !document.body.classList.contains("transitioning");
    rail.style.pointerEvents = hoverReady ? "auto" : "none";

    if (!hoverReady) {
      hoveredIndex = null;
      clearHoverStates();
    }

    // const visibleProgress = clamp((progress - 0.04) / 0.96, 0, 1);
    const visibleProgress = clamp((progress - 0.0) / 1.0, 0, 1);
    
    const baseT = easeInOutCubic(visibleProgress);

    letterLinks.forEach((link, index) => {
      const { startX, startY, endX, endY } = layoutCache[index];

      const sideIndex = index < LEFT_COUNT ? index : index - LEFT_COUNT;
      const stagger = sideIndex * 0.01;
      const localRaw = clamp((visibleProgress - stagger) / (1 - stagger), 0, 1);
      const t = easeOutCubic(localRaw);

      const x = lerp(startX, endX, t);
      const y = lerp(startY, endY, t);

      // let opacity = 0;
      // if (progress > 0.03) {
      //   opacity = lerp(0, 0.92, baseT);
      // }
      const opacity = lerp(0.18, 0.92, baseT);

      let baseScale = lerp(0.88, 1.0, t);

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
      link.style.transform = `translate(${x}px, ${y}px) scale(${baseScale * hoverScale})`;
    });

    if (hoverReady && hoveredIndex !== null) {
      applyHoverStates(hoveredIndex);
    }

    if (torusGlow && !document.body.classList.contains("transitioning")) {
      torusGlow.style.opacity = hoveredIndex !== null && hoverReady ? "1" : "0";
    }
  }

  function handleScroll() {
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

    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (assemblyProgress < 0.94) return;
      if (document.body.classList.contains("transitioning")) return;

      const href = link.href;

      document.body.classList.add("transitioning");
      link.classList.add("selected");
      hoveredIndex = index;

      if (torusGlow) {
        torusGlow.style.opacity = "1";
      }

      renderLetters();

      setTimeout(() => {
        window.location.href = href;
      }, 700);
    });
  });

  rail.addEventListener("mouseleave", () => {
    if (document.body.classList.contains("transitioning")) return;

    hoveredIndex = null;
    clearHoverStates();
    renderLetters();
  });

  computeLayout();
  renderLetters();

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize);
}