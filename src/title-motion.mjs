// Animated Floodlight Fog ("Flutlicht Nebel") over the user's real stadium photograph (/assets/super-league-stadium.jpg)
// + Exact CodeLab-creator/liquid-glass-button interactive 3D tilt & liquid shine behavior for all buttons.

const FOG_PUFFS = [];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function initFogPuffs() {
  if (FOG_PUFFS.length > 0) return;
  const rand = seededRandom(202617);
  for (let i = 0; i < 26; i += 1) {
    FOG_PUFFS.push({
      x: rand(),
      y: 0.34 + rand() * 0.36,
      rx: 0.12 + rand() * 0.18,
      ry: 0.045 + rand() * 0.085,
      vx: (rand() > 0.5 ? 1 : -1) * (0.007 + rand() * 0.013),
      phase: rand() * Math.PI * 2,
      freq: 0.28 + rand() * 0.45,
      alpha: 0.045 + rand() * 0.075,
    });
  }
}

const BUTTON_SELECTOR = '.liquid-glass-btn, .button, .sl-join-manager-pill, .sl-join-close';

function ensureLiquidGlassShineElements(root = document) {
  if (typeof document === 'undefined' || !root?.querySelectorAll) return;
  root.querySelectorAll('.shine').forEach((el) => el.remove());
  const buttons = root.querySelectorAll(BUTTON_SELECTOR);
  buttons.forEach((btn) => {
    if (!btn.classList.contains('liquid-glass-surface')) {
      btn.classList.add('liquid-glass-surface');
    }
  });
}

function initLiquidGlassButtons() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  ensureLiquidGlassShineElements(document);


  // Exact 3D tilt logic from https://github.com/CodeLab-creator/liquid-glass-button/blob/main/liquid%20glass%20anim/script.js
  let activeBtn = null;

  document.addEventListener('mousemove', (e) => {
    const btn = e.target?.closest?.(BUTTON_SELECTOR);
    if (activeBtn && activeBtn !== btn) {
      activeBtn.style.transform = '';
      activeBtn = null;
    }
    if (!btn || btn.disabled) return;
    activeBtn = btn;

    const rect = btn.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate percentage from center (-1 to 1)
    const xPercent = (x / rect.width - 0.5) * 2;
    const yPercent = (y / rect.height - 0.5) * 2;

    const isTitleMainBtn = btn.classList.contains('liquid-glass-btn');
    const tiltForce = isTitleMainBtn ? 10 : 6; // 10 degrees on hero liquid glass buttons
    const hoverScale = isTitleMainBtn ? 1.05 : 1.03;

    btn.style.transform = `perspective(800px) rotateX(${(yPercent * -tiltForce).toFixed(2)}deg) rotateY(${(xPercent * tiltForce).toFixed(2)}deg) scale(${hoverScale})`;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    if (activeBtn) {
      activeBtn.style.transform = '';
      activeBtn = null;
    }
  }, { passive: true });
}

let animationFrameId = 0;
let initialized = false;

const cameraSpring = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  targetX: 0,
  targetY: 0,
};

export function triggerTitleEntranceSpring() {
  // Subtle reset on title open
  cameraSpring.vx = 0;
  cameraSpring.vy = 0;
}

