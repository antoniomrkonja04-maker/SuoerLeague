import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  applyDragDeltaToSpin,
  buildFlatSphericalStarBuffers,
  buildStarballTopology,
  createStarballSpinState,
  CRYSTAL_LIGHT_PRESETS,
  setStarballButtonOpenState,
  stepStarballSpinPhysics,
  triggerSpinImpulse,
} from './crystal-ball-core.mjs';

const TOPOLOGY = buildStarballTopology();

// Pre-allocated scratch math objects (zero GC in render loop)
const _quat = new THREE.Quaternion();
const _vec3 = new THREE.Vector3();

/**
 * Generates a fine isotropic sandblasted micro-grain texture for Frosted Glass
 * (`roughnessMap` and `bumpMap` — linear space / NoColorSpace).
 */
function createFrostedGlassNoiseTexture(renderer) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;

  // Deterministic pseudo-random frosted micro-grain so tests and frames are consistent
  let seed = 133742;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed & 0xffff) / 0xffff;
  };

  for (let i = 0; i < d.length; i += 4) {
    const n1 = nextRand();
    const n2 = nextRand();
    // Centered around 145..215 for a silky sandblasted frosted roughness distribution
    const grain = Math.round(135 + (n1 * 0.65 + n2 * 0.35) * 85);
    d[i] = grain;
    d[i + 1] = grain;
    d[i + 2] = grain;
    d[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  if (renderer?.capabilities?.getMaxAnisotropy) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  texture.needsUpdate = true;
  return texture;
}

function createStadiumPanoramaEnvTexture(renderer, loadedStadiumImage = null) {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (loadedStadiumImage) {
    ctx.drawImage(loadedStadiumImage, 0, 0, width, height);
    ctx.fillStyle = 'rgba(4, 10, 24, 0.18)';
    ctx.fillRect(0, 0, width, height);
  } else {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#040814');
    skyGrad.addColorStop(0.28, '#0c1d3d');
    skyGrad.addColorStop(0.50, '#16305e');
    skyGrad.addColorStop(0.68, '#0d2038');
    skyGrad.addColorStop(0.84, '#0f3024');
    skyGrad.addColorStop(1, '#050c0a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(186, 214, 255, 0.32)';
    ctx.lineWidth = 3;
    for (let x = 0; x < width; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.14);
      ctx.lineTo(x + 24, height * 0.34);
      ctx.lineTo(x + 48, height * 0.14);
      ctx.stroke();
    }

    for (let row = 0; row < 6; row += 1) {
      const y = height * (0.44 + row * 0.045);
      ctx.fillStyle = row % 2 === 0 ? 'rgba(96, 165, 250, 0.28)' : 'rgba(232, 255, 0, 0.20)';
      ctx.fillRect(0, y, width, 6);
    }
  }

  // Stadium Floodlight Towers & Neon-Yellow Grazing Arcs
  const floodlightSpots = [
    { x: width * 0.22, y: height * 0.30, r: 105, color: 'rgba(255, 255, 255, 0.94)' },
    { x: width * 0.76, y: height * 0.28, r: 130, color: 'rgba(239, 255, 0, 0.96)' },
    { x: width * 0.62, y: height * 0.36, r: 95, color: 'rgba(220, 255, 0, 0.88)' },
    { x: width * 0.38, y: height * 0.34, r: 85, color: 'rgba(186, 230, 253, 0.82)' },
  ];
  for (const spot of floodlightSpots) {
    const g = ctx.createRadialGradient(spot.x, spot.y, 4, spot.x, spot.y, spot.r);
    g.addColorStop(0, spot.color);
    g.addColorStop(0.38, 'rgba(232, 255, 0, 0.34)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(spot.x - spot.r, spot.y - spot.r, spot.r * 2, spot.r * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer?.capabilities?.getMaxAnisotropy) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  texture.needsUpdate = true;
  return texture;
}

function createContactShadowTexture(renderer) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(232, 255, 0, 0.24)');
  grad.addColorStop(0.35, 'rgba(3, 7, 18, 0.52)');
  grad.addColorStop(0.72, 'rgba(2, 5, 12, 0.16)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (renderer?.capabilities?.getMaxAnisotropy) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return texture;
}

function detectSoftwareGl() {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function renderCrystalStarballStage({
  mountId = 'sl-crystal-ball-mount',
  variant = 'title',
} = {}) {
  const isHero = variant === 'hero';
  return `
    <div class="crystal-starball-widget ${isHero ? 'is-hero-stage' : 'is-title-stage'}" data-crystal-widget="${mountId}">
      <div
        id="${mountId}"
        class="crystal-starball-canvas-mount"
        data-testid="${isHero ? 'hero-crystal-starball' : 'crystal-starball-canvas'}"
        data-variant="${variant}"
        role="application"
        tabindex="0"
        aria-label="Interaktiver 3D Super League Kristallball — Ziehen zum freien Drehen in 360 Grad"
      ></div>
    </div>
  `;
}

const activeControllers = new Map();

export function unmountAllCrystalStarballs() {
  for (const [, ctrl] of activeControllers) {
    ctrl.dispose();
  }
  activeControllers.clear();
}

export function setAllCrystalStarballsButtonOpen(isOpen = false) {
  for (const [, ctrl] of activeControllers) {
    ctrl.setButtonOpen(isOpen);
  }
}

export function mountCrystalStarball3D(mountEl, { variant = 'title' } = {}) {
  if (!mountEl) return null;
  const mountId = mountEl.id || `crystal-mount-${Math.random().toString(36).slice(2, 8)}`;

  const existing = activeControllers.get(mountId);
  if (existing && existing.mountEl === mountEl && mountEl.querySelector('canvas')) {
    existing.resize();
    return existing;
  }
  if (existing) {
    existing.dispose();
    activeControllers.delete(mountId);
  }

  const isSoftwareGl = detectSoftwareGl();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const width = Math.max(180, mountEl.clientWidth || (variant === 'hero' ? 268 : 248));
  const height = Math.max(180, mountEl.clientHeight || (variant === 'hero' ? 268 : 248));
  renderer.setSize(width, height);

  mountEl.innerHTML = '';
  renderer.domElement.className = 'crystal-starball-webgl-canvas';
  renderer.domElement.setAttribute('data-testid', `${mountId}-webgl-canvas`);
  mountEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
  camera.position.set(0, 0.02, 3.42);
  camera.lookAt(0, 0, 0);

  // Stadium Reflection Environment Map + Sandblasted Frosted Glass Micro-Grain Texture
  let stadiumEnvTex = createStadiumPanoramaEnvTexture(renderer, null);
  const frostedNoiseTex = createFrostedGlassNoiseTexture(renderer);
  scene.environment = stadiumEnvTex;

  const preset = CRYSTAL_LIGHT_PRESETS.neonYellow;
  const hemiLight = new THREE.HemisphereLight(0x284b8c, 0x03060f, 1.35);
  hemiLight.position.set(0, 8, 0);
  scene.add(hemiLight);

  // Key Neon-Yellow Light (upper-right grazing angle)
  const keyLight = new THREE.DirectionalLight(preset.keyColor, 5.2);
  keyLight.position.set(3.4, 2.1, 2.7);
  scene.add(keyLight);

  // Secondary Neon-Yellow Rim Light (right-flank chartreuse glow diffused through the frosted glass)
  const rimLight = new THREE.PointLight(preset.rimColor, 4.6, 12, 1.4);
  rimLight.position.set(2.35, -0.55, 2.05);
  scene.add(rimLight);

  // Cool Stadium Rim Light (left flank)
  const coolRimLight = new THREE.DirectionalLight(0x60a5fa, 1.65);
  coolRimLight.position.set(-3.4, 1.0, -1.8);
  scene.add(coolRimLight);

  // Internal Neon-Yellow Frosted Core Light (illuminates the translucent frosted glass from within)
  const coreLight = new THREE.PointLight(preset.coreColor, 3.8, 4.8, 1.4);
  coreLight.position.set(0.42, 0.18, 0.42);
  scene.add(coreLight);

  let rectLight = null;
  if (!isSoftwareGl) {
    RectAreaLightUniformsLib.init();
    rectLight = new THREE.RectAreaLight(0xefff00, 5.0, 2.6, 2.6);
    rectLight.position.set(2.4, 1.6, 2.2);
    rectLight.lookAt(0, 0, 0);
    scene.add(rectLight);
  }

  const shadowTex = createContactShadowTexture(renderer);

  // Material 1: Translucent Frosted Glass Sphere ("innen durchsichtig und frosted glass")
  // Diffuses stadium & neon-yellow light across a sandblasted, milky-translucent glass shell
  // while letting the rear black stars shine softly through the interior.
  const frostedCrystalGlassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x9cb8dc),
    roughness: 0.42,
    metalness: 0.04,
    roughnessMap: frostedNoiseTex,
    bumpMap: frostedNoiseTex,
    bumpScale: 0.005,
    transmission: isSoftwareGl ? 0 : 0.88,
    transparent: true,
    opacity: isSoftwareGl ? 0.26 : 0.94,
    ior: 1.52,
    thickness: 1.35,
    attenuationColor: new THREE.Color(0xdbeafe),
    attenuationDistance: 2.4,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
    sheen: 0.85,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color(0xefff80),
    envMap: stadiumEnvTex,
    envMapIntensity: 1.35,
    depthWrite: false,
  });

  // Material 2: Black Frosted Stars ("Sterne auch frosted aber trotzdem schwarz")
  // Deep pitch-black / obsidian frosted satin surface with sandblasted micro-grain
  // that stays rich black while catching diffused stadium and neon-yellow sheen.
  const starBodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x04060b),
    roughness: 0.44,
    metalness: 0.26,
    roughnessMap: frostedNoiseTex,
    bumpMap: frostedNoiseTex,
    bumpScale: 0.0065,
    clearcoat: 0.28,
    clearcoatRoughness: 0.38,
    sheen: 0.55,
    sheenRoughness: 0.48,
    sheenColor: new THREE.Color(0x1e293b),
    reflectivity: 0.75,
    envMap: stadiumEnvTex,
    envMapIntensity: 1.65,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });

  // Material 3: Frosted Neon-Yellow / Gold-Crystal Star Rim Frame
  const starRimMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xd8f012),
    emissive: new THREE.Color(0xd8ff00),
    emissiveIntensity: 0.30,
    roughness: 0.32,
    metalness: 0.78,
    roughnessMap: frostedNoiseTex,
    bumpMap: frostedNoiseTex,
    bumpScale: 0.004,
    clearcoat: 0.65,
    clearcoatRoughness: 0.22,
    envMap: stadiumEnvTex,
    envMapIntensity: 2.0,
    side: THREE.DoubleSide,
  });

  // Upgrade the reflection map with the actual /assets/super-league-stadium.jpg image once loaded
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (disposed) return;
    const upgradedTex = createStadiumPanoramaEnvTexture(renderer, img);
    const oldTex = stadiumEnvTex;
    stadiumEnvTex = upgradedTex;
    scene.environment = stadiumEnvTex;
    frostedCrystalGlassMat.envMap = stadiumEnvTex;
    starBodyMat.envMap = stadiumEnvTex;
    starRimMat.envMap = stadiumEnvTex;
    frostedCrystalGlassMat.needsUpdate = true;
    starBodyMat.needsUpdate = true;
    starRimMat.needsUpdate = true;
    oldTex.dispose();
  };
  img.src = '/assets/super-league-stadium.jpg';

  // Assemble the 3D Frosted Crystal Starball Hierarchy
  const rootGroup = new THREE.Group();
  rootGroup.name = 'SuperLeagueCrystalStarball';
  scene.add(rootGroup);

  const ballGroup = new THREE.Group();
  ballGroup.name = 'CrystalBallRotatableCore';
  rootGroup.add(ballGroup);

  // High-resolution translucent Frosted Glass inner sphere (64x48 segments)
  const glassSphereGeo = new THREE.SphereGeometry(0.990, 64, 48);
  const glassSphereMesh = new THREE.Mesh(glassSphereGeo, frostedCrystalGlassMat);
  glassSphereMesh.renderOrder = 1;
  ballGroup.add(glassSphereMesh);

  // 12 Sharp-Pointed ("eckiger Stern"), Flat-Flush ("aber flach"), Black Frosted 3D Stars
  const starsGroup = new THREE.Group();
  starsGroup.name = 'TwelveFlatSpherical3DStarsGroup';
  ballGroup.add(starsGroup);

  const starItems = [];
  const customGeometries = [glassSphereGeo];

  for (const starBasis of TOPOLOGY.stars) {
    const starUnitGroup = new THREE.Group();
    const {
      bodyPositions,
      bodyIndices,
      rimPositions,
      rimIndices,
    } = buildFlatSphericalStarBuffers(starBasis, {
      sphereRadius: 0.994,
      outerTipRadius: 0.554,
      outerValleyRadius: 0.224,
      rimWidthRatio: 0.125,
      flatHeight: 0.014,
      rimHeight: 0.020,
      radialSteps: 10,
      edgeSteps: 12,
      rimSteps: 4,
    });

    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute('position', new THREE.BufferAttribute(bodyPositions, 3));
    bodyGeo.setIndex(new THREE.BufferAttribute(bodyIndices, 1));
    bodyGeo.computeVertexNormals();

    const rimGeo = new THREE.BufferGeometry();
    rimGeo.setAttribute('position', new THREE.BufferAttribute(rimPositions, 3));
    rimGeo.setIndex(new THREE.BufferAttribute(rimIndices, 1));
    rimGeo.computeVertexNormals();

    customGeometries.push(bodyGeo, rimGeo);

    const bodyMesh = new THREE.Mesh(bodyGeo, starBodyMat);
    const rimMesh = new THREE.Mesh(rimGeo, starRimMat);
    bodyMesh.renderOrder = 2;
    rimMesh.renderOrder = 3;

    starUnitGroup.add(bodyMesh);
    starUnitGroup.add(rimMesh);
    starsGroup.add(starUnitGroup);

    starItems.push({
      group: starUnitGroup,
      normal: new THREE.Vector3(...starBasis.normal),
    });
  }

  // Grounded Contact Shadow Disc beneath the Crystal Starball
  const shadowGeo = new THREE.CircleGeometry(1.12, 48);
  customGeometries.push(shadowGeo);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.set(0, -1.22, 0);
  rootGroup.add(shadowMesh);

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  let spinState = createStarballSpinState();
  let disposed = false;
  let frameId = 0;
  let lastTime = performance.now();
  let lastPointerX = 0;
  let lastPointerY = 0;
  let lastPointerTime = 0;

  function syncDomDataset() {
    mountEl.dataset.lightPreset = spinState.lightPreset;
    mountEl.dataset.exploded = spinState.targetExploded > 0.05 ? 'true' : 'false';
    mountEl.dataset.spinBoosts = String(spinState.spinBoostCount || 0);
  }
  syncDomDataset();

  function applySceneState() {
    const [qx, qy, qz, qw] = spinState.quaternion;
    _quat.set(qx, qy, qz, qw);
    ballGroup.quaternion.copy(_quat);

    // Subtle radial star opening when buttons are hovered/selected
    const explodeOffset = spinState.exploded * 0.14;
    for (let i = 0; i < starItems.length; i += 1) {
      const item = starItems[i];
      _vec3.copy(item.normal).multiplyScalar(explodeOffset);
      item.group.position.copy(_vec3);
    }

    // Boost internal neon-yellow glow slightly as the stars open up
    coreLight.intensity = 3.8 + spinState.exploded * 3.8;
    starRimMat.emissiveIntensity = 0.30 + spinState.exploded * 0.45;
    camera.position.z = spinState.cameraDistance + spinState.exploded * 0.22;
  }

  function afterDraw(cb) {
    if (disposed) return;
    const gl = renderer.getContext();
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    } else {
      frameId = window.setTimeout(cb, 80);
    }
  }

  function tick() {
    if (disposed) return;
    const now = performance.now();
    const dt = Math.min(0.08, Math.max(0.004, (now - lastTime) / 1000));
    lastTime = now;

    spinState = stepStarballSpinPhysics(spinState, dt);
    applySceneState();
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = window.requestAnimationFrame(tick);
    }
  }

  const canvas = renderer.domElement;

  const onPointerDown = (event) => {
    spinState = { ...spinState, isDragging: true };
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    lastPointerTime = performance.now();
    canvas.classList.add('is-dragging');
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch { /* ignore synthetic pointer events */ }
  };

  const onPointerMove = (event) => {
    if (!spinState.isDragging) return;
    const now = performance.now();
    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    const dt = Math.max(0.005, (now - lastPointerTime) / 1000);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    lastPointerTime = now;
    spinState = applyDragDeltaToSpin(spinState, dx, dy, dt);
    applySceneState();
  };

  const onPointerUp = (event) => {
    if (!spinState.isDragging) return;
    spinState = { ...spinState, isDragging: false };
    canvas.classList.remove('is-dragging');
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      spinState = applyDragDeltaToSpin(spinState, 28, 0, 0.016);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      spinState = applyDragDeltaToSpin(spinState, -28, 0, 0.016);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      spinState = applyDragDeltaToSpin(spinState, 0, -24, 0.016);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      spinState = applyDragDeltaToSpin(spinState, 0, 24, 0.016);
    } else if (event.key === ' ') {
      event.preventDefault();
      controller.spinBoost();
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  mountEl.addEventListener('keydown', onKeyDown);

  const onWindowResize = () => {
    if (disposed) return;
    const w = Math.max(180, mountEl.clientWidth || (variant === 'hero' ? 268 : 228));
    const h = Math.max(180, mountEl.clientHeight || (variant === 'hero' ? 268 : 228));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onWindowResize);

  const controller = {
    mountId,
    mountEl,
    resize: onWindowResize,
    spinBoost() {
      spinState = triggerSpinImpulse(spinState, 1);
      syncDomDataset();
      return spinState;
    },
    setButtonOpen(isOpen = false) {
      spinState = setStarballButtonOpenState(spinState, isOpen, 0.36);
      syncDomDataset();
      return spinState;
    },
    toggleExplode() {
      const nextTarget = spinState.targetExploded > 0.1 ? 0 : 0.36;
      spinState = setStarballButtonOpenState(spinState, nextTarget > 0, 0.36);
      syncDomDataset();
      return spinState;
    },
    getState() {
      return { ...spinState };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('resize', onWindowResize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      mountEl.removeEventListener('keydown', onKeyDown);

      customGeometries.forEach((g) => g.dispose());
      frostedCrystalGlassMat.dispose();
      starBodyMat.dispose();
      starRimMat.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      frostedNoiseTex.dispose();
      stadiumEnvTex.dispose();
      renderer.dispose();
    },
  };

  activeControllers.set(mountId, controller);

  applySceneState();
  renderer.render(scene, camera);
  if (isSoftwareGl) {
    afterDraw(tick);
  } else {
    frameId = window.requestAnimationFrame(tick);
  }

  return controller;
}

const INTERACTIVE_BUTTON_SELECTOR = '.liquid-glass-btn, .sl-title-actions button, .welcome-card .button';

export function bindCrystalStarballActions(root = document) {
  if (root.__crystalActionsBound) return;
  root.__crystalActionsBound = true;

  const handleEnter = (event) => {
    const btn = event.target?.closest?.(INTERACTIVE_BUTTON_SELECTOR);
    if (!btn) return;
    setAllCrystalStarballsButtonOpen(true);
  };

  const handleLeave = (event) => {
    const btn = event.target?.closest?.(INTERACTIVE_BUTTON_SELECTOR);
    if (!btn) return;
    const related = event.relatedTarget?.closest?.(INTERACTIVE_BUTTON_SELECTOR);
    if (related) return;
    const joinDrawerOpen = Boolean(document.querySelector('.sl-join-drawer'));
    setAllCrystalStarballsButtonOpen(joinDrawerOpen);
  };

  root.addEventListener('pointerover', handleEnter);
  root.addEventListener('pointerout', handleLeave);
  root.addEventListener('focusin', handleEnter);
  root.addEventListener('focusout', handleLeave);
  root.addEventListener('pointerdown', (event) => {
    const btn = event.target?.closest?.(INTERACTIVE_BUTTON_SELECTOR);
    if (btn) {
      setAllCrystalStarballsButtonOpen(true);
    }
  });
}
