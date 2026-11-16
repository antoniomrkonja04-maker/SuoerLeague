import {
  buildEditModeChecklist,
  buildFifa15AutoFriendlyMacro,
  buildFifa15BrowserUrl,
  calculateTeamPesStrength,
  computeGameDbHash,
  derivePesProfile,
  ESL_LOGO_ASSET_PATH,
  ESL_SCOREBOARD_ASSET_PATH,
  getManagerSyncSummary,
  getPesStatTier,
  PES_ATTRIBUTE_GROUPS,
  PES_HEXAGON_AXES,
  syncPlayersWithLeague,
} from './pes-core.mjs';
import { icon } from './icons.mjs';

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function teamShortCode(name = '') {
  const cleaned = String(name || 'TEAM').replace(/[^A-Za-zÄÖÜäöüß0-9 ]/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0].length <= 3) {
    return (parts[0] + parts[1].slice(0, 3 - parts[0].length)).toUpperCase().slice(0, 3);
  }
  return cleaned.replace(/\s+/g, '').slice(0, 3).toUpperCase() || 'ESL';
}

export function renderEslBroadcastScoreboard({
  homeTeamName = 'Heimteam',
  awayTeamName = 'Auswärtsteam',
  homeScore = 0,
  awayScore = 0,
  matchClock = '00:00',
  roundLabel = 'ESL · LIVE',
  roomCode = 'ESL15A',
  interactive = false,
} = {}) {
  const homeCode = teamShortCode(homeTeamName);
  const awayCode = teamShortCode(awayTeamName);

  return `
    <div class="esl-tv-scoreboard ${interactive ? 'is-interactive' : ''}" role="region" aria-label="European Super League TV-Broadcast Anzeigetafel">
      <img
        src="${ESL_SCOREBOARD_ASSET_PATH}"
        alt=""
        class="esl-tv-scoreboard-bg"
        loading="eager"
      />
      <div class="esl-tv-scoreboard-layer">
        <div class="esl-tv-left-stack">
          <div class="esl-tv-brand-pod">
            <img src="${ESL_LOGO_ASSET_PATH}" data-clean-esl-logo="true" alt="European Super League" class="esl-tv-brand-logo" />
            <div class="esl-tv-brand-copy">
              <strong>SUPER LEAGUE</strong>
              <small>${escapeHtml(roundLabel)}</small>
            </div>
          </div>
          <div class="esl-tv-clock-pod">
            <span class="esl-tv-live-dot" aria-hidden="true"></span>
            <strong class="esl-tv-clock-value">${escapeHtml(matchClock)}</strong>
            <small class="esl-tv-clock-mode">FIFA 15 · 1V1</small>
          </div>
        </div>

        <div class="esl-tv-main-bar">
          <div class="esl-tv-team-wing is-home">
            <span class="esl-tv-team-code">${escapeHtml(homeCode)}</span>
            <strong class="esl-tv-team-name">${escapeHtml(homeTeamName)}</strong>
          </div>

          <div class="esl-tv-score-center">
            ${interactive ? `<button type="button" class="esl-tv-score-step" data-action="adjust-fifa15-score" data-side="home" data-delta="-1" title="Heimtor -1" aria-label="Heimtor minus 1">−</button>` : ''}
            <strong class="esl-tv-score-digits">${Number(homeScore) || 0}<span>:</span>${Number(awayScore) || 0}</strong>
            ${interactive ? `<button type="button" class="esl-tv-score-step" data-action="adjust-fifa15-score" data-side="home" data-delta="1" title="Heimtor +1" aria-label="Heimtor plus 1">+</button>` : ''}
          </div>

          <div class="esl-tv-team-wing is-away">
            <strong class="esl-tv-team-name">${escapeHtml(awayTeamName)}</strong>
            <span class="esl-tv-team-code">${escapeHtml(awayCode)}</span>
            ${interactive ? `
              <span class="esl-tv-away-Quicksteps">
                <button type="button" class="esl-tv-score-step" data-action="adjust-fifa15-score" data-side="away" data-delta="-1" title="Gasttor -1" aria-label="Gasttor minus 1">−</button>
                <button type="button" class="esl-tv-score-step" data-action="adjust-fifa15-score" data-side="away" data-delta="1" title="Gasttor +1" aria-label="Gasttor plus 1">+</button>
              </span>
            ` : ''}
          </div>

          <div class="esl-tv-right-cap" title="Synchronisierter 1v1 Online-Raumcode">
            <small>RAUM</small>
            <strong>${escapeHtml(roomCode)}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderFifa15BrowserArena({
  league,
  homeStrength,
  awayStrength,
  syncSummary,
  streamActive = false,
  streamRole = 'host',
  cinemaMode = false,
  hudVisible = true,
  activeFixture = null,
} = {}) {
  const roomCode = syncSummary?.roomCode || 'ESL15A';
  const homeScore = Number.isFinite(Number(syncSummary?.liveHomeScore))
    ? Number(syncSummary.liveHomeScore)
    : (league?.match?.result?.home ?? 0);
  const awayScore = Number.isFinite(Number(syncSummary?.liveAwayScore))
    ? Number(syncSummary.liveAwayScore)
    : (league?.match?.result?.away ?? 0);
  const matchClock = syncSummary?.matchClock || '00:00';
  const roundLabel = activeFixture?.round
    ? `ST ${activeFixture.round} · LIVE`
    : league?.match?.round
      ? `ST ${league.match.round} · LIVE`
      : 'ESL · ANSTOSS';

  const browserUrl = buildFifa15BrowserUrl({
    mode: streamRole,
    roomCode,
    autorun: true,
    autoFriendly: true,
    fixtureId: activeFixture?.id || syncSummary?.activeFixtureId || '',
  });

  const macroInfo = buildFifa15AutoFriendlyMacro({
    homeTeamName: homeStrength.teamName,
    awayTeamName: awayStrength.teamName,
    roomCode,
  });

  const renderCompactLineupList = (strength, sideTag) => {
    const rows = strength.lineup.map(({ slot, player }) => {
      const shirt = player ? (strength.shirtNumbers?.[player.id] || player.shirtNumber || 10) : '—';
      const ovr = player?.rating || '—';
      const tier = player ? getPesStatTier(player.rating) : 'tier-60';
      return `
        <div class="fifa15-xi-row">
          <span class="fifa15-xi-pos">${escapeHtml(slot.label)}</span>
          <span class="fifa15-xi-shirt">#${escapeHtml(String(shirt))}</span>
          <strong class="fifa15-xi-name">${escapeHtml(player?.name || 'Unbesetzt')}</strong>
          <button
            type="button"
            class="pes-stat-badge ${tier} pes-ovr-trigger"
            ${player ? `data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}"` : ''}
          >${escapeHtml(String(ovr))}</button>
        </div>
      `;
    }).join('');

    return `
      <div class="fifa15-xi-column">
        <div class="fifa15-xi-head">
          <div>
            <span class="eyebrow">${escapeHtml(sideTag)} · ${escapeHtml(strength.formation || '4-3-3')}</span>
            <strong>${escapeHtml(strength.teamName)}</strong>
          </div>
          <span class="pes-stat-badge ${getPesStatTier(strength.overall)}"><small>OVR</small>${strength.overall}</span>
        </div>
        <div class="fifa15-xi-meta">
          <span>Taktik: <b>${escapeHtml(strength.tacticalPreset?.label || 'Gegenpressing')}</b></span>
          <span>ATT ${strength.attack} · MID ${strength.midfield} · DEF ${strength.defense}</span>
        </div>
        <div class="fifa15-xi-list">${rows}</div>
      </div>
    `;
  };

  return `
    <section class="panel fifa15-browser-arena ${cinemaMode ? 'is-cinema-mode' : ''}" id="fifa15-browser-arena" aria-label="European Super League FIFA 15 Browser-Arena">
      <div class="fifa15-arena-top-bar">
        <div class="fifa15-arena-brand">
          <img src="${ESL_LOGO_ASSET_PATH}" data-clean-esl-logo="true" alt="European Super League Logo" class="fifa15-arena-logo-thumb" />
          <div>
            <div class="eyebrow">EUROPEAN SUPER LEAGUE · FIFA 15 XBOX 360 MOD-ENGINE (AKTUELLE 30ER-KADER · 1V1 AUTO-SETUP)</div>
            <h3>${escapeHtml(homeStrength.teamName)} <span class="fifa15-vs-inline">vs.</span> ${escapeHtml(awayStrength.teamName)}</h3>
          </div>
        </div>

        <div class="fifa15-arena-controls">
          <button
            type="button"
            class="button ${streamActive && streamRole === 'host' ? 'primary' : 'light'} small"
            data-action="start-fifa15-stream"
            data-role="host"
          >
            ${icon('play', { size: 14 })} <span>Host starten (Pad 1 · Anstoß)</span>
          </button>
          <button
            type="button"
            class="button ${streamActive && streamRole === 'guest' ? 'primary' : 'light'} small"
            data-action="start-fifa15-stream"
            data-role="guest"
          >
            ${icon('users', { size: 14 })} <span>Als Gast beitreten (Pad 2 · ${escapeHtml(roomCode)})</span>
          </button>
          <button
            type="button"
            class="button light small"
            data-action="trigger-fifa15-auto-friendly"
            title="Schaltet FIFA 15 automatisch in den 1v1 Online-Freundschaftsspiel-Modus"
          >
            ${icon('zap', { size: 14 })} <span>Auto-Freundschaftsspiel (1v1)</span>
          </button>
          <button
            type="button"
            class="button light small ${hudVisible ? 'is-active' : ''}"
            data-action="toggle-fifa15-hud"
          >
            ${icon('tv', { size: 14 })} <span>TV-Scoreboard ${hudVisible ? 'aktiv' : 'aus'}</span>
          </button>
          <button
            type="button"
            class="button light small ${cinemaMode ? 'is-active' : ''}"
            data-action="toggle-fifa15-cinema"
          >
            ${icon('maximize', { size: 14 })} <span>${cinemaMode ? 'Kinomodus beenden' : 'Kinomodus'}</span>
          </button>
        </div>
      </div>

      ${hudVisible ? renderEslBroadcastScoreboard({
        homeTeamName: homeStrength.teamName,
        awayTeamName: awayStrength.teamName,
        homeScore,
        awayScore,
        matchClock,
        roundLabel,
        roomCode,
        interactive: true,
      }) : ''}

      <div class="fifa15-mod-setup-strip" role="status" aria-label="Super League Mod- und Auto-Setup-Status">
        <span class="fifa15-mod-pill is-ready">MOD AKTIV · 30 DRAFT-KADER, NR. &amp; 1–99 WERTE</span>
        <span>Branding: <b>Transparentes Super-League-Logo &amp; TV-Scoreboard</b></span>
        <span aria-hidden="true">·</span>
        <span>Auto-Setup: <b>Direktstart in 1v1 Online-Freundschaftsspiel (0x26F0 Klassisch)</b></span>
        <span aria-hidden="true">·</span>
        <span>1v1 Raum: <code>${escapeHtml(roomCode)}</code></span>
      </div>

      <div class="fifa15-arena-workspace">
        <div class="fifa15-viewport-shell">
          <div class="fifa15-viewport-frame">
            ${streamActive ? `
              <iframe
                id="fifa15-browser-iframe"
                class="fifa15-browser-iframe"
                src="${escapeHtml(browserUrl)}"
                allow="gamepad; fullscreen; autoplay; clipboard-read; clipboard-write"
                allowfullscreen
                credentialless
                loading="eager"
                title="FIFA 15 European Super League Browser-Stream"
              ></iframe>
            ` : `
              <div class="fifa15-standby-stage">
                <div class="fifa15-standby-hero">
                  <img src="${ESL_LOGO_ASSET_PATH}" data-clean-esl-logo="true" alt="European Super League" class="fifa15-standby-logo" />
                  <div class="fifa15-standby-copy">
                    <span class="eyebrow">FIFA 15 XBOX 360 SUPER LEAGUE MOD · SOFORT-SETUP INS ONLINE-FREUNDSCHAFTSSPIEL</span>
                    <h4>FIFA 15 Super League Broadcast-Arena</h4>
                    <p>Startet FIFA 15 Xbox 360 direkt hier im Browser mit geladenem <strong>Super League Kader-Mod</strong> (alle 30 Draft-Teams, Rückennummern &amp; 1–99 Werte) und schaltet automatisch auf <strong>1v1 Online-Freundschaftsspiel</strong>. Heim startet als <strong>Host (Pad 1)</strong>, Gast tritt über Raumcode <code>${escapeHtml(roomCode)}</code> als <strong>Pad 2 (WebRTC)</strong> bei.</p>
                    <div class="fifa15-standby-cta-row">
                      <button type="button" class="button primary" data-action="start-fifa15-stream" data-role="host">
                        ${icon('play', { size: 16 })} <span>FIFA 15 Mod-Engine starten &amp; direkt ins Online-Freundschaftsspiel (Host · Pad 1)</span>
                      </button>
                      <button type="button" class="button light" data-action="start-fifa15-stream" data-role="guest">
                        ${icon('users', { size: 16 })} <span>Als Gast mit Raumcode ${escapeHtml(roomCode)} beitreten (Pad 2)</span>
                      </button>
                    </div>
                    <div class="fifa15-standby-badges">
                      <span>Mod: <b>30 Super-League-Teams (Save-ID 454109DB)</b></span>
                      <span>Steuerung: <b>Gamepad &amp; Tastatur (Klassisch)</b></span>
                      <span>Auto-Boot: <b>Direkt in 1v1 Online-Freundschaftsspiel</b></span>
                    </div>
                  </div>
                </div>
              </div>
            `}
          </div>

          <div class="fifa15-stream-footer-bar">
            <div class="fifa15-stream-status">
              <span class="pes-live-pill">${streamActive ? `LIVE STREAM AKTIV (${streamRole === 'guest' ? 'GAST · PAD 2' : 'HOST · PAD 1'})` : 'BEREIT FÜR ANSTOSS'}</span>
              <span>Aktive Engine-URL: <code>${escapeHtml(browserUrl)}</code></span>
            </div>
            <div class="fifa15-clock-presets">
              <span>Spielminute:</span>
              ${['00:00', '25:00', '45:00', '70:00', '90:00'].map((clk) => `
                <button type="button" class="fifa15-clock-chip ${matchClock === clk ? 'is-active' : ''}" data-action="set-fifa15-clock" data-clock="${clk}">${clk}</button>
              `).join('')}
              <a href="${escapeHtml(browserUrl)}" target="_blank" rel="noopener noreferrer" class="button light small">Externes Vollbild-Fenster</a>
            </div>
          </div>
        </div>

        <aside class="fifa15-cockpit-sidebar">
          <div class="fifa15-cockpit-card">
            <div class="fifa15-cockpit-head">
              <span class="eyebrow">1V1 ONLINE-RAUMCODE-SYNCHRONISATION</span>
              <strong>WebRTC Match-Lobby · Raum <code>${escapeHtml(roomCode)}</code></strong>
            </div>
            <p class="fifa15-cockpit-sub">Beide Manager nutzen denselben 6-stelligen Raumcode. Host streamt das Spiel in 720p30; Gast steuert Team 2 verzögerungsarm über Pad 2.</p>
            <div class="fifa15-room-sync-row">
              <input
                type="text"
                id="fifa15-room-code-input"
                class="fifa15-room-input"
                maxlength="6"
                value="${escapeHtml(roomCode)}"
                aria-label="6-stelliger FIFA 15 Online-Raumcode"
              />
              <button type="button" class="button primary small" data-action="apply-fifa15-room">Code synchronisieren</button>
              <button type="button" class="button light small" data-action="regenerate-fifa15-room">Neu</button>
            </div>
            <div class="fifa15-macro-box">
              <div class="fifa15-macro-title">
                <strong>Automatisches Online-Freundschaftsspiel</strong>
                <span class="pes-mgr-sync-tag is-ok">AKTIV</span>
              </div>
              <small>${escapeHtml(macroInfo.controlsPreset)} · Schwierigkeit ${escapeHtml(macroInfo.difficultyPreset)} (Profil-Offset <code>${escapeHtml(macroInfo.profileSettingsOffset)}</code>)</small>
              <ol class="fifa15-macro-steps">
                ${macroInfo.macroSequence.map((step) => `<li><code>${escapeHtml(step.code)}</code> — ${escapeHtml(step.label)}</li>`).join('')}
              </ol>
            </div>
          </div>

          <div class="fifa15-cockpit-card">
            <div class="fifa15-cockpit-head">
              <span class="eyebrow">LIVE-ANZEIGETAFEL &amp; ERGEBNIS-DIREKTEINGABE</span>
              <strong>Spielstand in Echtzeit abgleichen</strong>
            </div>
            <div class="fifa15-quick-score-box">
              <div class="fifa15-quick-team">
                <small>${escapeHtml(homeStrength.teamName)}</small>
                <div class="fifa15-quick-stepper">
                  <button type="button" class="button light small" data-action="adjust-fifa15-score" data-side="home" data-delta="-1">−</button>
                  <strong>${homeScore}</strong>
                  <button type="button" class="button light small" data-action="adjust-fifa15-score" data-side="home" data-delta="1">+</button>
                </div>
              </div>
              <span class="fifa15-quick-colon">:</span>
              <div class="fifa15-quick-team">
                <small>${escapeHtml(awayStrength.teamName)}</small>
                <div class="fifa15-quick-stepper">
                  <button type="button" class="button light small" data-action="adjust-fifa15-score" data-side="away" data-delta="-1">−</button>
                  <strong>${awayScore}</strong>
                  <button type="button" class="button light small" data-action="adjust-fifa15-score" data-side="away" data-delta="1">+</button>
                </div>
              </div>
            </div>
            <button
              type="button"
              class="button primary small"
              style="width:100%;margin-top:8px"
              data-action="commit-fifa15-live-score"
              data-home-id="${escapeHtml(homeStrength.teamId)}"
              data-away-id="${escapeHtml(awayStrength.teamId)}"
              data-fixture-id="${escapeHtml(activeFixture?.id || syncSummary?.activeFixtureId || '')}"
            >
              ${icon('check', { size: 14 })} <span>Spielstand (${homeScore}:${awayScore}) als Endergebnis in Liga speichern</span>
            </button>
          </div>

          <div class="fifa15-cockpit-card">
            <div class="fifa15-cockpit-head">
              <span class="eyebrow">XBOX-360 KADER-SAVE-MANAGER (IDBFS-DUMP)</span>
              <strong>Super League Custom-Squads im Browser</strong>
            </div>
            <p class="fifa15-cockpit-sub">Exportiert oder lädt einen FIFA 15 Browser-Speicherstand (<code>/user/&lt;profile&gt;/454109DB/00000001/</code>), damit editierte Super-League-Teams für alle Manager sofort verfügbar sind.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="button light small" data-action="export-fifa15-save-seed">
                ${icon('download', { size: 14 })} <span>Super League Kader-Seed (.json)</span>
              </button>
              <button type="button" class="button light small" data-action="confirm-manager-db-sync">
                ${icon('check', { size: 14 })} <span>Kader-Hash (${escapeHtml(syncSummary.dbHash)}) bestätigen</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div class="fifa15-lineup-compare-strip">
        <div class="fifa15-lineup-compare-header">
          <div>
            <span class="eyebrow">AKTUELLE STARTELF- &amp; TAKTIK-ÜBERSICHT BEIDER TEAMS ZUM ABGLEICHEN IM SPIEL</span>
            <h4>Startelf-Abgleich (4-3-3) · ${escapeHtml(homeStrength.teamName)} vs. ${escapeHtml(awayStrength.teamName)}</h4>
          </div>
          <span class="pes-live-pill">11 STARTER + TAKTIK SYNCHRON</span>
        </div>
        <div class="fifa15-lineup-compare-grid">
          ${renderCompactLineupList(homeStrength, 'HEIM · PAD 1 (HOST)')}
          ${renderCompactLineupList(awayStrength, 'GAST · PAD 2 (WEBRTC)')}
        </div>
      </div>
    </section>
  `;
}

export function renderPesHexagonSvg(hexagon = {}, { size = 250 } = {}) {
  const center = size / 2;
  const maxRadius = size * 0.34;
  const labelRadius = size * 0.455;
  const rings = [55, 70, 85, 99];

  const pointFor = (axisIndex, statValue, radiusScale = maxRadius) => {
    const angle = (-Math.PI / 2) + (axisIndex * (Math.PI * 2)) / 6;
    const normalized = Math.max(0.18, Math.min(1, (Math.max(40, Number(statValue) || 40) - 35) / 64));
    const r = radiusScale * normalized;
    return {
      x: Number((center + Math.cos(angle) * r).toFixed(1)),
      y: Number((center + Math.sin(angle) * r).toFixed(1)),
    };
  };

  const gridPolygons = rings.map((ringVal) => {
    const pts = PES_HEXAGON_AXES.map((_, idx) => {
      const pt = pointFor(idx, ringVal);
      return `${pt.x},${pt.y}`;
    }).join(' ');
    return `<polygon points="${pts}" class="pes-hex-ring ${ringVal === 99 ? 'is-outer' : ''}" />`;
  }).join('');

  const axisLines = PES_HEXAGON_AXES.map((_, idx) => {
    const outer = pointFor(idx, 99);
    return `<line x1="${center}" y1="${center}" x2="${outer.x}" y2="${outer.y}" class="pes-hex-axis" />`;
  }).join('');

  const valuePoints = PES_HEXAGON_AXES.map((axis, idx) => pointFor(idx, hexagon[axis.key] ?? 75));
  const polygonPoints = valuePoints.map((pt) => `${pt.x},${pt.y}`).join(' ');

  const vertexDots = valuePoints.map((pt, idx) => {
    const key = PES_HEXAGON_AXES[idx].key;
    const val = hexagon[key] ?? 75;
    return `<circle cx="${pt.x}" cy="${pt.y}" r="4.2" class="pes-hex-dot ${getPesStatTier(val)}" />`;
  }).join('');

  const axisLabels = PES_HEXAGON_AXES.map((axis, idx) => {
    const angle = (-Math.PI / 2) + (idx * (Math.PI * 2)) / 6;
    const lx = Number((center + Math.cos(angle) * labelRadius).toFixed(1));
    const ly = Number((center + Math.sin(angle) * labelRadius).toFixed(1));
    const val = Math.round(Number(hexagon[axis.key]) || 75);
    return `
      <g class="pes-hex-label-group" transform="translate(${lx}, ${ly})">
        <text y="-5" text-anchor="middle" class="pes-hex-axis-name">${escapeHtml(axis.label)}</text>
        <text y="10" text-anchor="middle" class="pes-hex-axis-val ${getPesStatTier(val)}">${val}</text>
      </g>
    `;
  }).join('');

  return `
    <svg class="pes-hexagon-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="FIFA 17 6-Achsen Hexagon-Radar">
      <defs>
        <linearGradient id="pesHexFillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(56, 189, 248, 0.52)" />
          <stop offset="55%" stop-color="rgba(37, 99, 235, 0.36)" />
          <stop offset="100%" stop-color="rgba(245, 196, 81, 0.42)" />
        </linearGradient>
      </defs>
      ${gridPolygons}
      ${axisLines}
      <polygon points="${polygonPoints}" class="pes-hex-data-polygon" fill="url(#pesHexFillGrad)" />
      ${vertexDots}
      ${axisLabels}
    </svg>
  `;
}

export function renderPesPlayerModal(rawPlayer, league = null, { managerTeamId = '', activeManagerTeamId = '', enforceScouting = false } = {}) {
  if (!rawPlayer) return '';
  const profile = derivePesProfile(rawPlayer, league);
  if (!profile) return '';

  const effectiveTeamId = managerTeamId || activeManagerTeamId || '';
  const pick = (league?.draft?.picks ?? []).find((entry) => entry.playerId === profile.id);
  const ownerTeamId = pick?.teamId || null;
  const isOwnPlayer = Boolean(effectiveTeamId && ownerTeamId && ownerTeamId === effectiveTeamId);
  const reportKey = `${effectiveTeamId || 'host'}:${profile.id}`;
  const storedReport = league?.scouting?.reports?.[reportKey] ?? league?.scouting?.reports?.[profile.id] ?? null;
  const scoutLevel = !enforceScouting || isOwnPlayer ? 2 : (storedReport?.level ?? 0);
  const isFullyScouted = scoutLevel >= 2;

  const deltaLabel = profile.ratingDelta > 0
    ? `+${profile.ratingDelta} Saison-Form${profile.matchBoost ? ` (+${profile.matchBoost} Match-Boost)` : ''}`
    : profile.ratingDelta < 0
      ? `${profile.ratingDelta} Alterskurve`
      : '±0 Stabil';
  const deltaClass = profile.ratingDelta > 0 ? 'is-up' : profile.ratingDelta < 0 ? 'is-down' : 'is-neutral';

  const displayOvr = isFullyScouted
    ? `${profile.rating}`
    : scoutLevel === 1
      ? `${Math.max(45, profile.rating - 2)}–${Math.min(99, profile.rating + 2)}`
      : `${Math.max(45, profile.rating - 5)}–${Math.min(99, profile.rating + 5)}`;

  const displayPot = isFullyScouted
    ? `${profile.potential}`
    : scoutLevel === 1
      ? `${Math.max(50, profile.potential - 3)}–${Math.min(99, profile.potential + 2)}`
      : `${Math.max(50, profile.potential - 6)}–${Math.min(99, profile.potential + 5)}`;

  const hexForRadar = isFullyScouted
    ? profile.hexagon
    : {
      SHO: scoutLevel === 1 ? profile.hexagon.SHO : 68,
      PAS: 68,
      DRI: scoutLevel === 1 ? profile.hexagon.DRI : 68,
      PAC: scoutLevel === 1 ? profile.hexagon.PAC : 68,
      PHY: 68,
      DEF: 68,
    };

  const hexSummaryTiles = PES_HEXAGON_AXES.map((axis, idx) => {
    const val = profile.hexagon[axis.key] ?? 75;
    const revealed = isFullyScouted || (scoutLevel === 1 && idx % 2 === 0);
    const tier = revealed ? getPesStatTier(val) : 'tier-60';
    const textVal = revealed
      ? `${val}`
      : scoutLevel === 1
        ? `${Math.max(40, val - 3)}–${Math.min(99, val + 3)}`
        : `${Math.max(40, val - 6)}–${Math.min(99, val + 6)}`;
    return `
      <div class="pes-hex-stat-chip">
        <small>${escapeHtml(axis.fullLabel)}</small>
        <strong class="pes-stat-badge ${tier}">${escapeHtml(textVal)}</strong>
      </div>
    `;
  }).join('');

  const attributeGroupsHtml = PES_ATTRIBUTE_GROUPS.map((group) => {
    const rows = group.stats.map((stat, statIdx) => {
      const val = profile.attributes[stat.key] ?? 70;
      const revealed = isFullyScouted || (scoutLevel === 1 && statIdx === 0);
      const tier = revealed ? getPesStatTier(val) : 'tier-60';
      const pct = revealed ? Math.max(8, Math.min(100, Math.round(((val - 40) / 59) * 100))) : (scoutLevel === 1 ? 55 : 35);
      const badgeText = revealed
        ? `${val}`
        : scoutLevel === 1
          ? `${Math.max(40, val - 4)}–${Math.min(99, val + 4)}`
          : '??';
      return `
        <div class="pes-attr-row ${revealed ? '' : 'is-fogged-stat'}">
          <span class="pes-attr-label">${escapeHtml(stat.label)}</span>
          <div class="pes-attr-bar-track" aria-hidden="true">
            <span class="pes-attr-bar-fill ${tier}" style="width:${pct}%"></span>
          </div>
          <span class="pes-stat-badge ${tier}">${escapeHtml(badgeText)}</span>
        </div>
      `;
    }).join('');

    return `
      <section class="pes-attr-group-card">
        <h4>${escapeHtml(group.title)}</h4>
        <div class="pes-attr-list">${rows}</div>
      </section>
    `;
  }).join('');

  const scoutingBannerHtml = enforceScouting && !isFullyScouted ? `
    <div class="fm-modal-scout-banner">
      <div>
        <strong>Super League Scouting-Status: ${scoutLevel === 1 ? 'Vorbericht (50% Kenntnis)' : 'Ungescoutet (0% Kenntnis · Nebel des Krieges)'}</strong>
        <p>Die exakten Einzelwerte, das volle Hexagon-Radar und das wahre Potenzial dieses Spielers sind noch verdeckt. Entsende jetzt deine Scouts, um alle Fähigkeiten freizuschalten.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="button light small" data-action="scout-player" data-player-id="${escapeHtml(profile.id)}">
          Scout entsenden (${scoutLevel === 0 ? '50%' : '100%'} · 0,5 Mio. €)
        </button>
        <button type="button" class="button primary small" data-action="scout-player-full" data-player-id="${escapeHtml(profile.id)}">
          Voll-Scouting (100% alle Werte · 1,0 Mio. €)
        </button>
      </div>
    </div>
  ` : '';

  return `
    <div class="pes-modal-backdrop" data-action="close-pes-player">
      <section class="pes-player-modal" role="dialog" aria-modal="true" aria-labelledby="pes-player-modal-title" onclick="event.stopPropagation()">
        <header class="pes-modal-header">
          <div class="pes-modal-identity">
            <div class="pes-ovr-crest ${isFullyScouted ? getPesStatTier(profile.rating) : 'tier-70'}">
              <small>OVR</small>
              <strong>${escapeHtml(displayOvr)}</strong>
            </div>
            <div class="pes-modal-title-block">
              <div class="pes-modal-kicker">
                <span class="pes-position-pill">${escapeHtml(profile.position || 'CM')} · #${profile.shirtNumber}</span>
                <span class="pes-style-pill">${escapeHtml(profile.playingStyle)}</span>
                <span class="pes-id-pill">FIFA 17 ID #${profile.fifaId}</span>
                <span class="pes-delta-pill ${deltaClass}">${escapeHtml(deltaLabel)}</span>
              </div>
              <h2 id="pes-player-modal-title">${escapeHtml(profile.name)}</h2>
              <div class="pes-modal-meta-row">
                <span><strong>Aktueller Verein:</strong> ${escapeHtml(profile.currentClub)}</span>
                <span>·</span>
                <span><strong>Stammverein:</strong> ${escapeHtml(profile.originClub)}</span>
                <span>·</span>
                <span><strong>Alter:</strong> ${profile.age} J.</span>
                <span>·</span>
                <span><strong>Starker Fuß:</strong> ${escapeHtml(profile.foot)} (Spezial ${profile.skillMoves}/5 · Schwacher Fuß ${profile.weakFoot}/5)</span>
                <span>·</span>
                <span><strong>Potenzial:</strong> ${escapeHtml(displayPot)}</span>
                <span>·</span>
                <span><strong>Saison-Bilanz:</strong> ${profile.seasonGoals} Tore · ${profile.seasonAssists} Vorlagen</span>
              </div>
            </div>
          </div>
          <button type="button" class="pes-modal-close" data-action="close-pes-player" aria-label="Spielerprofil schließen">×</button>
        </header>

        ${scoutingBannerHtml}

        <div class="pes-modal-body">
          <aside class="pes-modal-radar-col">
            <div class="pes-radar-card">
              <div class="pes-radar-head">
                <span>FIFA 17 ATTRIBUTE-RADAR</span>
                <strong>${isFullyScouted ? '6-Achsen Hexagon' : `Scouting (${scoutLevel === 1 ? '50%' : '0%'})`}</strong>
              </div>
              <div class="pes-radar-figure">
                ${renderPesHexagonSvg(hexForRadar, { size: 256 })}
              </div>
              <div class="pes-hex-chip-grid">
                ${hexSummaryTiles}
              </div>
              <div class="pes-sync-status-box">
                <div>
                  <strong>Datenbank-Status synchronisiert</strong>
                  <small>${escapeHtml(profile.acquiredVia)} · Werte passen sich automatisch an Saison, Tore &amp; Transfers an.</small>
                </div>
              </div>
            </div>
          </aside>

          <div class="pes-modal-attrs-col">
            <div class="pes-attrs-grid">
              ${attributeGroupsHtml}
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderMiniPitchPreview(strength, sideLabel) {
  const formationName = strength.formation || '4-3-3';
  const presetName = strength.tacticalPreset?.label || 'Gegenpressing';
  const slotsHtml = strength.lineup.map(({ slot, player }) => {
    const rating = player?.rating || '—';
    const shirt = player ? (strength.shirtNumbers?.[player.id] || player.shirtNumber || '') : '';
    const tier = player ? getPesStatTier(player.rating) : 'tier-60';
    return `
      <button
        type="button"
        class="pes-mini-slot ${player ? 'is-filled' : ''}"
        style="left:${Number(slot.x)}%;top:${Number(slot.y)}%"
        ${player ? `data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}"` : ''}
        title="${escapeHtml(player ? `#${shirt} ${player.name} (${slot.label} · OVR ${rating}) — Auf OVR klicken für detaillierte Werte` : slot.label)}"
      >
        <span class="pes-mini-slot-ovr ${tier}" data-action="open-pes-player" ${player ? `data-player-id="${escapeHtml(player.id)}"` : ''}>${rating}</span>
        <span class="pes-mini-slot-name">${escapeHtml(player ? `${shirt ? `#${shirt} ` : ''}${player.name.split(' ').at(-1)}` : slot.label)}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="pes-tactic-pitch-card">
      <div class="pes-tactic-pitch-head">
        <div>
          <span class="eyebrow">${escapeHtml(sideLabel)} · ${escapeHtml(formationName)} · ${escapeHtml(presetName.toUpperCase())}</span>
          <h4>${escapeHtml(strength.teamName)}</h4>
        </div>
        <div class="pes-spirit-badge">
          <small>TEAMGEIST</small>
          <strong>${strength.teamSpirit}</strong>
        </div>
      </div>
      <div class="pes-mini-pitch" role="group" aria-label="Taktik-Vorschau ${escapeHtml(strength.teamName)}">
        <div class="pes-mini-pitch-half"></div>
        <div class="pes-mini-pitch-circle"></div>
        ${slotsHtml}
      </div>
    </div>
  `;
}

function renderMultiManagerSyncBar(syncSummary, onlineManagerIds = []) {
  const managerRows = syncSummary.managers.map((m) => {
    const isOnline = onlineManagerIds.includes(m.teamId);
    const statusText = m.isSynced ? `Synchron (${m.confirmedHash})` : `Update offen (${m.confirmedHash})`;
    return `
      <div class="pes-mgr-sync-item ${m.isSynced ? 'is-synced' : 'is-pending'}">
        <div class="pes-mgr-sync-main">
          <strong>${escapeHtml(m.managerName)} · ${escapeHtml(m.teamName)}</strong>
          <small>${isOnline ? 'Online' : 'Bereit'} · ${escapeHtml(statusText)}</small>
        </div>
        <span class="pes-mgr-sync-tag ${m.isSynced ? 'is-ok' : 'is-warn'}">${m.isSynced ? 'GLEICHER STAND' : 'RE-SYNC NÖTIG'}</span>
      </div>
    `;
  }).join('');

  const engineLabels = [
    { id: 'FIFA15', label: 'FIFA 15 Browser-Edition (WebGPU · 1v1 Online)' },
    { id: 'FIFA17', label: 'FIFA 17 (PC Online + RDBM)' },
  ];

  return `
    <section class="panel pes-multi-sync-banner" aria-label="Multi-Manager Datenbank-Synchronisation">
      <div class="pes-multi-sync-top">
        <div>
          <div class="eyebrow">EUROPEAN SUPER LEAGUE · MULTI-MANAGER DATENBANK-SYNCHRONISATION · ANTI-DESYNC</div>
          <div class="pes-hash-headline">
            <strong>Aktiver Server-Stand: <code class="pes-hash-code">${escapeHtml(syncSummary.dbHash)}</code> · Raum: <code class="pes-hash-code">${escapeHtml(syncSummary.roomCode || 'ESL15A')}</code></strong>
            <span class="pes-desync-indicator ${syncSummary.allHumansSynced ? 'is-ok' : 'is-warn'}">
              ${syncSummary.allHumansSynced ? 'Alle Mitspieler auf identischem Kader-Stand (0% Online-Desync)' : 'Kader-Änderung erkannt — Mitspieler jetzt synchronisieren'}
            </span>
          </div>
        </div>
        <div class="pes-engine-switch-group">
          <div class="pes-mode-pills" role="tablist" aria-label="Spiel-Engine wählen">
            ${engineLabels.map((eng) => `
              <button type="button" class="pes-mode-pill ${syncSummary.engineVersion === eng.id ? 'is-active' : ''}" data-action="set-game-engine" data-engine="${escapeHtml(eng.id)}">${escapeHtml(eng.label)}</button>
            `).join('')}
          </div>
          <button type="button" class="button primary small" data-action="confirm-manager-db-sync">
            ${icon('check', { size: 14 })} <span>Alle Mitspieler auf ${escapeHtml(syncSummary.dbHash)} synchronisieren</span>
          </button>
        </div>
      </div>
      <div class="pes-mgr-sync-grid">
        ${managerRows}
      </div>
    </section>
  `;
}

function renderMatchTelemetryReporter(league, homeStrength, awayStrength) {
  const lastSync = league.lastPesSync;
  const homePlayers = [...homeStrength.lineup.map((e) => e.player).filter(Boolean), ...homeStrength.benchPlayers];
  const awayPlayers = [...awayStrength.lineup.map((e) => e.player).filter(Boolean), ...awayStrength.benchPlayers];

  const homeOptions = homePlayers.map((p) => `<option value="${escapeHtml(p.id)}">#${homeStrength.shirtNumbers[p.id] || p.shirtNumber} ${escapeHtml(p.name)} (${escapeHtml(p.position)} · OVR ${p.rating})</option>`).join('');
  const awayOptions = awayPlayers.map((p) => `<option value="${escapeHtml(p.id)}">#${awayStrength.shirtNumbers[p.id] || p.shirtNumber} ${escapeHtml(p.name)} (${escapeHtml(p.position)} · OVR ${p.rating})</option>`).join('');

  const lastReportHtml = lastSync ? `
    <div class="pes-last-telemetry-box">
      <div class="pes-last-telemetry-head">
        <strong>Letztes synchronisiertes Spiel: ${escapeHtml(lastSync.homeName)} ${lastSync.homeScore} : ${lastSync.awayScore} ${escapeHtml(lastSync.awayName)}</strong>
        <span>Ballbesitz ${lastSync.possessionHome ?? 50}% : ${100 - (lastSync.possessionHome ?? 50)}% · Schüsse ${lastSync.shotsHome ?? 8} : ${lastSync.shotsAway ?? 6} · Spieler des Spiels: ${escapeHtml(lastSync.motmPlayerName || '—')}</span>
      </div>
      ${(lastSync.scorers?.length) ? `
        <div class="pes-telemetry-events">
          <span><strong>Torschützen:</strong> ${lastSync.scorers.map((s) => `${escapeHtml(s.playerName)} (${s.minute}.'${s.assistPlayerName ? `, Vorlage: ${escapeHtml(s.assistPlayerName)}` : ''})`).join(' · ')}</span>
        </div>
      ` : ''}
      ${(lastSync.attributeUpgrades?.length) ? `
        <div class="pes-telemetry-upgrades">
          <span><strong>Spieler-Entwicklung (1–99 DB-Update):</strong> ${lastSync.attributeUpgrades.map((u) => `${escapeHtml(u.playerName)} (${escapeHtml(u.delta)})`).join(' · ')}</span>
        </div>
      ` : ''}
    </div>
  ` : '';

  return `
    <section class="panel pes-telemetry-panel" aria-label="Abpfiff-Protokoll, Torschützen & Spieler-Entwicklung">
      <div class="panel-header">
        <div>
          <h2>Super League Online-Match Abpfiff-Protokoll · Ergebnis, Torschützen &amp; 1–99 Spieler-Entwicklung</h2>
          <p class="sub" style="margin:4px 0 0">Speichert das Endergebnis aus der FIFA 15 Browser-Arena, trägt Torschützen &amp; Vorlagen ein und wertet erfolgreiche Torschützen sowie eingesetzte Wunderkinder automatisch in der Datenbank auf.</p>
        </div>
        <button type="button" class="button light small" data-action="trigger-pes-live-sync">Auto-Sync vom Spiel abrufen</button>
      </div>

      ${lastReportHtml}

      <form id="pes-telemetry-form" class="pes-telemetry-form">
        <input type="hidden" name="homeTeamId" value="${escapeHtml(homeStrength.teamId)}">
        <input type="hidden" name="awayTeamId" value="${escapeHtml(awayStrength.teamId)}">
        <div class="pes-telemetry-grid">
          <div class="field">
            <label for="tele-home-score">Tore ${escapeHtml(homeStrength.teamName)}</label>
            <input id="tele-home-score" name="homeScore" type="number" min="0" max="20" value="${syncSummaryScoreOrDefault(league, 'home')}" required>
          </div>
          <div class="field">
            <label for="tele-away-score">Tore ${escapeHtml(awayStrength.teamName)}</label>
            <input id="tele-away-score" name="awayScore" type="number" min="0" max="20" value="${syncSummaryScoreOrDefault(league, 'away')}" required>
          </div>
          <div class="field">
            <label for="tele-home-scorer">Haupt-Torschütze (${escapeHtml(homeStrength.teamName)})</label>
            <select id="tele-home-scorer" name="homeScorerId">
              <option value="">Automatisch aus Startelf ermitteln</option>
              ${homeOptions}
            </select>
          </div>
          <div class="field">
            <label for="tele-home-assist">Vorlagengeber (${escapeHtml(homeStrength.teamName)})</label>
            <select id="tele-home-assist" name="homeAssistId">
              <option value="">Automatisch / Keine Vorlage</option>
              ${homeOptions}
            </select>
          </div>
          <div class="field">
            <label for="tele-away-scorer">Haupt-Torschütze (${escapeHtml(awayStrength.teamName)})</label>
            <select id="tele-away-scorer" name="awayScorerId">
              <option value="">Automatisch aus Startelf ermitteln</option>
              ${awayOptions}
            </select>
          </div>
          <div class="field">
            <label for="tele-possession">Ballbesitz Heim (%)</label>
            <input id="tele-possession" name="possessionHome" type="number" min="15" max="85" value="54">
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:12px">
          <span class="draft-sub">Torschützen &amp; Vorlagengeber erhalten sofort +1 auf ihre Attribute; alle Mitspieler erhalten den neuen Squad-Hash.</span>
          <button type="submit" class="button primary small">Ergebnis, Torschützen &amp; Spieler-Entwicklung speichern</button>
        </div>
      </form>
    </section>
  `;
}

function syncSummaryScoreOrDefault(league, side) {
  if (side === 'home') {
    if (Number.isFinite(Number(league?.onlineLobby?.liveHomeScore))) return Number(league.onlineLobby.liveHomeScore);
    return league?.match?.result?.home ?? 2;
  }
  if (Number.isFinite(Number(league?.onlineLobby?.liveAwayScore))) return Number(league.onlineLobby.liveAwayScore);
  return league?.match?.result?.away ?? 1;
}

export function renderPesMatchHubSuite({
  league,
  players = [],
  homeTeamId = '',
  awayTeamId = '',
  activeTab = 'strength',
  checkedExportIds = [],
  connectionMode = 'fifa15-browser',
  onlineManagerIds = [],
  streamActive = false,
  streamRole = 'host',
  cinemaMode = false,
  hudVisible = true,
}) {
  if (!league) return '';
  const teams = league.teams ?? [];
  const resolvedHomeId = homeTeamId || league.match?.homeId || teams[0]?.id || '';
  const resolvedAwayId = awayTeamId || league.match?.awayId || teams[1]?.id || teams[0]?.id || '';

  const homeStrength = calculateTeamPesStrength(resolvedHomeId, league, players);
  const awayStrength = calculateTeamPesStrength(resolvedAwayId, league, players);
  const checklist = buildEditModeChecklist(league, players);
  const checkedSet = new Set(checkedExportIds);
  const syncedPlayers = syncPlayersWithLeague(players, league);
  const syncSummary = getManagerSyncSummary(league, players, { homeTeamId: resolvedHomeId, awayTeamId: resolvedAwayId });
  const activeFixture = (league.schedule ?? []).find((f) => f.id === syncSummary.activeFixtureId)
    || (league.schedule ?? []).find((f) => f.homeId === resolvedHomeId && f.awayId === resolvedAwayId && f.status !== 'completed')
    || null;

  const renderComparisonBar = (label, homeVal, awayVal) => {
    const total = Math.max(1, homeVal + awayVal);
    const homePct = Math.round((homeVal / total) * 100);
    return `
      <div class="pes-h2h-bar-row">
        <strong class="pes-h2h-val ${getPesStatTier(homeVal)}">${homeVal}</strong>
        <div class="pes-h2h-bar-center">
          <div class="pes-h2h-bar-label">${escapeHtml(label)}</div>
          <div class="pes-h2h-bar-track">
            <span class="pes-h2h-fill-home" style="width:${homePct}%"></span>
            <span class="pes-h2h-fill-away" style="width:${100 - homePct}%"></span>
          </div>
        </div>
        <strong class="pes-h2h-val ${getPesStatTier(awayVal)}">${awayVal}</strong>
      </div>
    `;
  };

  const renderStarList = (strength) => {
    if (!strength.starPlayers.length) {
      return '<div class="pes-empty-inline">Noch keine Spieler im Kader (Draft ausstehend).</div>';
    }
    return strength.starPlayers.map((player) => {
      const shirt = strength.shirtNumbers?.[player.id] || player.shirtNumber || 10;
      return `
        <button type="button" class="pes-star-player-row" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}" title="Auf OVR klicken für detaillierte Werte">
          <span class="pes-stat-badge ${getPesStatTier(player.rating)} pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}"><small>OVR</small>${player.rating}</span>
          <span class="pes-star-copy">
            <strong>#${shirt} ${escapeHtml(player.name)}</strong>
            <small>${escapeHtml(player.position)} · ${escapeHtml(player.playingStyle)} · ${player.age} J.${player.seasonGoals ? ` · ${player.seasonGoals} Tore` : ''}</small>
          </span>
          <span class="pes-star-hex-mini">SCH ${player.hexagon.SHO} · DRI ${player.hexagon.DRI} · TEM ${player.hexagon.PAC}</span>
        </button>
      `;
    }).join('');
  };

  let tabBodyHtml = '';

  if (activeTab === 'strength' || activeTab === 'arena') {
    tabBodyHtml = `
      ${renderFifa15BrowserArena({
        league,
        homeStrength,
        awayStrength,
        syncSummary,
        streamActive,
        streamRole,
        cinemaMode,
        hudVisible,
        activeFixture,
      })}

      <div class="pes-suite-grid">
        <section class="panel pes-h2h-panel">
          <div class="panel-header">
            <h2>Teamstärke, Startelf &amp; Head-to-Head Vergleich</h2>
            <span>LIVE AUS 30ER-KADERN, TRANSFERS &amp; SPIELER-ENTWICKLUNG</span>
          </div>

          <div class="pes-h2h-team-selectors">
            <label class="field">
              <span>Heimteam (Browser-Arena &amp; Vorschau)</span>
              <select data-pes-team-select="home">
                ${teams.map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === resolvedHomeId ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.managerName)})</option>`).join('')}
              </select>
            </label>
            <div class="pes-vs-pill">VS</div>
            <label class="field">
              <span>Auswärtsteam (Browser-Arena &amp; Vorschau)</span>
              <select data-pes-team-select="away">
                ${teams.map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === resolvedAwayId ? 'selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.managerName)})</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="pes-h2h-bars">
            ${renderComparisonBar('Gesamtstärke (OVR)', homeStrength.overall, awayStrength.overall)}
            ${renderComparisonBar('Angriff (ATT)', homeStrength.attack, awayStrength.attack)}
            ${renderComparisonBar('Mittelfeld (MID)', homeStrength.midfield, awayStrength.midfield)}
            ${renderComparisonBar('Defensive (DEF)', homeStrength.defense, awayStrength.defense)}
            ${renderComparisonBar('Teamgeist (Taktik-Chemie)', homeStrength.teamSpirit, awayStrength.teamSpirit)}
          </div>

          <div class="pes-stars-columns">
            <div class="pes-stars-box">
              <h4>Top-Stars · ${escapeHtml(homeStrength.teamName)} <small>(Ø ${homeStrength.avgAge} J. · ${escapeHtml(homeStrength.formation)})</small></h4>
              ${renderStarList(homeStrength)}
            </div>
            <div class="pes-stars-box">
              <h4>Top-Stars · ${escapeHtml(awayStrength.teamName)} <small>(Ø ${awayStrength.avgAge} J. · ${escapeHtml(awayStrength.formation)})</small></h4>
              ${renderStarList(awayStrength)}
            </div>
          </div>
        </section>

        <section class="panel pes-tactics-panel">
          <div class="panel-header">
            <h2>Startelf, Rückennummern &amp; Taktik-Vorschau</h2>
            <span>SPIELER ANTIPPEN FÜR HEXAGON &amp; EINZELWERTE</span>
          </div>
          <div class="pes-dual-pitch-grid">
            ${renderMiniPitchPreview(homeStrength, 'HEIM')}
            ${renderMiniPitchPreview(awayStrength, 'GAST')}
          </div>
        </section>
      </div>
      ${renderMatchTelemetryReporter(league, homeStrength, awayStrength)}
    `;
  } else if (activeTab === 'export') {
    const previewPlayers = syncedPlayers.slice(0, 14);
    tabBodyHtml = `
      <section class="panel pes-export-panel">
        <div class="panel-header">
          <div>
            <h2>Super League Datenbank- &amp; FIFA Kader-Export</h2>
            <p class="sub" style="margin:4px 0 0">Exportiert den FIFA 15 Browser-Save-Seed sowie die relationalen Kader-Tabellen (<code>players.csv</code>, <code>teamplayerlinks.csv</code>, <code>formations.csv</code>). Dadurch treten alle Mitspieler mit exakt denselben 30er-Kadern, Rückennummern, Transfers und entwickelten Spielerwerten an.</p>
          </div>
          <div class="pes-export-actions">
            <button type="button" class="button primary small" data-action="export-fifa15-save-seed">${icon('download', { size: 14 })} <span>FIFA 15 Browser Save-Seed (.json)</span></button>
            <button type="button" class="button light small" data-action="download-career-package">${icon('download', { size: 14 })} <span>Karriere-Snapshot (.json) herunterladen</span></button>
            <button type="button" class="button primary small" data-action="export-fifa-players-csv">${icon('download', { size: 14 })} <span>players.csv (RDBM)</span></button>
            <button type="button" class="button primary small" data-action="export-fifa-links-csv">${icon('download', { size: 14 })} <span>teamplayerlinks.csv (Kader &amp; Nr.)</span></button>
            <button type="button" class="button light small" data-action="export-fifa-formations-csv">${icon('download', { size: 14 })} <span>formations.csv (Taktik)</span></button>
            <button type="button" class="button light small" data-action="export-pes-json">${icon('download', { size: 14 })} <span>Komplett-Manifest JSON</span></button>
          </div>
        </div>

        <div class="pes-sync-banner">
          <div>
            <strong>Synchronisierte Super League Spieler-Datenbank (${syncedPlayers.length} Spieler inkl. Wunderkinder · Hash <code>${escapeHtml(syncSummary.dbHash)}</code>)</strong>
            <p>Alle 30er-Draft-Kader, Rückennummern und entwickelten Attribute (1–99) für die FIFA 15 Browser-Arena und RDBM-Datenbanken.</p>
          </div>
          <span class="pes-live-pill">DB-HASH ${escapeHtml(syncSummary.dbHash)}</span>
        </div>

        <div class="table-scroll">
          <table class="player-table pes-db-table">
            <thead>
              <tr>
                <th>FIFA ID</th>
                <th>Nr.</th>
                <th>Spieler</th>
                <th>Aktueller Liga-Verein</th>
                <th>Pos</th>
                <th>Alter</th>
                <th>OVR &amp; Form</th>
                <th>Saison (T/V)</th>
                <th>6-Achsen Werte (SCH/DRI/PAS/TEM/PHY/DEF)</th>
                <th>Profil</th>
              </tr>
            </thead>
            <tbody>
              ${previewPlayers.map((p) => `
                <tr>
                  <td><code>F#${p.fifaId}</code></td>
                  <td><code>#${p.shirtNumber}</code></td>
                  <td><strong>${escapeHtml(p.name)}</strong><div class="draft-sub">${escapeHtml(p.playingStyle)} · ${escapeHtml(p.foot)} · SM ${p.skillMoves}★</div></td>
                  <td><span class="pes-club-badge">${escapeHtml(p.currentClub)}</span><div class="draft-sub">${escapeHtml(p.originClub)}</div></td>
                  <td><span class="position-tag">${escapeHtml(p.position || 'CM')}</span></td>
                  <td>${p.age}</td>
                  <td>
                    <button type="button" class="pes-stat-badge ${getPesStatTier(p.rating)} pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(p.id)}" title="Auf OVR klicken für detaillierte Werte"><small>OVR</small>${p.rating}</button>
                    ${p.ratingDelta ? `<small class="pes-inline-delta ${p.ratingDelta > 0 ? 'is-up' : 'is-down'}">${p.ratingDelta > 0 ? `+${p.ratingDelta}` : p.ratingDelta}</small>` : ''}
                  </td>
                  <td><code>${p.seasonGoals || 0}T · ${p.seasonAssists || 0}V</code></td>
                  <td>
                    <div class="pes-mini-hex-strip">
                      <span>SCH <b>${p.hexagon.SHO}</b></span>
                      <span>DRI <b>${p.hexagon.DRI}</b></span>
                      <span>PAS <b>${p.hexagon.PAS}</b></span>
                      <span>TEM <b>${p.hexagon.PAC}</b></span>
                      <span>PHY <b>${p.hexagon.PHY}</b></span>
                      <span>DEF <b>${p.hexagon.DEF}</b></span>
                    </div>
                  </td>
                  <td><button type="button" class="pick-button" data-action="open-pes-player" data-player-id="${escapeHtml(p.id)}">Hexagon</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  } else if (activeTab === 'editmode') {
    const transferRows = checklist.transfers.length
      ? checklist.transfers.map((item) => {
        const done = checkedSet.has(item.stepId);
        return `
          <div class="pes-checklist-item ${done ? 'is-done' : ''}">
            <button type="button" class="pes-check-toggle" data-action="toggle-pes-check" data-step-id="${escapeHtml(item.stepId)}" aria-pressed="${done}">
              ${done ? '✓' : ''}
            </button>
            <div class="pes-checklist-copy">
              <strong>#${item.shirtNumber || 10} ${escapeHtml(item.playerName)} <span class="position-tag">${escapeHtml(item.position)}</span> <button type="button" class="pes-stat-badge ${getPesStatTier(item.rating)} pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(item.playerId)}" title="Auf OVR klicken für detaillierte Werte"><small>OVR</small>${item.rating}</button></strong>
              <p>${escapeHtml(item.instruction)}</p>
              <small>FIFA ID #${item.fifaId} · Ablöse: ${item.fee.toLocaleString('de-DE')} Mio. €</small>
            </div>
            <button type="button" class="button light small" data-action="open-pes-player" data-player-id="${escapeHtml(item.playerId)}">Werte (1–99)</button>
          </div>
        `;
      }).join('')
      : `
        <div class="pes-empty-checklist">
          <strong>Noch keine abgeschlossenen Transfers in dieser Saison</strong>
          <p>Sobald im Smartphone (TransferHub), in der Free Agency oder durch die CPU-Marktsimulation Transfers stattfinden, erscheinen sie hier als abhakbare Liste sowie im automatischen Super-League-Tabellen-Export.</p>
          <button type="button" class="button light small" data-action="trigger-cpu-market">CPU-Transfermarkt jetzt simulieren</button>
        </div>
      `;

    tabBodyHtml = `
      <div class="pes-suite-grid">
        <section class="panel">
          <div class="panel-header">
            <h2>Kader- &amp; Transfer-Checkliste (FIFA 15 Browser &amp; RDBM)</h2>
            <span>${checklist.transfers.length} TRANSFERS ZUM ÜBERTRAGEN</span>
          </div>
          <div class="pes-checklist-stack">
            ${transferRows}
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>Schnell-Guide: Eigene Super League Kader in FIFA 15 Browser nutzen</h2>
            <span>FIFA 15 SAVE-SEED &amp; WEBRTC</span>
          </div>
          <div class="pes-guide-steps">
            <div class="pes-guide-step">
              <span class="pes-step-num">01</span>
              <div>
                <strong>Transfers &amp; Startelf im FIFA 15 Edit-Modus anpassen (Optional)</strong>
                <p>Da FIFA 15 im Browser direkt aus dem Xbox-360-Image lädt, kann der Host einmalig im Spiel unter <em>Anpassen → Teams bearbeiten</em> Transfers durchführen und den Speicherstand als <strong>Super League Kader-Seed (.json)</strong> exportieren.</p>
              </div>
            </div>
            <div class="pes-guide-step">
              <span class="pes-step-num">02</span>
              <div>
                <strong>6-stelligen Raumcode (${escapeHtml(syncSummary.roomCode)}) teilen</strong>
                <p>Der Heim-Manager startet den Browser-Stream als <strong>Host (Pad 1)</strong>. Der Auswärts-Manager klickt auf <strong>Als Gast beitreten (Pad 2)</strong> und steuert sein Team live über WebRTC.</p>
              </div>
            </div>
            <div class="pes-guide-step">
              <span class="pes-step-num">03</span>
              <div>
                <strong>Live-Scoreboard nutzen &amp; Ergebnis speichern</strong>
                <p>Über das offizielle Super League TV-Scoreboard über dem Spielstream könnt ihr Tore direkt erfassen und mit einem Klick samt Torschützen in den Saisonkalender übernehmen.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  } else {
    const activeNetMode = connectionMode || syncSummary.networkMode || 'fifa15-browser';
    tabBodyHtml = `
      <div class="pes-suite-grid">
        <section class="panel">
          <div class="panel-header">
            <h2>Online-Matchmaking &amp; WebRTC Raum-Lobby (FIFA 15 Browser &amp; PC)</h2>
            <span>1V1 BROWSER-WEBRTC ODER PC-DIRECT</span>
          </div>

          <div class="pes-mode-pills" role="tablist" aria-label="Verbindungsmodus">
            <button type="button" class="pes-mode-pill ${activeNetMode === 'fifa15-browser' ? 'is-active' : ''}" data-action="set-pes-connection-mode" data-mode="fifa15-browser">FIFA 15 Browser WebRTC 1v1 (Empfohlen)</button>
            <button type="button" class="pes-mode-pill ${activeNetMode === 'radmin-direct' || activeNetMode === 'parsec' ? 'is-active' : ''}" data-action="set-pes-connection-mode" data-mode="radmin-direct">PC Direct-Online + Radmin VPN</button>
            <button type="button" class="pes-mode-pill ${activeNetMode === 'custom-blaze' || activeNetMode === 'sider' ? 'is-active' : ''}" data-action="set-pes-connection-mode" data-mode="custom-blaze">Community Blaze Server</button>
          </div>

          <form id="online-lobby-config-form" class="pes-online-lobby-box" style="margin-top:14px">
            <div class="pes-telemetry-grid">
              <div class="field">
                <label for="lobby-room-name">Super League Raumname / Netzwerk</label>
                <input id="lobby-room-name" name="networkRoomName" value="${escapeHtml(syncSummary.networkRoomName)}" required>
              </div>
              <div class="field">
                <label for="lobby-host-ip">1v1 Raumcode / Host-Kennung</label>
                <input id="lobby-host-ip" name="hostVirtualIp" value="${escapeHtml(syncSummary.hostVirtualIp)}" required>
              </div>
            </div>
            <div class="pes-ready-check-row">
              <button type="button" class="button ${syncSummary.homeReady ? 'primary' : 'light'} small" data-action="toggle-online-lobby-ready" data-side="home">
                Heim (${escapeHtml(homeStrength.teamName)}): ${syncSummary.homeReady ? 'BEREIT (PAD 1)' : 'Bereitschaft bestätigen'}
              </button>
              <button type="button" class="button ${syncSummary.awayReady ? 'primary' : 'light'} small" data-action="toggle-online-lobby-ready" data-side="away">
                Gast (${escapeHtml(awayStrength.teamName)}): ${syncSummary.awayReady ? 'BEREIT (PAD 2)' : 'Bereitschaft bestätigen'}
              </button>
              <button type="submit" class="button light small">Lobby-Daten für alle speichern</button>
            </div>
          </form>

          <div class="pes-guide-steps" style="margin-top:14px">
            <div class="pes-guide-step">
              <span class="pes-step-num">01</span>
              <div>
                <strong>FIFA 15 Browser-Arena mit Raumcode <code>${escapeHtml(syncSummary.roomCode)}</code> starten</strong>
                <p>Heim-Manager startet als Host (<code>?autorun=1</code>), Auswärts-Manager verbindet sich über <code>?join=${escapeHtml(syncSummary.roomCode)}</code> direkt im Browser ohne Zusatzsoftware.</p>
              </div>
            </div>
            <div class="pes-guide-step">
              <span class="pes-step-num">02</span>
              <div>
                <strong>Automatisches Online-Freundschaftsspiel (1v1)</strong>
                <p>Das Super League Controller-Makro navigiert automatisch in das 1v1-Freundschaftsspiel und setzt Controller 1 (Heim) gegen Controller 2 (Gast via WebRTC).</p>
              </div>
            </div>
            <div class="pes-guide-step">
              <span class="pes-step-num">03</span>
              <div>
                <strong>Anpfiff &amp; Ergebnis-Rückmeldung in die Super League</strong>
                <p>Nach Abpfiff wird das Ergebnis samt Torschützen, Vorlagen und Spieler-Aufwertungen direkt an den Super League Server übertragen und für alle Mitspieler gespeichert.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>Offizielle Super League Match-Einstellungen</h2>
            <span>FIFA 15 BROWSER EDITION</span>
          </div>
          <div class="summary-row"><span>Primäre Engine</span><b>FIFA 15 Browser-Edition (WebAssembly / WebGPU)</b></div>
          <div class="summary-row"><span>1v1 Online-Raumcode</span><b><code>${escapeHtml(syncSummary.roomCode)}</code> (Host Pad 1 vs. Gast Pad 2)</b></div>
          <div class="summary-row"><span>Datenbank-Prüfsumme</span><b><code>${escapeHtml(syncSummary.dbHash)}</code> (${syncSummary.isDesyncFree ? 'Synchron' : 'Update offen'})</b></div>
          <div class="summary-row"><span>Spielmodus</span><b>Automatisches 1v1 Online-Freundschaftsspiel</b></div>
          <div class="summary-row"><span>Halbzeitlänge</span><b>6 Min. (Liga) · 7 Min. (K.-o.-Phase)</b></div>
          <div class="summary-row"><span>Steuerung &amp; Geschwindigkeit</span><b>Klassisch (Classic) · Normal · Wetter Trocken</b></div>
          <div class="summary-row"><span>Spieler-Entwicklung</span><b>Aktiv (+1 OVR/Stats bei Toren, Assists &amp; U21-Einsätzen)</b></div>
        </section>
      </div>
    `;
  }

  return `
    <section class="pes-command-center" aria-label="European Super League FIFA 15 Browser-Arena">
      <div class="pes-command-header">
        <div class="pes-command-brand-row">
          <img src="${ESL_LOGO_ASSET_PATH}" data-clean-esl-logo="true" alt="European Super League" class="pes-command-esl-logo" />
          <div>
            <div class="eyebrow">EUROPEAN SUPER LEAGUE · FIFA 15 XBOX 360 BROWSER-MOD · 1V1 WEBRTC ONLINE</div>
            <h2>European Super League · FIFA 15 Browser-Arena &amp; FIFA 17 Online Command Center</h2>
            <p>Spielt eure Super-League-Begegnungen direkt im Browser mit dem aktuellen 30-Team-Kader-Mod, freigestelltem Super-League-Logo, offiziellem TV-Broadcast-Scoreboard und automatischem Sofort-Setup ins 1v1 Online-Freundschaftsspiel.</p>
          </div>
        </div>
        <div class="pes-command-tabs" role="tablist" aria-label="Integration Bereiche">
          <button type="button" class="pes-tab-btn ${activeTab === 'strength' || activeTab === 'arena' ? 'is-active' : ''}" data-action="set-pes-hub-tab" data-tab="strength">${icon('play', { size: 15 })} <span>FIFA 15 Browser-Arena, Taktik &amp; Ergebnis</span></button>
          <button type="button" class="pes-tab-btn ${activeTab === 'export' ? 'is-active' : ''}" data-action="set-pes-hub-tab" data-tab="export">${icon('download', { size: 15 })} <span>Kader-Seeds &amp; DB-Export</span></button>
          <button type="button" class="pes-tab-btn ${activeTab === 'editmode' ? 'is-active' : ''}" data-action="set-pes-hub-tab" data-tab="editmode">${icon('contract', { size: 15 })} <span>Transfers &amp; Checkliste (${checklist.transfers.length})</span></button>
          <button type="button" class="pes-tab-btn ${activeTab === 'parsec' ? 'is-active' : ''}" data-action="set-pes-hub-tab" data-tab="parsec">${icon('matches', { size: 15 })} <span>1v1 Online-Lobby &amp; WebRTC</span></button>
        </div>
      </div>
      ${renderMultiManagerSyncBar(syncSummary, onlineManagerIds)}
      ${tabBodyHtml}
    </section>
  `;
}
