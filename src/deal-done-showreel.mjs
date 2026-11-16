// THE IRON SEAL — 15-Second 120-BPM Deal Done Motion Design Showreel Engine
// Pure function of time t via seekShowreelFrame(svgRoot, t, dealMeta) + Web Audio API OfflineAudioContext soundtrack.

const W = 1920;
const H = 1080;
const CX = 960;
const CY = 540;
export const SHOWREEL_DURATION = 15.0;
const BEAT_SEC = 0.5; // 120 BPM

const COL = {
  obsidian: '#050811',
  navy: '#0A1124',
  slate: '#111C38',
  cobalt: '#1D4ED8',
  cobaltBright: '#2563EB',
  ice: '#38BDF8',
  white: '#F8FAFC',
  muted: '#94A3B8',
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a, b, u) {
  return a + (b - a) * u;
}
function expOut(dt, k = 9.0) {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-k * dt);
}
function expInOut(u, k = 7.0) {
  const c = clamp(u, 0, 1);
  if (c < 0.5) return 0.5 * Math.exp(k * (c * 2 - 1));
  return 1 - 0.5 * Math.exp(-k * (c * 2 - 1));
}
function spring(dt, omega = 22.0, zeta = 0.82) {
  if (dt <= 0) return 0;
  const wd = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const env = Math.exp(-zeta * omega * dt);
  return clamp(1 - env * (Math.cos(wd * dt) + ((zeta * omega) / wd) * Math.sin(wd * dt)), 0, 1.04);
}
function springVelocity(dt, omega = 22.0, zeta = 0.82) {
  if (dt <= 0 || dt > 1.0) return 0;
  const eps = 0.002;
  return Math.abs(spring(dt + eps, omega, zeta) - spring(dt, omega, zeta)) / eps;
}

function project3D(x, y, z, rotX, rotY, rotZ, scale = 1, persp = 1600) {
  const cz = Math.cos(rotZ);
  const sz = Math.sin(rotZ);
  const x1 = x * cz - y * sz;
  const y1 = x * sz + y * cz;
  const z1 = z;

  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const y2 = y1 * cx - z1 * sx;
  const z2 = y1 * sx + z1 * cx;
  const x2 = x1;

  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const x3 = x2 * cy + z2 * sy;
  const z3 = -x2 * sy + z2 * cy;
  const y3 = y2;

  const factor = persp / Math.max(300, persp - z3);
  return {
    x: CX + x3 * scale * factor,
    y: CY + y3 * scale * factor,
    z: z3,
  };
}

