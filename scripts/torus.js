import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

export function setupTorusScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1a1a, 0.04);

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const SEG_U = 40;
  const SEG_V = 11;

  const R = 3.8;
  const r = 0.55;
  const INDENT = 1.8;

  let mouseTiltX = 0;
  let mouseTiltY = 0;

  let currentMouseLeanX = 0;
  let currentMouseLeanY = 0;
  let currentMouseLeanZ = 0;

  let pointerTiltEnabled = false;

  const neutralRotation = {
    x: THREE.MathUtils.degToRad(-8),
    y: THREE.MathUtils.degToRad(40),
    z: THREE.MathUtils.degToRad(6)
  };

  const carouselRotationPresets = {
    default: {
      x: THREE.MathUtils.degToRad(84),
      y: THREE.MathUtils.degToRad(0),
      z: THREE.MathUtils.degToRad(2)
    }
  };

  function getInitialRestoreLetter() {
    const isValidLetter = (value) => /^[A-Z]$/.test(String(value || "").toUpperCase());

    const historyLetter = history.state?.mode === "carousel"
      ? String(history.state.letter || "").toUpperCase()
      : "";

    if (isValidLetter(historyLetter)) {
      return historyLetter;
    }

    const params = new URLSearchParams(window.location.search);
    const urlLetter = String(params.get("letter") || "").toUpperCase();

    if (isValidLetter(urlLetter)) {
      return urlLetter;
    }

    return null;
  }

  const initialRestoreLetter = getInitialRestoreLetter();
  const initialRotation = initialRestoreLetter
    ? (carouselRotationPresets[initialRestoreLetter] || carouselRotationPresets.default || neutralRotation)
    : neutralRotation;

  const currentRotation = { ...initialRotation };
  const startRotation = { ...initialRotation };
  const targetRotation = { ...initialRotation };

  let rotationStartTime = 0;
  let rotationDuration = 1450;
  let isRotating = false;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function beginRotationToPreset(letter, { immediate = false, duration = 1450 } = {}) {
    const preset = letter
      ? (carouselRotationPresets[letter] || carouselRotationPresets.default || neutralRotation)
      : neutralRotation;

    if (immediate) {
      currentRotation.x = preset.x;
      currentRotation.y = preset.y;
      currentRotation.z = preset.z;

      startRotation.x = preset.x;
      startRotation.y = preset.y;
      startRotation.z = preset.z;

      targetRotation.x = preset.x;
      targetRotation.y = preset.y;
      targetRotation.z = preset.z;

      isRotating = false;
      return;
    }

    startRotation.x = currentRotation.x;
    startRotation.y = currentRotation.y;
    startRotation.z = currentRotation.z;

    targetRotation.x = preset.x;
    targetRotation.y = preset.y;
    targetRotation.z = preset.z;

    rotationStartTime = performance.now();
    rotationDuration = duration;
    isRotating = true;
  }

  function updateRotationState() {
    if (!isRotating) return;

    const elapsed = performance.now() - rotationStartTime;
    const rawT = clamp(elapsed / rotationDuration, 0, 1);
    const t = easeInOutCubic(rawT);

    currentRotation.x = lerp(startRotation.x, targetRotation.x, t);
    currentRotation.y = lerp(startRotation.y, targetRotation.y, t);
    currentRotation.z = lerp(startRotation.z, targetRotation.z, t);

    if (rawT >= 1) {
      isRotating = false;
    }
  }

  function indentedTorusPoint(u, v, phase, target) {
    const TWO_PI = Math.PI * 2;
    const up = u * TWO_PI;
    const vp = (v + phase) * TWO_PI;

    const cosu = Math.cos(up);
    const sinu = Math.sin(up);
    const cosv = Math.cos(vp);
    const sinv = Math.sin(vp);

    const x = (R + r * cosv) * cosu;
    const z = (R + r * cosv) * sinu;
    let y = r * sinv;

    const dip = (1 - Math.cos(2 * up)) * 0.5;
    y -= INDENT * dip;

    target.set(x, y, z);
  }

  const geometry = new ParametricGeometry(
    (u, v, target) => indentedTorusPoint(u, v, 0.0, target),
    SEG_U,
    SEG_V
  );

  const wireframeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
    transparent: true,
    opacity: 0.9
  });

  const torusMesh = new THREE.Mesh(geometry, wireframeMaterial);

  const group = new THREE.Group();
  group.add(torusMesh);

  const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
  mainLight.position.set(5, 10, 7);
  group.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
  fillLight.position.set(-5, -5, -5);
  group.add(fillLight);

  scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  group.scale.set(0.7, 0.7, 0.7);
  group.rotation.x = initialRotation.x;
  group.rotation.y = initialRotation.y;
  group.rotation.z = initialRotation.z;

  pointerTiltEnabled = !!initialRestoreLetter;

  function adjustCameraDistance() {
    const aspect = window.innerWidth / window.innerHeight;
    const baseDistance = 12;

    if (aspect < 1) {
      camera.position.set(0, 0, baseDistance / aspect);
    } else {
      camera.position.set(0, 0, baseDistance);
    }
  }

  adjustCameraDistance();

  const positionAttr = geometry.attributes.position;
  const tmp = new THREE.Vector3();
  let phase = 0;
  let clickPulse = 0;

  function updateFlow(currentPhase) {
    let index = 0;

    for (let i = 0; i <= SEG_U; i++) {
      const u = i / SEG_U;
      for (let j = 0; j <= SEG_V; j++) {
        const v = j / SEG_V;
        indentedTorusPoint(u, v, currentPhase, tmp);
        positionAttr.array[index * 3 + 0] = tmp.x;
        positionAttr.array[index * 3 + 1] = tmp.y;
        positionAttr.array[index * 3 + 2] = tmp.z;
        index++;
      }
    }

    positionAttr.needsUpdate = true;
  }

  function animate() {
    requestAnimationFrame(animate);

    phase = (phase + 0.0015) % 1.0;
    updateRotationState();
    updateFlow(phase);

    if (clickPulse > 0.001) {
      clickPulse *= 0.92;
    } else {
      clickPulse = 0;
    }

    const pulseT = clickPulse;

    const targetLeanX = pointerTiltEnabled ? mouseTiltY * 0.04 : 0;
    const targetLeanY = pointerTiltEnabled ? mouseTiltX * 0.04 : 0;
    const targetLeanZ = pointerTiltEnabled ? mouseTiltX * 0.25 : 0;

    currentMouseLeanX += (targetLeanX - currentMouseLeanX) * 0.08;
    currentMouseLeanY += (targetLeanY - currentMouseLeanY) * 0.08;
    currentMouseLeanZ += (targetLeanZ - currentMouseLeanZ) * 0.06;

    group.rotation.x = currentRotation.x + currentMouseLeanX;
    group.rotation.y = currentRotation.y + currentMouseLeanY;
    group.rotation.z = currentRotation.z + currentMouseLeanZ;

    group.scale.setScalar(0.7 + pulseT * 0.05);
    wireframeMaterial.opacity = 0.9 + pulseT * 0.1;

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    adjustCameraDistance();
  });

  window.addEventListener("lapsa:letter-select", (event) => {
    const detail = event.detail || {};
    const letter = detail.letter || detail.char || null;
    const source = detail.source || "fresh";

    console.log("[torus] carousel selected:", letter, source);

    pointerTiltEnabled = true;

    if (source === "restore") {
      clickPulse = 0;
      beginRotationToPreset(letter, { immediate: true });
      return;
    }

    clickPulse = 1;
    beginRotationToPreset(letter, { immediate: false, duration: 1450 });
  });

  window.addEventListener("lapsa:letter-deselect", () => {
    console.log("[torus] carousel deselected");

    clickPulse = 0;
    pointerTiltEnabled = false;
    mouseTiltX = 0;
    mouseTiltY = 0;

    beginRotationToPreset(null, { immediate: false, duration: 1450 });
  });

  window.addEventListener("lapsa:pointer-move", (event) => {
    const { x = 0, y = 0 } = event.detail || {};
    mouseTiltX = x;
    mouseTiltY = y;
  });

  animate();
}