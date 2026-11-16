import { isTransferWindowOpen, rankTeamsFromResults } from './transfer-core.mjs';
import { getTopScorers, getTopAssisters } from './calendar-core.mjs';
import { calculateTeamPesStrength, ESL_LOGO_ASSET_PATH, getManagerSyncSummary } from './pes-core.mjs';
import { renderEslBroadcastScoreboard, renderFifa15BrowserArena } from './pes-view.mjs';
import { icon } from './icons.mjs';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function dateOnly(value) { return String(value ?? '').slice(0, 10); }

export function renderStandingsTable(league, { compact = false, subTab = 'table' } = {}) {
  const standings = rankTeamsFromResults(league?.teams ?? [], league?.matchHistory ?? []);

  if (subTab === 'scorers') {
    const topScorers = getTopScorers(league, 25);
    const teamsMap = new Map((league?.teams ?? []).map((t) => [t.id, t.name]));

    const scorerRows = topScorers.length ? topScorers.map((p, idx) => `
      <tr class="standings-row">
        <td class="col-rank"><strong>${idx + 1}</strong></td>
        <td class="col-team">
          <button type="button" class="table-player-link" data-action="open-pes-player" data-player-id="${escapeHtml(p.playerId)}" title="${escapeHtml(p.playerName)} Profil ansehen">
            <strong>${escapeHtml(p.playerName)}</strong>
          </button>
        </td>
        <td>
          <button type="button" class="table-team-link" data-action="open-club-page" data-team-id="${escapeHtml(p.teamId)}" title="${escapeHtml(teamsMap.get(p.teamId) || 'Verein')} Vereinspage öffnen">
            ${escapeHtml(teamsMap.get(p.teamId) || 'Verein')}
          </button>
        </td>
        <td><span class="pos-badge">${escapeHtml(p.position || '—')}</span></td>
        <td>${p.matches}</td>
        <td><strong class="col-highlight">${p.goals}</strong></td>
        <td>${p.assists}</td>
        <td><strong>${p.averageRating > 0 ? p.averageRating : '—'}</strong></td>
      </tr>
    `).join('') : '<tr><td colspan="8" class="empty-state-sm">Noch keine Ligatore in dieser Saison erzielt. Simuliere Spieltage, um Tore zu erfassen.</td></tr>';

    return `<section class="panel standings-panel" aria-label="Torjägerliste">
      <div class="panel-header">
        <div>
          <h2>Offizielle Torjägerliste &amp; Scorer</h2>
          <span>TOP 25 TORSCHÜTZEN · SAISON 2026/27</span>
        </div>
        <div class="table-subtab-switch">
          <button type="button" class="button light small" data-action="set-table-subtab" data-subtab="table">Ligatabelle</button>
          <button type="button" class="button primary small" data-action="set-table-subtab" data-subtab="scorers">Torjäger &amp; Scorer</button>
        </div>
      </div>
      <div class="standings-scroll">
        <table class="player-table standings-table">
          <thead>
            <tr>
              <th>Rang</th>
              <th>Spieler</th>
              <th>Verein</th>
              <th>Pos</th>
              <th title="Spiele">Sp</th>
              <th title="Tore">Tore</th>
              <th title="Vorlagen">Vorlagen</th>
              <th title="Durchschnittsnote">Ø Note</th>
            </tr>
          </thead>
          <tbody>${scorerRows}</tbody>
        </table>
      </div>
    </section>`;
  }

  const rows = (compact ? standings.slice(0, 30) : standings).map((row) => {
    const zone = row.rank <= 8 ? 'direct-knockout' : row.rank <= 24 ? 'playoff' : 'eliminated';
    const zoneBadge = row.rank <= 8
      ? '<span class="qual-badge is-knockout" title="Direkte Qualifikation für das Achtelfinale (Plätze 1–8)">Achtelfinale</span>'
      : row.rank <= 24
        ? '<span class="qual-badge is-playoff" title="K.-o.-Phasen Play-offs (Plätze 9–24)">Play-offs</span>'
        : '<span class="qual-badge is-eliminated" title="Ausgeschieden nach Ligaphase (Plätze 25–30)">Ausgeschieden</span>';
    const diff = row.goalsFor - row.goalsAgainst;
    const formBadges = (row.form ?? []).map((result) => `<span class="form-pill is-${result.toLowerCase()}" aria-label="${result}">${result}</span>`).join('') || '<span class="draft-sub">—</span>';
    return `<tr class="standings-row is-${zone}" data-team-id="${escapeHtml(row.teamId)}" data-qualification="${zone}">
      <td class="col-rank"><strong>${row.rank}</strong></td>
      <td class="col-team">
        <button type="button" class="table-team-link" data-action="open-club-page" data-team-id="${escapeHtml(row.teamId)}" title="${escapeHtml(row.teamName)} Vereinspage öffnen">
          <strong>${escapeHtml(row.teamName)}</strong>
        </button>
        ${zoneBadge}
      </td>
      <td>${row.played}</td>
      <td>${row.wins}</td>
      <td>${row.draws}</td>
      <td>${row.losses}</td>
      <td>${row.goalsFor}</td>
      <td>${row.goalsAgainst}</td>
      <td>${diff > 0 ? `+${diff}` : diff}</td>
      <td><strong>${row.points}</strong></td>
      <td class="col-form">${formBadges}</td>
    </tr>`;
  }).join('');

  return `<section class="panel standings-panel" aria-label="Ligatabelle">
    <div class="panel-header">
      <div>
        <h2>Ligatabelle</h2>
        <span>58 SPIELTAGE · 30 TEAMS</span>
      </div>
      <div class="table-subtab-switch">
        <button type="button" class="button primary small" data-action="set-table-subtab" data-subtab="table">Ligatabelle</button>
        <button type="button" class="button light small" data-action="set-table-subtab" data-subtab="scorers">Torjäger &amp; Scorer</button>
      </div>
    </div>
    <div class="standings-legend" aria-label="Tabellenlegende">
      <span class="legend-item is-knockout"><b>●</b> Grün/Gold: Direktes Achtelfinale (Plätze 1–8)</span>
      <span class="legend-item is-playoff"><b>●</b> Blau: K.-o.-Phasen Play-offs (Plätze 9–24)</span>
      <span class="legend-item is-eliminated"><b>○</b> Grau: Ausgeschieden (Plätze 25–30)</span>
    </div>
    <div class="standings-scroll">
      <table class="player-table standings-table">
        <thead>
          <tr>
            <th>Platz</th>
            <th>Verein</th>
            <th title="Spiele">Sp</th>
            <th title="Siege">S</th>
            <th title="Unentschieden">U</th>
            <th title="Niederlagen">N</th>
            <th title="Tore">T</th>
            <th title="Gegentore">GT</th>
            <th title="Tordifferenz">TD</th>
            <th title="Punkte">Pkt</th>
            <th>Form (5)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

export function renderPhoneCalendarView({ league, selectedDate, canAdvance = false, activeTab = 'month' } = {}) {
  const today = dateOnly(league.currentDate);
  const activeDate = dateOnly(selectedDate || today);
  const current = new Date(`${activeDate}T00:00:00Z`);
  const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(1 - offset);

  const eventsByDate = new Map();
  for (const fixture of league.schedule ?? []) {
    if (!eventsByDate.has(fixture.date)) eventsByDate.set(fixture.date, []);
    eventsByDate.get(fixture.date).push(fixture);
  }

  const year = current.getUTCFullYear();
  const transferDates = new Map([
    [`${year}-07-01`, 'Sommerfenster öffnet'],
    [`${year}-08-31`, 'Sommer-Deadline'],
    [`${year}-01-01`, 'Winterfenster öffnet'],
    [`${year}-01-31`, 'Winter-Deadline'],
  ]);

  const standings = rankTeamsFromResults(league.teams ?? [], league.matchHistory ?? []);
  const rankByTeam = new Map(standings.map((row) => [row.teamId, row.rank]));
  const teamsMap = new Map((league.teams ?? []).map((team) => [team.id, team]));

  const lastDate = league.schedule?.at(-1)?.date ?? today;
  const totalFixtures = league.schedule?.length || 870;
  const completed = (league.schedule ?? []).filter((fixture) => fixture.status === 'completed').length;
  const progressPercent = Math.round((completed / totalFixtures) * 100);
  const windowOpen = isTransferWindowOpen(today);

  const tabsHtml = `
    <div class="ios-segmented" role="tablist" aria-label="Kalender Ansichten">
      <button type="button" class="ios-seg-btn ${activeTab === 'month' ? 'is-active' : ''}" data-action="set-phone-calendar-tab" data-tab="month">Monat &amp; Tag</button>
      <button type="button" class="ios-seg-btn ${activeTab === 'fixtures' ? 'is-active' : ''}" data-action="set-phone-calendar-tab" data-tab="fixtures">Spielplan</button>
      <button type="button" class="ios-seg-btn ${activeTab === 'standings' ? 'is-active' : ''}" data-action="set-phone-calendar-tab" data-tab="standings">Tabelle</button>
    </div>
  `;

  if (activeTab === 'standings') {
    const mobileRows = standings.map((row) => {
      const zone = row.rank <= 8 ? 'direct-knockout' : row.rank <= 24 ? 'playoff' : 'eliminated';
      const diff = row.goalsFor - row.goalsAgainst;
      return `
        <tr class="ios-table-row is-${zone}">
          <td class="ios-td-rank">${row.rank}</td>
          <td class="ios-td-team">
            <button type="button" class="table-team-link" data-action="open-club-page" data-team-id="${escapeHtml(row.teamId)}">
              <strong>${escapeHtml(row.teamName)}</strong>
            </button>
            <small>${row.rank <= 8 ? 'Achtelfinale' : row.rank <= 24 ? 'Play-offs' : 'Ausgeschieden'}</small>
          </td>
          <td>${row.played}</td>
          <td>${diff > 0 ? `+${diff}` : diff}</td>
          <td><strong>${row.points}</strong></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="ios-app-container">
        ${tabsHtml}
        <div class="ios-card">
          <div class="ios-card-head">
            <div>
              <strong>Ligatabelle</strong>
              <small>${completed} / ${totalFixtures} Spiele (${progressPercent}%)</small>
            </div>
            <button type="button" class="ios-pill-btn" data-action="close-phone-and-knockout">K.-o.-Phase →</button>
          </div>
          <table class="ios-standings-table">
            <thead>
              <tr><th>#</th><th>Verein</th><th>Sp</th><th>TD</th><th>Pkt</th></tr>
            </thead>
            <tbody>${mobileRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (activeTab === 'fixtures') {
    const openHumanMatches = (league.schedule ?? []).filter((fixture) => {
      const home = teamsMap.get(fixture.homeId);
      const away = teamsMap.get(fixture.awayId);
      return home?.managerType === 'human' && away?.managerType === 'human' && fixture.status !== 'completed';
    }).slice(0, 8).map((fixture) => {
      const home = teamsMap.get(fixture.homeId);
      const away = teamsMap.get(fixture.awayId);
      return `
        <div class="ios-list-row is-highlight">
          <div class="ios-list-main">
            <strong>${escapeHtml(home?.name ?? '')} vs ${escapeHtml(away?.name ?? '')}</strong>
            <small>Spieltag ${fixture.round} · ${escapeHtml(fixture.date)} · Manuell</small>
          </div>
          <button type="button" class="ios-row-action" data-action="select-calendar-date" data-date="${escapeHtml(fixture.date)}">Öffnen</button>
        </div>
      `;
    }).join('');

    const upcoming = (league.schedule ?? []).filter((fixture) => fixture.status !== 'completed' && fixture.date >= today).slice(0, 12).map((fixture) => {
      const home = teamsMap.get(fixture.homeId);
      const away = teamsMap.get(fixture.awayId);
      const human = home?.managerType === 'human' && away?.managerType === 'human';
      return `
        <div class="ios-list-row">
          <div class="ios-list-main">
            <strong>${escapeHtml(home?.name ?? '')} vs ${escapeHtml(away?.name ?? '')}</strong>
            <small>ST ${fixture.round} · ${new Date(`${fixture.date}T00:00:00Z`).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', timeZone: 'UTC' })}</small>
          </div>
          <span class="ios-meta-label">${human ? 'Manuell' : 'Sim'}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="ios-app-container">
        ${tabsHtml}
        <div class="ios-card">
          <div class="ios-card-head">
            <strong>Offene Mensch-Duelle</strong>
            <small>Manuelle Eingabe</small>
          </div>
          <div class="ios-list-group">
            ${openHumanMatches || '<div class="ios-empty-note">Aktuell keine offenen Mensch-gegen-Mensch-Spiele.</div>'}
          </div>
        </div>
        <div class="ios-card">
          <div class="ios-card-head">
            <strong>Nächste Spiele</strong>
            <small>Ab ${escapeHtml(today)}</small>
          </div>
          <div class="ios-list-group">
            ${upcoming || '<div class="ios-empty-note">Alle Spiele abgeschlossen.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  // Default Tab: 'month' (Clean iOS Month Grid + Selected Day + Host Sim)
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    const key = day.toISOString().slice(0, 10);
    const fixtures = eventsByDate.get(key) ?? [];
    const humanMatch = fixtures.some((fixture) => teamsMap.get(fixture.homeId)?.managerType === 'human' && teamsMap.get(fixture.awayId)?.managerType === 'human' && fixture.status !== 'completed');
    const hasTransferEvent = transferDates.has(key);
    const isMuted = day.getUTCMonth() !== current.getUTCMonth();
    const isCurrent = key === today;
    const isSelected = key === activeDate;

    const dots = [
      fixtures.length ? `<i class="ios-dot ${humanMatch ? 'is-human' : 'is-match'}"></i>` : '',
      hasTransferEvent ? '<i class="ios-dot is-transfer"></i>' : '',
    ].filter(Boolean).join('');

    return `
      <button type="button"
        class="ios-cal-cell ${isMuted ? 'is-muted' : ''} ${isCurrent ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}"
        data-action="select-calendar-date"
        data-date="${key}"
        aria-label="${key}${fixtures.length ? `, ${fixtures.length} Spiele` : ''}">
        <span class="ios-cal-num">${day.getUTCDate()}</span>
        <span class="ios-cal-dots">${dots}</span>
      </button>
    `;
  }).join('');

  const dayFixtures = (eventsByDate.get(activeDate) ?? []).map((fixture) => {
    const home = teamsMap.get(fixture.homeId);
    const away = teamsMap.get(fixture.awayId);
    const humanVsHuman = home?.managerType === 'human' && away?.managerType === 'human';
    const hRank = rankByTeam.get(home?.id);
    const aRank = rankByTeam.get(away?.id);
    const entry = humanVsHuman && fixture.status !== 'completed'
      ? `<form class="ios-score-form calendar-score-form" data-fixture-id="${escapeHtml(fixture.id)}">
          <input type="number" min="0" max="99" required aria-label="Tore ${escapeHtml(home.name)}" placeholder="0">
          <span>:</span>
          <input type="number" min="0" max="99" required aria-label="Tore ${escapeHtml(away.name)}" placeholder="0">
          <button class="ios-pill-btn" type="submit" ${canAdvance ? '' : 'disabled'}>Speichern</button>
        </form>`
      : humanVsHuman && fixture.status === 'completed' && canAdvance
        ? `<form class="ios-score-form calendar-score-form is-edit-form" data-fixture-id="${escapeHtml(fixture.id)}" data-allow-overwrite="true">
            <input type="number" min="0" max="99" required aria-label="Tore ${escapeHtml(home.name)}" value="${Number(fixture.homeScore)}">
            <span>:</span>
            <input type="number" min="0" max="99" required aria-label="Tore ${escapeHtml(away.name)}" value="${Number(fixture.awayScore)}">
            <button class="ios-pill-btn" type="submit">Ändern</button>
          </form>`
        : '';

    return `
      <div class="ios-fixture-row ${humanVsHuman ? 'is-human' : ''}">
        <div class="ios-fixture-teams">
          <strong>${escapeHtml(home?.name ?? '')} ${hRank ? `<small>#${hRank}</small>` : ''} vs ${escapeHtml(away?.name ?? '')} ${aRank ? `<small>#${aRank}</small>` : ''}</strong>
          <small>Spieltag ${fixture.round} · ${humanVsHuman ? 'Mensch-Duell' : 'Liga-Simulation'}</small>
        </div>
        ${fixture.status === 'completed'
          ? `<b class="ios-fixture-score">${fixture.homeScore} : ${fixture.awayScore}</b>`
          : `<span class="ios-meta-label">${humanVsHuman ? 'Offen' : 'Geplant'}</span>`}
        ${entry}
      </div>
    `;
  }).join('');

  return `
    <div class="ios-app-container">
      ${tabsHtml}

      <div class="ios-kpi-strip">
        <div><small>AKTUELL</small><strong>${new Date(`${today}T00:00:00Z`).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', timeZone: 'UTC' })}</strong></div>
        <div><small>SPIELE</small><strong>${completed}/${totalFixtures}</strong></div>
        <div><small>FENSTER</small><strong>${windowOpen ? 'Offen' : 'Zu'}</strong></div>
      </div>

      <div class="ios-card ios-cal-card">
        <div class="ios-cal-header">
          <button type="button" class="ios-icon-btn" data-action="shift-calendar-month" data-delta="-1" aria-label="Vorheriger Monat">‹</button>
          <strong>${current.toLocaleDateString('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
          <button type="button" class="ios-icon-btn" data-action="shift-calendar-month" data-delta="1" aria-label="Nächster Monat">›</button>
        </div>
        <div class="ios-cal-weekdays">
          ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<span>${d}</span>`).join('')}
        </div>
        <div class="ios-cal-grid">${cells}</div>
      </div>

      <div class="ios-card ios-sim-card">
        <div class="ios-card-head">
          <strong>Saison &amp; Kalender simulieren</strong>
          <small>${canAdvance ? 'Nur Host' : 'Gesperrt'}</small>
        </div>
        ${canAdvance ? `
          <div class="ios-sim-controls">
            <input id="calendar-target-date" type="date" min="${escapeHtml(today)}" max="${escapeHtml(lastDate)}" value="${escapeHtml(activeDate)}" aria-label="Zieldatum">
            <button type="button" class="ios-primary-btn" data-action="simulate-calendar">Bis Datum →</button>
          </div>
          <div style="margin-top:8px">
            <button type="button" class="ios-pill-btn" data-action="simulate-entire-season" style="width:100%">Ganze Saison simulieren (58 Spieltage) →</button>
          </div>
        ` : `
          <p class="ios-empty-note" style="margin:4px 0">Nur der Liga-Host kann Spiele und die Saison simulieren.</p>
        `}
      </div>

      <div class="ios-card">
        <div class="ios-card-head">
          <strong>Ausgewählter Tag</strong>
          <small>${escapeHtml(activeDate)}</small>
        </div>
        <div class="ios-list-group">
          ${dayFixtures || '<div class="ios-empty-note">An diesem Tag sind keine Spiele angesetzt.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderHumanMatchSparkles() {
  return `
    <div class="human-aura-sparkles" aria-hidden="true">
      <svg class="trophy-sparkle s1" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
      <svg class="trophy-sparkle s2" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
      <svg class="trophy-sparkle s3" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
      <svg class="trophy-sparkle s4" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
    </div>
  `;
}

export function renderCalendarView({
  league,
  selectedDate,
  canAdvance = false,
  isSimulatingLive = false,
  activeManagerTeamId = '',
  simSpeedMs = 420,
  tableSubTab = 'table',
  players = [],
  fifa15State = {},
} = {}) {
  const today = dateOnly(league.currentDate);
  const activeDate = dateOnly(selectedDate || today);
  const current = new Date(`${activeDate}T00:00:00Z`);
  const monthStart = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
  const offset = (monthStart.getUTCDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(1 - offset);
  const eventsByDate = new Map();
  for (const fixture of league.schedule ?? []) {
    if (!eventsByDate.has(fixture.date)) eventsByDate.set(fixture.date, []);
    eventsByDate.get(fixture.date).push(fixture);
  }
  const year = current.getUTCFullYear();
  const transferDates = new Map([
    [`${year}-07-01`, 'Sommerfenster öffnet'], [`${year}-08-31`, 'Sommer-Deadline'],
    [`${year}-01-01`, 'Winterfenster öffnet'], [`${year}-01-31`, 'Winter-Deadline'],
  ]);
  const standings = rankTeamsFromResults(league.teams ?? [], league.matchHistory ?? []);
  const rankByTeam = new Map(standings.map((row) => [row.teamId, row.rank]));
  const teamsById = new Map((league.teams ?? []).map((team) => [team.id, team]));

  const rankBadge = (teamId) => {
    const rank = rankByTeam.get(teamId);
    if (!rank) return '';
    if (rank <= 8) return `<small class="team-rank-chip is-knockout" title="Platz ${rank} · Direkt Achtelfinale">TOP #${rank}</small>`;
    if (rank <= 24) return `<small class="team-rank-chip is-playoff" title="Platz ${rank} · Play-offs">PO #${rank}</small>`;
    return '';
  };

  const isHumanPair = (fixture) => {
    const home = teamsById.get(fixture.homeId);
    const away = teamsById.get(fixture.awayId);
    return home?.managerType === 'human' && away?.managerType === 'human';
  };

  const hasDualApproval = (fixture) => {
    if (fixture?.humanConsentGranted) return true;
    const approvals = fixture?.humanApprovals ?? {};
    return Boolean(approvals[fixture.homeId] && approvals[fixture.awayId]);
  };

  // Blocking human fixtures on or before today
  const blockingHumanFixtures = (league.schedule ?? []).filter((fixture) => (
    fixture.date <= today
    && fixture.status !== 'completed'
    && isHumanPair(fixture)
    && !hasDualApproval(fixture)
  ));

  // Build 7-day Career Mode Broadcast Ribbon Strip centered around today/activeDate
  const stripAnchor = new Date(`${today}T00:00:00Z`);
  const weekStripDays = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(stripAnchor);
    d.setUTCDate(stripAnchor.getUTCDate() + (idx - 1));
    const iso = d.toISOString().slice(0, 10);
    const dayFixtures = eventsByDate.get(iso) ?? [];
    const humanFixturesOnDay = dayFixtures.filter(isHumanPair);
    const hasOpenHuman = humanFixturesOnDay.some((f) => f.status !== 'completed');
    const isGateBlocked = humanFixturesOnDay.some((f) => f.status !== 'completed' && !hasDualApproval(f) && iso <= today);
    const isTodayCursor = iso === today;
    const isSelectedDay = iso === activeDate;
    const weekdayShort = d.toLocaleDateString('de-AT', { weekday: 'short', timeZone: 'UTC' });
    const dayNum = d.LocaleDateString ? d.getUTCDate() : d.getUTCDate();
    const monthShort = d.toLocaleDateString('de-AT', { month: 'short', timeZone: 'UTC' });
    const transferEvent = transferDates.get(iso);

    return `
      <button
        type="button"
        class="career-ticker-day ${isTodayCursor ? 'is-cursor-today' : ''} ${isSelectedDay ? 'is-selected-day' : ''} ${hasOpenHuman ? 'has-human-aura' : ''} ${isGateBlocked ? 'is-gate-blocked' : ''}"
        data-action="select-calendar-date"
        data-date="${iso}"
      >
        ${hasOpenHuman ? '<span class="human-aura-glow-layer" aria-hidden="true"></span>' : ''}
        <div class="career-ticker-day-top">
          <span class="career-ticker-weekday">${escapeHtml(weekdayShort)}</span>
          ${isTodayCursor ? '<span class="career-cursor-pill">HEUTE</span>' : ''}
          ${isGateBlocked ? `<span class="career-lock-pill">${icon('lock', { size: 10 })} STOP</span>` : hasOpenHuman ? '<span class="career-human-pill">1v1</span>' : ''}
        </div>
        <div class="career-ticker-day-num">${dayNum}. <small>${escapeHtml(monthShort)}</small></div>
        <div class="career-ticker-day-meta">
          ${dayFixtures.length
            ? `<span>${dayFixtures.length} Spiele</span>`
            : transferEvent
              ? `<span>${escapeHtml(transferEvent)}</span>`
              : '<span>Scouting &amp; Training</span>'}
        </div>
      </button>
    `;
  }).join('');

  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    const key = day.toISOString().slice(0, 10);
    const fixtures = eventsByDate.get(key) ?? [];
    const humanMatch = fixtures.some((fixture) => isHumanPair(fixture) && fixture.status !== 'completed');
    const humanConsented = fixtures.some((fixture) => isHumanPair(fixture) && hasDualApproval(fixture) && fixture.status !== 'completed');
    const classes = [
      'calendar-day',
      day.getUTCMonth() !== current.getUTCMonth() ? 'is-muted' : '',
      key === today ? 'is-current' : '',
      key === activeDate ? 'is-selected' : '',
      humanMatch ? 'is-human-match has-human-trophy-aura' : '',
      humanConsented ? 'is-human-consented' : '',
    ].filter(Boolean).join(' ');

    const matches = fixtures.slice(0, 2).map((fixture) => {
      const home = teamsById.get(fixture.homeId)?.name ?? fixture.homeId;
      const away = teamsById.get(fixture.awayId)?.name ?? fixture.awayId;
      const isHum = isHumanPair(fixture);
      return `<span class="calendar-fixture ${fixture.status === 'completed' ? 'is-completed' : isHum ? 'is-human-match' : ''}" title="${escapeHtml(home)} – ${escapeHtml(away)}">${isHum ? '[1v1] ' : ''}${escapeHtml(home)} <i>vs</i> ${escapeHtml(away)}${fixture.status === 'completed' ? ` <b>${fixture.homeScore}–${fixture.awayScore}</b>` : ''}</span>`;
    }).join('');
    const transfer = transferDates.has(key) ? `<span class="calendar-event">TF: ${escapeHtml(transferDates.get(key))}</span>` : '';
    return `<button type="button" class="${classes}" data-action="select-calendar-date" data-date="${key}" aria-label="${key}${fixtures.length ? `, ${fixtures.length} Spiele` : ''}">${humanMatch ? '<span class="calendar-cell-aura-halo" aria-hidden="true"></span>' : ''}<span class="calendar-day-number">${day.getUTCDate()}</span>${transfer}${matches}${fixtures.length > 2 ? `<small>+${fixtures.length - 2} weitere Spiele</small>` : ''}</button>`;
  }).join('');

  const renderHumanAuraControlBlock = (fixture, home, away) => {
    const approvals = fixture.humanApprovals ?? {};
    const homeApproved = Boolean(approvals[fixture.homeId] || fixture.humanConsentGranted);
    const awayApproved = Boolean(approvals[fixture.awayId] || fixture.humanConsentGranted);
    const dualReady = homeApproved && awayApproved;
    const isCompleted = fixture.status === 'completed';

    if (isCompleted) {
      return `
        <div class="human-aura-sync-footer is-completed">
          <span class="human-sync-badge is-done">Ergebnis synchronisiert (${escapeHtml(fixture.syncedVia || 'Manuell / FIFA 15 Arena')})</span>
          ${canAdvance ? `<form class="calendar-score-form is-edit-form" data-fixture-id="${escapeHtml(fixture.id)}" data-allow-overwrite="true"><input type="number" min="0" max="99" required aria-label="Tore ${escapeHtml(home.name)}" value="${Number(fixture.homeScore)}"><span>:</span><input type="number" min="0" max="99" required aria-label="Tore ${escapeHtml(away.name)}" value="${Number(fixture.awayScore)}"><button class="button light small" type="submit">Ergebnis bearbeiten</button></form>` : ''}
        </div>
      `;
    }

    return `
      <div class="human-aura-gate-controls">
        <div class="human-consent-row">
          <button
            type="button"
            class="human-consent-chip ${homeApproved ? 'is-approved' : ''}"
            data-action="approve-human-fixture"
            data-fixture-id="${escapeHtml(fixture.id)}"
            data-team-id="${escapeHtml(fixture.homeId)}"
            title="Zustimmung von ${escapeHtml(home?.managerName || home?.name || 'Heim')} umschalten"
          >
            <span class="consent-dot"></span>
            <span>${escapeHtml(home?.managerName || home?.name)}: <strong>${homeApproved ? 'Bereit' : 'Offen'}</strong></span>
          </button>
          <button
            type="button"
            class="human-consent-chip ${awayApproved ? 'is-approved' : ''}"
            data-action="approve-human-fixture"
            data-fixture-id="${escapeHtml(fixture.id)}"
            data-team-id="${escapeHtml(fixture.awayId)}"
            title="Zustimmung von ${escapeHtml(away?.managerName || away?.name || 'Gast')} umschalten"
          >
            <span class="consent-dot"></span>
            <span>${escapeHtml(away?.managerName || away?.name)}: <strong>${awayApproved ? 'Bereit' : 'Offen'}</strong></span>
          </button>
          ${!dualReady ? `
            <button
              type="button"
              class="button light small human-both-approve-btn"
              data-action="approve-human-fixture-both"
              data-fixture-id="${escapeHtml(fixture.id)}"
            >
              ${icon('unlock', { size: 13 })} <span>Beide zustimmen &amp; Sperre lösen</span>
            </button>
          ` : `<span class="human-consent-unlocked-pill">${icon('check', { size: 13 })} Simulation freigegeben</span>`}
        </div>
        <div class="human-pes-actions-row">
          <button
            type="button"
            class="button primary small"
            data-action="launch-pes-fixture"
            data-fixture-id="${escapeHtml(fixture.id)}"
            data-home-id="${escapeHtml(fixture.homeId)}"
            data-away-id="${escapeHtml(fixture.awayId)}"
          >
            ${icon('play', { size: 14 })} <span>In FIFA 15 Browser spielen (1v1 Arena)</span>
          </button>
          <button
            type="button"
            class="button light small"
            data-action="launch-calendar-fifa15-inline"
            data-fixture-id="${escapeHtml(fixture.id)}"
            data-home-id="${escapeHtml(fixture.homeId)}"
            data-away-id="${escapeHtml(fixture.awayId)}"
          >
            ${icon('tv', { size: 13 })} <span>Direkt hier im Kalender spielen</span>
          </button>
          <button
            type="button"
            class="button light small"
            data-action="sync-pes-fixture-now"
            data-fixture-id="${escapeHtml(fixture.id)}"
            title="Liest das Ergebnis direkt über den Live-Sync ein"
          >
            ${icon('refresh', { size: 13 })} <span>Live-Sync</span>
          </button>
          <form class="calendar-score-form" data-fixture-id="${escapeHtml(fixture.id)}">
            <input type="number" min="0" max="99" required aria-label="Tore ${escapeHtml(home.name)}" placeholder="0">
            <span>:</span>
            <input type="number" min="0" max="99" required aria-label="Tore ${escapeHtml(away.name)}" placeholder="0">
            <button class="button light small" type="submit" ${canAdvance ? '' : 'disabled'}>${icon('check', { size: 13 })} <span>Speichern</span></button>
          </form>
        </div>
      </div>
    `;
  };

  const dayFixtures = (eventsByDate.get(activeDate) ?? []).map((fixture) => {
    const home = teamsById.get(fixture.homeId);
    const away = teamsById.get(fixture.awayId);
    const humanVsHuman = isHumanPair(fixture);
    const result = fixture.status === 'completed'
      ? `<div class="calendar-score-wrap"><b class="calendar-score">${fixture.homeScore} : ${fixture.awayScore}</b><button type="button" class="button light small" data-action="open-match-report" data-fixture-id="${escapeHtml(fixture.id)}">${icon('stats', { size: 12 })} <span>Match-Report</span></button></div>`
      : humanVsHuman
        ? `<span class="calendar-manual">Mensch-gegen-Mensch · manuell eintragen · FIFA 15 Browser-Arena</span>`
        : `
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            <span class="calendar-pending">Wird beim Datumssprung simuliert</span>
            <button type="button" class="button light small" data-action="launch-pes-fixture" data-fixture-id="${escapeHtml(fixture.id)}" data-home-id="${escapeHtml(fixture.homeId)}" data-away-id="${escapeHtml(fixture.awayId)}" title="Dieses Spiel selbst in der FIFA 15 Browser-Arena austragen">${icon('play', { size: 12 })} <span>FIFA 15</span></button>
          </div>
        `;

    let scorersSnippet = '';
    if (fixture.status === 'completed') {
      const homeGoals = (fixture.events ?? []).filter((e) => e.teamId === fixture.homeId).map((e) => `${e.player} ${e.minute}'${e.assist ? ` (${e.assist})` : ''}`).join(', ');
      const awayGoals = (fixture.events ?? []).filter((e) => e.teamId === fixture.awayId).map((e) => `${e.player} ${e.minute}'${e.assist ? ` (${e.assist})` : ''}`).join(', ');
      const xgHome = fixture.stats?.xG?.home ?? '—';
      const xgAway = fixture.stats?.xG?.away ?? '—';
      const possHome = fixture.stats?.possession?.home ?? 50;
      const possAway = fixture.stats?.possession?.away ?? 50;
      const motm = fixture.manOfTheMatch;
      scorersSnippet = `
        <div class="calendar-scorers-strip">
          ${(homeGoals || awayGoals) ? `
            <div class="scorers-goals-row">
              <small class="scorers-side is-home">${homeGoals ? `[TOR] ${escapeHtml(homeGoals)}` : ''}</small>
              <small class="scorers-side is-away">${awayGoals ? `[TOR] ${escapeHtml(awayGoals)}` : ''}</small>
            </div>
          ` : ''}
          <div class="scorers-telemetry-row">
            <span class="telemetry-pill">xG: <b>${xgHome}</b> : <b>${xgAway}</b></span>
            <span class="telemetry-pill">Ballbesitz: <b>${possHome}%</b> : <b>${possAway}%</b></span>
            ${motm ? `<span class="telemetry-pill is-motm">MOTM: <b>${escapeHtml(motm.name)} (${Number(motm.matchRating).toFixed(1)})</b></span>` : ''}
          </div>
        </div>
      `;
    }

    if (humanVsHuman) {
      return `
        <article class="calendar-agenda-row is-human-match human-aura-card" data-fixture-id="${escapeHtml(fixture.id)}">
          <div class="human-aura-backdrop" aria-hidden="true"></div>
          <div class="human-aura-rays" aria-hidden="true"></div>
          <div class="trophy-shimmer-sweep" aria-hidden="true"></div>
          ${renderHumanMatchSparkles()}
          <div class="human-aura-card-head">
            <div>
              <span class="human-aura-kicker">HIGHLIGHT-DUELL ECHTER SPIELER · SPIELTAG ${fixture.round}</span>
              <strong><button type="button" class="table-team-link" data-action="open-club-page" data-team-id="${escapeHtml(home?.id ?? '')}">${escapeHtml(home?.name ?? '')}</button> ${rankBadge(home?.id)} <i>vs</i> <button type="button" class="table-team-link" data-action="open-club-page" data-team-id="${escapeHtml(away?.id ?? '')}">${escapeHtml(away?.name ?? '')}</button> ${rankBadge(away?.id)}</strong>
              <small>SPIELTAG ${fixture.round} · ${escapeHtml(home?.managerName || 'Human')} vs ${escapeHtml(away?.managerName || 'Human')}</small>
            </div>
            ${result}
          </div>
          ${scorersSnippet}
          ${renderHumanAuraControlBlock(fixture, home, away)}
        </article>
      `;
    }

    return `
      <article class="calendar-agenda-row">
        <div>
          <strong><button type="button" class="table-team-link" data-action="open-club-page" data-team-id="${escapeHtml(home?.id ?? '')}">${escapeHtml(home?.name ?? '')}</button> ${rankBadge(home?.id)} <i>vs</i> <button type="button" class="table-team-link" data-action="open-club-page" data-team-id="${escapeHtml(away?.id ?? '')}">${escapeHtml(away?.name ?? '')}</button> ${rankBadge(away?.id)}</strong>
          <small>SPIELTAG ${fixture.round}</small>
          ${scorersSnippet}
        </div>
        ${result}
      </article>
    `;
  }).join('');

  const upcoming = (league.schedule ?? []).filter((fixture) => fixture.status !== 'completed' && fixture.date >= today).slice(0, 6).map((fixture) => {
    const home = teamsById.get(fixture.homeId);
    const away = teamsById.get(fixture.awayId);
    const human = isHumanPair(fixture);
    return `<div class="calendar-upcoming ${human ? 'is-human-match has-human-mini-aura' : ''}"><time>${new Date(`${fixture.date}T00:00:00Z`).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', timeZone: 'UTC' })}</time><span>${escapeHtml(home?.name ?? '')} <i>vs</i> ${escapeHtml(away?.name ?? '')}</span><small>${human ? '1V1 ARENA' : 'SIMULATION'}</small></div>`;
  }).join('');

  const openHumanMatches = (league.schedule ?? []).filter((fixture) => (
    isHumanPair(fixture) && fixture.status !== 'completed'
  )).slice(0, 6).map((fixture) => {
    const home = teamsById.get(fixture.homeId);
    const away = teamsById.get(fixture.awayId);
    const dualReady = hasDualApproval(fixture);
    const isBlockingNow = fixture.date <= today && !dualReady;
    return `
      <div class="calendar-upcoming is-human-match human-aura-mini-card ${isBlockingNow ? 'is-blocking-now' : ''}">
        <div class="human-mini-main">
          <time>${new Date(`${fixture.date}T00:00:00Z`).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', timeZone: 'UTC' })}</time>
          <span><strong>${escapeHtml(home?.name ?? '')} <i>vs</i> ${escapeHtml(away?.name ?? '')}</strong><small>${escapeHtml(home?.managerName || '')} vs ${escapeHtml(away?.managerName || '')}</small></span>
          <small class="human-status-tag">${isBlockingNow ? 'SPERRE AKTIV' : dualReady ? 'ZUGESTIMMT' : `ST ${fixture.round} · ${fixture.status === 'awaiting-human' ? 'OFFEN' : 'ANGESETZT'}`}</small>
        </div>
        <div class="human-mini-actions">
          <button type="button" class="button light small" data-action="select-calendar-date" data-date="${escapeHtml(fixture.date)}">Tag öffnen</button>
          <button type="button" class="button primary small" data-action="launch-pes-fixture" data-fixture-id="${escapeHtml(fixture.id)}" data-home-id="${escapeHtml(fixture.homeId)}" data-away-id="${escapeHtml(fixture.awayId)}">FIFA 15 Arena</button>
          <button type="button" class="button light small" data-action="launch-calendar-fifa15-inline" data-fixture-id="${escapeHtml(fixture.id)}" data-home-id="${escapeHtml(fixture.homeId)}" data-away-id="${escapeHtml(fixture.awayId)}">Im Kalender spielen</button>
          ${!dualReady ? `<button type="button" class="button light small" data-action="approve-human-fixture-both" data-fixture-id="${escapeHtml(fixture.id)}">Beide bereit</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const lastDate = league.schedule?.at(-1)?.date ?? today;
  const nextDeadline = [0, 1].flatMap((yearOffset) => [
    `${year + yearOffset}-01-31`, `${year + yearOffset}-08-31`,
  ]).filter((date) => date >= today).sort()[0];
  const totalFixtures = league.schedule?.length || 870;
  const completed = (league.schedule ?? []).filter((fixture) => fixture.status === 'completed').length;
  const progressPercent = Math.round((completed / totalFixtures) * 100);
  const windowOpen = isTransferWindowOpen(today);
  const lastPesSync = league.lastPesSync;

  // Resolve featured fixture for Calendar inline FIFA 15 Browser-Arena
  const featuredFixture = (league.schedule ?? []).find((f) => f.id === fifa15State.activeFixtureId)
    || blockingHumanFixtures[0]
    || (eventsByDate.get(activeDate) ?? [])[0]
    || (league.schedule ?? []).find((f) => f.status !== 'completed')
    || (league.schedule ?? [])[0]
    || null;

  const calHomeId = fifa15State.homeTeamId || featuredFixture?.homeId || league.teams?.[0]?.id || '';
  const calAwayId = fifa15State.awayTeamId || featuredFixture?.awayId || league.teams?.[1]?.id || '';
  const calHomeStrength = calculateTeamPesStrength(calHomeId, league, players);
  const calAwayStrength = calculateTeamPesStrength(calAwayId, league, players);
  const calSyncSummary = getManagerSyncSummary(league, players, { homeTeamId: calHomeId, awayTeamId: calAwayId });

  const calendarInlineArenaHtml = fifa15State.calendarArenaOpen
    ? renderFifa15BrowserArena({
      league,
      homeStrength: calHomeStrength,
      awayStrength: calAwayStrength,
      syncSummary: calSyncSummary,
      streamActive: Boolean(fifa15State.streamActive),
      streamRole: fifa15State.streamRole || 'host',
      cinemaMode: Boolean(fifa15State.cinemaMode),
      hudVisible: fifa15State.hudVisible !== false,
      activeFixture: featuredFixture,
    })
    : `
      <section class="panel calendar-fifa15-dock" aria-label="FIFA 15 Browser-Arena Schnellstart im Kalender">
        <div class="calendar-fifa15-dock-top">
          <div class="fifa15-arena-brand">
            <img src="${ESL_LOGO_ASSET_PATH}" data-clean-esl-logo="true" alt="European Super League" class="fifa15-arena-logo-thumb" />
            <div>
              <span class="eyebrow">DIREKT IM SAISONKALENDER SPIELEN · FIFA 15 XBOX 360 SUPER LEAGUE MOD &amp; TV-SCOREBOARD</span>
              <h3>${escapeHtml(calHomeStrength.teamName)} <span class="fifa15-vs-inline">vs.</span> ${escapeHtml(calAwayStrength.teamName)} <small>(Raumcode <code>${escapeHtml(calSyncSummary.roomCode)}</code> · Auto-Freundschaftsspiel)</small></h3>
            </div>
          </div>
          <div class="fifa15-arena-controls">
            <button type="button" class="button primary small" data-action="toggle-calendar-fifa15-arena">
              ${icon('play', { size: 14 })} <span>FIFA 15 Browser-Arena hier im Kalender öffnen</span>
            </button>
            <button type="button" class="button light small" data-action="launch-pes-fixture" data-fixture-id="${escapeHtml(featuredFixture?.id || '')}" data-home-id="${escapeHtml(calHomeId)}" data-away-id="${escapeHtml(calAwayId)}">
              ${icon('maximize', { size: 14 })} <span>Im Match Hub + Kinomodus öffnen</span>
            </button>
          </div>
        </div>
        ${renderEslBroadcastScoreboard({
          homeTeamName: calHomeStrength.teamName,
          awayTeamName: calAwayStrength.teamName,
          homeScore: calSyncSummary.liveHomeScore,
          awayScore: calSyncSummary.liveAwayScore,
          matchClock: calSyncSummary.matchClock || '00:00',
          roundLabel: featuredFixture?.round ? `ST ${featuredFixture.round} · BEREIT` : 'ESL · LIVE',
          roomCode: calSyncSummary.roomCode,
          interactive: true,
        })}
      </section>
    `;

  const gateBannerHtml = blockingHumanFixtures.length ? (() => {
    const blocker = blockingHumanFixtures[0];
    const bHome = teamsById.get(blocker.homeId);
    const bAway = teamsById.get(blocker.awayId);
    return `
      <section class="human-gate-alert-banner human-aura-card" role="region" aria-label="Simulations-Sperre für Mensch-gegen-Mensch-Spiel">
        <div class="human-aura-backdrop" aria-hidden="true"></div>
        <div class="human-aura-rays" aria-hidden="true"></div>
        <div class="trophy-shimmer-sweep" aria-hidden="true"></div>
        ${renderHumanMatchSparkles()}
        <div class="human-gate-alert-content">
          <div class="human-gate-alert-copy">
            <span class="human-aura-kicker">${icon('lock', { size: 12 })} SIMULATIONS-STOPP AM SPIELTAG (${escapeHtml(blocker.date)}) · 1v1 PFLICHTSPIEL</span>
            <h2>${escapeHtml(bHome?.name || '')} <span>vs</span> ${escapeHtml(bAway?.name || '')}</h2>
            <p>Startet das Duell per 1-Klick in der <strong>FIFA 15 Browser-Arena</strong> (automatisches Online-Freundschaftsspiel aktiv) oder gebt den Spieltag gemeinsam frei.</p>
          </div>
          ${renderHumanAuraControlBlock(blocker, bHome, bAway)}
        </div>
      </section>
    `;
  })() : '';

  return `<section class="calendar-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">SAISONKALENDER · EUROPEAN SUPER LEAGUE &amp; FIFA 15 BROWSER-ARENA</div>
        <h1>Der Kalender.</h1>
        <p>Tag-für-Tag-Simulation, 1v1-Spieltagssperre mit Champions-Aura und eingebettete FIFA 15 Browser-Arena samt TV-Scoreboard.</p>
      </div>
      <div class="calendar-heading-actions">
        ${canAdvance ? `<span class="calendar-host-badge">${icon('calendar', { size: 13 })} HOST STEUERT SIMULATION</span>` : ''}
        <button type="button" class="button light small" data-action="toggle-calendar-fifa15-arena">${icon('play', { size: 14 })} <span>${fifa15State.calendarArenaOpen ? 'Kalender-Arena einklappen' : 'FIFA 15 Arena einblenden'}</span></button>
        <button type="button" class="button primary small" data-view="matches">${icon('matches', { size: 14 })} <span>FIFA 15 Match Hub</span></button>
      </div>
    </div>

    ${calendarInlineArenaHtml}

    <section class="panel career-broadcast-hub" aria-label="Karriere-Simulations-Steuerung">
      <div class="career-broadcast-top">
        <div class="career-broadcast-status">
          <span class="career-sim-indicator ${isSimulatingLive ? 'is-running' : blockingHumanFixtures.length ? 'is-blocked' : ''}"></span>
          <div>
            <small>SIMULATION ENGINE · ${isSimulatingLive ? 'LIVE-SIMULATION LÄUFT' : blockingHumanFixtures.length ? 'STOPP BEI 1v1 DUELL' : 'BEREIT'}</small>
            <strong>${new Date(`${today}T00:00:00Z`).toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
          </div>
        </div>
        <div class="career-broadcast-controls">
          ${canAdvance ? `
            <button
              type="button"
              class="button primary small career-sim-all-btn"
              data-action="simulate-entire-season"
              title="Simuliert alle verbleibenden Spieltage der gesamten Saison (58 Spieltage) in einem Schritt"
            >
              ${icon('zap', { size: 14 })} <span>Ganze Saison simulieren</span>
            </button>
          ` : ''}
          <button
            type="button"
            class="button ${isSimulatingLive ? 'light' : 'primary'} small career-live-sim-btn"
            data-action="toggle-live-calendar-sim"
            ${canAdvance ? '' : 'disabled'}
          >
            ${icon(isSimulatingLive ? 'pause' : 'play', { size: 14 })} <span>${isSimulatingLive ? 'Pausieren' : 'Live-Simulation'}</span>
          </button>
          <button
            type="button"
            class="button light small"
            data-action="step-next-matchday"
            title="Springt direkt zum nächsten offenen Spieltag"
            ${canAdvance ? '' : 'disabled'}
          >
            ${icon('skipForward', { size: 14 })} <span>Nächster Spieltag</span>
          </button>
          <button
            type="button"
            class="button light small"
            data-action="simulate-single-day"
            title="Simuliert genau 1 Kalendertag weiter"
            ${canAdvance ? '' : 'disabled'}
          >
            +1 Tag
          </button>
          <button
            type="button"
            class="button light small"
            data-action="simulate-month-step"
            title="Simuliert 30 Tage im Voraus"
            ${canAdvance ? '' : 'disabled'}
          >
            +1 Monat
          </button>
          <button
            type="button"
            class="button light small"
            data-action="trigger-pes-live-sync"
            title="Synchronisiert das aktuelle FIFA 15 / Super League Ergebnis sofort in Kalender, Tabelle & NewsHub"
          >
            ${icon('refresh', { size: 14 })} <span>Ergebnis-Sync</span>
          </button>
        </div>
      </div>
      <div class="career-speed-selector">
        <span class="speed-label">SIMULATIONS-TEMPO:</span>
        <button type="button" class="speed-pill ${simSpeedMs === 650 ? 'is-active' : ''}" data-action="set-sim-speed" data-speed="650">Normal (0.6s)</button>
        <button type="button" class="speed-pill ${simSpeedMs === 300 ? 'is-active' : ''}" data-action="set-sim-speed" data-speed="300">Schnell (0.3s)</button>
        <button type="button" class="speed-pill ${simSpeedMs === 100 ? 'is-active' : ''}" data-action="set-sim-speed" data-speed="100">Turbo (0.1s)</button>
      </div>
      <div class="career-week-ribbon" role="list" aria-label="Karriere-Wochenleiste">
        ${weekStripDays}
      </div>
      ${lastPesSync ? `
        <div class="career-pes-sync-strip">
          <span class="pes-live-pill">SUPER LEAGUE LIVE-SYNC</span>
          <span>Letztes synchronisiertes Spiel: <strong>${escapeHtml(lastPesSync.homeName)} ${lastPesSync.homeScore} : ${lastPesSync.awayScore} ${escapeHtml(lastPesSync.awayName)}</strong> (ST ${lastPesSync.round})</span>
        </div>
      ` : ''}
    </section>

    ${gateBannerHtml}

    <div class="calendar-stats">
      <div class="panel calendar-stat"><small>KALENDERSTAND</small><strong>${new Date(`${today}T00:00:00Z`).toLocaleDateString('de-AT', { dateStyle: 'medium', timeZone: 'UTC' })}</strong></div>
      <div class="panel calendar-stat"><small>LIGA-FORTSCHRITT</small><strong>${completed} <i>/ ${totalFixtures} (${progressPercent}%)</i></strong></div>
      <div class="panel calendar-stat"><small>TRANSFERFENSTER</small><strong>${nextDeadline ? new Date(`${nextDeadline}T00:00:00Z`).toLocaleDateString('de-AT', { dateStyle: 'medium', timeZone: 'UTC' }) : '—'} <i>(${windowOpen ? 'Offen' : 'Geschlossen'})</i></strong></div>
    </div>

    <div class="calendar-layout">
      <section class="panel calendar-month">
        <div class="calendar-month-head">
          <div>
            <span class="eyebrow">SAISONÜBERSICHT · 30 VEREINE</span>
            <div class="calendar-month-title">
              <button type="button" class="calendar-nav-btn" data-action="shift-calendar-month" data-delta="-1" aria-label="Vorheriger Monat">‹</button>
              <h2>${current.toLocaleDateString('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
              <button type="button" class="calendar-nav-btn" data-action="shift-calendar-month" data-delta="1" aria-label="Nächster Monat">›</button>
            </div>
          </div>
          <div class="calendar-legend">
            <span><i class="dot-sim"></i> CPU-Sim</span>
            <span class="legend-human"><i class="dot-human"></i> 1v1 Aura</span>
            <span><i class="dot-transfer"></i> Transfers</span>
          </div>
        </div>
        <div class="calendar-weekdays">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => `<span>${day}</span>`).join('')}</div>
        <div class="calendar-grid">${cells}</div>
        <div class="calendar-deadline-note">
          <strong>Transferfristen &amp; Liga-Fortschritt</strong>
          <span>Sommer: 01.07.–31.08. · Winter: 01.01.–31.01. · ${completed}/${totalFixtures} Spiele (${progressPercent}%)</span>
        </div>
      </section>

      <aside class="calendar-sidebar">
        <section class="panel calendar-sim-panel">
          <div class="panel-header"><h2>Datum- &amp; Saison-Simulation</h2><span>${canAdvance ? 'LIGA-HOST' : 'NUR HOST'}</span></div>
          <div class="calendar-panel-body">
            <p class="calendar-sim-desc">${canAdvance ? 'Als Liga-Host hast du die volle Kontrolle: Simuliere einzelne Tage, Monate oder sofort die gesamte Saison.' : 'Nur der Liga-Host hat die Berechtigung, Spieltage oder die Saison zu simulieren.'}</p>
            ${canAdvance ? `
              <button type="button" class="button primary" data-action="simulate-entire-season" style="width:100%;justify-content:center;margin-bottom:10px">
                ${icon('zap', { size: 14 })} <span>Ganze Saison simulieren (58 Spieltage)</span>
              </button>
            ` : ''}
            <div class="calendar-sim-field">
              <label for="calendar-target-date">Zieldatum</label>
              <input id="calendar-target-date" type="date" min="${escapeHtml(today)}" max="${escapeHtml(lastDate)}" value="${escapeHtml(activeDate)}"${canAdvance ? '' : ' disabled'}>
            </div>
            <div class="calendar-sim-actions">
              <button type="button" class="button primary" data-action="simulate-calendar"${canAdvance ? '' : ' disabled'}>${icon('play', { size: 14 })} <span>Bis zu diesem Datum simulieren</span></button>
              <div class="calendar-sim-quick-row">
                <button type="button" class="button light small" data-action="simulate-single-day"${canAdvance ? '' : ' disabled'}>+1 Tag</button>
                <button type="button" class="button light small" data-action="step-next-matchday"${canAdvance ? '' : ' disabled'}>Nächster Spieltag</button>
                <button type="button" class="button light small" data-action="simulate-month-step"${canAdvance ? '' : ' disabled'}>+1 Monat</button>
              </div>
              <button type="button" class="button light small" data-action="toggle-live-calendar-sim"${canAdvance ? '' : ' disabled'}>${icon(isSimulatingLive ? 'pause' : 'skipForward', { size: 13 })} <span>${isSimulatingLive ? 'Animation stoppen' : 'Live Tag-für-Tag animieren'}</span></button>
            </div>
            ${!canAdvance ? `
              <div class="host-only-box" style="margin-top:10px;padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;font-size:12px;color:#fca5a5">
                Simulation gesperrt für Mitspieler. Bitte den Liga-Host (${escapeHtml(league?.adminName || 'Admin')}), die Spieltage voranzutreiben.
              </div>
            ` : ''}
          </div>
        </section>

        <section class="panel calendar-agenda">
          <div class="panel-header">
            <h2>Ausgewählter Tag</h2>
            <span>${new Date(`${activeDate}T00:00:00Z`).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })} (${escapeHtml(activeDate)})</span>
          </div>
          <div class="calendar-panel-body calendar-agenda-list">
            ${dayFixtures || '<div class="empty-state">Kein Spieltag an diesem Datum.</div>'}
          </div>
        </section>
      </aside>
    </div>

    <div class="calendar-lower-grid">
      <section class="panel calendar-open-humans">
        <div class="panel-header"><h2>Offene Mensch-gegen-Mensch-Spiele</h2><span>FIFA 17 LAUNCH</span></div>
        <div class="calendar-panel-body calendar-lower-list">
          ${openHumanMatches || '<div class="empty-state">Keine offenen 1v1-Spiele.</div>'}
        </div>
      </section>

      <section class="panel calendar-upcoming-panel">
        <div class="panel-header"><h2>Nächste Spiele</h2><span>AB ${escapeHtml(today)}</span></div>
        <div class="calendar-panel-body calendar-lower-list">
          ${upcoming || '<div class="empty-state">Saison abgeschlossen.</div>'}
        </div>
      </section>
    </div>

    ${renderStandingsTable(league, { subTab: tableSubTab })}
  </section>`;
}