export function initStadiumTitleMotion() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return;
  initialized = true;
  initFogPuffs();
  initLiquidGlassButtons();

  const bgContainer = document.querySelector('.ambient-stadium-bg');
  if (!bgContainer) return;

  let canvas = bgContainer.querySelector('#stadium-motion-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'stadium-motion-canvas';
    canvas.className = 'stadium-motion-canvas';
    bgContainer.appendChild(canvas);
  }

  // Transparent canvas so the user's real stadium photo (/assets/super-league-stadium.jpg) shines through 100%
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let width = 1440;
  let height = 900;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, window.innerWidth || 1440);
    height = Math.max(320, window.innerHeight || 900);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  window.addEventListener('pointermove', (event) => {
    cameraSpring.targetX = (event.clientX / Math.max(1, width)) * 2 - 1;
    cameraSpring.targetY = (event.clientY / Math.max(1, height)) * 2 - 1;
  }, { passive: true });

  let lastTs = performance.now();

  const renderFrame = (now) => {
    if (window.__pauseStadiumCanvas) {
      animationFrameId = 0;
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
    lastTs = now;
    const time = now * 0.001;

    // Spring-damped parallax for the volumetric floodlight fog ("Flutlicht Nebel")
    const stiffness = 65;
    const damping = 14;
    const ax = (cameraSpring.targetX - cameraSpring.x) * stiffness;
    const ay = (cameraSpring.targetY - cameraSpring.y) * stiffness;
    cameraSpring.vx = (cameraSpring.vx + ax * dt) * Math.exp(-damping * dt);
    cameraSpring.vy = (cameraSpring.vy + ay * dt) * Math.exp(-damping * dt);
    cameraSpring.x += cameraSpring.vx * dt;
    cameraSpring.y += cameraSpring.vy * dt;

    ctx.clearRect(0, 0, width, height);

    const leftTowerX = width * 0.376;
    const leftTowerY = height * 0.495;
    const rightTowerX = width * 0.620;
    const rightTowerY = height * 0.492;

    const breathL = 0.88 + 0.12 * Math.sin(time * 0.95);
    const breathR = 0.88 + 0.12 * Math.sin(time * 0.88 + 1.7);

    // Subtle volumetric floodlight cones anchored to the two main floodlight towers in the photo
    const drawTowerMistCone = (tx, ty, angleDeg, spreadW, lengthH, intensity) => {
      ctx.save();
      ctx.translate(tx + cameraSpring.x * -5, ty + cameraSpring.y * -3);
      ctx.rotate((angleDeg * Math.PI) / 180);

      const grad = ctx.createLinearGradient(0, 0, 0, lengthH);
      grad.addColorStop(0, `rgba(255, 255, 255, ${(0.22 * intensity).toFixed(3)})`);
      grad.addColorStop(0.35, `rgba(224, 242, 254, ${(0.12 * intensity).toFixed(3)})`);
      grad.addColorStop(0.75, `rgba(186, 230, 253, ${(0.04 * intensity).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(spreadW * 0.5, lengthH);
      ctx.lineTo(-spreadW * 0.5, lengthH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    drawTowerMistCone(leftTowerX, leftTowerY, -16 + Math.sin(time * 0.35) * 1.6, width * 0.26, height * 0.38, breathL);
    drawTowerMistCone(rightTowerX, rightTowerY, 16 + Math.cos(time * 0.32) * 1.6, width * 0.26, height * 0.38, breathR);

    // Drifting volumetric floodlight fog clouds ("Flutlicht Nebel")
    for (let i = 0; i < FOG_PUFFS.length; i += 1) {
      const p = FOG_PUFFS[i];
      const u = ((p.x + time * p.vx) % 1.28 + 1.28) % 1.28 - 0.14;
      const v = p.y + Math.sin(time * p.freq + p.phase) * 0.016;

      const fx = u * width + cameraSpring.x * -12;
      const fy = v * height + cameraSpring.y * -7;
      const rx = p.rx * width;
      const ry = p.ry * height;

      const dLeft = Math.hypot((fx - leftTowerX) / width, (fy - leftTowerY) / height);
      const dRight = Math.hypot((fx - rightTowerX) / width, (fy - rightTowerY) / height);
      const proximity = Math.min(
        1.75,
        0.38 + Math.exp(-dLeft * 5.2) * 1.25 + Math.exp(-dRight * 5.2) * 1.25
      );

      const alpha = Math.min(0.18, p.alpha * proximity * (0.85 + 0.15 * Math.sin(time * 0.7 + p.phase)));

      ctx.save();
      ctx.translate(fx, fy);
      ctx.scale(1, ry / Math.max(1, rx));
      const fogGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      fogGrad.addColorStop(0, `rgba(240, 249, 255, ${alpha.toFixed(3)})`);
      fogGrad.addColorStop(0.5, `rgba(186, 230, 253, ${(alpha * 0.45).toFixed(3)})`);
      fogGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = fogGrad;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    animationFrameId = window.requestAnimationFrame(renderFrame);
  };

  animationFrameId = window.requestAnimationFrame(renderFrame);
}

export function stopStadiumTitleMotion() {
  if (animationFrameId && typeof window !== 'undefined') {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }
}
