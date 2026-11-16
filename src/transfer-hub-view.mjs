import { analyzeTeamPositionNeeds, isTransferWindowOpen } from './transfer-core.mjs';
import { getPesStatTier } from './pes-core.mjs';
import {
  getPlayerContract,
  getPlayerScoutingReport,
  isPlayerShortlisted,
} from './scouting-talent-core.mjs';
import { getPlayerAgentProfile, renderMailInboxView } from './mail-finance-agent.mjs';
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

function renderHijackRadarSection(league, managerId, { compact = false } = {}) {
  const openDeals = (league?.pendingDeals ?? []).filter(
    (deal) => (!deal.status || deal.status === 'open') && deal.sellerTeamId !== managerId && deal.buyerTeamId !== managerId,
  );
  if (!openDeals.length) {
    if (compact) return '';
    return `
      <div class="empty-state">
        <strong>Aktuell keine offenen Rivalen-Verhandlungen auf dem Hijack-Radar.</strong>
        <p>Klicke auf „Konkurrenz-Verhandlungen aktualisieren“, um laufende Mehrrunden-Gespräche anderer Vereine aufzuspüren.</p>
      </div>
    `;
  }

  const cardsHtml = openDeals.slice(0, compact ? 3 : 6).map((deal) => {
    const hijackFee = Number(deal.hijackFee || deal.minHijackFee || Math.round((deal.currentFee || 20) * 1.12));
    const progressPct = Math.round(((Number(deal.round) || 1) / (Number(deal.maxRounds) || 3)) * 100);
    return `
      <article class="fm-hijack-card ${Number(deal.round) >= 3 ? 'is-urgent' : ''}" data-deal-id="${escapeHtml(deal.id)}">
        <div class="fm-hijack-card-top">
          <div>
            <span class="fm-hijack-stage-pill ${Number(deal.round) >= 3 ? 'is-critical' : ''}">
              ${escapeHtml(deal.stageLabel || `Runde ${deal.round || 1}/${deal.maxRounds || 3}`)}
            </span>
            <strong>
              <button type="button" class="pes-inline-player-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(deal.playerId)}">
                <strong>${escapeHtml(deal.playerName)}</strong>
              </button>
              <span class="position-tag">${escapeHtml(deal.position || 'CM')}</span>
              <button type="button" class="pes-inline-ovr-btn" data-action="open-pes-player" data-player-id="${escapeHtml(deal.playerId)}">OVR ${Number(deal.rating) || 80}</button>
            </strong>
            <small>${escapeHtml(deal.sellerTeamName)} verhandelt mit <b>${escapeHtml(deal.buyerTeamName)}</b></small>
          </div>
          <div class="fm-hijack-bid-box">
            <small>AKTUELLES GEBOT</small>
            <strong>${Number(deal.currentFee).toLocaleString('de-DE')} Mio. €</strong>
            <span>Marktwert ~${Number(deal.marketValue || deal.currentFee).toLocaleString('de-DE')} Mio. €</span>
          </div>
        </div>
        <div class="fm-hijack-progress-track" aria-hidden="true">
          <span style="width:${progressPct}%"></span>
        </div>
        <div class="fm-hijack-card-foot">
          <span class="draft-sub">
            ${Number(deal.round) >= 3
              ? 'Letzte Runde vor Unterschrift'
              : '3-Runden-Poker offen für Hijack'}
          </span>
          <button
            type="button"
            class="button primary small fm-hijack-btn"
            data-action="hijack-transfer-deal"
            data-deal-id="${escapeHtml(deal.id)}"
            data-hijack-fee="${hijackFee}"
          >
            ${icon('hijack', { size: 13 })} <span>Hijacken (${hijackFee} Mio. €)</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  return `
    <div class="fm-hijack-grid ${compact ? 'is-compact' : ''}">
      ${cardsHtml}
    </div>
  `;
}

export function renderCommandTransferHubView({
  league,
  players = [],
  manager = null,
  activeManagerTeamId = '',
  activeTab = 'scouting',
  clubFilter = 'all',
  positionFilter = 'all',
  scoutingFilter = 'all',
  searchQuery = '',
  onlineManagerIds = [],
  selectedMailId = '',
  mailFilter = 'all',
  preselectedTargetTeamId = '',
  preselectedPlayerId = '',
} = {}) {
  if (!league) return '';
  const managerId = activeManagerTeamId || manager?.id || league.teams?.[0]?.id || '';
  const activeClub = league.teams?.find((t) => t.id === managerId) || league.teams?.[0];
  const windowOpen = isTransferWindowOpen(league.currentDate);

  const picks = league.draft?.picks ?? [];
  const pickByPlayerId = new Map(picks.map((pick) => [pick.playerId, pick]));
  const teamsById = new Map((league.teams ?? []).map((t) => [t.id, t]));

  // Count stats for KPI strip
  const myRosterPicks = picks.filter((p) => p.teamId === managerId);
  const myExpiringCount = myRosterPicks.filter((p) => {
    const c = getPlayerContract(league, { id: p.playerId, rating: p.rating, position: p.position });
    return c.isExpiring;
  }).length;

  const generatedTalents = players.filter((p) => p.isGeneratedTalent);
  const freeAgents = players.filter((p) => !pickByPlayerId.has(p.id));
  const activeCallsCount = (league.calls ?? []).filter(
    (c) => [c.callerTeamId, c.targetTeamId].includes(managerId) && ['ringing', 'negotiating'].includes(c.status),
  ).length;
  const openHijackDeals = (league.pendingDeals ?? []).filter(
    (d) => (!d.status || d.status === 'open') && d.sellerTeamId !== managerId && d.buyerTeamId !== managerId,
  );

  const scoutedReportsCount = Object.values(league.scouting?.reports ?? {}).filter(
    (r) => r.teamId === managerId && r.level >= 1,
  ).length;

  const totalAnnualPayroll = myRosterPicks.reduce((sum, p) => {
    const c = getPlayerContract(league, { id: p.playerId, rating: p.rating, position: p.position });
    return sum + (c.salary || 0);
  }, 0);

  const unreadMailCount = (league.mailItems ?? []).filter((m) => !m.read).length;

  const subTabsHtml = `
    <div class="pes-command-tabs tx-command-tabs" role="tablist" aria-label="TransferHub Command Center Navigation">
      <button type="button" class="pes-tab-btn ${activeTab === 'scouting' ? 'is-active' : ''}" data-action="set-tx-hub-tab" data-tab="scouting">
        ${icon('search', { size: 15 })} <span>Scouting-Zentrale (${players.length})</span>
      </button>
      <button type="button" class="pes-tab-btn ${activeTab === 'mail' ? 'is-active' : ''}" data-action="set-tx-hub-tab" data-tab="mail">
        ${icon('news', { size: 15 })} <span>Postfach &amp; Angebote (${(league.mailItems ?? []).length}${unreadMailCount ? ` · ${unreadMailCount} neu` : ''})</span>
      </button>
      <button type="button" class="pes-tab-btn ${activeTab === 'freeagency' ? 'is-active' : ''}" data-action="set-tx-hub-tab" data-tab="freeagency">
        ${icon('userPlus', { size: 15 })} <span>Free Agency &amp; Talente (${freeAgents.length})</span>
      </button>
      <button type="button" class="pes-tab-btn ${activeTab === 'contracts' ? 'is-active' : ''}" data-action="set-tx-hub-tab" data-tab="contracts">
        ${icon('contract', { size: 15 })} <span>Verträge &amp; Agenten (${myRosterPicks.length}${myExpiringCount ? ` · ${myExpiringCount} offen` : ''})</span>
      </button>
      <button type="button" class="pes-tab-btn ${activeTab === 'market' ? 'is-active' : ''}" data-action="set-tx-hub-tab" data-tab="market">
        ${icon('hijack', { size: 15 })} <span>Hijacks (${openHijackDeals.length}) &amp; Markt (${(league.transfers ?? []).length})</span>
      </button>
    </div>
  `;

  let tabContentHtml = '';

  if (activeTab === 'mail') {
    tabContentHtml = renderMailInboxView({
      league,
      players,
      activeManagerTeamId: managerId,
      selectedMailId,
      mailFilter,
      preselectedTargetTeamId,
      preselectedPlayerId,
      embeddedInTransferHub: true,
    });
  } else if (activeTab === 'scouting') {
    const q = String(searchQuery || '').trim().toLowerCase();

    const filteredPlayers = players.filter((raw) => {
      const pick = pickByPlayerId.get(raw.id);
      const ownerId = pick?.teamId || 'free-agent';

      if (clubFilter === 'rivals' && (ownerId === 'free-agent' || ownerId === managerId)) return false;
      if (clubFilter === 'talents' && !raw.isGeneratedTalent) return false;
      if (clubFilter === 'free-agents' && ownerId !== 'free-agent') return false;
      if (clubFilter === 'shortlist' && !isPlayerShortlisted(league, managerId, raw.id)) return false;
      if (clubFilter === 'my-club' && ownerId !== managerId) return false;
      if (
        !['all', 'rivals', 'talents', 'free-agents', 'shortlist', 'my-club'].includes(clubFilter)
        && ownerId !== clubFilter
      ) {
        return false;
      }

      if (positionFilter !== 'all') {
        const pos = String(raw.position || pick?.position || 'CM').toUpperCase();
        if (!pos.includes(positionFilter)) return false;
      }

      if (q) {
        const hay = `${raw.name} ${raw.club || ''} ${pick?.teamName || ''} ${raw.position || ''} ${raw.nationality || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (scoutingFilter !== 'all') {
        const rep = getPlayerScoutingReport(league, managerId, raw);
        if (scoutingFilter === 'full' && rep.level < 2) return false;
        if (scoutingFilter === 'partial' && rep.level !== 1) return false;
        if (scoutingFilter === 'unscouted' && rep.level !== 0) return false;
      }

      return true;
    });

    let displayedPlayers;
    if (clubFilter === 'all' && !q) {
      const wonderkidsInFilter = filteredPlayers.filter((p) => p.isGeneratedTalent).slice(0, 8);
      const wonderkidIds = new Set(wonderkidsInFilter.map((p) => p.id));
      const others = filteredPlayers.filter((p) => !wonderkidIds.has(p.id)).slice(0, 37);
      displayedPlayers = [...wonderkidsInFilter, ...others];
    } else {
      displayedPlayers = filteredPlayers.slice(0, 45);
    }

    const rowsHtml = displayedPlayers.map((raw) => {
      const report = getPlayerScoutingReport(league, managerId, raw);
      const pes = report.pesProfile;
      const pick = pickByPlayerId.get(raw.id);
      const ownerTeam = pick ? teamsById.get(pick.teamId) : null;
      const shortlisted = isPlayerShortlisted(league, managerId, raw.id);
      const contract = report.contract;

      const ovrBadgeHtml = report.isFullyScouted
        ? `<button type="button" class="pes-stat-badge ${getPesStatTier(pes.rating)} pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(raw.id)}" title="Auf OVR klicken für vollständigen FIFA 17 &amp; Scouting-Bericht"><small>OVR</small>${pes.rating}</button>`
        : `<button type="button" class="fm-fog-ovr-badge ${report.level === 1 ? 'is-partial' : 'is-hidden'}" data-action="open-pes-player" data-player-id="${escapeHtml(raw.id)}" title="Spieler noch nicht zu 100% gescoutet — Klicken für Scouting-Details"><small>OVR</small>${escapeHtml(report.displayedOvr)}</button>`;

      const potBadgeHtml = report.isFullyScouted
        ? `<span class="pes-stat-badge ${getPesStatTier(report.exactPotential)}">${report.exactPotential}</span>`
        : `<span class="fm-fog-pot-badge">${escapeHtml(report.displayedPotential)}</span>`;

      const hexStripHtml = `
        <div class="pes-mini-hex-strip fm-hex-strip ${report.isFullyScouted ? 'is-revealed' : 'is-fogged'}">
          <span>SCH <b>${escapeHtml(report.hexagonDisplay.SHO)}</b></span>
          <span>DRI <b>${escapeHtml(report.hexagonDisplay.DRI)}</b></span>
          <span>PAS <b>${escapeHtml(report.hexagonDisplay.PAS)}</b></span>
          <span>TEM <b>${escapeHtml(report.hexagonDisplay.PAC)}</b></span>
          <span>PHY <b>${escapeHtml(report.hexagonDisplay.PHY)}</b></span>
          <span>DEF <b>${escapeHtml(report.hexagonDisplay.DEF)}</b></span>
        </div>
      `;

      const knowledgeBarHtml = `
        <div class="fm-knowledge-cell">
          <div class="fm-knowledge-top">
            <span class="fm-grade-pill is-level-${report.level}">${escapeHtml(report.grade)}</span>
            <small>${escapeHtml(report.statusLabel)}</small>
          </div>
          <div class="fm-knowledge-bar"><span class="is-level-${report.level}" style="width:${report.progress}%"></span></div>
        </div>
      `;

      const actionButtonsHtml = [];
      actionButtonsHtml.push(`
        <button type="button" class="fm-shortlist-star ${shortlisted ? 'is-active' : ''}" data-action="toggle-shortlist" data-player-id="${escapeHtml(raw.id)}" title="${shortlisted ? 'Von Shortlist entfernen' : 'Auf Shortlist setzen'}">
          ${icon('star', { size: 12 })} <span>${shortlisted ? 'Merken' : 'Merken'}</span>
        </button>
      `);

      if (!report.isFullyScouted) {
        actionButtonsHtml.push(`
          <button type="button" class="button light small" data-action="scout-player" data-player-id="${escapeHtml(raw.id)}" title="Nächste Scouting-Stufe freischalten (0,5 Mio. €)">
            ${icon('eye', { size: 13 })} <span>Scout (${report.level === 0 ? '50%' : '100%'})</span>
          </button>
          <button type="button" class="button primary small" data-action="scout-player-full" data-player-id="${escapeHtml(raw.id)}" title="Express-Vollscouting: Alle FIFA 17 Attribute &amp; Potenzial sofort aufdecken">
            <span>Voll-Scout</span>
          </button>
        `);
      } else {
        actionButtonsHtml.push(`
          <button type="button" class="button light small" data-action="open-pes-player" data-player-id="${escapeHtml(raw.id)}">
            <span>FIFA 17 Werte</span>
          </button>
        `);
      }

      if (!pick) {
        actionButtonsHtml.push(`
          <button type="button" class="button primary small" data-action="sign-free-agent" data-player-id="${escapeHtml(raw.id)}">
            ${icon('userPlus', { size: 13 })} <span>Agent &amp; Vertrag (${contract.signingBonus}M)</span>
          </button>
        `);
      } else if (pick.teamId !== managerId) {
        actionButtonsHtml.push(`
          <button type="button" class="button primary small" data-action="mail-offer-player" data-team-id="${escapeHtml(pick.teamId)}" data-player-id="${escapeHtml(raw.id)}" title="Schriftliches Transferangebot per Postfach senden (CPU &amp; Spieler)">
            <span>Per Mail bieten</span>
          </button>
        `);
        if (ownerTeam?.managerType === 'human') {
          actionButtonsHtml.push(`
            <button type="button" class="button light small" data-action="call-player-club" data-team-id="${escapeHtml(pick.teamId)}" data-player-id="${escapeHtml(raw.id)}" title="Schneller Live-Anruf im Handy mit echtem Mitspieler">
              ${icon('phoneCall', { size: 13 })} <span>Schnell-Anruf</span>
            </button>
          `);
        }
      }

      return `
        <tr class="fm-scouting-row fm-player-row ${raw.isGeneratedTalent ? 'is-wonderkid is-wonderkid-row' : ''}">
          <td>
            <div class="fm-player-cell">
              <div>
                <button type="button" class="pes-inline-player-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(raw.id)}">
                  <strong>${escapeHtml(pes.name)}</strong>
                </button>
                ${raw.isGeneratedTalent ? `<span class="fm-wonderkid-badge">${escapeHtml(raw.talentTier || 'Wunderkind')}</span>` : ''}
                <div class="draft-sub">${pes.age} J. · ${escapeHtml(pes.playingStyle)} · ${escapeHtml(raw.originClub || pes.originClub)}</div>
              </div>
            </div>
          </td>
          <td><span class="position-tag">${escapeHtml(pes.position || 'CM')}</span></td>
          <td>
            ${ownerTeam
              ? `<span class="fm-club-pill ${ownerTeam.id === managerId ? 'is-own' : ''}">${escapeHtml(ownerTeam.name)}</span>`
              : `<span class="fm-free-pill">Free Agent</span>`}
          </td>
          <td>${ovrBadgeHtml}</td>
          <td>${potBadgeHtml}</td>
          <td>${knowledgeBarHtml}</td>
          <td>${hexStripHtml}</td>
          <td>
            <div class="fm-contract-cell">
              <strong>${contract.isFreeAgent ? `Handgeld ${contract.signingBonus} Mio. €` : `~${contract.marketValue} Mio. €`}</strong>
              <small>${escapeHtml(contract.statusLabel)} · ${contract.salary} Mio./J.</small>
            </div>
          </td>
          <td>
            <div class="fm-row-actions">${actionButtonsHtml.join('')}</div>
          </td>
        </tr>
      `;
    }).join('');

    const clubOptionsHtml = [
      `<option value="all" ${clubFilter === 'all' ? 'selected' : ''}>Alle Spieler &amp; Wunderkinder (${players.length})</option>`,
      `<option value="rivals" ${clubFilter === 'rivals' ? 'selected' : ''}>Alle anderen 29 Liga-Vereine (Kader durchsuchen)</option>`,
      `<option value="talents" ${clubFilter === 'talents' ? 'selected' : ''}>Zufallsgenerierte Talente &amp; Wunderkinder (${generatedTalents.length})</option>`,
      `<option value="free-agents" ${clubFilter === 'free-agents' ? 'selected' : ''}>Vereinslose Spieler / Free Agency (${freeAgents.length})</option>`,
      `<option value="shortlist" ${clubFilter === 'shortlist' ? 'selected' : ''}>Meine Scouting-Shortlist</option>`,
      `<option value="my-club" ${clubFilter === 'my-club' ? 'selected' : ''}>Mein Verein (${escapeHtml(activeClub?.name || '')})</option>`,
      ...(league.teams ?? []).map(
        (team) => `<option value="${escapeHtml(team.id)}" ${clubFilter === team.id ? 'selected' : ''}>${escapeHtml(team.name)} (${escapeHtml(team.managerName || 'CPU')})</option>`,
      ),
    ].join('');

    const quickPillsHtml = [
      { id: 'all', label: `Alle & Top-Talente` },
      { id: 'rivals', label: `Liga-Konkurrenz (29 Clubs)` },
      { id: 'talents', label: `Wunderkinder (${generatedTalents.length})` },
      { id: 'free-agents', label: `Free Agency (${freeAgents.length})` },
      { id: 'shortlist', label: `Shortlist` },
      { id: 'my-club', label: `Mein Kader` },
    ].map((pill) => `<button type="button" class="pes-mode-pill ${clubFilter === pill.id ? 'is-active' : ''}" data-action="filter-club-scouting" data-club-id="${pill.id}">${pill.label}</button>`).join('');

    tabContentHtml = `
      <section class="panel fm-hijack-radar-banner" aria-label="Laufende Konkurrenz-Transfers zum Hijacken">
        <div class="panel-header">
          <div>
            <h2>Transfer-Hijack-Radar (${openHijackDeals.length})</h2>
            <div class="draft-sub">Laufende 3-Runden-Deals anderer Vereine per Übergebot sofort ins Handy holen.</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="button light small" data-action="refresh-hijack-deals">${icon('refresh', { size: 13 })} <span>Radar aktualisieren</span></button>
            <button type="button" class="button light small" data-action="set-tx-hub-tab" data-tab="market"><span>Alle ${openHijackDeals.length} Deals</span></button>
          </div>
        </div>
        ${renderHijackRadarSection(league, managerId, { compact: true })}
      </section>

      <section class="panel fm-scouting-panel">
        <div class="panel-header">
          <div>
            <h2>Super League Scouting-Datenbank · 30 Vereine &amp; FIFA 17 Attribute</h2>
            <div class="draft-sub">Scoute verdeckte FIFA 17 Einzelwerte (40–99), Hexagon-Radar und Potenzial aller Liga-Spieler.</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="button primary small" data-action="generate-new-talents">${icon('userPlus', { size: 13 })} <span>+6 Talente</span></button>
            <button type="button" class="button light small" data-action="scout-top-targets">${icon('eye', { size: 13 })} <span>Top-5 scouten (2,5M)</span></button>
          </div>
        </div>

        <div class="pes-mode-pills" style="margin:10px 0 6px">${quickPillsHtml}</div>

        <div class="fm-filter-toolbar">
          <div class="field">
            <label for="fm-club-filter">Verein / Spielerpool</label>
            <select id="fm-club-filter" data-fm-filter="club">${clubOptionsHtml}</select>
          </div>
          <div class="field">
            <label for="fm-pos-filter">Position</label>
            <select id="fm-pos-filter" data-fm-filter="position">
              <option value="all" ${positionFilter === 'all' ? 'selected' : ''}>Alle Positionen</option>
              ${['ST', 'LW', 'RW', 'CM', 'DM', 'CB', 'LB', 'RB', 'GK'].map((pos) => `<option value="${pos}" ${positionFilter === pos ? 'selected' : ''}>${pos}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="fm-scout-filter">Scouting-Kenntnis</label>
            <select id="fm-scout-filter" data-fm-filter="scouting">
              <option value="all" ${scoutingFilter === 'all' ? 'selected' : ''}>Alle Kenntnisstufen</option>
              <option value="full" ${scoutingFilter === 'full' ? 'selected' : ''}>100% Vollständig gescoutet</option>
              <option value="partial" ${scoutingFilter === 'partial' ? 'selected' : ''}>50% Vorbericht</option>
              <option value="unscouted" ${scoutingFilter === 'unscouted' ? 'selected' : ''}>0% Ungescoutet (Nebel)</option>
            </select>
          </div>
          <div class="field">
            <label for="fm-search-input">Spieler oder Nation suchen</label>
            <input id="fm-search-input" type="text" data-fm-filter="search" value="${escapeHtml(searchQuery)}" placeholder="z. B. Yamal, Wirtz, Wunderkind…">
          </div>
        </div>

        <div class="standings-scroll">
          <table class="player-table fm-scouting-table">
            <thead>
              <tr>
                <th>Spieler &amp; Rolle</th>
                <th>Pos</th>
                <th>Aktueller Verein</th>
                <th>OVR (Kenntnis)</th>
                <th>Potenzial</th>
                <th>Scout-Bericht</th>
                <th>FIFA 17 Hexagon (40–99)</th>
                <th>Vertrag / Marktwert</th>
                <th>Scouting &amp; Aktion</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="9" class="empty-table">Keine Spieler für diese Filterauswahl gefunden.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  } else if (activeTab === 'freeagency') {
    const sortedFreeAgents = [...freeAgents].sort((a, b) => (b.isGeneratedTalent ? 1 : 0) - (a.isGeneratedTalent ? 1 : 0) || (b.potential || b.rating) - (a.potential || a.rating)).slice(0, 36);

    const cardsHtml = sortedFreeAgents.map((raw) => {
      const report = getPlayerScoutingReport(league, managerId, raw);
      const pes = report.pesProfile;
      const contract = report.contract;
      return `
        <article class="panel fm-free-agent-card ${raw.isGeneratedTalent ? 'is-wonderkid-card' : ''}">
          <div class="fm-fa-card-top">
            <div>
              ${raw.isGeneratedTalent
                ? `<span class="fm-wonderkid-badge">${escapeHtml(raw.talentTier || 'Zufalls-Talent')} · ${escapeHtml(raw.originClub || 'U21')}</span>`
                : '<span class="fm-free-agent-badge">Ablösefrei (Free Agent)</span>'}
              <h3>
                <button type="button" class="pes-inline-player-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(raw.id)}">
                  <strong>${escapeHtml(pes.name)}</strong>
                </button>
              </h3>
              <small>${escapeHtml(pes.position || 'CM')} · ${pes.age} Jahre · ${escapeHtml(pes.playingStyle)}</small>
            </div>
            <div class="fm-fa-ratings">
              ${report.isFullyScouted
                ? `<button type="button" class="pes-stat-badge ${getPesStatTier(pes.rating)} pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(raw.id)}"><small>OVR</small>${pes.rating}</button>`
                : `<button type="button" class="fm-fog-ovr-badge" data-action="open-pes-player" data-player-id="${escapeHtml(raw.id)}"><small>OVR</small>${escapeHtml(report.displayedOvr)}</button>`}
              <span class="fm-pot-pill" title="Potenzial">POT ${escapeHtml(report.displayedPotential)}</span>
            </div>
          </div>

          <div class="pes-mini-hex-strip fm-hex-strip ${report.isFullyScouted ? 'is-revealed' : 'is-fogged'}">
            <span>SCH <b>${escapeHtml(report.hexagonDisplay.SHO)}</b></span>
            <span>DRI <b>${escapeHtml(report.hexagonDisplay.DRI)}</b></span>
            <span>PAS <b>${escapeHtml(report.hexagonDisplay.PAS)}</b></span>
            <span>TEM <b>${escapeHtml(report.hexagonDisplay.PAC)}</b></span>
            <span>PHY <b>${escapeHtml(report.hexagonDisplay.PHY)}</b></span>
            <span>DEF <b>${escapeHtml(report.hexagonDisplay.DEF)}</b></span>
          </div>

          <div class="fm-fa-contract-box">
            <div>
              <small>HANDGELD (SOFORT)</small>
              <strong>${contract.signingBonus} Mio. €</strong>
            </div>
            <div>
              <small>GEHALTSFORDERUNG</small>
              <strong>${contract.salary} Mio. €/J.</strong>
            </div>
            <div>
              <small>SCOUT-URTEIL</small>
              <strong>${escapeHtml(report.grade)} (${report.progress}%)</strong>
            </div>
          </div>

          <div class="fm-fa-actions">
            ${!report.isFullyScouted ? `
              <button type="button" class="button light small" data-action="scout-player-full" data-player-id="${escapeHtml(raw.id)}">
                Vollständig scouten (100%)
              </button>
            ` : `
              <button type="button" class="button light small" data-action="open-pes-player" data-player-id="${escapeHtml(raw.id)}">
                40–99 Werte
              </button>
            `}
            <button type="button" class="button primary small" data-action="sign-free-agent" data-player-id="${escapeHtml(raw.id)}">
              3-Jahres-Vertrag (${contract.signingBonus} Mio. €)
            </button>
          </div>
        </article>
      `;
    }).join('');

    tabContentHtml = `
      <section class="panel fm-scouting-panel">
        <div class="panel-header">
          <div>
            <h2>Free Agency &amp; Zufallsgenerierte Jugend-Talente</h2>
            <div class="draft-sub">Verpflichte ablösefreie Profis und frisch generierte 16–20-jährige Wunderkinder direkt gegen Handgeld für deinen Kader.</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="button primary small" data-action="generate-new-talents">Neue Talente-Klasse generieren (+6 Wunderkinder)</button>
          </div>
        </div>
        <div class="fm-free-agent-grid">
          ${cardsHtml || '<div class="empty-state">Aktuell keine freien Spieler verfügbar.</div>'}
        </div>
      </section>
    `;
  } else if (activeTab === 'contracts') {
    const myPlayersRows = myRosterPicks.map((pick) => {
      const raw = players.find((p) => p.id === pick.playerId) || { id: pick.playerId, name: pick.playerName, position: pick.position, rating: pick.rating };
      const pes = getPlayerScoutingReport(league, managerId, raw).pesProfile;
      const contract = getPlayerContract(league, pes);
      const agent = getPlayerAgentProfile(pes);
      const extendCost2 = Math.max(1, Math.round(contract.salary * 1.2));

      return `
        <tr>
          <td>
            <button type="button" class="pes-inline-player-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(pes.id)}">
              <strong>${escapeHtml(pes.name)}</strong>
            </button>
            <div class="draft-sub">${pes.age} J. · ${escapeHtml(pes.playingStyle)} · Berater: ${escapeHtml(agent.agentName)} (${escapeHtml(agent.agency)})</div>
          </td>
          <td><span class="position-tag">${escapeHtml(pes.position || 'CM')}</span></td>
          <td>
            <button type="button" class="pes-stat-badge ${getPesStatTier(pes.rating)} pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(pes.id)}">
              <small>OVR</small>${pes.rating}
            </button>
          </td>
          <td><strong>~${contract.marketValue} Mio. €</strong></td>
          <td><strong>${contract.salary} Mio. € / Jahr</strong></td>
          <td>
            <span class="fm-contract-pill ${contract.isExpiring ? 'is-expiring' : 'is-safe'}">
              ${contract.isExpiring ? 'AUSLAUFEND · ' : 'AKTIV · '}${escapeHtml(contract.statusLabel)} (${contract.yearsRemaining} J.)
            </span>
          </td>
          <td><span>${contract.releaseClause} Mio. €</span></td>
          <td>
            <div class="fm-row-actions">
              <button type="button" class="button primary small" data-action="start-agent-extension" data-player-id="${escapeHtml(pes.id)}" title="Mit Spielerberater ${escapeHtml(agent.agentName)} über Gehalt, Laufzeit &amp; Unterschrift verhandeln">
                Mit Agent verhandeln
              </button>
              <button type="button" class="button light small" data-action="extend-contract" data-player-id="${escapeHtml(pes.id)}" data-years="2" title="Schnell-Verlängerung um 2 Jahre (Handgeld ${extendCost2} Mio. €)">
                +2 J. (${extendCost2}M)
              </button>
              <button type="button" class="button light small" data-action="release-player" data-player-id="${escapeHtml(pes.id)}" title="Spieler in die Free Agency entlassen">
                Freigeben
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tabContentHtml = `
      <section class="panel fm-scouting-panel">
        <div class="panel-header">
          <div>
            <h2>Vertragszentrale, Spieler-Agenten &amp; Gehaltsbudget · ${escapeHtml(activeClub?.name || '')}</h2>
            <div class="draft-sub">Verhandle Verträge direkt mit den Beratern deiner Spieler oder passe dein Transfer- und Gehaltsbudget im Finanzen-Tab an.</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="pes-team-kpi-pill">Gehaltsetat: ${totalAnnualPayroll.toFixed(1)} Mio. €/J. · Transferbudget: ${Number(activeClub?.budget ?? 150).toLocaleString('de-DE')} Mio. €</span>
            <button type="button" class="button primary small" data-view="finances">FIFA 17 Finanzen &amp; Budget-Regler</button>
          </div>
        </div>
        <div class="standings-scroll">
          <table class="player-table fm-scouting-table">
            <thead>
              <tr>
                <th>Spieler &amp; Berater</th>
                <th>Pos</th>
                <th>OVR</th>
                <th>Marktwert</th>
                <th>Jahresgehalt</th>
                <th>Vertragslaufzeit</th>
                <th>Ausstiegsklausel</th>
                <th>Agenten- &amp; Vertragsmanagement</th>
              </tr>
            </thead>
            <tbody>
              ${myPlayersRows || '<tr><td colspan="8" class="empty-table">Noch keine Spieler im Kader.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  } else {
    // 'market' tab: Hijack-Radar + 30 Clubs + Completed Transfers + Mail / Phone
    const clubsHtml = (league.teams ?? []).filter((t) => t.id !== managerId).map((team) => {
      const needs = analyzeTeamPositionNeeds(league, team.id, players);
      const topNeed = needs.missingPositions[0];
      const isOnline = onlineManagerIds.includes(team.id);
      const isHuman = team.managerType === 'human';
      return `
        <div class="fm-club-card">
          <div class="fm-club-card-head">
            <div>
              <strong>${escapeHtml(team.name)}</strong>
              <small>${escapeHtml(team.managerName || 'CPU')} · ${isHuman ? (isOnline ? 'SPIELER ONLINE' : 'SPIELER') : 'CPU-VEREIN (POSTFACH)'}</small>
            </div>
            <span class="pes-club-badge">${Number(team.budget ?? 150).toLocaleString('de-DE')} Mio. €</span>
          </div>
          <div class="fm-club-card-meta">
            <span>Kader: ${needs.rosterSize} / 30</span>
            <span>•</span>
            <span>${topNeed ? `Sucht ${topNeed.position} (${topNeed.count}/${topNeed.target})` : 'Alle Positionen besetzt'}</span>
          </div>
          <div class="fm-club-card-actions">
            <button type="button" class="button light small" data-action="filter-club-scouting" data-club-id="${escapeHtml(team.id)}">Kader scouten</button>
            <button type="button" class="button primary small" data-action="mail-offer-club" data-team-id="${escapeHtml(team.id)}">Mail-Angebot</button>
            ${isHuman ? `<button type="button" class="button light small" data-action="call-manager" data-team-id="${escapeHtml(team.id)}">Handy-Anruf</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const recentDealsHtml = (league.transfers ?? []).slice(-16).reverse().map((tr) => `
      <div class="calendar-agenda-row">
        <div>
          <strong>
            <button type="button" class="pes-inline-player-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(tr.playerId)}">
              <strong>${escapeHtml(tr.playerName)}</strong>
            </button>
            <span class="position-tag">${escapeHtml(tr.position || 'CM')}</span>
            <button type="button" class="pes-inline-ovr-btn" data-action="open-pes-player" data-player-id="${escapeHtml(tr.playerId)}">OVR ${Number(tr.rating) || 80}</button>
          </strong>
          <small>${escapeHtml(tr.sellerTeamName)} → ${escapeHtml(tr.buyerTeamName)} · ${escapeHtml(tr.reason || 'Transfer abgeschlossen')}</small>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <b class="calendar-score">${Number(tr.fee).toLocaleString('de-DE')} Mio. €</b>
          <button type="button" class="button light small" data-action="replay-transfer-signature" data-call-id="${escapeHtml(tr.callId)}">Vertrag &amp; Signatur</button>
        </div>
      </div>
    `).join('');

    tabContentHtml = `
      <section class="panel fm-hijack-radar-banner" style="margin-bottom:16px" aria-label="Hijack-Radar im Transfermarkt">
        <div class="panel-header">
          <div>
            <h2>Laufende Verhandlungen der Konkurrenz · Transfer-Hijack-Fenster</h2>
            <div class="draft-sub">Verhandlungen dauern 3 Runden (Sondierung, Ablöse &amp; Klauseln, Medizincheck). Solange noch nicht unterschrieben ist, kannst du jeden Deal mit einem höheren Angebot kapern!</div>
          </div>
          <button type="button" class="button light small" data-action="refresh-hijack-deals">Neue Runde / Deals aktualisieren</button>
        </div>
        ${renderHijackRadarSection(league, managerId, { compact: false })}
      </section>

      <div class="calendar-lower-grid">
        <section class="panel">
          <div class="panel-header">
            <h2>Liga-Vereine kontaktieren &amp; Kader inspizieren</h2>
            <span>29 VERHANDLUNGSPARTNER</span>
          </div>
          <div class="calendar-panel-body fm-clubs-grid">
            ${clubsHtml}
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>Abgeschlossene Transfers &amp; Free-Agency-Deals</h2>
            <span>${(league.transfers ?? []).length} DEALS</span>
          </div>
          <div class="calendar-panel-body">
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
              <button type="button" class="button primary small" data-action="trigger-cpu-market">CPU-Transfermarkt &amp; Anrufe simulieren</button>
              <button type="button" class="button light small" data-action="open-phone">Verhandlungs-Handy öffnen (${activeCallsCount})</button>
            </div>
            <div class="calendar-agenda-list">
              ${recentDealsHtml || '<div class="empty-state">Noch keine Transfers abgeschlossen.</div>'}
            </div>
          </div>
        </section>
      </div>
    `;
  }

  return `
    <section class="calendar-page transfer-command-page" aria-label="TransferHub Command Center">
      <div class="page-heading">
        <div>
          <div class="eyebrow">TRANSFERHUB · SCOUTING, FREE AGENCY &amp; FIFA 17 ONLINE-SYNC</div>
          <h1>TransferHub &amp; Scouting.</h1>
          <p>Spieler-Scouting (FIFA 17 Werte), Free Agency, 3-Runden-Hijacks und Live-Verhandlungen im Handy.</p>
        </div>
        <div class="calendar-heading-actions">
          <button type="button" class="button light small" data-action="export-fifa-players-csv">${icon('download', { size: 14 })} <span>FIFA 17 players.csv</span></button>
          <button type="button" class="button light small" data-action="trigger-cpu-market">${icon('phoneIncoming', { size: 14 })} <span>CPU-Anruf &amp; Markt</span></button>
          <button type="button" class="button primary small" data-action="open-phone">${icon('smartphone', { size: 14 })} <span>Verhandlungs-Handy (${activeCallsCount})</span></button>
        </div>
      </div>

      <div class="calendar-stats">
        <div class="panel calendar-stat">
          <small>BUDGET &amp; GEHALT (${escapeHtml(activeClub?.name || '')})</small>
          <strong>${Number(activeClub?.budget ?? 150).toLocaleString('de-DE')} Mio. € <i>· ${totalAnnualPayroll.toFixed(1)} Mio./J. (${windowOpen ? 'Fenster offen' : 'Geschlossen'})</i></strong>
        </div>
        <div class="panel calendar-stat">
          <small>SCOUTING &amp; TALENTE</small>
          <strong>${scoutedReportsCount} Berichte <i>· ${generatedTalents.length} Talente · ${freeAgents.length} Free Agents</i></strong>
        </div>
        <div class="panel calendar-stat">
          <small>HIJACK-RADAR &amp; ANRUFE</small>
          <strong>${openHijackDeals.length} Hijacks <i>· ${activeCallsCount} Anrufe · ${myExpiringCount} Verträge offen</i></strong>
        </div>
      </div>

      ${subTabsHtml}
      ${tabContentHtml}
    </section>
  `;
}
