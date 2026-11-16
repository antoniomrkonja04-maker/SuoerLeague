import {
  ensureKnockoutBracket,
  getLeaguePhaseProgress,
  getNextKnockoutRoundKey,
  isLeaguePhaseComplete,
} from './knockout-core.mjs';
import { rankTeamsFromResults } from './transfer-core.mjs';

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const CLUB_BRANDS = {
  'Manchester City': { code: 'MCI', color: '#38bdf8', badgeBg: 'rgba(56, 189, 248, 0.16)' },
  'Arsenal': { code: 'ARS', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.16)' },
  'Liverpool': { code: 'LIV', color: '#dc2626', badgeBg: 'rgba(220, 38, 38, 0.16)' },
  'Chelsea': { code: 'CHE', color: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.16)' },
  'Manchester United': { code: 'MUN', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.16)' },
  'Tottenham Hotspur': { code: 'TOT', color: '#94a3b8', badgeBg: 'rgba(148, 163, 184, 0.16)' },
  'Real Madrid': { code: 'RMA', color: '#eab308', badgeBg: 'rgba(234, 179, 8, 0.18)' },
  'FC Barcelona': { code: 'BAR', color: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.16)' },
  'Atlético Madrid': { code: 'ATM', color: '#f87171', badgeBg: 'rgba(248, 113, 113, 0.16)' },
  'Athletic Club': { code: 'ATH', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.16)' },
  'Real Sociedad': { code: 'RSO', color: '#60a5fa', badgeBg: 'rgba(96, 165, 250, 0.16)' },
  'Villarreal CF': { code: 'VIL', color: '#facc15', badgeBg: 'rgba(250, 204, 21, 0.18)' },
  'Inter Mailand': { code: 'INT', color: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.16)' },
  'AC Mailand': { code: 'ACM', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.16)' },
  'Juventus Turin': { code: 'JUV', color: '#e2e8f0', badgeBg: 'rgba(226, 232, 240, 0.14)' },
  'SSC Neapel': { code: 'NAP', color: '#0ea5e9', badgeBg: 'rgba(14, 165, 233, 0.16)' },
  'AS Rom': { code: 'ROM', color: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.18)' },
  'Atalanta Bergamo': { code: 'ATA', color: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.16)' },
  'Bayern München': { code: 'FCB', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.16)' },
  'Borussia Dortmund': { code: 'BVB', color: '#facc15', badgeBg: 'rgba(250, 204, 21, 0.18)' },
  'Bayer 04 Leverkusen': { code: 'B04', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.16)' },
  'RB Leipzig': { code: 'RBL', color: '#fb7185', badgeBg: 'rgba(251, 113, 133, 0.16)' },
  'VfB Stuttgart': { code: 'VFB', color: '#f87171', badgeBg: 'rgba(248, 113, 113, 0.16)' },
  'Eintracht Frankfurt': { code: 'SGE', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.16)' },
  'Paris Saint-Germain': { code: 'PSG', color: '#60a5fa', badgeBg: 'rgba(96, 165, 250, 0.16)' },
  'Olympique Marseille': { code: 'OM', color: '#38bdf8', badgeBg: 'rgba(56, 189, 248, 0.16)' },
  'AS Monaco': { code: 'ASM', color: '#f87171', badgeBg: 'rgba(248, 113, 113, 0.16)' },
  'LOSC Lille': { code: 'LIL', color: '#fb7185', badgeBg: 'rgba(251, 113, 133, 0.16)' },
  'Olympique Lyonnais': { code: 'OL', color: '#60a5fa', badgeBg: 'rgba(96, 165, 250, 0.16)' },
  'OGC Nizza': { code: 'OGC', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.16)' },
};

