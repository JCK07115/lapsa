import * as THREE from 'three';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

export function setupMobiusScene() {
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

  const neutralMorph = {
    pinch: 0,
    peak: 0,
    angularity: 0,
    sideTaper: 0
  };

  const letterMorphPresets = {
    A: {
      pinch: 1.25,
      peak: 3.8,
      angularity: 1.0,
      sideTaper: 2.0,
      rotationX: THREE.MathUtils.degToRad(74),
      rotationY: THREE.MathUtils.degToRad(18),
      rotationZ: THREE.MathUtils.degToRad(0)
    }
  };

  const currentMorph = { ...neutralMorph };
  const startMorph = { ...neutralMorph };
  const targetMorph = { ...neutralMorph };

  const neutralRotation = {
    x: THREE.MathUtils.degToRad(-8),
    y: THREE.MathUtils.degToRad(40),
    z: THREE.MathUtils.degToRad(6)
  };

  const currentRotation = { ...neutralRotation };
  const startRotation = { ...neutralRotation };
  const targetRotation = { ...neutralRotation };

  let morphStartTime = 0;
  let morphDuration = 1450;
  let isMorphing = false;

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

  function remap(value, inMin, inMax) {
    return clamp((value - inMin) / (inMax - inMin), 0, 1);
  }

  function beginMorphToLetter(char) {
    const preset = letterMorphPresets[char] || {};

    Object.assign(startMorph, currentMorph);
    Object.assign(targetMorph, neutralMorph, preset);

    Object.assign(startRotation, currentRotation);
    Object.assign(targetRotation, {
      x: preset.rotationX ?? neutralRotation.x,
      y: preset.rotationY ?? neutralRotation.y,
      z: preset.rotationZ ?? neutralRotation.z
    });

    morphStartTime = performance.now();
    isMorphing = true;
  }

  function updateMorphState() {
    if (!isMorphing) return;

    const elapsed = performance.now() - morphStartTime;
    const rawT = clamp(elapsed / morphDuration, 0, 1);

    // Phase 1: rotation happens first
    const rotationT = easeInOutCubic(remap(rawT, 0.0, 0.42));

    // Phase 2: geometry deformation begins after rotation is underway
    const shapeT = easeInOutCubic(remap(rawT, 0.28, 1.0));

    for (const key of Object.keys(currentMorph)) {
      currentMorph[key] = lerp(startMorph[key], targetMorph[key], shapeT);
    }

    currentRotation.x = lerp(startRotation.x, targetRotation.x, rotationT);
    currentRotation.y = lerp(startRotation.y, targetRotation.y, rotationT);
    currentRotation.z = lerp(startRotation.z, targetRotation.z, rotationT);

    if (rawT >= 1) {
      isMorphing = false;
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

    const shapedCosV = lerp(
      cosv,
      Math.sign(cosv) * Math.pow(Math.abs(cosv), 0.28),
      currentMorph.angularity
    );

    const shapedSinV = lerp(
      sinv,
      Math.sign(sinv) * Math.pow(Math.abs(sinv), 0.28),
      currentMorph.angularity
    );

    const upperWeight = Math.max(0, sinv);
    const lateralWeight = Math.pow(Math.abs(cosu), 0.72);
    const centerWeight = Math.pow(Math.max(0, sinu), 1.0);
    const lowerWeight = Math.max(0, -sinv);

    let localRadius = r;

    // Strong center tightening
    const centerPinchProfile = Math.pow(Math.sin(up), 2);
    localRadius *= 1 - currentMorph.pinch * 0.62 * centerPinchProfile;

    let x = (R + localRadius * shapedCosV) * cosu;
    let z = (R + localRadius * shapedCosV) * sinu;
    let y = localRadius * shapedSinV;

    const dip = (1 - Math.cos(2 * up)) * 0.5;
    y -= INDENT * dip;

    // Strong apex lift at the top center
    y += currentMorph.peak * upperWeight * (1.0 + 1.55 * centerWeight);

    // Push the lower region down a bit more so the triangular top dominates
    y -= currentMorph.peak * lowerWeight * 0.38;

    // Pull upper side regions inward more strongly to form clearer slanted sides
    x *= 1 - currentMorph.sideTaper * 0.34 * upperWeight;
    z *= 1 - currentMorph.sideTaper * 0.2 * upperWeight;

    // Lift left/right upper regions more uniformly to create triangle shoulders
    y += currentMorph.sideTaper * 1.15 * upperWeight * lateralWeight;

    // Tighten the very top center into a more decisive apex
    const apexTighten = upperWeight * (1 - lateralWeight);
    x *= 1 - currentMorph.sideTaper * 0.14 * apexTighten;
    z *= 1 - currentMorph.sideTaper * 0.08 * apexTighten;

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
  group.rotation.x = neutralRotation.x;
  group.rotation.y = neutralRotation.y;
  group.rotation.z = neutralRotation.z;

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

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    adjustCameraDistance();
  });

  const positionAttr = geometry.attributes.position;
  const tmp = new THREE.Vector3();
  let phase = 0;
  let clickPulse = 0;

  window.addEventListener("lapsa:letter-select", (event) => {
    const { char, index, href } = event.detail || {};

    console.log("[mobius] letter selected:", char, index, href);

    clickPulse = 1;
    beginMorphToLetter(char);
  });

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

    updateMorphState();
    updateFlow(phase);

    if (clickPulse > 0.001) {
      clickPulse *= 0.92;
    } else {
      clickPulse = 0;
    }

    const pulseT = clickPulse;

    group.rotation.x = currentRotation.x;
    group.rotation.y = currentRotation.y;
    group.rotation.z = currentRotation.z;
    group.scale.setScalar(0.7 + pulseT * 0.05);

    wireframeMaterial.opacity = 0.9 + pulseT * 0.1;

    renderer.render(scene, camera);
  }

  animate();
}