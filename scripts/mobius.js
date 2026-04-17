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
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  const SEG_U = 40;
  const SEG_V = 11;

  const R = 3.8;
  const r = 0.55;
  const INDENT = 1.8;

  function indentedTorusPoint(u, v, phase, target) {
    const TWO_PI = Math.PI * 2;
    const up = u * TWO_PI;
    const vp = (v + phase) * TWO_PI;

    const cosu = Math.cos(up), sinu = Math.sin(up);
    const cosv = Math.cos(vp), sinv = Math.sin(vp);

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
  group.rotation.x = THREE.MathUtils.degToRad(-8);
  group.rotation.y = THREE.MathUtils.degToRad(40);
  group.rotation.z = THREE.MathUtils.degToRad(6);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // renderer.setSize(window.innerWidth, window.innerHeight);
    adjustCameraDistance();
  });

  const positionAttr = geometry.attributes.position;
  const tmp = new THREE.Vector3();
  let phase = 0;

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
    updateFlow(phase);
    renderer.render(scene, camera);
  }

  animate();
}