function getClubBrand(teamName = '') {
  if (CLUB_BRANDS[teamName]) return CLUB_BRANDS[teamName];
  const code = String(teamName || 'TBD')
    .replace(/[^A-Za-zÄÖÜäöüß0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 3)
    .toUpperCase() || 'TBD';
  return {
    code,
    color: '#d4af37',
    badgeBg: 'rgba(212, 175, 55, 0.14)',
  };
}

function renderBracketSlot(teamEntry, score, isWinner, isLoser, placeholderLabel = 'Offen') {
  if (!teamEntry) {
    return `
      <div class="ko-team-row is-tbd">
        <span class="ko-club-bar is-tbd"></span>
        <span class="ko-seed-num">-</span>
        <span class="ko-club-monogram is-tbd">TBD</span>
        <span class="ko-club-title is-tbd">${escapeHtml(placeholderLabel)}</span>
        <span class="ko-club-score">-</span>
      </div>
    `;
  }
  const brand = getClubBrand(teamEntry.teamName);
  const stateClass = isWinner ? 'is-winner' : isLoser ? 'is-loser' : '';
  return `
    <div class="ko-team-row ${stateClass}" title="${escapeHtml(teamEntry.teamName)} (Setzplatz #${teamEntry.seed})">
      <span class="ko-club-bar" style="background:${brand.color}"></span>
      <span class="ko-seed-num">#${teamEntry.seed}</span>
      <span class="ko-club-monogram" style="background:${brand.badgeBg};color:${brand.color};border-color:${brand.color}40">${escapeHtml(brand.code)}</span>
      <span class="ko-club-title">${escapeHtml(teamEntry.teamName)}</span>
      <span class="ko-club-score ${isWinner ? 'is-gold' : ''}">${score ?? '-'}</span>
    </div>
  `;
}

function renderMatchupCard(match, selectedMatchId = '', matchIndex = 0, defaultAwayPlaceholder = 'Offen') {
  const completed = match.status === 'completed';
  const homeWon = completed && match.winnerTeamId === match.home?.teamId;
  const awayWon = completed && match.winnerTeamId === match.away?.teamId;
  const canSelect = Boolean(match.home && match.away);
  const isSelected = selectedMatchId === match.id;
  const sideClass = match.side === 'east' ? 'is-right' : 'is-left';

  return `
    <article class="ko-match-card ${completed ? 'is-completed' : ''} ${isSelected ? 'is-selected' : ''} ${sideClass}"
      data-slot="${matchIndex}"
      ${canSelect ? `data-action="select-ko-match" data-match-id="${escapeHtml(match.id)}" role="button" tabindex="0" aria-label="K.-o.-Spiel ${escapeHtml(match.home?.teamName || 'TBD')} gegen ${escapeHtml(match.away?.teamName || 'TBD')}"` : ''}>
      <div class="ko-match-rows">
        ${renderBracketSlot(match.home, match.homeScore, homeWon, awayWon, 'Setzplatz')}
        <div class="ko-match-divider"></div>
        ${renderBracketSlot(match.away, match.awayScore, awayWon, homeWon, defaultAwayPlaceholder)}
      </div>
    </article>
  `;
}

function renderLockedPhaseGate(league) {
  const progress = getLeaguePhaseProgress(league);
  const standings = rankTeamsFromResults(league?.teams ?? [], league?.matchHistory ?? []);
  const directTeams = standings.slice(0, 8);
  const playoffTeams = standings.slice(8, 24);
  const eliminatedTeams = standings.slice(24, 30);

  return `
    <section class="ko-locked-stage" aria-label="K.-o.-Phase und Playoffs gesperrt">
      <div class="ko-locked-header-card">
        <div class="ko-locked-badge-row">
          <span class="ko-phase-badge is-warning">GESPERRT · LIGAPHASE LÄUFT</span>
          <span class="ko-phase-badge is-info">UEFA CHAMPIONS SYSTEM 2024+</span>
        </div>
        <h1>Ligaphase läuft noch · K.-o.-Phase &amp; Playoffs gesperrt</h1>
        <p>
          Nach dem offiziellen UEFA Champions League Modus spielen alle 30 Mannschaften zuerst eine vollständige
          Ligaphase mit Hin- und Rückspiel (58 Spieltage, 870 Partien). Erst nach Abschluss aller Spiele der
          Ligaphase werden die K.-o.-Phasen Play-offs und die K.-o.-Phase freigeschaltet.
        </p>

        <div class="ko-lock-progress-box">
          <div class="ko-lock-progress-labels">
            <strong>Ligaphase Fortschritt: Spieltag ${progress.currentRound} von ${progress.maxRounds}</strong>
            <span><b>${progress.completed}</b> / ${progress.total} Spiele absolviert (${progress.percent}%)</span>
          </div>
          <div class="ko-lock-progress-track" role="progressbar" aria-valuenow="${progress.percent}" aria-valuemin="0" aria-valuemax="100">
            <div class="ko-lock-progress-fill" style="width: ${progress.percent}%"></div>
          </div>
        </div>

        <div class="ko-lock-actions">
          <button type="button" class="button primary" data-view="calendar">
            Zum Saisonkalender (Spiele absolvieren &amp; simulieren) →
          </button>
          <button type="button" class="button light" data-view="table">
            Ligatabelle (30 Teams) ansehen
          </button>
        </div>
      </div>

      <!-- UEFA 3-Phase Roadmap -->
      <div class="ko-roadmap-grid">
        <div class="ko-roadmap-card is-active">
          <div class="ko-roadmap-step-badge">PHASE 1 · AKTUELL</div>
          <h3>Ligaphase (Regular Season)</h3>
          <p>30 Teams treten in Hin- und Rückspiel gegeneinander an. Alle 58 Spieltage müssen beendet sein.</p>
          <div class="ko-roadmap-status is-active">
            <span class="ko-dot is-green">●</span> In Arbeit (${progress.completed}/${progress.total} Spiele)
          </div>
        </div>

        <div class="ko-roadmap-card is-locked">
          <div class="ko-roadmap-step-badge">PHASE 2 · FOLGT</div>
          <h3>K.-o.-Phasen Play-offs</h3>
          <p>Plätze 9–16 (gesetzt) spielen in 8 Duellen gegen Plätze 17–24 (ungesetzt) um 8 Tickets für das Achtelfinale.</p>
          <div class="ko-roadmap-status is-locked">
            <span class="ko-dot is-amber">●</span> Gesperrt bis Spieltag 58
          </div>
        </div>

        <div class="ko-roadmap-card is-locked">
          <div class="ko-roadmap-step-badge">PHASE 3 · FINALE</div>
          <h3>K.-o.-Phase &amp; Finale</h3>
          <p>Achtelfinale (Top 8 direkt gesetzt vs. 8 Play-off-Sieger) bis zum Finale um den Super League Henkelpott.</p>
          <div class="ko-roadmap-status is-locked">
            <span class="ko-dot is-slate">●</span> Gesperrt bis Play-offs
          </div>
        </div>
      </div>

      <!-- Current Qualification Standings Projection -->
      <div class="ko-projections-panel">
        <div class="panel-header">
          <div>
            <h2>Aktuelle Hochrechnung der Qualifikationszonen</h2>
            <small>Basierend auf dem aktuellen Tabellenstand der Ligaphase</small>
          </div>
        </div>

        <div class="ko-zones-grid">
          <!-- Zone 1: Direct Round of 16 (1-8) -->
          <div class="ko-zone-card is-direct">
            <div class="ko-zone-title">
              <span class="ko-zone-pill is-gold">PLÄTZE 1–8</span>
              <strong>Direktes Achtelfinale</strong>
            </div>
            <p class="ko-zone-desc">Freilos für die Play-offs · Direkt gesetzt im Achtelfinale</p>
            <ul class="ko-zone-list">
              ${directTeams.map((t, idx) => `
                <li>
                  <span class="ko-zone-rank">#${idx + 1}</span>
                  <span class="ko-zone-team">${escapeHtml(t.teamName)}</span>
                  <span class="ko-zone-pts">${t.points} Pkt</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Zone 2: Knockout Phase Play-offs (9-24) -->
          <div class="ko-zone-card is-playoff">
            <div class="ko-zone-title">
              <span class="ko-zone-pill is-blue">PLÄTZE 9–24</span>
              <strong>K.-o.-Phasen Play-offs</strong>
            </div>
            <p class="ko-zone-desc">9–16 gesetzt (Heimrecht) · 17–24 ungesetzt</p>
            <ul class="ko-zone-list is-split">
              ${playoffTeams.map((t, idx) => {
                const rank = idx + 9;
                const isSeeded = rank <= 16;
                return `
                  <li class="${isSeeded ? 'is-seeded' : 'is-unseeded'}">
                    <span class="ko-zone-rank">#${rank}</span>
                    <span class="ko-zone-team">${escapeHtml(t.teamName)}</span>
                    <span class="ko-zone-sub">${isSeeded ? 'Gesetzt' : 'Ungesetzt'}</span>
                    <span class="ko-zone-pts">${t.points} Pkt</span>
                  </li>
                `;
              }).join('')}
            </ul>
          </div>

          <!-- Zone 3: Eliminated (25-30) -->
          <div class="ko-zone-card is-eliminated">
            <div class="ko-zone-title">
              <span class="ko-zone-pill is-gray">PLÄTZE 25–30</span>
              <strong>Ausgeschieden</strong>
            </div>
            <p class="ko-zone-desc">Keine Teilnahme an Play-offs oder K.-o.-Phase</p>
            <ul class="ko-zone-list">
              ${eliminatedTeams.map((t, idx) => `
                <li>
                  <span class="ko-zone-rank">#${idx + 25}</span>
                  <span class="ko-zone-team">${escapeHtml(t.teamName)}</span>
                  <span class="ko-zone-pts">${t.points} Pkt</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function renderKnockoutView({ league, canControl = true, selectedMatchId = '' } = {}) {
  // Access Gate: Play-offs and Knockout are strictly locked until the full league phase (58 matchdays) is complete!
  if (!isLeaguePhaseComplete(league)) {
    return renderLockedPhaseGate(league);
  }

  const ensured = ensureKnockoutBracket(league);
  if (ensured.error && ensured.locked) {
    return renderLockedPhaseGate(league);
  }
  if (ensured.error) {
    return `<section class="panel empty-wide"><h2>K.-o.-Phase noch nicht verfügbar</h2><p>${escapeHtml(ensured.error)}</p></section>`;
  }

  const ko = ensured.knockout;
  const playoffs = ko.rounds.playoffs ?? [];
  const r16Left = (ko.rounds.r16 ?? []).filter((m) => m.side === 'west');
  const r16Right = (ko.rounds.r16 ?? []).filter((m) => m.side === 'east');
  const qfLeft = (ko.rounds.qf ?? []).filter((m) => m.side === 'west');
  const qfRight = (ko.rounds.qf ?? []).filter((m) => m.side === 'east');
  const sfLeft = (ko.rounds.sf ?? []).find((m) => m.side === 'west');
  const sfRight = (ko.rounds.sf ?? []).find((m) => m.side === 'east');
  const finalMatch = ko.rounds.final?.[0] ?? {};

  const finalCompleted = finalMatch.status === 'completed';
  const finalHomeWon = finalCompleted && finalMatch.winnerTeamId === finalMatch.home?.teamId;
  const finalAwayWon = finalCompleted && finalMatch.winnerTeamId === finalMatch.away?.teamId;
  const finalHomeBrand = getClubBrand(finalMatch.home?.teamName || '');
  const finalAwayBrand = getClubBrand(finalMatch.away?.teamName || '');

  const nextRoundKey = getNextKnockoutRoundKey(ko);
  const roundLabels = {
    playoffs: 'Play-offs (8 Spiele)',
    r16: 'Achtelfinale (8 Spiele)',
    qf: 'Viertelfinale (4 Spiele)',
    sf: 'Halbfinale (2 Spiele)',
    final: 'Finale',
  };

  const playoffsDone = playoffs.length > 0 && playoffs.every((m) => m.status === 'completed');
  const r16Done = (ko.rounds.r16 ?? []).every((m) => m.status === 'completed');
  const qfDone = (ko.rounds.qf ?? []).every((m) => m.status === 'completed');
  const sfDone = (ko.rounds.sf ?? []).every((m) => m.status === 'completed');

  const allMatches = [
    ...playoffs,
    ...(ko.rounds.r16 ?? []),
    ...(ko.rounds.qf ?? []),
    ...(ko.rounds.sf ?? []),
    ...(ko.rounds.final ?? []),
  ];
  const activeMatch = allMatches.find((m) => m.id === selectedMatchId && m.home && m.away)
    || allMatches.find((m) => m.status === 'scheduled' && m.home && m.away)
    || finalMatch;

  const championName = ko.champion?.teamName || 'Noch offen';
  const seasonLabel = `SAISON ${escapeHtml(league?.season || '2026/27')}`;

  return `
    <section class="ko-page" aria-label="UEFA Champions League 2024+ Playoffs und K.-o.-Phase">
      <div class="ko-toolbar">
        <div class="ko-toolbar-copy">
          <span class="ko-kicker">UEFA CHAMPIONS SYSTEM 2024+ · PLAYOFFS &amp; K.-O.-PHASE</span>
          <h1>Playoffs &amp; K.-o.-Phase Turnierbaum</h1>
          <p>
            Plätze 1–8 direkt im Achtelfinale · Plätze 9–24 in den K.-o.-Play-offs um die verbleibenden 8 Tickets.
          </p>
        </div>
        <div class="ko-toolbar-actions">
          ${canControl && nextRoundKey ? `
            <button type="button" class="button primary small" data-action="simulate-ko-round" data-round="${escapeHtml(nextRoundKey)}">
              ${escapeHtml(roundLabels[nextRoundKey] || nextRoundKey)} simulieren →
            </button>
          ` : ''}
          ${canControl && nextRoundKey ? `
            <button type="button" class="button light small" data-action="simulate-ko-all">
              Komplettes Turnier simulieren
            </button>
          ` : ''}
          ${canControl ? `
            <button type="button" class="button light small" data-action="reset-ko-bracket">
              Turnierbaum neu berechnen
            </button>
          ` : ''}
        </div>
      </div>

      ${activeMatch && activeMatch.home && activeMatch.away && canControl ? `
        <form class="ko-score-bar" data-ko-score-form data-match-id="${escapeHtml(activeMatch.id)}">
          <div class="ko-score-bar-info">
            <span class="ko-score-tag">${escapeHtml(roundLabels[activeMatch.round] || activeMatch.roundLabel || 'MATCH')} · AUSGEWÄHLTE PARTIE</span>
            <strong>#${activeMatch.home.seed} ${escapeHtml(activeMatch.home.teamName)} <i>vs.</i> #${activeMatch.away.seed} ${escapeHtml(activeMatch.away.teamName)}</strong>
          </div>
          <div class="ko-score-inputs">
            <label>
              <span>${escapeHtml(activeMatch.home.teamName)}</span>
              <input type="number" name="homeScore" min="0" max="99" required value="${activeMatch.homeScore ?? 2}" aria-label="Tore ${escapeHtml(activeMatch.home.teamName)}">
            </label>
            <b class="ko-score-colon">:</b>
            <label>
              <span>${escapeHtml(activeMatch.away.teamName)}</span>
              <input type="number" name="awayScore" min="0" max="99" required value="${activeMatch.awayScore ?? 1}" aria-label="Tore ${escapeHtml(activeMatch.away.teamName)}">
            </label>
            <button type="submit" class="button primary small">Ergebnis speichern</button>
          </div>
        </form>
      ` : ''}

      <!-- Stage 1 of Knockout: 8 Play-off Matches -->
      <section class="ko-playoffs-section" aria-label="K.-o.-Phasen Play-offs">
        <div class="ko-playoffs-header">
          <div>
            <span class="ko-kicker">PHASE 2 · PLAY-OFF-RUNDE</span>
            <h2>K.-o.-Phasen Play-offs (Plätze 9–24)</h2>
            <small>8 K.o.-Duelle · Die 8 Sieger komplettieren das Achtelfinale gegen die gesetzten Top 8</small>
          </div>
          <div class="ko-playoffs-status">
            ${playoffsDone ? '<span class="ko-status-badge is-done">Play-offs beendet (8 Sieger weiter)</span>' : '<span class="ko-status-badge is-active">Play-offs ausstehend</span>'}
          </div>
        </div>

        <div class="ko-playoffs-grid">
          ${playoffs.map((m, idx) => {
            const completed = m.status === 'completed';
            const homeWon = completed && m.winnerTeamId === m.home?.teamId;
            const awayWon = completed && m.winnerTeamId === m.away?.teamId;
            const isSelected = selectedMatchId === m.id;
            return `
              <div class="ko-playoff-card ${completed ? 'is-completed' : ''} ${isSelected ? 'is-selected' : ''}"
                data-action="select-ko-match" data-match-id="${escapeHtml(m.id)}" role="button" tabindex="0">
                <div class="ko-playoff-card-head">
                  <span class="ko-po-tag">${escapeHtml(m.label || `Play-off ${idx + 1}`)}</span>
                  <span class="ko-po-dest">${m.nextMatchId ? `-> Achtelfinale` : ''}</span>
                </div>
                <div class="ko-match-rows">
                  ${renderBracketSlot(m.home, m.homeScore, homeWon, awayWon, 'Gesetzt (9-16)')}
                  <div class="ko-match-divider"></div>
                  ${renderBracketSlot(m.away, m.awayScore, awayWon, homeWon, 'Ungesetzt (17-24)')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>

      <!-- Main Symmetrical Tournament Bracket (Achtelfinale -> Finale) -->
      <div class="nba-bracket-stage" data-testid="nba-knockout-bracket">
        <div class="ko-stage-progress" aria-label="Turnierfortschritt">
          <div class="ko-stage-pill ${nextRoundKey === 'playoffs' ? 'is-active' : playoffsDone ? 'is-done' : ''}">
            <span class="ko-pill-step">01</span>
            <div><strong>Play-offs</strong><small>8 Duelle · Plätze 9–24</small></div>
          </div>
          <span class="ko-stage-arrow">―</span>
          <div class="ko-stage-pill ${nextRoundKey === 'r16' ? 'is-active' : r16Done ? 'is-done' : ''}">
            <span class="ko-pill-step">02</span>
            <div><strong>Achtelfinale</strong><small>Top 8 vs. Play-off-Sieger</small></div>
          </div>
          <span class="ko-stage-arrow">―</span>
          <div class="ko-stage-pill ${nextRoundKey === 'qf' ? 'is-active' : qfDone ? 'is-done' : ''}">
            <span class="ko-pill-step">03</span>
            <div><strong>Viertelfinale</strong><small>4 Partien · Top 8</small></div>
          </div>
          <span class="ko-stage-arrow">―</span>
          <div class="ko-stage-pill ${nextRoundKey === 'sf' ? 'is-active' : sfDone ? 'is-done' : ''}">
            <span class="ko-pill-step">04</span>
            <div><strong>Halbfinale</strong><small>2 Partien · Top 4</small></div>
          </div>
          <span class="ko-stage-arrow">―</span>
          <div class="ko-stage-pill ${nextRoundKey === 'final' ? 'is-active' : finalCompleted ? 'is-done' : ''}">
            <span class="ko-pill-step">05</span>
            <div><strong>Großes Finale</strong><small>Titelentscheidung</small></div>
          </div>
        </div>

        <div class="ko-columns-header">
          <span>ACHTELFINALE</span>
          <span>VIERTELFINALE</span>
          <span>HALBFINALE</span>
          <span class="is-center">GROSSES FINALE</span>
          <span>HALBFINALE</span>
          <span>VIERTELFINALE</span>
          <span>ACHTELFINALE</span>
        </div>

        <div class="nba-bracket-grid">
          <!-- LEFT COLUMN 1: ACHTELFINALE (4 Matchups) -->
          <div class="nba-col nba-col-r16 is-left">
            ${r16Left.map((m, i) => renderMatchupCard(m, activeMatch?.id, i, 'Sieger Play-off')).join('')}
          </div>

          <!-- LEFT COLUMN 2: VIERTELFINALE (2 Matchups) -->
          <div class="nba-col nba-col-qf is-left">
            <div class="nba-qf-pair">
              ${qfLeft.map((m, i) => renderMatchupCard(m, activeMatch?.id, i, 'Sieger AF')).join('')}
            </div>
          </div>

          <!-- LEFT COLUMN 3: HALBFINALE (1 Matchup) -->
          <div class="nba-col nba-col-sf is-left">
            ${sfLeft ? renderMatchupCard(sfLeft, activeMatch?.id, 0, 'Sieger VF') : ''}
          </div>

          <!-- CENTER STAGE: ANIMATED AURA & GLITTER TROPHY + GRAND FINAL + CHAMPION -->
          <div class="nba-col nba-col-center">
            <div class="nba-trophy-pedestal" aria-label="Animierte Champions Trophäe mit goldener Aura">
              <div class="trophy-aura-outer"></div>
              <div class="trophy-aura-rays"></div>
              <div class="trophy-halo-ring"></div>
              <div class="trophy-aura-inner"></div>
              <div class="trophy-sparkles" aria-hidden="true">
                <svg class="trophy-sparkle s1" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
                <svg class="trophy-sparkle s2" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
                <svg class="trophy-sparkle s3" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
                <svg class="trophy-sparkle s4" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
                <svg class="trophy-sparkle s5" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
                <svg class="trophy-sparkle s6" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
                <svg class="trophy-sparkle s7" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
                <svg class="trophy-sparkle s8" viewBox="0 0 24 24"><path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4Z" fill="currentColor"/></svg>
              </div>
              <div class="trophy-figure-wrap">
                <img
                  src="/public/assets/aistudio/image_8903d5b0.png"
                  data-original-src="/public/assets/aistudio/image_8903d5b0.png"
                  data-clean-trophy="true"
                  alt="Super League Pokal"
                  class="nba-trophy-img"
                  referrerpolicy="no-referrer"
                >
                <div class="trophy-shimmer-sweep" aria-hidden="true"></div>
              </div>
            </div>

            <div class="nba-finals-box ${finalCompleted ? 'is-completed' : ''} ${activeMatch?.id === finalMatch.id ? 'is-selected' : ''}"
              ${finalMatch.home && finalMatch.away ? `data-action="select-ko-match" data-match-id="${escapeHtml(finalMatch.id)}" role="button" tabindex="0"` : ''}>
              <div class="ko-final-header">
                <span>ENDSPIEL</span>
                <span class="ko-final-season">${seasonLabel}</span>
              </div>
              <div class="nba-finals-teams">
                <div class="nba-finalist-card ${finalHomeWon ? 'is-winner' : finalAwayWon ? 'is-loser' : ''}">
                  <span class="ko-finalist-bar" style="background:${finalMatch.home ? finalHomeBrand.color : '#475569'}"></span>
                  <span class="ko-finalist-seed">${finalMatch.home ? `#${finalMatch.home.seed}` : 'HF 1'}</span>
                  <strong class="nba-finalist-code">${escapeHtml(finalMatch.home ? finalHomeBrand.code : 'TBD')}</strong>
                  <small>${escapeHtml(finalMatch.home?.teamName || 'Halbfinale 1')}</small>
                  <b class="ko-finalist-score ${finalHomeWon ? 'is-gold' : ''}">${finalMatch.homeScore ?? '-'}</b>
                </div>
                <div class="ko-final-vs">VS</div>
                <div class="nba-finalist-card ${finalAwayWon ? 'is-winner' : finalHomeWon ? 'is-loser' : ''}">
                  <span class="ko-finalist-bar" style="background:${finalMatch.away ? finalAwayBrand.color : '#475569'}"></span>
                  <span class="ko-finalist-seed">${finalMatch.away ? `#${finalMatch.away.seed}` : 'HF 2'}</span>
                  <strong class="nba-finalist-code">${escapeHtml(finalMatch.away ? finalAwayBrand.code : 'TBD')}</strong>
                  <small>${escapeHtml(finalMatch.away?.teamName || 'Halbfinale 2')}</small>
                  <b class="ko-finalist-score ${finalAwayWon ? 'is-gold' : ''}">${finalMatch.awayScore ?? '-'}</b>
                </div>
              </div>
            </div>

            <div class="nba-champions-plaque ${ko.champion ? 'is-crowned' : ''}">
              <span class="nba-champions-season">${seasonLabel} · TITELTRÄGER</span>
              <h2 class="nba-champions-word">CHAMPION</h2>
              <strong class="nba-champions-club">${escapeHtml(championName)}</strong>
            </div>
          </div>

          <!-- RIGHT COLUMN 3: HALBFINALE (1 Matchup) -->
          <div class="nba-col nba-col-sf is-right">
            ${sfRight ? renderMatchupCard(sfRight, activeMatch?.id, 0, 'Sieger VF') : ''}
          </div>

          <!-- RIGHT COLUMN 2: VIERTELFINALE (2 Matchups) -->
          <div class="nba-col nba-col-qf is-right">
            <div class="nba-qf-pair">
              ${qfRight.map((m, i) => renderMatchupCard(m, activeMatch?.id, i, 'Sieger AF')).join('')}
            </div>
          </div>

          <!-- RIGHT COLUMN 1: ACHTELFINALE (4 Matchups) -->
          <div class="nba-col nba-col-r16 is-right">
            ${r16Right.map((m, i) => renderMatchupCard(m, activeMatch?.id, i, 'Sieger Play-off')).join('')}
          </div>
        </div>
      </div>
    </section>
  `;
}
