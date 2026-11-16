import { icon } from './icons.mjs';
import { rankTeamsFromResults, calculatePlayerMarketValue } from './transfer-core.mjs';
import { getTeamRoster, getTeamSquad, evaluateSlotFit, SQUAD_SLOTS } from './squad-core.mjs';
import { getPlayerSeasonStats, simulateFixtureMultiSeed } from './calendar-core.mjs';
import { getTeamFinanceSummary } from './mail-finance-agent.mjs';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatEur(amount = 0) {
  const val = Number(amount) || 0;
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `€${(val / 1_000).toFixed(0)}k`;
  return `€${val}`;
}

export function renderClubPageView({
  league,
  teamId,
  activeTab = 'overview',
  playerPool = [],
}) {
  if (!league || !Array.isArray(league.teams)) {
    return `<div class="panel empty-state"><h3>Keine Ligadaten gefunden</h3></div>`;
  }

  const team = league.teams.find((t) => t.id === teamId) || league.teams[0];
  if (!team) {
    return `<div class="panel empty-state"><h3>Verein nicht gefunden</h3></div>`;
  }

  const standings = rankTeamsFromResults(league.teams, league.matchHistory ?? []);
  const standingRow = standings.find((r) => r.teamId === team.id) || {
    rank: 1, points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, form: [],
  };
  const diff = standingRow.goalsFor - standingRow.goalsAgainst;

  const roster = getTeamRoster(league, team.id, playerPool);
  const squad = getTeamSquad(league, team.id);
  const finance = getTeamFinanceSummary(league, team.id);

  // Total roster market value
  const totalMarketValue = roster.reduce((sum, p) => sum + calculatePlayerMarketValue(p), 0);
  const avgOvr = roster.length ? Math.round(roster.reduce((sum, p) => sum + (Number(p.rating) || 75), 0) / roster.length) : 75;

  // Club fixtures (played and upcoming)
  const clubFixtures = (league.schedule ?? []).filter((f) => f.homeId === team.id || f.awayId === team.id);
  const completedFixtures = clubFixtures.filter((f) => f.status === 'completed');
  const upcomingFixtures = clubFixtures.filter((f) => f.status !== 'completed');

  // Average possession and xG across season
  let totalPossession = 0;
  let totalXg = 0;
  let matchesWithStats = 0;
  for (const f of completedFixtures) {
    const isHome = f.homeId === team.id;
    if (f.stats?.possession) {
      totalPossession += (isHome ? f.stats.possession.home : f.stats.possession.away);
      matchesWithStats += 1;
    }
    if (f.stats?.xG) {
      totalXg += (isHome ? f.stats.xG.home : f.stats.xG.away);
    }
  }
  const avgPossession = matchesWithStats > 0 ? (totalPossession / matchesWithStats).toFixed(1) : '50.0';
  const totalXgDisplay = totalXg > 0 ? totalXg.toFixed(1) : (standingRow.goalsFor * 0.95).toFixed(1);

  // Club selector dropdown options
  const clubOptions = league.teams.map((t) => `
    <option value="${escapeHtml(t.id)}" ${t.id === team.id ? 'selected' : ''}>
      ${escapeHtml(t.name)} ${t.managerType === 'human' ? '(Manager: ' + escapeHtml(t.managerName || 'Human') + ')' : '(CPU)'}
    </option>
  `).join('');

  // Zone pill
  const zoneClass = standingRow.rank <= 8 ? 'is-knockout' : standingRow.rank <= 24 ? 'is-playoff' : 'is-eliminated';
  const zoneLabel = standingRow.rank <= 8 ? 'Achtelfinale (Top 8)' : standingRow.rank <= 24 ? 'Play-offs (Plätze 9–24)' : 'Ausgeschieden';

  // Form badges
  const formBadgesHtml = (standingRow.form ?? []).map((res) => `
    <span class="form-pill is-${res.toLowerCase()}">${res}</span>
  `).join('') || '<span class="draft-sub">—</span>';

  // Navigation Tabs
  const tabs = [
    { id: 'overview', label: 'Übersicht & Bilanz' },
    { id: 'roster', label: `Kader & Spieler (${roster.length})` },
    { id: 'lineup', label: 'Startelf & Taktik (4-3-3)' },
    { id: 'matches', label: `Spielplan & Resultate (${clubFixtures.length})` },
  ];

  const tabButtonsHtml = tabs.map((t) => `
    <button type="button" class="club-nav-tab ${activeTab === t.id ? 'is-active' : ''}" data-action="set-club-page-tab" data-tab="${t.id}">
      ${escapeHtml(t.label)}
    </button>
  `).join('');

  // Render Sub-Views
  let tabContentHtml = '';

  if (activeTab === 'overview') {
    // Top 3 Scorers of this club
    const clubScorers = roster.map((p) => {
      const stats = getPlayerSeasonStats(league, p.id);
      return { ...p, ...stats };
    }).filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 5);

    const scorersListHtml = clubScorers.length ? clubScorers.map((p, idx) => `
      <div class="club-scorer-row">
        <span class="club-scorer-rank">#${idx + 1}</span>
        <div class="club-scorer-info">
          <strong>${escapeHtml(p.name)}</strong>
          <small>${escapeHtml(p.position || '—')} · OVR ${p.rating || 75}</small>
        </div>
        <div class="club-scorer-stats">
          <span class="club-stat-badge"><strong>${p.goals}</strong> Tore</span>
          <span class="club-stat-sub">${p.assists} Vorlagen · Ø ${p.averageRating || '—'}</span>
        </div>
      </div>
    `).join('') : '<div class="empty-state-sm">Noch keine Ligatore erzielt.</div>';

    // Recent 5 played matches
    const recentMatches = [...completedFixtures].slice(-5).reverse();
    const recentMatchesHtml = recentMatches.length ? recentMatches.map((f) => {
      const isHome = f.homeId === team.id;
      const oppId = isHome ? f.awayId : f.homeId;
      const opp = league.teams.find((t) => t.id === oppId);
      const teamScore = isHome ? f.homeScore : f.awayScore;
      const oppScore = isHome ? f.awayScore : f.homeScore;
      const resultClass = teamScore > oppScore ? 'is-win' : teamScore === oppScore ? 'is-draw' : 'is-loss';
      const resultLetter = teamScore > oppScore ? 'S' : teamScore === oppScore ? 'U' : 'N';
      return `
        <div class="club-match-card ${resultClass}">
          <div class="club-match-main">
            <span class="club-res-pill is-${resultLetter.toLowerCase()}">${resultLetter}</span>
            <div class="club-match-teams">
              <strong>${isHome ? escapeHtml(team.name) : escapeHtml(opp?.name || 'Gegner')} ${teamScore} : ${oppScore} ${isHome ? escapeHtml(opp?.name || 'Gegner') : escapeHtml(team.name)}</strong>
              <small>Spieltag ${f.round} · ${escapeHtml(f.date)}</small>
            </div>
          </div>
          <button type="button" class="button light small" data-action="open-match-report" data-fixture-id="${escapeHtml(f.id)}">
            ${icon('stats', { size: 13 })} <span>Match-Report</span>
          </button>
        </div>
      `;
    }).join('') : '<div class="empty-state-sm">Noch keine Spiele absolviert.</div>';

    tabContentHtml = `
      <div class="club-overview-grid">
        <section class="panel club-metrics-panel">
          <div class="panel-header"><h3>Saison-Kennzahlen</h3><span>LIGAPHASE</span></div>
          <div class="club-stat-cards-grid">
            <div class="club-stat-card">
              <span class="card-label">TABELLENPLATZ</span>
              <strong class="card-val">#${standingRow.rank}</strong>
              <small class="card-sub ${zoneClass}">${zoneLabel}</small>
            </div>
            <div class="club-stat-card">
              <span class="card-label">PUNKTE &amp; SPIELE</span>
              <strong class="card-val">${standingRow.points} <small>Pkt</small></strong>
              <small class="card-sub">${standingRow.played} Spiele · ${standingRow.wins}S / ${standingRow.draws}U / ${standingRow.losses}N</small>
            </div>
            <div class="club-stat-card">
              <span class="card-label">TORE &amp; xG</span>
              <strong class="card-val">${standingRow.goalsFor} : ${standingRow.goalsAgainst}</strong>
              <small class="card-sub">TD ${diff > 0 ? `+${diff}` : diff} · Total xG: ${totalXgDisplay}</small>
            </div>
            <div class="club-stat-card">
              <span class="card-label">Ø BALLBESITZ</span>
              <strong class="card-val">${avgPossession}%</strong>
              <small class="card-sub">Taktik: ${escapeHtml(squad.tacticalPreset || 'Ballbesitz')}</small>
            </div>
          </div>
          <div class="club-form-row">
            <span class="card-label">AKTUELLE FORM:</span>
            <div class="club-form-pills">${formBadgesHtml}</div>
          </div>
        </section>

        <section class="panel club-scorers-panel">
          <div class="panel-header"><h3>Vereins-Toptorjäger</h3><span>SAISON 2026/27</span></div>
          <div class="club-scorers-list">
            ${scorersListHtml}
          </div>
        </section>

        <section class="panel club-recent-matches-panel" style="grid-column: 1 / -1;">
          <div class="panel-header"><h3>Letzte Spielergebnisse</h3><span>MIT DETAILLIERTEN STATS</span></div>
          <div class="club-matches-list">
            ${recentMatchesHtml}
          </div>
        </section>
      </div>
    `;
  } else if (activeTab === 'roster') {
    const sortedRoster = [...roster].sort((a, b) => (Number(b.rating) || 75) - (Number(a.rating) || 75));
    const rosterRowsHtml = sortedRoster.map((p, idx) => {
      const stats = getPlayerSeasonStats(league, p.id);
      const mVal = calculatePlayerMarketValue(p);
      const shirtNo = squad.shirtNumbers?.[p.id] || p.shirtNumber || (idx + 1);
      return `
        <tr class="club-roster-row">
          <td class="col-num">#${shirtNo}</td>
          <td class="col-name">
            <strong>${escapeHtml(p.name)}</strong>
            <small>${escapeHtml(p.nation || '—')} · ${p.age || 24} J.</small>
          </td>
          <td><span class="pos-badge">${escapeHtml(p.position || 'CM')}</span></td>
          <td>
            <button type="button" class="squad-slot-ovr-btn" data-action="open-pes-player" data-player-id="${escapeHtml(p.id)}" title="FIFA 17 Attribute ansehen">
              OVR ${p.rating || 75}
            </button>
          </td>
          <td>${stats.matches}</td>
          <td><strong>${stats.goals}</strong></td>
          <td>${stats.assists}</td>
          <td><strong>${stats.averageRating > 0 ? stats.averageRating : '—'}</strong></td>
          <td>${formatEur(mVal)}</td>
          <td>
            <button type="button" class="button light small" data-action="open-pes-player" data-player-id="${escapeHtml(p.id)}">
              ${icon('eye', { size: 12 })} <span>Profil</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tabContentHtml = `
      <section class="panel club-roster-panel">
        <div class="panel-header">
          <div>
            <h3>Kaderübersicht (${roster.length} Spieler)</h3>
            <small>Kaderwert: ${formatEur(totalMarketValue)} · Ø OVR: ${avgOvr}</small>
          </div>
        </div>
        <div class="table-scroll">
          <table class="player-table club-roster-table">
            <thead>
              <tr>
                <th>Nr</th>
                <th>Spieler</th>
                <th>Pos</th>
                <th>OVR</th>
                <th title="Einsätze">Sp</th>
                <th title="Tore">T</th>
                <th title="Vorlagen">V</th>
                <th title="Durchschnittsnote">Ø Note</th>
                <th>Marktwert</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              ${rosterRowsHtml}
            </tbody>
          </table>
        </div>
      </section>
    `;
  } else if (activeTab === 'lineup') {
    const playersById = new Map(roster.map((p) => [p.id, p]));
    const pitchSlotsHtml = SQUAD_SLOTS.map((slot) => {
      const pid = squad.starters?.[slot.id];
      const player = playersById.get(pid);
      const shirtNo = player ? (squad.shirtNumbers?.[player.id] || '') : '';
      const fit = player ? evaluateSlotFit(player.position, slot.id) : null;
      const fitBadge = fit ? `<span class="squad-slot-fit is-${fit.status}">${fit.fit}% Fit</span>` : '';
      return `
        <div class="squad-slot is-readonly ${player ? 'is-filled' : 'is-empty'}" style="--slot-x:${slot.x}%;--slot-y:${slot.y}%;">
          <span class="squad-slot-role">${escapeHtml(slot.label)}${shirtNo ? ` · #${shirtNo}` : ''}</span>
          <span class="squad-player-name">${player ? escapeHtml(player.name) : 'Offen'}</span>
          ${player ? `<span class="squad-player-meta">${escapeHtml(player.position)} ${fitBadge} · <button type="button" class="squad-slot-ovr-btn" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}">OVR ${player.rating}</button></span>` : ''}
        </div>
      `;
    }).join('');

    tabContentHtml = `
      <section class="panel club-lineup-panel">
        <div class="panel-header">
          <div>
            <h3>Startelf &amp; Taktische Ausrichtung</h3>
            <small>Formation: ${escapeHtml(squad.formation || '4-3-3')} · Stil: ${escapeHtml(squad.tacticalPreset || 'Gegenpressing')}</small>
          </div>
        </div>
        <div class="squad-layout">
          <div class="squad-pitch-panel">
            <div class="squad-pitch" role="group" aria-label="Aufstellung">
              <div class="pitch-line pitch-halfway"></div>
              <div class="pitch-circle"></div>
              <div class="pitch-box pitch-box-top"></div>
              <div class="pitch-box pitch-box-bottom"></div>
              ${pitchSlotsHtml}
            </div>
          </div>
          <aside class="squad-bench">
            <header>
              <div>
                <span class="bench-kicker">TAKTIK-PROFIL</span>
                <h3>${escapeHtml(team.name)}</h3>
              </div>
            </header>
            <div class="club-tactic-info-card">
              <div class="info-row"><span>Taktik-Stil:</span><strong>${escapeHtml(squad.tacticalPreset || 'Ballbesitz-Dominanz')}</strong></div>
              <div class="info-row"><span>Formation:</span><strong>${escapeHtml(squad.formation || '4-3-3')}</strong></div>
              <div class="info-row"><span>Kaderstärke:</span><strong>${avgOvr} OVR</strong></div>
              <div class="info-row"><span>Heimvorteil:</span><strong>Aktiv (+0.22)</strong></div>
            </div>
          </aside>
        </div>
      </section>
    `;
  } else if (activeTab === 'matches') {
    const fixtureRowsHtml = clubFixtures.map((f) => {
      const isHome = f.homeId === team.id;
      const oppId = isHome ? f.awayId : f.homeId;
      const opp = league.teams.find((t) => t.id === oppId);
      const isCompleted = f.status === 'completed';
      const teamScore = isHome ? f.homeScore : f.awayScore;
      const oppScore = isHome ? f.awayScore : f.homeScore;

      let scoreSnippet = '<span class="calendar-pending">Angesetzt</span>';
      let actionSnippet = '';
      if (isCompleted) {
        const resLetter = teamScore > oppScore ? 'S' : teamScore === oppScore ? 'U' : 'N';
        scoreSnippet = `
          <div class="club-match-score-pill">
            <span class="form-pill is-${resLetter.toLowerCase()}">${resLetter}</span>
            <strong>${f.homeScore} : ${f.awayScore}</strong>
          </div>
        `;
        actionSnippet = `
          <button type="button" class="button light small" data-action="open-match-report" data-fixture-id="${escapeHtml(f.id)}">
            ${icon('stats', { size: 13 })} <span>Match-Report &amp; xG</span>
          </button>
        `;
      }

      return `
        <div class="club-fixture-item ${isCompleted ? 'is-completed' : ''}">
          <div class="club-fixture-meta">
            <span class="fixture-st">ST ${f.round}</span>
            <time class="fixture-date">${escapeHtml(f.date)}</time>
            <span class="fixture-side ${isHome ? 'is-home' : 'is-away'}">${isHome ? 'HEIM' : 'AUSWÄRTS'}</span>
          </div>
          <div class="club-fixture-duel">
            <strong>${escapeHtml(isHome ? team.name : (opp?.name || 'Gegner'))}</strong>
            <span>vs</span>
            <strong>${escapeHtml(isHome ? (opp?.name || 'Gegner') : team.name)}</strong>
          </div>
          ${scoreSnippet}
          <div class="club-fixture-actions">
            ${actionSnippet}
          </div>
        </div>
      `;
    }).join('');

    tabContentHtml = `
      <section class="panel club-fixtures-panel">
        <div class="panel-header">
          <div>
            <h3>Saisonspielplan (58 Spieltage)</h3>
            <small>${completedFixtures.length} abgeschlossen · ${upcomingFixtures.length} verbleibend</small>
          </div>
        </div>
        <div class="club-fixtures-list">
          ${fixtureRowsHtml}
        </div>
      </section>
    `;
  }

  return `
    <div class="club-profile-page">
      <!-- Breadcrumb Bar -->
      <nav class="club-breadcrumb-bar" aria-label="Vereinsnavigation">
        <button type="button" class="button light small" data-action="back-from-club-page">
          ${icon('back', { size: 14 })} <span>Zurück zur Ligatabelle</span>
        </button>
        <div class="club-switch-box">
          <label for="club-select-dropdown">Verein wechseln:</label>
          <select id="club-select-dropdown" data-action="switch-club-page">
            ${clubOptions}
          </select>
        </div>
      </nav>

      <!-- Club Hero Header -->
      <header class="club-hero-card">
        <div class="club-hero-crest">
          <span class="club-crest-text">${escapeHtml(team.name.slice(0, 3).toUpperCase())}</span>
        </div>
        <div class="club-hero-main">
          <div class="club-hero-title-row">
            <h2>${escapeHtml(team.name)}</h2>
            <span class="club-manager-tag ${team.managerType === 'human' ? 'is-human' : 'is-cpu'}">
              ${team.managerType === 'human' ? `Manager: ${escapeHtml(team.managerName || 'Human')}` : 'CPU-Gesteuert'}
            </span>
          </div>
          <div class="club-hero-sub-row">
            <span>Platz <strong>#${standingRow.rank}</strong> in der Ligatabelle</span>
            <span>·</span>
            <span><strong>${standingRow.points}</strong> Punkte</span>
            <span>·</span>
            <span>Kaderwert: <strong>${formatEur(totalMarketValue)}</strong></span>
            <span>·</span>
            <span>Budget: <strong>${formatEur(finance.transferBudget)}</strong></span>
            <span>·</span>
            <span>Kader: <strong>${roster.length}</strong> Spieler</span>
          </div>
        </div>
      </header>

      <!-- Navigation Tabs -->
      <div class="club-nav-tabs-bar" role="tablist">
        ${tabButtonsHtml}
      </div>

      <!-- Tab Body -->
      <main class="club-tab-content">
        ${tabContentHtml}
      </main>
    </div>
  `;
}

export function renderMatchReportModal(league, fixtureId) {
  if (!league) return '';
  const fixture = (league.schedule ?? []).find((f) => f.id === fixtureId)
    || (league.matchHistory ?? []).find((m) => (m.matchId ?? m.fixtureId) === fixtureId);

  if (!fixture) return '';

  const home = league.teams.find((t) => t.id === fixture.homeId);
  const away = league.teams.find((t) => t.id === fixture.awayId);

  const homeScore = Number(fixture.homeScore) || 0;
  const awayScore = Number(fixture.awayScore) || 0;

  const stats = fixture.stats || {
    possession: { home: 50, away: 50 },
    xG: { home: (homeScore * 0.95 + 0.3).toFixed(2), away: (awayScore * 0.95 + 0.2).toFixed(2) },
    xA: { home: (homeScore * 0.65 + 0.2).toFixed(2), away: (awayScore * 0.65 + 0.15).toFixed(2) },
    teamRating: { home: 6.85, away: 6.75 },
    shots: { home: homeScore * 3 + 4, away: awayScore * 3 + 3 },
    shotsOnTarget: { home: Math.max(homeScore, Math.round((homeScore * 3 + 4) * 0.45)), away: Math.max(awayScore, Math.round((awayScore * 3 + 3) * 0.42)) },
    bigChances: { home: Math.max(1, homeScore), away: Math.max(1, awayScore) },
    passes: { home: 450, away: 450 },
    passAccuracy: { home: 84, away: 82 },
    progressivePasses: { home: 42, away: 38 },
    pressures: { home: 112, away: 105 },
    tackles: { home: 16, away: 15 },
    interceptions: { home: 11, away: 10 },
    saves: { home: 3, away: 3 },
    distanceKm: { home: 112.4, away: 111.8 },
    sprints: { home: 148, away: 142 },
    corners: { home: 5, away: 4 },
    fouls: { home: 10, away: 11 },
    yellowCards: { home: 1, away: 2 },
  };

  const multiSeed = simulateFixtureMultiSeed(league, fixture, 40);

  const events = Array.isArray(fixture.events) ? fixture.events : [];
  const eventsHtml = events.length ? events.map((ev) => `
    <div class="report-goal-row ${ev.teamId === fixture.homeId ? 'is-home' : 'is-away'}">
      <span class="report-goal-min">${ev.minute}'</span>
      <div class="report-goal-desc">
        <strong>${escapeHtml(ev.player || 'Spieler')}${ev.position ? ` <small class="pos-inline">(${escapeHtml(ev.position)})</small>` : ''}</strong>
        <small>${escapeHtml(ev.goalType || 'Tor')}${ev.shotXg ? ` · Schuss-xG: ${Number(ev.shotXg).toFixed(2)}` : ''}${ev.assist ? ` · Vorlage: ${escapeHtml(ev.assist)}${ev.assistPosition ? ` (${escapeHtml(ev.assistPosition)})` : ''}` : ' · Ohne Vorlage'}</small>
      </div>
      <span class="report-goal-badge">${escapeHtml(ev.teamName || '')}</span>
    </div>
  `).join('') : '<div class="report-no-events">Keine Tore in dieser Partie gefallen.</div>';

  // Lineups & Ratings
  const homeLineup = fixture.lineups?.home || [];
  const awayLineup = fixture.lineups?.away || [];

  const renderLineupRows = (lineup) => {
    if (!lineup.length) return '<tr><td colspan="5" class="empty-state-sm">Keine Aufstellungsdaten</td></tr>';
    return lineup.map((p) => {
      const isMotm = fixture.manOfTheMatch?.id === p.id;
      const rating = Number(p.matchRating) || 6.5;
      const ratingClass = rating >= 7.5 ? 'is-super' : rating >= 6.5 ? 'is-solid' : 'is-low';
      const pXg = p.xG !== undefined ? Number(p.xG).toFixed(2) : '0.00';
      const pPasses = p.passesCompleted !== undefined ? `${p.passesCompleted}/${p.passesAttempted}` : '—';
      const pDist = p.distanceKm !== undefined ? `${Number(p.distanceKm).toFixed(1)} km` : '';
      return `
        <tr class="report-player-row ${isMotm ? 'is-motm-row' : ''}">
          <td class="col-num">#${p.shirtNumber || 10}</td>
          <td class="col-name">
            <button type="button" class="table-player-link" data-action="open-pes-player" data-player-id="${escapeHtml(p.id)}">
              <strong>${escapeHtml(p.name)}</strong>
            </button>
            <small>${escapeHtml(p.position)} · OVR ${p.rating}${pDist ? ` · ${pDist}` : ''}</small>
          </td>
          <td class="col-telemetry">
            <small>xG ${pXg} · Pässe ${pPasses}</small>
          </td>
          <td class="col-contrib">
            ${p.goals ? `<span class="report-tag is-goal">${p.goals}T</span>` : ''}
            ${p.assists ? `<span class="report-tag is-assist">${p.assists}V</span>` : ''}
            ${isMotm ? '<span class="report-motm-tag">MOTM</span>' : ''}
          </td>
          <td class="col-rating">
            <span class="report-rating-pill ${ratingClass}">${rating.toFixed(1)}</span>
          </td>
        </tr>
      `;
    }).join('');
  };

  const motm = fixture.manOfTheMatch;

  return `
    <div class="modal-backdrop is-open" role="dialog" aria-modal="true" aria-labelledby="match-report-heading">
      <div class="modal-card match-report-modal">
        <header class="match-report-header">
          <div class="report-kicker">
            <span id="match-report-heading">SPIELTAG ${fixture.round || '—'} · ${escapeHtml(fixture.date || '')} · MATCH TELEMETRY</span>
            <button type="button" class="modal-close-btn" data-action="close-match-report" aria-label="Schließen">×</button>
          </div>
          <div class="report-scoreboard">
            <div class="report-team is-home">
              <button type="button" class="report-team-btn" data-action="open-club-page" data-team-id="${escapeHtml(fixture.homeId)}">
                <h2>${escapeHtml(home?.name || 'Heim')}</h2>
              </button>
              <small>Ø Team-Rating: <strong>${Number(stats.teamRating?.home || 6.8).toFixed(2)}</strong></small>
            </div>
            <div class="report-result-pill">
              <span class="report-score">${homeScore}</span>
              <span class="report-sep">:</span>
              <span class="report-score">${awayScore}</span>
            </div>
            <div class="report-team is-away">
              <button type="button" class="report-team-btn" data-action="open-club-page" data-team-id="${escapeHtml(fixture.awayId)}">
                <h2>${escapeHtml(away?.name || 'Gast')}</h2>
              </button>
              <small>Ø Team-Rating: <strong>${Number(stats.teamRating?.away || 6.7).toFixed(2)}</strong></small>
            </div>
          </div>
        </header>

        <!-- Man of the Match Hero Badge -->
        ${motm ? `
          <div class="report-motm-banner">
            <span class="motm-icon">${icon('trophy', { size: 16 })}</span>
            <div class="motm-text">
              <strong>SPIELER DES SPIELS: ${escapeHtml(motm.name)} (${escapeHtml(motm.teamName || '')})</strong>
              <small>Match-Rating: <b>${Number(motm.matchRating).toFixed(1)}</b>${motm.goals ? ` · ${motm.goals} Tore` : ''}${motm.assists ? ` · ${motm.assists} Vorlagen` : ''}${motm.xG ? ` · xG ${Number(motm.xG).toFixed(2)}` : ''}</small>
            </div>
          </div>
        ` : ''}

        <!-- Goals & Ticker -->
        <section class="report-section report-events-section">
          <h3>Torschützen &amp; Vorlagen</h3>
          <div class="report-events-list">
            ${eventsHtml}
          </div>
        </section>

        <!-- Match Stats Comparison -->
        <section class="report-section report-stats-section">
          <h3>Spieldaten, Ballbesitz &amp; Expected Goals (xG)</h3>
          <div class="report-bars-grid">
            ${renderStatBar('Ballbesitz (Pass-Share)', `${stats.possession?.home || 50}%`, `${stats.possession?.away || 50}%`, stats.possession?.home || 50, stats.possession?.away || 50)}
            ${renderStatBar('Expected Goals (xG)', Number(stats.xG?.home || 0).toFixed(2), Number(stats.xG?.away || 0).toFixed(2), Number(stats.xG?.home || 0.5) * 25, Number(stats.xG?.away || 0.5) * 25)}
            ${renderStatBar('Expected Assists (xA)', Number(stats.xA?.home || 0).toFixed(2), Number(stats.xA?.away || 0).toFixed(2), Number(stats.xA?.home || 0.4) * 25, Number(stats.xA?.away || 0.4) * 25)}
            ${renderStatBar('Torschüsse (Aufs Tor)', `${stats.shots?.home || 0} (${stats.shotsOnTarget?.home || 0})`, `${stats.shots?.away || 0} (${stats.shotsOnTarget?.away || 0})`, stats.shots?.home || 1, stats.shots?.away || 1)}
            ${renderStatBar('Großchancen (Clear-Cut)', stats.bigChances?.home || 0, stats.bigChances?.away || 0, (stats.bigChances?.home || 0) + 1, (stats.bigChances?.away || 0) + 1)}
            ${renderStatBar('Pässe & Passquote', `${stats.passes?.home || 400} (${stats.passAccuracy?.home || 80}%)`, `${stats.passes?.away || 400} (${stats.passAccuracy?.away || 80}%)`, stats.passes?.home || 400, stats.passes?.away || 400)}
            ${renderStatBar('Progressive Pässe', stats.progressivePasses?.home || 38, stats.progressivePasses?.away || 34, stats.progressivePasses?.home || 38, stats.progressivePasses?.away || 34)}
            ${renderStatBar('Pressing-Aktionen', stats.pressuresCompleted?.home ?? stats.pressures?.home ?? 110, stats.pressuresCompleted?.away ?? stats.pressures?.away ?? 104, stats.pressuresCompleted?.home ?? stats.pressures?.home ?? 110, stats.pressuresCompleted?.away ?? stats.pressures?.away ?? 104)}
            ${renderStatBar('Tacklings & Ballgewinne', `${stats.tacklesWon?.home ?? stats.tackles?.home ?? 15} (${stats.interceptions?.home || 9} Int)`, `${stats.tacklesWon?.away ?? stats.tackles?.away ?? 14} (${stats.interceptions?.away || 9} Int)`, stats.tacklesWon?.home ?? stats.tackles?.home ?? 15, stats.tacklesWon?.away ?? stats.tackles?.away ?? 14)}
            ${renderStatBar('Laufdistanz & Sprints', `${stats.distanceKm?.home || 112.0} km (${stats.highIntensitySprints?.home ?? stats.sprints?.home ?? 140})`, `${stats.distanceKm?.away || 111.5} km (${stats.highIntensitySprints?.away ?? stats.sprints?.away ?? 135})`, stats.distanceKm?.home || 112, stats.distanceKm?.away || 111)}
            ${renderStatBar('Paraden (Gehalten/Abgewehrt)', stats.saves?.home ?? 2, stats.saves?.away ?? 2, (stats.saves?.home ?? 2) + 1, (stats.saves?.away ?? 2) + 1)}
            ${renderStatBar('Ecken / Fouls (Gelb)', `${stats.corners?.home || 4} Ecken / ${stats.fouls?.home || 9}F (${stats.yellowCards?.home || 1}G)`, `${stats.corners?.away || 4} Ecken / ${stats.fouls?.away || 9}F (${stats.yellowCards?.away || 1}G)`, (stats.corners?.home || 4) + 1, (stats.corners?.away || 4) + 1)}
          </div>
        </section>

        <!-- Multi-Seed Simulation Distribution -->
        <section class="report-section report-multiseed-section">
          <h3>Multi-Seed Simulations-Prognose (${multiSeed.runs || 40} Durchläufe)</h3>
          <div class="multiseed-summary-strip">
            <div class="multiseed-prob-box is-home">
              <small>SIEG ${escapeHtml(home?.name || 'HEIM')}</small>
              <strong>${multiSeed.homeWinPct}%</strong>
              <span>Ø ${multiSeed.avgHomeGoals} Tore (${multiSeed.avgHomeXg} xG)</span>
            </div>
            <div class="multiseed-prob-box is-draw">
              <small>UNENTSCHIEDEN</small>
              <strong>${multiSeed.drawPct}%</strong>
              <span>Ø Ballbesitz ${multiSeed.avgHomePossession}% : ${multiSeed.avgAwayPossession}%</span>
            </div>
            <div class="multiseed-prob-box is-away">
              <small>SIEG ${escapeHtml(away?.name || 'GAST')}</small>
              <strong>${multiSeed.awayWinPct}%</strong>
              <span>Ø ${multiSeed.avgAwayGoals} Tore (${multiSeed.avgAwayXg} xG)</span>
            </div>
          </div>
        </section>

        <!-- Lineups & Player Ratings -->
        <section class="report-section report-lineups-section">
          <h3>Startelf, Spieler-Telemetrie &amp; Bewertungen (1.0–10.0)</h3>
          <div class="report-lineups-grid">
            <div class="report-lineup-col">
              <h4>${escapeHtml(home?.name || 'Heim')}</h4>
              <table class="report-player-table">
                <tbody>${renderLineupRows(homeLineup)}</tbody>
              </table>
            </div>
            <div class="report-lineup-col">
              <h4>${escapeHtml(away?.name || 'Gast')}</h4>
              <table class="report-player-table">
                <tbody>${renderLineupRows(awayLineup)}</tbody>
              </table>
            </div>
          </div>
        </section>

        <footer class="match-report-footer">
          <button type="button" class="button light" data-action="close-match-report">Schließen</button>
        </footer>
      </div>
    </div>
  `;
}

function renderStatBar(label, homeVal, awayVal, homePct, awayPct) {
  const total = (Number(homePct) || 1) + (Number(awayPct) || 1);
  const hWidth = Math.max(10, Math.min(90, Math.round(((Number(homePct) || 1) / total) * 100)));
  const aWidth = 100 - hWidth;
  return `
    <div class="stat-bar-item">
      <div class="stat-bar-labels">
        <strong>${homeVal}</strong>
        <span>${escapeHtml(label)}</span>
        <strong>${awayVal}</strong>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill is-home" style="width:${hWidth}%"></div>
        <div class="stat-bar-fill is-away" style="width:${aWidth}%"></div>
      </div>
    </div>
  `;
}