function ptsToPoly(pts) {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function escapeXml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function renderGridBackdrop(bgColor, lineColor, beatIndex, subProgress) {
  const shift = (beatIndex * 60 + expOut(subProgress * 0.5, 10) * 60) % 120;
  let lines = `<rect x="0" y="0" width="${W}" height="${H}" fill="${bgColor}" />`;
  for (let x = -120 + shift; x <= W + 120; x += 240) {
    lines += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" stroke="${lineColor}" stroke-width="1" />`;
  }
  for (let y = 90; y < H; y += 180) {
    lines += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${lineColor}" stroke-width="1" />`;
  }
  lines += `
    <g stroke="${lineColor}" stroke-width="2" fill="none">
      <path d="M 64 96 L 64 64 L 96 64" />
      <path d="M 1856 96 L 1856 64 L 1824 64" />
      <path d="M 64 984 L 64 1016 L 96 1016" />
      <path d="M 1856 984 L 1856 1016 L 1824 1016" />
    </g>
  `;
  return lines;
}

function renderBeatHeader(beatIndex, barIndex, meta, darkOnLight = false) {
  const fg = darkOnLight ? COL.obsidian : COL.white;
  const sub = darkOnLight ? COL.cobalt : COL.muted;
  const beatNum = String((beatIndex % 30) + 1).padStart(2, '0');
  const barNum = String(barIndex + 1).padStart(2, '0');
  return `
    <g font-family="'JetBrains Mono', monospace" font-weight="700" font-size="15" letter-spacing="3">
      <text x="96" y="84" fill="${fg}">SUPER LEAGUE // CONTRACT PROTOCOL</text>
      <text x="960" y="84" text-anchor="middle" fill="${sub}">120 BPM · BAR ${barNum} · BEAT ${beatNum}/30</text>
      <text x="1824" y="84" text-anchor="end" fill="${fg}">${escapeXml(meta.buyer)}</text>
    </g>
  `;
}

export function buildShowreelFrameSvg(rawTime, rawMeta = {}) {
  const meta = {
    player: String(rawMeta.playerName || rawMeta.player || 'SUPER LEAGUE PRO').toUpperCase(),
    pos: String(rawMeta.position || rawMeta.pos || 'CM').toUpperCase(),
    ovr: String(rawMeta.rating || rawMeta.ovr || '88'),
    seller: String(rawMeta.sellerTeamName || rawMeta.seller || 'SELLER CLUB').toUpperCase(),
    buyer: String(rawMeta.buyerTeamName || rawMeta.buyer || 'BUYER CLUB').toUpperCase(),
    fee: Number(rawMeta.fee ?? 65).toFixed(1),
    salary: Number(rawMeta.salary ?? 9.5).toFixed(1),
    years: String(rawMeta.contractYears || rawMeta.years || 4).padStart(2, '0'),
    sigPath: rawMeta.sigPath || '',
  };

  const numericTime = Number(rawTime) || 0;
  const t = numericTime >= SHOWREEL_DURATION ? 0 : clamp(numericTime, 0, SHOWREEL_DURATION);
  const beatFloat = t / BEAT_SEC;
  const beatIndex = Math.min(29, Math.floor(beatFloat));
  const beatLocal = t - beatIndex * BEAT_SEC;
  const beatNorm = clamp(beatLocal / BEAT_SEC, 0, 1);

  let blurX = 0;
  let blurY = 0;
  let html = '';

  if (t < 2.0) {
    html += renderGridBackdrop(COL.obsidian, 'rgba(37, 99, 235, 0.16)', beatIndex, beatNorm);
    html += renderBeatHeader(beatIndex, 0, meta, false);

    const s0 = spring(t, 24, 0.84);
    const s1 = spring(t - 0.5, 24, 0.84);
    const s2 = spring(t - 1.0, 24, 0.84);
    const s3 = spring(t - 1.5, 26, 0.85);

    blurX = clamp(springVelocity(t - 0.5, 24, 0.84) * 3.2, 0, 18);
    blurY = clamp(springVelocity(t - 1.5, 26, 0.85) * 3.5, 0, 16);

    const boxW = lerp(lerp(6, 1180, expOut(t * 2.2, 7.5)), 1560, s3);
    const boxH = lerp(640, 140, s3);
    const boxX = CX - boxW / 2;
    const boxY = CY - boxH / 2;
    const headerH = lerp(0, 108, s1) * (1 - s3 * 0.65);

    html += `
      <g filter="${blurY > 1.2 ? 'url(#sr-dir-blur-y)' : blurX > 1.2 ? 'url(#sr-dir-blur-x)' : ''}">
        <rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}"
              fill="${s3 > 0.4 ? COL.cobalt : COL.navy}" stroke="${COL.white}" stroke-width="4" />
        ${headerH > 2 ? `
          <rect x="${(boxX + 2).toFixed(1)}" y="${(boxY + 2).toFixed(1)}" width="${Math.max(0, boxW - 4).toFixed(1)}" height="${headerH.toFixed(1)}"
                fill="${COL.cobaltBright}" />
        ` : ''}
      </g>
    `;

    if (boxW > 280 && s3 < 0.85) {
      const titleScale = lerp(0.85, 1.0, s0);
      const sigProgress = clamp(s2, 0, 1);
      html += `
        <g transform="translate(${CX}, ${CY - 120 * (1 - s3)}) scale(${titleScale.toFixed(3)})">
          <text x="0" y="-110" text-anchor="middle" fill="${COL.white}" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="18" letter-spacing="6">
            OFFICIAL TRANSFER DOSSIER // ${escapeXml(meta.seller)} TO ${escapeXml(meta.buyer)}
          </text>
          <text x="0" y="10" text-anchor="middle" fill="${COL.white}" font-family="'Panchang', 'Outfit', sans-serif" font-weight="700" font-size="94" letter-spacing="-1">
            ${s1 < 0.2 ? 'CONTRACT' : s2 < 0.2 ? 'AGREEMENT' : 'SIGNED SEAL'}
          </text>
        </g>
      `;

      if (sigProgress > 0.01) {
        const lineW = lerp(40, 920, sigProgress);
        html += `
          <g transform="translate(${CX}, ${CY + 145 * (1 - s3)})">
            <line x1="${(-lineW / 2).toFixed(1)}" y1="0" x2="${(lineW / 2).toFixed(1)}" y2="0" stroke="${COL.ice}" stroke-width="3" />
            <path d="M -380 -18 L -260 -68 L -190 -8 L -70 -74 L 40 -14 L 180 -62 L 340 -22"
                  fill="none" stroke="${COL.white}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
            <text x="0" y="42" text-anchor="middle" fill="${COL.ice}" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="16" letter-spacing="5">
              MANAGER SIGNATURE LOCKED · EUR ${escapeXml(meta.fee)}M
            </text>
          </g>
        `;
      }
    }

    if (s3 > 0.15) {
      const seedSpacing = lerp(24, 4, s3);
      html += `
        <text x="${CX}" y="${CY + 32}" text-anchor="middle" fill="${COL.white}"
              font-family="'Panchang', 'Outfit', sans-serif" font-weight="700" font-size="${lerp(56, 86, s3).toFixed(1)}"
              letter-spacing="${seedSpacing.toFixed(1)}">
          CONTRACT LOCKED
        </text>
      `;
    }
  } else if (t < 4.0) {
    const localT = t - 2.0;
    const b4 = spring(localT, 26, 0.84);
    const b5 = spring(localT - 0.5, 26, 0.84);
    const b6 = spring(localT - 1.0, 26, 0.84);
    const b7 = spring(localT - 1.5, 26, 0.84);

    const invertBg = localT >= 0.5 && localT < 1.5;
    const bgCol = invertBg ? COL.cobalt : COL.obsidian;
    const fgCol = COL.white;
    const accentCol = invertBg ? COL.obsidian : COL.cobaltBright;

    html += renderGridBackdrop(bgCol, invertBg ? 'rgba(5, 8, 17, 0.22)' : 'rgba(37, 99, 235, 0.2)', beatIndex, beatNorm);
    html += renderBeatHeader(beatIndex, 1, meta, false);

    blurX = clamp((springVelocity(localT, 26, 0.84) + springVelocity(localT - 1.0, 26, 0.84)) * 3.8, 0, 22);

    const topShift = lerp(0, -220, b4) + lerp(0, 180, b5) + lerp(0, -140, b6) + lerp(0, -20, b7);
    const botShift = lerp(0, 220, b4) + lerp(0, -180, b5) + lerp(0, 140, b6) + lerp(0, 20, b7);
    const splitY = lerp(70, 210, b4) * (1 - b7 * 0.72);

    const wordsTop = ['TERMS', 'VERIFIED', 'SALARY CAP', 'SEALED'];
    const wordsBot = ['AGREED', 'BY BOTH CLUBS', `EUR ${escapeXml(meta.salary)}M / YR`, 'IN IRON'];
    const wIdx = Math.min(3, Math.floor(localT / 0.5));
    const apertureSize = lerp(0, 320, b7);

    html += `
      <g filter="${blurX > 1.2 ? 'url(#sr-dir-blur-x)' : ''}">
        <g transform="translate(${(CX + topShift).toFixed(1)}, ${(CY - splitY).toFixed(1)})">
          <rect x="-780" y="-115" width="1560" height="210" fill="${accentCol}" stroke="${fgCol}" stroke-width="4" />
          <text x="0" y="38" text-anchor="middle" fill="${fgCol}"
                font-family="'Panchang', 'Outfit', sans-serif" font-weight="700" font-size="118" letter-spacing="-2">
            ${wordsTop[wIdx]}
          </text>
        </g>
        <g transform="translate(${(CX + botShift).toFixed(1)}, ${(CY + splitY).toFixed(1)})">
          <rect x="-780" y="-95" width="1560" height="210" fill="${COL.navy}" stroke="${fgCol}" stroke-width="4" />
          <text x="0" y="48" text-anchor="middle" fill="${COL.ice}"
                font-family="'Panchang', 'Outfit', sans-serif" font-weight="700" font-size="108" letter-spacing="-2">
            ${wordsBot[wIdx]}
          </text>
        </g>
      </g>
    `;

    if (apertureSize > 4) {
      html += `
        <rect x="${(CX - apertureSize / 2).toFixed(1)}" y="${(CY - apertureSize / 2).toFixed(1)}"
              width="${apertureSize.toFixed(1)}" height="${apertureSize.toFixed(1)}"
              fill="${COL.obsidian}" stroke="${COL.white}" stroke-width="8"
              transform="rotate(${(b7 * 45).toFixed(1)} ${CX} ${CY})" />
      `;
    }
  } else if (t < 6.0) {
    const localT = t - 4.0;
    const m0 = spring(localT, 24, 0.84);
    const m1 = spring(localT - 0.5, 24, 0.84);
    const m2 = spring(localT - 1.0, 24, 0.84);
    const m3 = spring(localT - 1.5, 24, 0.84);

    html += renderGridBackdrop(COL.obsidian, 'rgba(56, 189, 248, 0.16)', beatIndex, beatNorm);
    html += renderBeatHeader(beatIndex, 2, meta, false);

    const rotAngle = (45 + m0 * 22.5 + m1 * 45 + m2 * 45 + m3 * 22.5) * (Math.PI / 180);
    const outerR = lerp(226, 360, m0) - m2 * 40 + m3 * 30;
    const innerR = lerp(226, 360, m0) * lerp(0.71, 1.0, m0) * lerp(1.0, 0.52, m1) * lerp(1.0, 0.78, m3);
    const isoSquashY = lerp(1.0, 0.62, m3);

    const outerPts = [];
    const innerPts = [];
    for (let i = 0; i < 8; i += 1) {
      const a = rotAngle + (i * Math.PI) / 4;
      const r = i % 2 === 0 ? outerR : innerR;
      outerPts.push({ x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r * isoSquashY });
      innerPts.push({ x: CX + Math.cos(a) * (r * 0.56), y: CY + Math.sin(a) * (r * 0.56) * isoSquashY });
    }

    const bladeReach = lerp(0, 560, m1) * (1 - m3 * 0.45);
    let bladesHtml = '';
    for (let b = 0; b < 4; b += 1) {
      const ba = rotAngle + (b * Math.PI) / 2;
      const bx = CX + Math.cos(ba) * bladeReach;
      const by = CY + Math.sin(ba) * bladeReach * isoSquashY;
      const perpX = -Math.sin(ba) * 48;
      const perpY = Math.cos(ba) * 48 * isoSquashY;
      bladesHtml += `
        <polygon points="${(CX + perpX).toFixed(1)},${(CY + perpY).toFixed(1)} ${(bx + perpX * 0.4).toFixed(1)},${(by + perpY * 0.4).toFixed(1)} ${(bx - perpX * 0.4).toFixed(1)},${(by - perpY * 0.4).toFixed(1)} ${(CX - perpX).toFixed(1)},${(CY - perpY).toFixed(1)}"
                 fill="${b % 2 === 0 ? COL.cobaltBright : COL.slate}" stroke="${COL.white}" stroke-width="3" />
      `;
    }

    const morphLabels = ['GEOMETRIC SEAL MATRIX', '4-WAY CLAUSE LOCK', 'VECTOR DIE COMPRESSION', 'ISOMETRIC BASE LOCKED'];
    const mIdx = Math.min(3, Math.floor(localT / 0.5));

    html += `
      <g>
        ${bladesHtml}
        <polygon points="${ptsToPoly(outerPts)}" fill="${COL.cobalt}" stroke="${COL.white}" stroke-width="6" />
        <polygon points="${ptsToPoly(innerPts)}" fill="${COL.obsidian}" stroke="${COL.ice}" stroke-width="4" />
        <text x="${CX}" y="${CY + 10}" text-anchor="middle" fill="${COL.white}"
              font-family="'JetBrains Mono', monospace" font-weight="800" font-size="28" letter-spacing="6">
          0${mIdx + 1} // ${morphLabels[mIdx]}
        </text>
        <text x="${CX}" y="965" text-anchor="middle" fill="${COL.white}"
              font-family="'Panchang', 'Outfit', sans-serif" font-weight="700" font-size="32" letter-spacing="6">
          ${escapeXml(meta.player)} · OVR ${escapeXml(meta.ovr)} · ${escapeXml(meta.pos)}
        </text>
      </g>
    `;
  } else if (t < 8.0) {
    const localT = t - 6.0;
    const d0 = spring(localT, 22, 0.84);
    const d1 = spring(localT - 0.5, 22, 0.84);
    const d2 = spring(localT - 1.0, 22, 0.84);
    const d3 = spring(localT - 1.5, 24, 0.86);

    html += renderGridBackdrop(COL.obsidian, 'rgba(37, 99, 235, 0.2)', beatIndex, beatNorm);
    html += renderBeatHeader(beatIndex, 3, meta, false);

    const rotX = lerp(0.92, 0.0, d3);
    const rotY = lerp(0.0, 0.42, d1) * (1 - d3);
    const rotZ = lerp(0.78, 0.0, d3);

    const hw = lerp(260, 760, d3);
    const hh = lerp(260, 360, d3);
    const hz = lerp(20, 240, d0) * (1 - d3 * 0.88);

    const v = [
      project3D(-hw, -hh, hz, rotX, rotY, rotZ),
      project3D(hw, -hh, hz, rotX, rotY, rotZ),
      project3D(hw, hh, hz, rotX, rotY, rotZ),
      project3D(-hw, hh, hz, rotX, rotY, rotZ),
      project3D(-hw, -hh, -hz, rotX, rotY, rotZ),
      project3D(hw, -hh, -hz, rotX, rotY, rotZ),
      project3D(hw, hh, -hz, rotX, rotY, rotZ),
      project3D(-hw, hh, -hz, rotX, rotY, rotZ),
    ];

    const pistonZ = hz + lerp(280, 40, d1) * (1 - d3);
    const pwh = hw * 0.68;
    const phh = hh * 0.68;
    const pv = [
      project3D(-pwh, -phh, pistonZ + 90, rotX, rotY, rotZ),
      project3D(pwh, -phh, pistonZ + 90, rotX, rotY, rotZ),
      project3D(pwh, phh, pistonZ + 90, rotX, rotY, rotZ),
      project3D(-pwh, phh, pistonZ + 90, rotX, rotY, rotZ),
      project3D(-pwh, -phh, pistonZ, rotX, rotY, rotZ),
      project3D(pwh, -phh, pistonZ, rotX, rotY, rotZ),
      project3D(pwh, phh, pistonZ, rotX, rotY, rotZ),
      project3D(-pwh, phh, pistonZ, rotX, rotY, rotZ),
    ];

    html += `
      <g stroke-linejoin="round">
        <polygon points="${ptsToPoly([v[3], v[2], v[6], v[7]])}" fill="${COL.navy}" stroke="${COL.white}" stroke-width="3" />
        <polygon points="${ptsToPoly([v[1], v[2], v[6], v[5]])}" fill="${COL.cobalt}" stroke="${COL.white}" stroke-width="3" />
        <polygon points="${ptsToPoly([v[0], v[3], v[7], v[4]])}" fill="${COL.slate}" stroke="${COL.white}" stroke-width="3" />
        <polygon points="${ptsToPoly([v[0], v[1], v[2], v[3]])}" fill="${d3 > 0.5 ? COL.navy : COL.cobaltBright}" stroke="${COL.white}" stroke-width="5" />
        ${d1 > 0.05 && d3 < 0.85 ? `
          <polygon points="${ptsToPoly([pv[3], pv[2], pv[6], pv[7]])}" fill="${COL.cobalt}" stroke="${COL.ice}" stroke-width="3" />
          <polygon points="${ptsToPoly([pv[1], pv[2], pv[6], pv[5]])}" fill="${COL.navy}" stroke="${COL.ice}" stroke-width="3" />
          <polygon points="${ptsToPoly([pv[0], pv[1], pv[2], pv[3]])}" fill="${COL.white}" stroke="${COL.obsidian}" stroke-width="4" />
        ` : ''}
      </g>
      <text x="${CX}" y="${lerp(1018, CY + 14, d3).toFixed(1)}" text-anchor="middle"
            fill="${COL.white}" font-family="'Panchang', 'Outfit', sans-serif" font-weight="700"
            font-size="${lerp(34, 56, d3).toFixed(1)}" letter-spacing="5">
        ${d3 > 0.4 ? 'INITIALIZING FIFA 17 LEDGER UI' : d2 > 0.3 ? '3D STAMP CORE ALIGNED' : '3D CONTRACT EXTRUSION'}
      </text>
    `;
  } else if (t < 10.0) {
    const localT = t - 8.0;
    const u0 = spring(localT, 26, 0.85);
    const u1 = spring(localT - 0.5, 26, 0.85);
    const u2 = spring(localT - 1.0, 26, 0.85);
    const u3 = spring(localT - 1.5, 26, 0.85);

    html += renderGridBackdrop(COL.obsidian, 'rgba(37, 99, 235, 0.18)', beatIndex, beatNorm);
    html += renderBeatHeader(beatIndex, 4, meta, false);

    const panelX = CX - 760;
    const panelY = CY - 360;
    const panelW = 1520;
    const panelH = 720;

    const feeVal = (Number(meta.fee) * clamp(u0, 0, 1)).toFixed(1);
    const salVal = (Number(meta.salary) * clamp(u1, 0, 1)).toFixed(1);
    const barW1 = Math.round(780 * clamp(u0, 0, 1));
    const barW2 = Math.round(640 * clamp(u1, 0, 1));

    html += `
      <g>
        <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" fill="${COL.navy}" stroke="${COL.white}" stroke-width="4" />
        <rect x="${panelX}" y="${panelY}" width="${panelW}" height="76" fill="${COL.cobalt}" />
        <text x="${panelX + 36}" y="${panelY + 46}" fill="${COL.white}" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="18" letter-spacing="2.5">
          SUPER LEAGUE LEDGER // PLAYER: ${escapeXml(meta.player)} (OVR ${escapeXml(meta.ovr)})
        </text>
        <text x="${panelX + panelW - 36}" y="${panelY + 46}" text-anchor="end" fill="${COL.white}" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="18" letter-spacing="2">
          STATUS: ${u3 > 0.3 ? 'VERIFIED 4/4' : `STEP ${Math.min(4, Math.floor(localT / 0.5) + 1)}/4`}
        </text>

        <g transform="translate(${panelX + 36}, ${panelY + 108})">
          <rect x="0" y="0" width="1448" height="132" fill="${COL.obsidian}" stroke="${u0 > 0.1 ? COL.cobaltBright : COL.slate}" stroke-width="2" />
          <text x="28" y="46" fill="${COL.muted}" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="16" letter-spacing="3">01 // CLUB-TO-CLUB TRANSFER FEE (${escapeXml(meta.seller)} TO ${escapeXml(meta.buyer)})</text>
          <rect x="28" y="68" width="${barW1}" height="38" fill="${COL.cobaltBright}" />
          <text x="1416" y="96" text-anchor="end" fill="${COL.white}" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="52">
            EUR ${feeVal}M
          </text>
        </g>

        <g transform="translate(${panelX + 36}, ${panelY + 258})">
          <rect x="0" y="0" width="1448" height="132" fill="${COL.obsidian}" stroke="${u1 > 0.1 ? COL.ice : COL.slate}" stroke-width="2" />
          <text x="28" y="46" fill="${COL.muted}" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="16" letter-spacing="3">02 // AGENT AGREEMENT · WAGE BUDGET ALLOCATION · TERM: ${escapeXml(meta.years)} YEARS</text>
          <rect x="28" y="68" width="${barW2}" height="38" fill="${COL.ice}" />
          <text x="1416" y="96" text-anchor="end" fill="${COL.white}" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="52">
            ${u1 > 0.02 ? `EUR ${salVal}M / YR` : 'PENDING'}
          </text>
        </g>

        <g transform="translate(${panelX + 36}, ${panelY + 408})">
          <rect x="0" y="0" width="1448" height="132" fill="${COL.obsidian}" stroke="${u2 > 0.1 ? COL.white : COL.slate}" stroke-width="2" />
          <text x="28" y="46" fill="${COL.muted}" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="16" letter-spacing="3">03 // DRAWN MANAGER SIGNATURE (STATIC VECTOR RECORD)</text>
          ${u2 > 0.05 ? `
            <path d="M 40 104 L 140 66 L 210 112 L 330 62 L 450 106 L 590 70 L 740 98"
                  fill="none" stroke="${COL.white}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
            <text x="1416" y="96" text-anchor="end" fill="${COL.ice}" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="42">
              SIGNATURE RECORDED
            </text>
          ` : ''}
        </g>

        <g transform="translate(${panelX + 36}, ${panelY + 558})">
          <rect x="0" y="0" width="1448" height="126" fill="${u3 > 0.1 ? COL.cobaltBright : COL.obsidian}" stroke="${COL.white}" stroke-width="2" />
          <text x="28" y="76" fill="${COL.white}" font-family="'Panchang', 'Outfit', sans-serif" font-weight="700" font-size="34" letter-spacing="2">
            ${u3 > 0.1 ? '04 // FIFA 17 RDBM SQUAD HASH LOCKED — READY FOR FINAL SEAL' : '04 // AWAITING REGISTRATION LOCK...'}
          </text>
        </g>
      </g>
    `;
  } else if (t < 12.0) {
    const localT = t - 10.0;
    const c0 = spring(localT, 26, 0.85);
    const c1 = spring(localT - 0.5, 26, 0.85);
    const c2 = spring(localT - 1.0, 26, 0.85);
    const c3 = spring(localT - 1.5, 28, 0.86);

    const totalComp = (c0 + c1 + c2 + c3) / 4;
    const w = lerp(1520, 1080, totalComp);
    const h = lerp(720, 440, totalComp);
    const rot = lerp(0, -6, c3);

    html += renderGridBackdrop(COL.obsidian, 'rgba(56, 189, 248, 0.24)', beatIndex, beatNorm);
    html += renderBeatHeader(beatIndex, 5, meta, false);

    const railInsetX = lerp(80, 380, totalComp);
    const railInsetY = lerp(100, 260, totalComp);
    const countdownWords = ['COMPRESSING LEDGER', 'ARMING IRON SEAL', 'LOCKING COORDINATES', 'STAMP ARMED'];
    const cIdx = Math.min(3, Math.floor(localT / 0.5));

    html += `
      <g>
        <line x1="${railInsetX.toFixed(1)}" y1="0" x2="${railInsetX.toFixed(1)}" y2="${H}" stroke="${COL.cobaltBright}" stroke-width="4" />
        <line x1="${(W - railInsetX).toFixed(1)}" y1="0" x2="${(W - railInsetX).toFixed(1)}" y2="${H}" stroke="${COL.cobaltBright}" stroke-width="4" />
        <line x1="0" y1="${railInsetY.toFixed(1)}" x2="${W}" y2="${railInsetY.toFixed(1)}" stroke="${COL.cobaltBright}" stroke-width="4" />
        <line x1="0" y1="${(H - railInsetY).toFixed(1)}" x2="${W}" y2="${(H - railInsetY).toFixed(1)}" stroke="${COL.cobaltBright}" stroke-width="4" />

        <g transform="translate(${CX}, ${CY}) rotate(${rot.toFixed(2)})">
          <rect x="${(-w / 2).toFixed(1)}" y="${(-h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
                fill="${c2 > 0.5 ? COL.cobalt : COL.navy}" stroke="${COL.white}" stroke-width="${lerp(4, 14, totalComp).toFixed(1)}" />
          <rect x="${(-w / 2 + 24).toFixed(1)}" y="${(-h / 2 + 24).toFixed(1)}" width="${(w - 48).toFixed(1)}" height="${(h - 48).toFixed(1)}"
                fill="none" stroke="${COL.ice}" stroke-width="4" />
          <text x="0" y="-36" text-anchor="middle" fill="${COL.ice}" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="24" letter-spacing="8">
            ${countdownWords[cIdx]}
          </text>
          <text x="0" y="64" text-anchor="middle" fill="${COL.white}" font-family="'Panchang', 'Outfit', sans-serif" font-weight="700" font-size="${lerp(64, 108, totalComp).toFixed(1)}" letter-spacing="4">
            ${c3 > 0.3 ? 'SEAL READY' : escapeXml(meta.player)}
          </text>
        </g>
      </g>
    `;
  } else if (t < 14.0) {
    const localT = t - 12.0;
    const s24 = spring(localT, 32, 0.82);
    const s25 = spring(localT - 0.5, 28, 0.84);
    const s26 = spring(localT - 1.0, 28, 0.84);
    const s27 = spring(localT - 1.5, 28, 0.86);

    const isWhiteBg = localT < 1.0;
    const bgCol = isWhiteBg ? COL.white : COL.cobalt;
    const mainInk = isWhiteBg ? COL.obsidian : COL.white;
    const accentInk = isWhiteBg ? COL.cobalt : COL.obsidian;

    html += renderGridBackdrop(bgCol, isWhiteBg ? 'rgba(5, 8, 17, 0.12)' : 'rgba(248, 250, 252, 0.18)', beatIndex, beatNorm);
    html += renderBeatHeader(beatIndex, 6, meta, isWhiteBg);

    blurY = clamp(springVelocity(localT, 32, 0.82) * 4.5, 0, 20);

    const stampScale = lerp(1.42, 1.0, s24) * lerp(1.0, 0.92, s27);
    const stampRot = lerp(-6.0, 0.0, s26);
    const stampW = lerp(1280, 1480, s27);
    const stampH = lerp(520, 220, s27);

    html += `
      <g filter="${blurY > 1.2 ? 'url(#sr-dir-blur-y)' : ''}" transform="translate(${CX}, ${CY}) scale(${stampScale.toFixed(3)}) rotate(${stampRot.toFixed(2)})">
        <rect x="${(-stampW / 2).toFixed(1)}" y="${(-stampH / 2).toFixed(1)}" width="${stampW.toFixed(1)}" height="${stampH.toFixed(1)}"
              fill="${mainInk}" stroke="${accentInk}" stroke-width="16" />
        <rect x="${(-stampW / 2 + 28).toFixed(1)}" y="${(-stampH / 2 + 28).toFixed(1)}" width="${(stampW - 56).toFixed(1)}" height="${(stampH - 56).toFixed(1)}"
              fill="none" stroke="${isWhiteBg ? COL.white : COL.obsidian}" stroke-width="6" />
        <text x="0" y="${lerp(88, 52, s27).toFixed(1)}" text-anchor="middle"
              fill="${isWhiteBg ? COL.white : COL.obsidian}"
              font-family="'Panchang', 'Outfit', sans-serif" font-weight="800"
              font-size="${lerp(250, 134, s27).toFixed(1)}" letter-spacing="${lerp(12, 6, s27).toFixed(1)}">
          DONE
        </text>
        ${s27 < 0.65 ? `
          <text x="0" y="${(-stampH / 2 + 72).toFixed(1)}" text-anchor="middle"
                fill="${COL.ice}" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="18" letter-spacing="5">
            OFFICIAL CONTRACT REGISTERED // ${escapeXml(meta.player)} TO ${escapeXml(meta.buyer)}
          </text>
          <text x="0" y="${(stampH / 2 - 48).toFixed(1)}" text-anchor="middle"
                fill="${COL.ice}" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="18" letter-spacing="5">
            FEE: EUR ${escapeXml(meta.fee)}M · WAGE: EUR ${escapeXml(meta.salary)}M/YR · TERM: ${escapeXml(meta.years)} YEARS
          </text>
        ` : ''}
      </g>
    `;

    if (s25 > 0.05 && s27 < 0.8) {
      const boltOffset = lerp(120, 0, s25);
      html += `
        <g font-family="'JetBrains Mono', monospace" font-weight="800" font-size="18" letter-spacing="4">
          <rect x="${(120 - boltOffset).toFixed(1)}" y="140" width="320" height="54" fill="${mainInk}" />
          <text x="${(280 - boltOffset).toFixed(1)}" y="174" text-anchor="middle" fill="${bgCol}">CLUB FEE: CLEARED</text>

          <rect x="${(1480 + boltOffset).toFixed(1)}" y="140" width="320" height="54" fill="${mainInk}" />
          <text x="${(1640 + boltOffset).toFixed(1)}" y="174" text-anchor="middle" fill="${bgCol}">AGENT: SIGNED</text>

          <rect x="${(120 - boltOffset).toFixed(1)}" y="886" width="320" height="54" fill="${mainInk}" />
          <text x="${(280 - boltOffset).toFixed(1)}" y="920" text-anchor="middle" fill="${bgCol}">CAP: APPROVED</text>

          <rect x="${(1480 + boltOffset).toFixed(1)}" y="886" width="320" height="54" fill="${mainInk}" />
          <text x="${(1640 + boltOffset).toFixed(1)}" y="920" text-anchor="middle" fill="${bgCol}">FIFA 17: SYNCED</text>
        </g>
      `;
    }
  } else {
    const localT = t - 14.0;
    const rawLoop = clamp((localT - 0.5) / 0.5, 0, 1);
    const uLoop = expInOut(rawLoop, 8.0);

    html += renderGridBackdrop(COL.obsidian, 'rgba(37, 99, 235, 0.16)', 0, 0);
    html += renderBeatHeader(0, 0, meta, false);

    const boxW = lerp(1480, 6, uLoop);
    const boxH = lerp(220, 640, uLoop);
    const boxX = CX - boxW / 2;
    const boxY = CY - boxH / 2;

    blurX = rawLoop > 0 && rawLoop < 1 ? Math.sin(rawLoop * Math.PI) * 14 : 0;

    html += `
      <g filter="${blurX > 1.5 ? 'url(#sr-dir-blur-x)' : ''}">
        <rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}"
              fill="${COL.navy}" stroke="${COL.white}" stroke-width="4" />
      </g>
    `;

    if (boxW > 360) {
      html += `
        <g>
          <text x="${CX}" y="${CY - 12}" text-anchor="middle" fill="${COL.white}"
                font-family="'Panchang', 'Outfit', sans-serif" font-weight="700" font-size="72" letter-spacing="8">
            SUPER LEAGUE
          </text>
          <text x="${CX}" y="${CY + 56}" text-anchor="middle" fill="${COL.ice}"
                font-family="'JetBrains Mono', monospace" font-weight="800" font-size="24" letter-spacing="10">
            OFFICIAL DEAL DONE // ${escapeXml(meta.player)}
          </text>
        </g>
      `;
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="THE IRON SEAL Deal Done Showreel"><defs><filter id="sr-dir-blur-x" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="${blurX.toFixed(2)} 0" /></filter><filter id="sr-dir-blur-y" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="0 ${blurY.toFixed(2)}" /></filter></defs>${html}</svg>`;
}

let activeAudioSource = null;
let activeAudioCtx = null;

export async function playShowreelSoundtrack() {
  if (typeof window === 'undefined') return;
  try {
    stopShowreelSoundtrack();
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!OfflineCtx || !AudioCtx) return;

    const sampleRate = 44100;
    const totalSamples = sampleRate * SHOWREEL_DURATION;
    const ctx = new OfflineCtx(2, totalSamples, sampleRate);

    for (let beat = 0; beat < 30; beat += 1) {
      const bt = beat * BEAT_SEC;
      const isStampSlam = beat === 24;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isStampSlam ? 170 : 135, bt);
      osc.frequency.exponentialRampToValueAtTime(34, bt + 0.16);
      osc.frequency.exponentialRampToValueAtTime(24, bt + 0.34);

      gain.gain.setValueAtTime(0.0001, bt);
      gain.gain.linearRampToValueAtTime(isStampSlam ? 0.85 : 0.55, bt + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, bt + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(bt);
      osc.stop(bt + 0.38);
    }

    const sceneTimes = [0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0];
    const sceneFreqs = [220, 277.18, 329.63, 392.0, 440.0, 523.25, 110.0, 220.0];
    sceneTimes.forEach((st, idx) => {
      const isSlam = st === 12.0;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const hitGain = ctx.createGain();

      osc1.type = isSlam ? 'sawtooth' : 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(sceneFreqs[idx], st);
      osc1.frequency.exponentialRampToValueAtTime(sceneFreqs[idx] * 0.5, st + (isSlam ? 0.75 : 0.35));
      osc2.frequency.setValueAtTime(sceneFreqs[idx] * 1.5, st);

      hitGain.gain.setValueAtTime(0.0001, st);
      hitGain.gain.linearRampToValueAtTime(isSlam ? 0.48 : 0.22, st + 0.008);
      hitGain.gain.exponentialRampToValueAtTime(0.0008, st + (isSlam ? 0.85 : 0.42));

      osc1.connect(hitGain);
      osc2.connect(hitGain);
      hitGain.connect(ctx.destination);
      osc1.start(st);
      osc2.start(st);
      osc1.stop(st + (isSlam ? 0.88 : 0.45));
      osc2.stop(st + (isSlam ? 0.88 : 0.45));
    });

    const riserOsc = ctx.createOscillator();
    const riserSub = ctx.createOscillator();
    const riserFilter = ctx.createBiquadFilter();
    const riserGain = ctx.createGain();

    riserOsc.type = 'sawtooth';
    riserSub.type = 'triangle';
    riserOsc.frequency.setValueAtTime(110, 10.0);
    riserOsc.frequency.exponentialRampToValueAtTime(880, 12.0);
    riserSub.frequency.setValueAtTime(55, 10.0);
    riserSub.frequency.exponentialRampToValueAtTime(440, 12.0);

    riserFilter.type = 'bandpass';
    riserFilter.frequency.setValueAtTime(240, 10.0);
    riserFilter.frequency.exponentialRampToValueAtTime(3200, 12.0);
    riserFilter.Q.setValueAtTime(3.5, 10.0);

    riserGain.gain.setValueAtTime(0.001, 10.0);
    riserGain.gain.exponentialRampToValueAtTime(0.36, 11.96);
    riserGain.gain.linearRampToValueAtTime(0.0001, 12.02);

    riserOsc.connect(riserFilter);
    riserSub.connect(riserFilter);
    riserFilter.connect(riserGain);
    riserGain.connect(ctx.destination);
    riserOsc.start(10.0);
    riserSub.start(10.0);
    riserOsc.stop(12.03);
    riserSub.stop(12.03);

    const rendered = await ctx.startRendering();
    activeAudioCtx = new AudioCtx();
    activeAudioSource = activeAudioCtx.createBufferSource();
    activeAudioSource.buffer = rendered;
    activeAudioSource.connect(activeAudioCtx.destination);
    activeAudioSource.start();
  } catch {
    /* ignore autoplay restrictions if unactivated */
  }
}

export function stopShowreelSoundtrack() {
  try {
    if (activeAudioSource) {
      activeAudioSource.stop();
      activeAudioSource.disconnect();
      activeAudioSource = null;
    }
    if (activeAudioCtx) {
      activeAudioCtx.close();
      activeAudioCtx = null;
    }
  } catch {
    /* ignore */
  }
}
