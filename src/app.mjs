import { assignManagersToTeams, autoDraftAllPicks, canManagerAutoDraft, canManagerPick, canManagerSimulateCpu, getDraftTargetPicks, MAX_DRAFT_POOL, mergeRosterPools, parseRosterCsv, shuffle, simulateCpuPicksUntilHumanTurn } from './league-core.mjs';
import { initStadiumTitleMotion, triggerTitleEntranceSpring } from './title-motion.mjs';
import {
  autoFillStartingEleven,
  getTeamRoster,
  getTeamSquad,
  isLeagueHost,
  resolveTeamShirtNumbers,
  setPlayerShirtNumber,
  setSquadFormation,
  setSquadTacticalPreset,
  setStartingPlayer,
  SQUAD_SLOTS,
} from './squad-core.mjs';
import { renderSquadView } from './squad-view.mjs';
import { approveHumanFixture, ensureCalendar, getBlockingHumanFixtures, getNextCalendarStepDate, isDraftComplete, recordHumanFixtureResult, simulateEntireSeason, simulateThroughDate, teamStrength } from './calendar-core.mjs';
import { renderCalendarView, renderStandingsTable } from './calendar-view.mjs';
import { createKnockoutBracket, ensureKnockoutBracket, getNextKnockoutRoundKey, isLeaguePhaseComplete, recordKnockoutMatchScore, simulateEntireKnockout, simulateKnockoutRound } from './knockout-core.mjs';
import { renderKnockoutView } from './knockout-view.mjs';
import { seedTeams } from './teams.mjs';
import {
  acceptOffer,
  analyzeTeamPositionNeeds,
  calculatePlayerMarketValue,
  cpuAnswersCall,
  createCall,
  declineOffer,
  ensureHijackableDeals,
  evaluateCpuOfferResponse,
  hijackTransferDeal,
  isTransferWindowOpen,
  rankTeamsFromResults,
  recordManagerSignature,
  resolveCompetingHijack,
  respondToCall,
  rosterNeedForTeam,
  simulateCpuTransferMarketStep,
  submitOffer,
  triggerRivalHijackOnCall,
} from './transfer-core.mjs';
import { addNewsComment, appendNewsEvent, buildNewsFeed, createCustomNewsPost, detectSimulationNewsEvents, toggleNewsLike, toggleNewsRepost } from './news-core.mjs';
import { buildMatchDefeatSlanderPost, generateXFootballComments } from './twitter-slander-engine.mjs';
import { renderNewsView } from './news-view.mjs';
import {
  applyPesLiveMatchSync,
  buildFifa15AutoFriendlyMacro,
  buildFifa15BrowserUrl,
  buildFifa15SuperLeagueModPackage,
  calculateTeamPesStrength,
  computeGameDbHash,
  confirmManagerDbSync,
  derivePesProfile,
  ESL_LOGO_ASSET_PATH,
  exportFifaFormationsCsv,
  exportFifaRdbmPlayersCsv,
  exportFifaTeamPlayerLinksCsv,
  exportPesEditorCsv,
  exportPesSiderJson,
  generateFifa15RoomCode,
  generatePesSiderLuaScript,
  getPesStatTier,
  sanitizeFifa15RoomCode,
  syncPlayersWithLeague,
  updateOnlineLobbySettings,
} from './pes-core.mjs';
import { renderPesMatchHubSuite, renderPesPlayerModal } from './pes-view.mjs';
import {
  extendPlayerContract,
  generateRandomTalents,
  getPlayerContract,
  getPlayerScoutingReport,
  releasePlayerToFreeAgency,
  scoutPlayer,
  signFreeAgent,
  toggleShortlistPlayer,
} from './scouting-talent-core.mjs';
import { renderCommandTransferHubView } from './transfer-hub-view.mjs';
import {
  adjustTeamBudgetSplit,
  createAgentNegotiationSession,
  ensureMailInboxInitialized,
  finalizeAgentDealWithSignature,
  getTeamFinanceSummary,
  markMailRead,
  renderAgentNegotiationModal,
  renderFinanceTabView,
  renderMailInboxView,
  renderStaticSignatureCard,
  respondToMailOffer,
  sendMailTransferOffer,
  submitAgentContractOffer,
} from './mail-finance-agent.mjs';
import {
  buildShowreelFrameSvg,
  playShowreelSoundtrack,
  SHOWREEL_DURATION,
  stopShowreelSoundtrack,
} from './deal-done-showreel.mjs';
import { icon } from './icons.mjs';
import { renderClubPageView, renderMatchReportModal } from './club-page-view.mjs';
import {
  bindCrystalStarballActions,
  mountCrystalStarball3D,
  renderCrystalStarballStage,
  setAllCrystalStarballsButtonOpen,
  unmountAllCrystalStarballs,
} from './crystal-ball-3d.mjs';

const KEY = 'career-versuch-2-state-v1';
const SESSION_KEY = 'career-versuch-2-manager-session-v1';
const DASHBOARD_VIEWS = {
  overview: 'Übersicht',
  setup: 'Liga-Setup',
  draft: 'Snake Draft',
  calendar: 'Saisonkalender',
  mail: 'Postfach & Angebote',
  transfers: 'TransferHub & Scouting',
  finances: 'Finanzen & Gehalt',
  news: 'NewsHub',
  squad: 'Squad Hub',
  table: 'Ligatabelle',
  club: 'Vereinspage',
  knockout: 'K.-o.-Phase & Playoffs',
  matches: 'Match Hub',
  log: 'Admin-Protokoll',
};
const PHONE_APPS = {
  home: 'Verhandlungs-Zentrale',
  transfers: 'Schnell-Verhandlungen (Spieler)',
};
const DEFAULT_SIGNATURE_PATH = 'M8 39 C22 38 19 15 27 17 C32 18 22 44 30 41 C39 37 39 22 44 22 C48 22 41 41 48 39 C59 34 58 24 64 25 C69 26 63 39 70 37 C81 32 86 18 91 19 C97 21 87 39 96 37 C105 35 106 26 112 28 C117 30 110 40 119 38 C131 35 133 28 140 29 C149 30 150 38 170 34';

const root = document.querySelector('#view-root');
let state = loadState();
normalizeSuperLeagueBranding();
const initialHash = location.hash.slice(1);
let currentView = initialHash in DASHBOARD_VIEWS ? initialHash : 'overview';
const skipTitleByQuery = new URLSearchParams(location.search).has('autostart');
let titleScreenOpen = !skipTitleByQuery;
let titleJoinModalOpen = false;
let setupBuilderOpen = false;
let phoneOpen = false;
let activePhoneApp = 'transfers';
let phoneViewMode = 'front'; // 'front' | 'back'
let phoneWideMode = false;
let phoneFullscreen = false;
let phoneTransferTab = 'room'; // 'room' | 'clubs' | 'deals'
let txHubTab = 'scouting'; // 'scouting' | 'mail' | 'freeagency' | 'contracts' | 'market'
let selectedMailId = '';
let selectedMailFilter = 'all';
let preselectedMailTargetTeamId = '';
let preselectedMailPlayerId = '';
let activeAgentNegotiationId = '';
let agentSignatureStrokes = [];
let showreelRafId = null;
let showreelStartTime = 0;
let showreelActiveTab = 'showreel'; // 'showreel' | 'contract'
let fmClubFilter = 'all';
let fmPositionFilter = 'all';
let fmScoutingFilter = 'all';
let fmSearchQuery = '';
let setupLeagueFilter = 'all';
let setupManagers = [
  { id: 'mgr-1', name: 'Admin', teamId: 'club-7' },
];
let preselectedNegotiationPlayerId = '';
let selectedKnockoutMatchId = '';
let cachedCleanTrophyDataUrl = '';
let cachedCleanEslLogoDataUrl = '';
let phoneVibrating = false;
let vibrationTimer;
let lastVibratedCallKey = '';
let toastTimer;
let callIslandTimer;
let signingTimer;
let activeSigningCallId = '';
let recordedSignatureStrokes = [];
let sharedRevision = 0;
let sharedReady = false;
let applyingSharedState = false;
let saveQueue = Promise.resolve();
let onlineManagerIds = [];
let syncTimer;
let presenceTimer;
let selectedSquadTeamId = '';
let selectedSquadPlayerId = '';
let selectedCalendarDate = '';
let isSimulatingCalendarLive = false;
let liveCalendarSimTimer = null;
let liveSimSpeedMs = 420;
let selectedNewsCategory = 'all';
let expandedNewsCommentsPostId = '';
let csvImportMode = 'replace';
let inspectedPesPlayerId = '';
let selectedClubPageId = '';
let clubPageTab = 'overview';
let previousViewBeforeClub = 'table';
let tableSubTab = 'table';
let inspectedMatchFixtureId = '';
let pesHubTab = 'strength'; // 'strength' | 'export' | 'editmode' | 'parsec'
let pesHomeTeamId = '';
let pesAwayTeamId = '';
let pesCheckedExportIds = [];
let pesConnectionMode = 'parsec';
let fifa15StreamActive = false;
let fifa15StreamRole = 'host';
let fifa15CinemaMode = false;
let fifa15HudVisible = true;
let fifa15CalendarArenaOpen = false;
const sessionId = sessionStorage.getItem(`${SESSION_KEY}-id`) || globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random()}`;
sessionStorage.setItem(`${SESSION_KEY}-id`, sessionId);

function loadState() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? { players: [], league: null, log: [] }; }
  catch { return { players: [], league: null, log: [] }; }
}
function normalizeSuperLeagueBranding() {
  if (state?.league) {
    if (!state.league.name || /career/i.test(state.league.name)) {
      state.league.name = 'Super League';
    }
    if (state.league.match?.status && /SPFL|PES|Football Life|FIFA 16/i.test(state.league.match.status)) {
      state.league.match.status = 'Lobby bereit · FIFA 17 Online';
    }
    if (Array.isArray(state.league.calls)) {
      state.league.calls = state.league.calls.filter(
        (c) => !(c.status === 'ringing' && (c.isCpuCall || /^CPU\b/i.test(String(c.callerManagerName || '')))),
      );
    }
  }
}
function enterSuperLeague(targetView = '') {
  titleScreenOpen = false;
  titleJoinModalOpen = false;
  phoneOpen = false;
  document.body.dataset.state = 'app';
  if (targetView && targetView in DASHBOARD_VIEWS) {
    currentView = targetView;
    history.replaceState(null, '', `#${currentView}`);
  }
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}
let lastTitleScreenSig = '';
function renderTitleScreen(force = false) {
  const titleRoot = document.querySelector('#title-screen-root');
  if (!titleRoot) return;
  document.body.dataset.state = titleScreenOpen ? 'title' : 'app';
  if (!titleScreenOpen) {
    lastTitleScreenSig = '';
    unmountAllCrystalStarballs();
    titleRoot.innerHTML = '';
    return;
  }
  const league = activeLeague();
  const hasSavedLeague = Boolean(league && Array.isArray(league.teams) && league.teams.length > 0);
  const humanTeams = (league?.teams ?? []).filter((t) => t.managerType === 'human');
  const allTeams = league?.teams ?? seedTeams;
  const currentMgr = activeManager();
  const sig = `${titleJoinModalOpen}|${hasSavedLeague}|${league?.name || ''}|${league?.season || ''}|${currentMgr?.id || ''}|${humanTeams.map((t) => `${t.id}:${t.managerName}`).join(',')}`;
  if (!force && sig === lastTitleScreenSig && titleRoot.innerHTML.trim() !== '') {
    const existingMount = titleRoot.querySelector('#sl-title-crystal-ball');
    if (existingMount) mountCrystalStarball3D(existingMount, { variant: 'title' });
    return;
  }
  lastTitleScreenSig = sig;
  const continueSub = hasSavedLeague
    ? `${escapeHtml(league.name || 'Super League')} · ${escapeHtml(league.season || '2026/27')}${currentMgr ? ` · ${escapeHtml(currentMgr.managerName || currentMgr.name)} (${escapeHtml(currentMgr.name)})` : ''}`
    : '';

  const joinPanelHtml = titleJoinModalOpen ? `
    <div class="sl-join-drawer" role="dialog" aria-label="Liga beitreten">
      <div class="sl-join-drawer-head">
        <h3>Liga beitreten &amp; Verein übernehmen</h3>
        <button type="button" class="sl-join-close" data-action="close-title-join" aria-label="Schließen">×</button>
      </div>
      ${hasSavedLeague && humanTeams.length > 0 ? `
        <div class="sl-join-existing">
          <span class="sl-join-label">Aktive Manager:</span>
          <div class="sl-join-pills">
            ${humanTeams.map((t) => `
              <button type="button" class="sl-join-manager-pill ${currentMgr?.id === t.id ? 'is-current' : ''}" data-action="title-quick-join-manager" data-team-id="${escapeHtml(t.id)}">
                <strong>${escapeHtml(t.managerName || t.name)}</strong>
                <span>${escapeHtml(t.name)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
      <form id="title-join-league-form" class="sl-join-form">
        <div class="sl-join-field">
          <label for="title-join-name">Manager-Name</label>
          <input id="title-join-name" name="managerName" type="text" placeholder="z. B. Lukas" maxlength="35" required>
        </div>
        <div class="sl-join-field">
          <label for="title-join-team">Verein</label>
          <select id="title-join-team" name="teamId">
            ${allTeams.map((t) => `
              <option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}${t.managerType === 'human' ? ` · [${escapeHtml(t.managerName)}]` : ''}</option>
            `).join('')}
          </select>
        </div>
        <div class="sl-join-field">
          <label for="title-join-code">Lobby-Code</label>
          <input id="title-join-code" name="roomCode" type="text" value="${escapeHtml(league?.onlineLobby?.networkRoomName || 'SUPER-LEAGUE-26')}" maxlength="40">
        </div>
        <button type="submit" class="liquid-glass-btn sl-join-submit">
          <span class="sl-cta-main">BEITRETEN</span>
        </button>
      </form>
    </div>
  ` : '';

  titleRoot.innerHTML = `
    <div class="sl-title-screen">
      <header class="sl-title-topbar">
        <span class="sl-meta-label">EUROPEAN SUPER LEAGUE</span>
        <span class="sl-meta-code">SAISON 2026/27 · 30 VEREINE</span>
      </header>

      <main class="sl-title-hero">
        <div class="sl-title-esl-emblem-wrap is-3d-crystal-wrap">
          ${renderCrystalStarballStage({
            mountId: 'sl-title-crystal-ball',
            variant: 'title',
          })}
        </div>
        <h1 class="sl-hero-wordmark" aria-label="SUPER LEAGUE">
          <span class="sl-word-mask"><span class="sl-word-inner" style="--word-idx:0">SUPER</span></span>
          <span class="sl-word-mask"><span class="sl-word-inner" style="--word-idx:1">LEAGUE</span></span>
        </h1>

        <nav class="sl-title-actions" aria-label="Super League Startoptionen">
          <button type="button" class="liquid-glass-btn is-primary" style="--opt-idx:0" data-action="title-continue-league">
            <div class="sl-btn-copy">
              <span class="sl-cta-main">LIGA FORTSETZEN</span>
              ${continueSub ? `<small class="sl-cta-sub">${continueSub}</small>` : ''}
            </div>
            <span class="sl-btn-badge" aria-hidden="true">ÖFFNEN <b class="sl-btn-arrow">→</b></span>
          </button>

          <div class="sl-liquid-btn-row">
            <button type="button" class="liquid-glass-btn is-secondary" style="--opt-idx:1" data-action="title-new-league">
              <span class="sl-cta-main">NEUE LIGA STARTEN</span>
              <span class="sl-btn-arrow-circle" aria-hidden="true">→</span>
            </button>

            <button type="button" class="liquid-glass-btn is-secondary ${titleJoinModalOpen ? 'is-active' : ''}" style="--opt-idx:2" data-action="title-join-league">
              <span class="sl-cta-main">LIGA BEITRETEN</span>
              <span class="sl-btn-arrow-circle" aria-hidden="true">→</span>
            </button>
          </div>
        </nav>
        ${joinPanelHtml}
      </main>
    </div>
  `;
  cleanEslLogoBackground();
  bindCrystalStarballActions(document);
  const titleBallMount = titleRoot.querySelector('#sl-title-crystal-ball');
  if (titleBallMount) {
    mountCrystalStarball3D(titleBallMount, { variant: 'title' });
    setAllCrystalStarballsButtonOpen(titleJoinModalOpen);
  }
}
function activeManager() {
  const id = sessionStorage.getItem(`${SESSION_KEY}-manager`);
  return state.league?.teams?.find((team) => team.id === id) ?? state.league?.teams?.find((team) => team.managerType === 'human') ?? null;
}
function setSyncLabel(label) {
  const el = document.querySelector('.save-state');
  if (el) el.textContent = label;
}
function triggerPhoneVibration(reason = '') {
  phoneVibrating = true;
  try {
    if (globalThis.navigator?.userActivation?.hasBeenActive) {
      globalThis.navigator?.vibrate?.([180, 90, 180, 90, 240]);
    }
  } catch { /* ignore unsupported vibrate */ }
  clearTimeout(vibrationTimer);
  const phoneShell = document.querySelector('#phone-shell-root');
  phoneShell?.classList.add('is-vibrating');
  document.querySelector('[data-action="open-phone"]')?.classList.add('is-vibrating');
  if (reason) toast(reason);
  vibrationTimer = setTimeout(() => {
    phoneVibrating = false;
    document.querySelector('#phone-shell-root')?.classList.remove('is-vibrating');
    document.querySelector('[data-action="open-phone"]')?.classList.remove('is-vibrating');
  }, 2600);
}
function checkIncomingVibration() {
  const manager = activeManager();
  if (!manager || !state.league) return;
  const calls = state.league.calls ?? [];
  const incoming = calls.find(
    (c) => c.targetTeamId === manager.id && c.status === 'ringing' && !c.isCpuCall && !/^CPU\b/i.test(String(c.callerManagerName || '')),
  );
  const pendingOfferCall = calls.find((c) => {
    if (c.isCpuCall || /^CPU\b/i.test(String(c.callerManagerName || ''))) return false;
    if (![c.callerTeamId, c.targetTeamId].includes(manager.id) || c.status !== 'negotiating') return false;
    const last = c.offers?.at(-1);
    return last && last.status === 'pending' && last.fromTeamId !== manager.id;
  });
  const alertCall = incoming || pendingOfferCall;
  if (!alertCall) return;
  const alertKey = `${alertCall.id}:${alertCall.status}:${alertCall.offers?.length || 0}`;
  if (alertKey !== lastVibratedCallKey) {
    lastVibratedCallKey = alertKey;
    const callerName = incoming ? `${incoming.callerManagerName} (${incoming.callerTeamName})` : 'Neues Transferangebot';
    triggerPhoneVibration(`Eingehender Anruf: ${callerName}`);
  }
}
async function applySharedState(next) {
  const previous = state;
  applyingSharedState = true;
  state = next && typeof next === 'object' ? next : { players: [], league: null, log: [] };
  state.players ??= []; state.log ??= [];
  normalizeSuperLeagueBranding();
  localStorage.setItem(KEY, JSON.stringify(state));
  refreshManagerSelector();
  checkIncomingVibration();
  render();
  announceNewTransfer(previous, state);
  applyingSharedState = false;
}
function refreshManagerSelector() {
  const select = document.querySelector('#active-manager');
  const league = state.league;
  if (!select || !league) { if (select) select.hidden = true; return; }
  const current = activeManager();
  select.innerHTML = league.teams.map((team) => `<option value="${escapeHtml(team.id)}" ${team.id === current?.id ? 'selected' : ''}>${escapeHtml(team.managerName || team.name)} · ${escapeHtml(team.name)}${team.managerType === 'cpu' ? ' (Testslot)' : ''}</option>`).join('');
  select.hidden = false;
}
async function initializeSharedState() {
  try {
    const response = await fetch('/api/state');
    const remote = await response.json();
    if (!remote.state && (state.league || state.players.length || state.log.length)) {
      const created = await fetch('/api/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision: remote.revision, state }) });
      const result = await created.json();
      sharedRevision = result.revision ?? remote.revision;
    } else if (remote.state) { state = remote.state; sharedRevision = remote.revision; normalizeSuperLeagueBranding(); }
    sharedReady = true;
    localStorage.setItem(KEY, JSON.stringify(state));
    refreshManagerSelector();
    checkIncomingVibration();
    render();
    await loadDefaultPlayerPool();
    await heartbeatPresence();
    setSyncLabel('Mit diesem PC synchronisiert');
    syncTimer = setInterval(pollSharedState, 1800);
    presenceTimer = setInterval(heartbeatPresence, 5000);
  } catch {
    await loadDefaultPlayerPool();
    setSyncLabel('Nur dieser Browser');
  }
}
function ensureGeneratedTalentsInPool(count = 16) {
  const existingTalents = (state.players ?? []).filter((p) => p.isGeneratedTalent);
  if (existingTalents.length >= 6) return 0;
  const usedIds = new Set((state.players ?? []).map((p) => p.id));
  const talents = generateRandomTalents(count, {
    seed: `${state.league?.name || 'career'}-${state.league?.season || '2026'}-init`,
    existingIds: usedIds,
  });
  state.players = [...(state.players ?? []), ...talents];
  return talents.length;
}
async function loadDefaultPlayerPool() {
  const realCount = (state.players ?? []).filter((p) => !p.isGeneratedTalent).length;
  if (realCount >= MAX_DRAFT_POOL) {
    ensureGeneratedTalentsInPool(16);
    return;
  }
  try {
    const response = await fetch('/data/fm26-top-players.csv');
    if (!response.ok) return;
    const players = parseRosterCsv(await response.text());
    if (!players.length) return;
    const merged = state.players.length ? mergeRosterPools(state.players, players) : players;
    state.players = merged;
    ensureGeneratedTalentsInPool(16);
    logAction('Super League Spielerpool & Talente geladen', `${state.players.length} Spieler inkl. zufallsgenerierter Wunderkinder geladen`);
    save();
    await saveQueue;
    render();
  } catch { setSyncLabel('Standard-Spielerpool konnte nicht geladen werden'); }
}
async function heartbeatPresence() {
  const manager = activeManager();
  if (!manager || !sharedReady) return;
  try {
    await fetch('/api/presence', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, managerId: manager.id }) });
    const response = await fetch('/api/presence');
    const nextOnline = (await response.json()).managerIds ?? [];
    if (nextOnline.slice().sort().join('|') !== onlineManagerIds.slice().sort().join('|')) {
      onlineManagerIds = nextOnline;
      if (phoneOpen) renderPhoneShell();
    }
  } catch { /* polling updates the connection label */ }
}
async function pollSharedState() {
  try {
    const response = await fetch('/api/state'); const payload = await response.json();
    if (payload.revision > sharedRevision && !document.activeElement?.matches('input,textarea,select,canvas')) {
      sharedRevision = payload.revision;
      await applySharedState(payload.state);
      await heartbeatPresence();
    }
  } catch { setSyncLabel('Verbindung unterbrochen'); }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  if (!sharedReady || applyingSharedState) return;
  saveQueue = saveQueue.then(async () => {
    const response = await fetch('/api/state', {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: sharedRevision, state }),
    });
    const payload = await response.json();
    if (response.status === 409) {
      sharedRevision = payload.revision;
      await applySharedState(payload.state);
      toast('Super League wurde im anderen Browser geändert. Der aktuelle gemeinsame Stand wurde geladen.');
      return;
    }
    if (!response.ok) throw new Error(payload.error || 'Gemeinsamer Spielstand konnte nicht gespeichert werden.');
    sharedRevision = payload.revision;
    setSyncLabel('Lokal synchronisiert');
  }).catch(() => setSyncLabel('Synchronisierung unterbrochen'));
}
function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function toast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3100);
}
function logAction(action, detail) {
  state.log.unshift({ action, detail, at: new Date().toISOString(), actor: activeManager()?.managerName || state.league?.adminName || 'Admin' });
  state.log = state.log.slice(0, 200);
}
function openPhoneApp(appName = 'transfers') {
  if (appName === 'calendar' || appName === 'news') {
    phoneOpen = false;
    phoneFullscreen = false;
    setView(appName);
    return;
  }
  phoneOpen = true;
  phoneViewMode = 'front';
  activePhoneApp = appName === 'home' ? 'home' : 'transfers';
  renderPhoneShell();
}
function setView(view) {
  if (view === 'draft') {
    if (!state.league) {
      toast('Schritt 1: Wähle zuerst die 30 Mannschaften im Liga-Setup aus!');
      currentView = 'setup';
      history.replaceState(null, '', '#setup');
      render();
      return;
    }
    if (isDraftComplete(state.league, state.players)) {
      toast('Der Snake Draft ist bereits vollständig abgeschlossen — der Draft-Tab ist gesperrt.');
      currentView = 'calendar';
      history.replaceState(null, '', '#calendar');
      render();
      return;
    }
  }
  if (view !== 'calendar' && isSimulatingCalendarLive) {
    stopLiveCalendarSimulation();
  }
  phoneOpen = false;
  phoneFullscreen = false;
  currentView = DASHBOARD_VIEWS[view] ? view : 'overview';
  history.replaceState(null, '', `#${currentView}`);
  render();
}
function activeLeague() { return state.league; }
function getRealDraftPool() {
  const real = (state.players ?? []).filter((p) => !p.isGeneratedTalent);
  return real.length ? real : (state.players ?? []);
}
function draftTeamAt(index) {
  const order = state.league?.draft?.order ?? [];
  if (!order.length) return null;
  const round = Math.floor(index / order.length);
  const offset = index % order.length;
  return order[round % 2 === 0 ? offset : order.length - 1 - offset];
}
function nextPick() {
  const league = activeLeague();
  if (!league) return null;
  const realPool = getRealDraftPool();
  const targetPicks = getDraftTargetPicks(league.teams?.length || 30, realPool.length);
  if (league.draft.picks.length >= targetPicks) return null;
  const teamId = draftTeamAt(league.draft.picks.length);
  return league.teams.find((team) => team.id === teamId) ?? null;
}
function initials(name = '') {
  return String(name).replace(/[^A-Za-zÄÖÜäöüß0-9\s]/g, ' ').trim().split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase() || 'FC';
}
function pageHeader(kicker, title, subtitle, action = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}
function renderHeroTrophyShowcase(championName = '') {
  return `
    <div class="hero-trophy-stage is-crystal-showcase" aria-label="Interaktiver 3D Super League Kristallball">
      ${renderCrystalStarballStage({
        mountId: 'sl-overview-crystal-ball',
        variant: 'hero',
        caption: `SUPER LEAGUE 3D KRISTALLBALL · ${escapeHtml(championName || '360° FREI SPINNBAR')}`,
      })}
    </div>
  `;
}

function renderOverview() {
  const league = activeLeague();
  if (!league) return `<section class="welcome-card"><div class="welcome-copy"><div class="eyebrow">EUROPEAN SUPER LEAGUE</div><h1>SUPER LEAGUE.<br>EUER SPIELFELD.</h1><p>Wählt eure 30 Vereine, draftet eure Kader im Snake Draft und startet direkt in die Saison.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="button primary" data-action="go-setup">Liga-Setup starten</button><button class="button light" data-view="transfers">TransferHub</button><button class="button light" data-view="news">NewsHub</button></div></div>${renderHeroTrophyShowcase('30 Teams · 1 Champion')}</section>`;

  const realPool = getRealDraftPool();
  const targetPicks = getDraftTargetPicks(league.teams.length, realPool.length);
  const draftDone = isDraftComplete(league, realPool);
  const draftPct = targetPicks ? Math.min(100, Math.round((league.draft.picks.length / targetPicks) * 100)) : 0;
  const manager = activeManager();
  const managerTeam = league.teams.find((t) => t.id === manager?.id) || league.teams[0];
  const isHost = isLeagueHost(league, manager?.id);

  if (!draftDone) {
    return `${pageHeader('EUROPEAN SUPER LEAGUE', 'Snake Draft aktiv', `${league.draft.picks.length} von ${targetPicks} Spielern gewählt (${draftPct}%).`, `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="button primary" data-view="draft">Zum Snake Draft</button>${canManagerAutoDraft(activeManager(), league.adminName) ? '<button class="button light" data-action="auto-draft-all">Auto-Draft</button>' : ''}<button class="button light" data-action="reset-local">Zurücksetzen</button></div>`)}
      <section class="welcome-card">
        <div class="welcome-copy">
          <div class="eyebrow">${escapeHtml(league.season)} · DRAFT PHASE</div>
          <h1>${escapeHtml(league.name)}</h1>
          <p>Schließe den Snake Draft ab (${league.draft.picks.length} / ${targetPicks} Picks), um den Spielbetrieb freizuschalten.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="button primary" data-view="draft">Zum Snake Draft</button>
            ${canManagerAutoDraft(activeManager(), league.adminName) ? '<button class="button light" data-action="auto-draft-all">Auto-Draft</button>' : ''}
            <button class="button light" data-action="open-phone">Verhandlungs-Handy</button>
          </div>
        </div>
        ${renderHeroTrophyShowcase('30 Teams · Snake Draft')}
      </section>`;
  }

  // --- WIDGET 1: NEWS & SOCIAL TICKER ---
  const allNews = buildNewsFeed(league);
  const topNews = allNews.slice(0, 4);
  const newsItemsHtml = topNews.length ? topNews.map((post) => {
    const isSlander = post.category === 'hatercentral' || post.type === 'defeat-slander';
    return `
      <article class="widget-news-item ${isSlander ? 'is-slander' : ''}" data-view="news">
        <div class="widget-news-head">
          <span class="widget-news-avatar">${escapeHtml(post.authorAvatar || 'CI')}</span>
          <div class="widget-news-author">
            <strong>${escapeHtml(post.authorName || 'Career Insider')}</strong>
            <small>${escapeHtml(post.authorHandle || '@career_insider')}</small>
          </div>
          <span class="widget-news-badge ${isSlander ? 'is-flame' : ''}">${escapeHtml(post.badge || 'LIGA')}</span>
        </div>
        <p class="widget-news-text">${escapeHtml(post.text)}</p>
        <div class="widget-news-footer">
          <span class="widget-news-comments">${(post.comments?.length || 0)} Reaktionen</span>
          <button type="button" class="widget-mini-link" data-view="news">Im NewsHub ansehen →</button>
        </div>
      </article>
    `;
  }).join('') : '<div class="widget-empty">Noch keine Liga-Meldungen vorhanden.</div>';

  const newsWidgetHtml = `
    <section class="widget-card is-news" aria-label="Widget: NewsHub">
      <div class="widget-card-header">
        <div class="widget-card-title">
          <span class="widget-badge is-live">${icon('news', { size: 14 })} LIVE TICKER</span>
          <h3>News &amp; Social Slander</h3>
        </div>
        <button type="button" class="widget-header-btn" data-view="news">NewsHub (${allNews.length}) →</button>
      </div>
      <div class="widget-card-body widget-scrollable">
        ${newsItemsHtml}
      </div>
    </section>
  `;

  // --- WIDGET 2: AUFSTELLUNG DES TEAMS (4-3-3 Pitch) ---
  const teamRoster = getTeamRoster(league, managerTeam.id, state.players);
  const shirtNumbers = resolveTeamShirtNumbers(league, managerTeam.id, teamRoster);
  const squad = getTeamSquad(league, managerTeam.id);
  const startersCount = Object.values(squad.starters).filter(Boolean).length;
  const teamStrength = calculateTeamPesStrength(managerTeam.id, league, state.players);
  const rosterById = new Map(teamRoster.map((p) => [p.id, p]));

  const pitchSlotsHtml = SQUAD_SLOTS.map((slot) => {
    const pId = squad.starters[slot.id];
    const p = pId ? rosterById.get(pId) : null;
    const shirt = p ? (shirtNumbers[p.id] || p.shirtNumber || '') : '';
    return `
      <div class="widget-pitch-slot ${p ? 'is-filled' : 'is-empty'}" style="--slot-x:${slot.x}%;--slot-y:${slot.y}%;" title="${p ? `${p.name} (${slot.label})` : `${slot.label}: Frei`}">
        <span class="widget-slot-role">${escapeHtml(slot.id)}${shirt ? ` · #${shirt}` : ''}</span>
        <span class="widget-slot-name">${p ? escapeHtml(p.name) : 'Offen'}</span>
        ${p ? `<span class="widget-slot-ovr" role="button" tabindex="0" data-action="open-pes-player" data-player-id="${escapeHtml(p.id)}" title="FIFA 17 Werte öffnen">OVR ${p.rating || 80}</span>` : ''}
      </div>
    `;
  }).join('');

  const squadWidgetHtml = `
    <section class="widget-card is-squad" aria-label="Widget: Aufstellung des Teams">
      <div class="widget-card-header">
        <div class="widget-card-title">
          <span class="widget-badge is-gold">${icon('squad', { size: 14 })} STARTELF · 4-3-3</span>
          <h3>Aufstellung · ${escapeHtml(managerTeam.name)}</h3>
        </div>
        <div class="widget-header-meta">
          <span class="widget-strength-pill" title="FIFA 17 Teamstärke">STÄRKE <b>${teamStrength.overall || teamStrength.ovr || 80}</b></span>
          <button type="button" class="widget-header-btn" data-view="squad">Squad Hub →</button>
        </div>
      </div>
      <div class="widget-card-body widget-pitch-container">
        <div class="widget-pitch-field">
          <div class="pitch-line pitch-halfway"></div>
          <div class="pitch-circle"></div>
          <div class="pitch-box pitch-box-top"></div>
          <div class="pitch-box pitch-box-bottom"></div>
          ${pitchSlotsHtml}
        </div>
        <div class="widget-pitch-footer">
          <span>${startersCount}/11 Startplätze besetzt</span>
          <span class="widget-sub-meta">${teamRoster.length} Spieler im Kader · ${escapeHtml(managerTeam.managerName || 'Manager')}</span>
          <button type="button" class="widget-mini-link" data-view="squad">Taktik bearbeiten →</button>
        </div>
      </div>
    </section>
  `;

  // --- WIDGET 3: NÄCHSTE SPIELE (Fixtures Stream) ---
  const schedule = league.schedule ?? [];
  const currentDateIso = league.currentDate || '2026-08-01';
  const teamsById = new Map(league.teams.map((t) => [t.id, t]));
  const upcomingFixtures = schedule
    .filter((f) => f.date >= currentDateIso && f.status !== 'completed')
    .slice(0, 6);

  const fixtureItemsHtml = upcomingFixtures.length ? upcomingFixtures.map((f) => {
    const homeTeam = teamsById.get(f.homeId);
    const awayTeam = teamsById.get(f.awayId);
    const isUserMatch = homeTeam?.id === managerTeam.id || awayTeam?.id === managerTeam.id;
    const isHumanMatch = homeTeam?.managerType === 'human' && awayTeam?.managerType === 'human';
    const isToday = f.date === currentDateIso;
    return `
      <div class="widget-fixture-row ${isUserMatch ? 'is-user-match' : ''} ${isHumanMatch ? 'is-human-duel' : ''}">
        <div class="widget-fixture-meta">
          <span class="widget-fixture-round">ST ${f.round}</span>
          <span class="widget-fixture-date ${isToday ? 'is-today' : ''}">${isToday ? 'HEUTE' : escapeHtml(f.date)}</span>
          ${isHumanMatch ? '<span class="widget-human-tag">1v1 AURA</span>' : ''}
        </div>
        <div class="widget-fixture-teams">
          <span class="widget-fixture-team ${homeTeam?.id === managerTeam.id ? 'is-highlight' : ''}">${escapeHtml(homeTeam?.name || f.homeId)}</span>
          <span class="widget-fixture-vs">vs</span>
          <span class="widget-fixture-team ${awayTeam?.id === managerTeam.id ? 'is-highlight' : ''}">${escapeHtml(awayTeam?.name || f.awayId)}</span>
        </div>
        <div class="widget-fixture-actions">
          ${isHumanMatch ? `
            <button type="button" class="widget-action-btn is-play" data-view="matches" title="Match öffnen">SPIELEN</button>
          ` : `
            <span class="widget-sim-badge">CPU</span>
          `}
        </div>
      </div>
    `;
  }).join('') : '<div class="widget-empty">Alle regulären Saisonspiele abgeschlossen!</div>';

  const fixturesWidgetHtml = `
    <section class="widget-card is-fixtures" aria-label="Widget: Nächste Spiele">
      <div class="widget-card-header">
        <div class="widget-card-title">
          <span class="widget-badge is-blue">${icon('calendar', { size: 14 })} SPIELPLAN</span>
          <h3>Nächste Spiele</h3>
        </div>
        <div class="widget-header-actions">
          ${isHost ? '<button type="button" class="widget-header-action-btn" data-action="step-matchday" title="Simuliert zum nächsten Spieltag">Nächster Spieltag →</button>' : ''}
          <button type="button" class="widget-header-btn" data-view="calendar">Kalender →</button>
        </div>
      </div>
      <div class="widget-card-body widget-scrollable">
        <div class="widget-fixtures-list">
          ${fixtureItemsHtml}
        </div>
      </div>
    </section>
  `;

  // --- WIDGET 4: LIGATABELLE (Condensed Standings) ---
  const standings = rankTeamsFromResults(league.teams, league.matchHistory ?? []);
  const condensedStandings = standings.slice(0, 24); // Top 24 (Plätze 1–8 Achtelfinale, 9–24 Play-offs)
  const standingsRowsHtml = condensedStandings.map((row) => {
    const isMyTeam = row.teamId === managerTeam.id;
    const isKnockoutZone = row.rank <= 8;
    const isPlayoffZone = row.rank > 8 && row.rank <= 24;
    const diff = row.goalsFor - row.goalsAgainst;
    const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
    return `
      <tr class="widget-table-row ${isMyTeam ? 'is-active-team' : ''} ${isKnockoutZone ? 'is-knockout-zone' : isPlayoffZone ? 'is-playoff-zone' : ''}">
        <td class="col-rank"><b>${row.rank}</b></td>
        <td class="col-team">
          <button type="button" class="table-team-link widget-table-team-name" data-action="open-club-page" data-team-id="${escapeHtml(row.teamId)}" title="${escapeHtml(row.teamName)} Vereinspage öffnen">${escapeHtml(row.teamName)}</button>
          ${isMyTeam ? '<span class="widget-my-pill">DEIN TEAM</span>' : ''}
        </td>
        <td class="col-played">${row.played}</td>
        <td class="col-diff">${diffLabel}</td>
        <td class="col-points"><strong>${row.points}</strong></td>
      </tr>
    `;
  }).join('');

  const tableWidgetHtml = `
    <section class="widget-card is-table" aria-label="Widget: Ligatabelle">
      <div class="widget-card-header">
        <div class="widget-card-title">
          <span class="widget-badge is-emerald">${icon('table', { size: 14 })} TABELLE</span>
          <h3>Ligatabelle · Top 24</h3>
        </div>
        <button type="button" class="widget-header-btn" data-view="table">Volle Tabelle (30) →</button>
      </div>
      <div class="widget-card-body widget-scrollable">
        <div class="widget-table-legend">
          <span class="leg-item is-knockout">● Plätze 1–8: Direkt Achtelfinale</span>
          <span class="leg-item is-playoff">● Plätze 9–24: K.-o.-Play-offs</span>
        </div>
        <table class="widget-mini-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Verein</th>
              <th>Sp</th>
              <th>TD</th>
              <th>Pkt</th>
            </tr>
          </thead>
          <tbody>
            ${standingsRowsHtml}
          </tbody>
        </table>
      </div>
    </section>
  `;

  return `
    ${pageHeader(
      'EUROPEAN SUPER LEAGUE',
      escapeHtml(managerTeam.name),
      `${escapeHtml(managerTeam.managerName || 'Manager')} · ${escapeHtml(currentDateIso)}`,
      `<div style="display:flex;gap:8px;flex-wrap:wrap">
        ${isHost ? '<button class="button primary small" data-action="step-matchday">Nächster Spieltag</button>' : ''}
        <button class="button light small" data-view="calendar">Kalender</button>
        <button class="button light small" data-view="news">NewsHub</button>
        <button class="button light small" data-action="open-phone">Handy</button>
      </div>`
    )}
    <div class="dashboard-widgets-grid">
      ${newsWidgetHtml}
      ${squadWidgetHtml}
      ${fixturesWidgetHtml}
      ${tableWidgetHtml}
    </div>
  `;
}

function renderSetup() {
  const league = activeLeague();
  const realPool = getRealDraftPool();
  const targetPicks = getDraftTargetPicks(league?.teams?.length || 30, realPool.length);
  if (league && !setupBuilderOpen) {
    const draftDone = isDraftComplete(league, realPool);
    return `${pageHeader('LIGA-SETUP · PROZESS-STATUS', draftDone ? 'Setup & Snake Draft abgeschlossen.' : 'Schritt 1 abgeschlossen — Jetzt folgt der Snake Draft.', 'Zuerst wurden eure 30 Mannschaften festgelegt. Sobald der Snake Draft beendet ist, wird der Draft-Tab gesperrt und die Saison läuft im Command Center.', '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="button primary" data-action="open-setup-builder">+ Neue Liga / Manager konfigurieren</button><button class="button light" data-action="reset-local">Liga zurücksetzen</button></div>')}
      <div class="stepper">
        <div class="step active"><span class="step-num">OK</span> 1. Mannschaften &amp; Manager (30 Teams)</div>
        <div class="step-line"></div>
        <div class="step ${draftDone ? 'active' : 'active'}"><span class="step-num">${draftDone ? 'OK' : '2'}</span> 2. Snake Draft (${draftDone ? 'Abgeschlossen & gesperrt' : 'Jetzt offen'})</div>
        <div class="step-line"></div>
        <div class="step ${draftDone ? 'active' : ''}"><span class="step-num">3</span> 3. Command Center Saison &amp; Scouting</div>
      </div>
      <section class="panel empty-wide">
        <div class="empty-icon" style="margin:0 auto 12px">${draftDone ? 'OK' : '02'}</div>
        <h2>${escapeHtml(league.name)} (${escapeHtml(league.season)})</h2>
        <p>${league.teams.length} Vereine (${league.teams.filter((team) => team.managerType === 'human').length} menschliche Manager, ${league.teams.filter((team) => team.managerType === 'cpu').length} CPU) · ${draftDone ? `Alle ${targetPicks} Draft-Picks abgeschlossen (Snake Draft Tab ist jetzt ausgeblendet) · ${(state.players ?? []).filter((p) => p.isGeneratedTalent).length} Zufalls-Talente im Scouting-Pool.` : `${league.draft.picks.length} / ${targetPicks} Spieler gedraftet. Starte jetzt Schritt 2 (Snake Draft)!`}</p>
        <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">
          ${!draftDone
            ? `<button class="button primary" data-view="draft">Weiter zu Schritt 2: Snake Draft öffnen</button>${state.players.length && canManagerAutoDraft(activeManager(), league.adminName) ? '<button class="button light" data-action="auto-draft-all">Auto-Draft (Alle 30er-Kader sofort fertigstellen)</button>' : ''}`
            : '<button class="button primary" data-view="calendar">Zum Saisonkalender</button><button class="button light" data-view="transfers">Zum TransferHub &amp; Scouting</button><button class="button light" data-view="news">Zum NewsHub</button>'}
          <button class="button light" data-action="open-setup-builder">+ Manager &amp; Liga neu aufsetzen</button>
          <button class="button light" data-action="reset-local">Liga zurücksetzen</button>
        </div>
      </section>`;
  }

  const leaguesList = ['all', ...new Set(seedTeams.map((t) => t.league))];
  const leagueFilterPills = leaguesList.map((lg) => `
    <button type="button" class="pes-mode-pill ${setupLeagueFilter === lg ? 'is-active' : ''}" data-action="set-setup-league-filter" data-league="${escapeHtml(lg)}">
      ${lg === 'all' ? 'Alle Ligen (30)' : escapeHtml(lg)}
    </button>
  `).join('');

  const teamsHtml = seedTeams.map((team) => {
    const hiddenByFilter = setupLeagueFilter !== 'all' && team.league !== setupLeagueFilter;
    const assignedMgr = setupManagers.find((m) => m.teamId === team.id && m.name.trim());
    return `<div class="team-option" ${hiddenByFilter ? 'style="display:none"' : ''}><input type="checkbox" id="${team.id}" data-team-id="${team.id}" checked><label for="${team.id}"><span class="crest">${initials(team.name)}</span><span><span class="club-name">${escapeHtml(team.name)}</span><span class="league-name">${escapeHtml(team.league)}</span>${assignedMgr ? `<span class="team-human-tag">${icon('squad', { size: 10 })} ${escapeHtml(assignedMgr.name)}</span>` : ''}</span><span class="checkmark">✓</span></label></div>`;
  }).join('');

  const managerCardsHtml = setupManagers.map((mgr, index) => {
    const isHost = index === 0;
    const teamOptionsHtml = seedTeams.map((team) => {
      const isSelected = team.id === mgr.teamId;
      const otherManager = setupManagers.find((m, i) => i !== index && m.teamId === team.id && (m.name || '').trim());
      const otherLabel = otherManager ? ` · [Belegt: ${escapeHtml(otherManager.name)}]` : '';
      return `<option value="${team.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(team.name)} (${escapeHtml(team.league)})${otherLabel}</option>`;
    }).join('');

    return `
      <div class="setup-manager-card ${isHost ? 'is-host' : ''}" data-manager-index="${index}">
        <div class="setup-manager-badge">
          ${isHost ? 'HOST / ADMIN' : `MITSPIELER #${index + 1}`}
        </div>
        <div class="setup-manager-field">
          <span>Manager-Name</span>
          <input type="text" data-setup-manager-name="${index}" value="${escapeHtml(mgr.name)}" placeholder="z. B. Antonio" maxlength="35" required>
        </div>
        <div class="setup-manager-field">
          <span>Zugewiesener Verein</span>
          <select data-setup-manager-team="${index}">
            ${teamOptionsHtml}
          </select>
        </div>
        <div>
          ${!isHost ? `
            <button type="button" class="setup-manager-del-btn" data-action="remove-setup-manager" data-index="${index}" title="Manager entfernen" aria-label="Manager entfernen">
              ${icon('trash', { size: 15 })}
            </button>
          ` : `
            <span style="font-size:10px;font-weight:700;color:#fde047;letter-spacing:0.04em;padding:4px 8px;">LIGA-LEITER</span>
          `}
        </div>
      </div>
    `;
  }).join('');

  return `${pageHeader('LIGA-SETUP · SCHRITT 01 VON 02', 'Schritt 1: Mannschaften & Manager.', 'Stelle zuerst eure 30 Vereine und Manager zusammen. Direkt danach geht es in Schritt 2 (Snake Draft), der nach Abschluss automatisch verriegelt wird.', '')}
    <div class="stepper">
      <div class="step active"><span class="step-num">1</span> Schritt 1: 30 Mannschaften &amp; Manager</div>
      <div class="step-line"></div>
      <div class="step"><span class="step-num">2</span> Schritt 2: Snake Draft (danach gesperrt)</div>
      <div class="step-line"></div>
      <div class="step"><span class="step-num">3</span> Schritt 3: Saison, Scouting &amp; Free Agency</div>
    </div>
    <form id="setup-form"><div class="setup-layout"><div class="setup-main">
      <section class="panel form-panel">
        <h2>1A · Super League Rahmen &amp; Manager</h2>
        <p class="sub">Bestimme Liganame, Startbudget und weise jedem menschlichen Mitspieler direkt seinen Verein zu. Alle übrigen der 30 Plätze werden von der KI übernommen.</p>
        <div class="field-grid">
          <div class="field"><label for="league-name">Liganame</label><input id="league-name" name="leagueName" value="Super League" maxlength="60" required></div>
          <div class="field"><label for="season">Start-Saison</label><input id="season" name="season" value="2026/27" maxlength="12" required></div>
          <div class="field"><label for="starting-budget">Startbudget pro Verein</label><select id="starting-budget" name="startingBudget"><option value="150" selected>150 Mio. € (Standard Super League)</option><option value="200">200 Mio. € (Blockbuster Markt)</option><option value="100">100 Mio. € (Hardcore Management)</option></select></div>
          <div class="field"><label for="wonderkid-intake">Zufallsgenerierte Talente &amp; Wunderkinder</label><select id="wonderkid-intake" name="wonderkidCount"><option value="16" selected>16 Zufalls-Talente (16–20 J.) für Scouting &amp; Free Agency</option><option value="24">24 Zufalls-Talente (Großer Jugend-Jahrgang)</option><option value="8">8 Zufalls-Talente (Exklusiver Jahrgang)</option></select></div>
        </div>

        <div class="setup-managers-section">
          <div class="setup-managers-top">
            <div>
              <strong style="font-size:13px;color:#f8fafc;">Menschliche Manager &amp; Team-Zuweisung (${setupManagers.length})</strong>
              <p class="sub" style="margin:2px 0 0">Füge Mitspieler mit dem Plus-Symbol hinzu, vergib den Managernamen und wähle seinen Club aus. Alle übrigen Teams erhalten automatisch einen KI-Manager.</p>
            </div>
            <button type="button" class="button primary small" data-action="add-setup-manager" style="display:inline-flex;align-items:center;gap:6px;">
              ${icon('plus', { size: 14 })} <span>Manager hinzufügen</span>
            </button>
          </div>

          <div class="setup-manager-list">
            ${managerCardsHtml}
          </div>
        </div>
      </section>
      <section class="panel form-panel">
        <div class="teams-toolbar">
          <div>
            <h2>1B · 30 Mannschaften auswählen &amp; anpassen</h2>
            <p class="sub" style="margin:4px 0 0">Wähle eure 30 Vereine oder ersetze beliebige Clubs durch eigene Vereine.</p>
          </div>
          <span class="teams-count"><b id="selected-count">30</b> / 30 gewählt</span>
        </div>
        <div class="pes-mode-pills" style="margin-bottom:12px">${leagueFilterPills}</div>
        <div class="team-grid">${teamsHtml}</div>
        <div class="custom-row">
          <div class="field"><label for="custom-team-name">Eigenes Team erstellen</label><input id="custom-team-name" maxlength="45" placeholder="z. B. Vienna United"></div>
          <div class="field"><label for="replace-team">Club im Pool ersetzen</label><select id="replace-team">${seedTeams.map((team) => `<option value="${team.id}">${escapeHtml(team.name)} (${escapeHtml(team.league)})</option>`).join('')}</select></div>
          <button type="button" class="button light small" data-action="add-custom-team" style="align-self:end">＋ Verein ersetzen</button>
        </div>
      </section>
      <section class="panel form-panel">
        <h2>1C · Spielerdatenbank (1.800 reale Profis + Zufalls-Wunderkinder)</h2>
        <p class="sub">Der lizenzierte 2026/27-Pool bildet die Basis für den Snake Draft (900 Picks · 30 pro Team), die Free Agency und das Super League Scouting-System.</p>
        <div class="note-card">
          <h3>Super League Scouting, Verträge &amp; Free Agency inklusive</h3>
          <p>Nach dem Draft sind die restlichen <strong>900 realen Spieler plus alle zufallsgenerierten Wunderkinder</strong> in der Free Agency verfügbar. Spieler anderer Vereine müssen gescoutet werden, um ihre vollen FIFA 17 Werte aufzudecken.</p>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap">
          <button type="button" class="button light small" data-action="import-csv">CSV ersetzen</button>
          <button type="button" class="button light small" data-action="import-csv-append">Spieler hinzufügen</button>
          <span id="csv-status" class="field small">${state.players.length ? `${state.players.length} Spieler inkl. Talente bereit` : 'Standardpool wird geladen'}</span>
          <button type="button" class="inline-link" data-action="download-template">CSV-Vorlage</button>
        </div>
      </section>
      </div>
      <aside class="panel setup-summary">
        <div class="summary-head"><div class="summary-badge">1→2</div><div><strong>Setup-Ablauf</strong><span>SCHRITT 1 · MANNSCHAFTEN</span></div></div>
        <div class="summary-row"><span>1. Clubs ausgewählt</span><b id="summary-teams">30 / 30</b></div>
        <div class="summary-row"><span>Menschliche Manager</span><b id="summary-humans">1</b></div>
        <div class="summary-row"><span>CPU-Manager</span><b id="summary-cpu">29</b></div>
        <div class="summary-row"><span>Spieler &amp; Wunderkinder</span><b id="summary-players">${state.players.length || 1816}</b></div>
        <div class="summary-row"><span>2. Nächster Schritt</span><b>Snake Draft (30/Team)</b></div>
        <div class="summary-callout"><b>Ablauf-Garantie:</b> Zuerst bestätigst du die 30 Mannschaften. Danach öffnet sich der Snake Draft. Sobald der Draft abgeschlossen ist, wird der Snake-Draft-Tab automatisch ausgeblendet!</div>
        <button class="button primary" type="submit" style="width:100%;justify-content:center">Schritt 1 bestätigen &amp; zum Draft</button>
        <button class="button light" type="button" data-action="start-league-autodraft" style="width:100%;justify-content:center;margin-top:8px">Teams bestätigen &amp; Sofort-Auto-Draft</button>
      </aside></div></form>`;
}

function renderDraft() {
  const league = activeLeague();
  if (!league) return `${pageHeader('SCHRITT 2 · SNAKE DRAFT', 'Wähle zuerst in Schritt 1 eure 30 Mannschaften.', 'Der Snake Draft wird freigeschaltet, sobald du im Liga-Setup eure 30 Vereine bestätigt hast.', '<button class="button primary" data-view="setup">Zu Schritt 1: Liga-Setup</button>')}`;
  const realPool = getRealDraftPool();
  if (isDraftComplete(league, realPool)) {
    return `${pageHeader('SNAKE DRAFT ABGESCHLOSSEN', 'Alle 30 Kader sind komplett.', 'Der Snake Draft ist beendet und dieser Tab ist für den Rest der Saison gesperrt.', '<button class="button primary" data-view="calendar">Zum Saisonkalender</button>')}`;
  }
  const current = nextPick();
  const picks = league.draft.picks;
  const targetPicks = getDraftTargetPicks(league.teams.length, realPool.length);
  const remainingPicks = Math.max(0, targetPicks - picks.length);
  const pickedIds = new Set(picks.map((pick) => pick.playerId));
  const available = realPool.filter((player) => !pickedIds.has(player.id)).sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  const ratingLabel = realPool.some((player) => player.ratingSource === 'FMB ABI') ? 'FMB ABI' : 'OVR';
  const round = Math.floor(picks.length / 30) + 1;
  const pickNumber = picks.length + 1;
  const manager = activeManager();
  const userTurn = canManagerPick(current, manager);
  const canHostSimulate = canManagerSimulateCpu(current, manager, league.adminName);
  const canHostAutoDraft = canManagerAutoDraft(manager, league.adminName) && remainingPicks > 0;
  const rows = available.slice(0, 24).map((rawPlayer) => {
    const player = derivePesProfile(rawPlayer, league);
    return `<tr><td><button type="button" class="pes-inline-player-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}"><strong>${escapeHtml(player.name)}</strong></button><div class="draft-sub">${escapeHtml(player.originClub || player.club || 'Unbekannter Club')} · ${player.age} J. · ${escapeHtml(player.playingStyle)}</div></td><td><span class="position-tag">${escapeHtml(player.position || '—')}</span></td><td><button type="button" class="rating pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}" title="Auf OVR klicken für detaillierte FIFA 17 Werte"><small>OVR</small>${player.rating || '—'}</button></td><td><div class="pes-mini-hex-strip"><span>SCH <b>${player.hexagon.SHO}</b></span><span>DRI <b>${player.hexagon.DRI}</b></span><span>PAS <b>${player.hexagon.PAS}</b></span><span>TEM <b>${player.hexagon.PAC}</b></span></div></td><td><div style="display:flex;gap:6px;align-items:center">${userTurn ? `<button class="pick-button" data-action="pick-player" data-player-id="${escapeHtml(player.id)}">Draften</button>` : '<span class="draft-sub">CPU am Zug</span>'}<button type="button" class="button light small" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}">Hexagon</button></div></td></tr>`;
  }).join('');
  const order = league.draft.order.map((id, index) => {
    const team = league.teams.find((entry) => entry.id === id);
    return `<div class="order-item ${team?.id === current?.id ? 'current' : ''}"><span class="order-number">${String(index + 1).padStart(2, '0')}</span><span class="order-team">${escapeHtml(team?.name ?? '')}</span><span class="order-manager">${escapeHtml(team?.managerName ?? 'CPU')}</span></div>`;
  }).join('');
  const headerActions = `<div style="display:flex;gap:8px;flex-wrap:wrap">${canHostAutoDraft ? `<button class="button primary" data-action="auto-draft-all">Auto-Draft abschließen (${remainingPicks} Picks · danach Saisonstart)</button>` : ''}<button class="button light" data-action="import-csv-append">Spielerpool erweitern</button><button class="button light" data-action="reset-local">Liga zurücksetzen</button></div>`;
  return `${pageHeader('SCHRITT 02 VON 02 · SNAKE DRAFT (30 SPIELER PRO TEAM)', 'Der Draft-Raum.', `Jedes der 30 Teams draftet 30 Spieler (${targetPicks} Picks gesamt). Sobald der Draft fertig ist, wird dieser Tab automatisch geschlossen und die Saison im Command Center freigeschaltet.`, headerActions)}
    <div class="stepper" style="margin-bottom:16px">
      <div class="step"><span class="step-num">OK</span> Schritt 1: 30 Mannschaften gewählt</div>
      <div class="step-line"></div>
      <div class="step active"><span class="step-num">2</span> Schritt 2: Snake Draft (${picks.length} / ${targetPicks} Picks)</div>
      <div class="step-line"></div>
      <div class="step"><span class="step-num">3</span> Schritt 3: Saison, Scouting &amp; Kalender</div>
    </div>
    <div class="draft-layout"><section class="panel draft-main"><div class="draft-headline"><div><h2>Spielerpipeline (${available.length} verfügbar)</h2><div class="draft-sub">Top 24 verfügbare Spieler nach ${ratingLabel} · Klicke auf <strong>OVR</strong> für detaillierte FIFA 17 Attribute &amp; Hexagon</div></div><span class="draft-progress">${picks.length} / ${targetPicks} PICKS (30/TEAM)</span></div>
    ${current ? `<div class="turn-banner"><div><strong>${escapeHtml(current.name)}</strong><span>${escapeHtml(current.managerName)} · Runde ${round} / 30 · Pick ${pickNumber} · ${current.managerType === 'human' ? userTurn ? 'Dein Manager-Pick' : 'Pick des anderen Managers' : 'CPU-Pick'}</span></div><span class="turn-pill">${userTurn ? 'DU BIST AM ZUG' : canHostSimulate ? 'HOST SIMULIERT CPU' : current.managerType === 'cpu' ? 'WARTET AUF HOST' : 'WARTET AUF MANAGER'}</span></div>` : ''}
    ${available.length && current ? `<table class="player-table"><thead><tr><th>Spieler</th><th>Position</th><th>${ratingLabel}</th><th>FIFA 17 Hexagon</th><th>Aktion</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty-table">Noch kein Spielerpool geladen. <button class="inline-link" data-view="setup">CSV im Setup importieren</button></div>`}</section>
    <aside class="draft-aside"><section class="panel draft-order"><h3>Zufällige Draft-Reihenfolge</h3><div class="draft-sub" style="margin-bottom:12px">Snake · 30 Runden · 30 Spieler pro Team</div><div class="order-list">${order}</div>${canHostSimulate ? `<button class="button light" data-action="simulate-cpu" style="width:100%;justify-content:center;margin-top:13px">CPU-Züge bis zum nächsten Manager-Pick</button>` : ''}${canHostAutoDraft ? `<button class="button primary" data-action="auto-draft-all" style="width:100%;justify-content:center;margin-top:8px">Auto-Draft (Alle ${remainingPicks} Picks sofort)</button>` : ''}</section><section class="panel"><div class="panel-header"><h2>Letzte Picks</h2><span>AKTUELLER DRAFT</span></div>${picks.length ? `<div class="log-list">${picks.slice(-5).reverse().map((pick) => `<div class="log-entry"><span class="log-time">Pick ${pick.number}</span><span class="log-copy"><button type="button" class="pes-inline-player-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(pick.playerId)}"><strong>${escapeHtml(pick.playerName)}</strong></button><br><span class="draft-sub">${escapeHtml(pick.teamName)} · ${escapeHtml(pick.managerName)}</span></span><button type="button" class="rating pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(pick.playerId)}" title="Auf OVR klicken für detaillierte FIFA 17 Werte"><small>OVR</small>${pick.rating || '—'}</button></div>`).join('')}</div>` : `<div class="empty-state">Noch keine Picks. Nutze den Einzel-Pick oder „Auto-Draft“, um sofort alle 30er-Kader zu füllen.</div>`}</section></aside></div>`;
}
function renderSquad() {
  const league = activeLeague();
  if (!league) return `${pageHeader('SQUAD HUB', 'Erst die Liga, dann der Kader.', 'Erstelle zuerst eure Liga und draftet Spieler für eure Teams.', '<button class="button primary" data-view="setup">Liga-Setup</button>')}`;
  const manager = activeManager();
  if (!manager) return `${pageHeader('SQUAD HUB', 'Kein Manager ausgewählt.', 'Wähle einen Manager für diesen Browser.', '')}`;
  const isHost = isLeagueHost(league, manager.id);
  if (!isHost) selectedSquadTeamId = manager.id;
  else if (!league.teams.some((team) => team.id === selectedSquadTeamId && (team.id === manager.id || team.managerType === 'cpu'))) selectedSquadTeamId = manager.id;
  const team = league.teams.find((entry) => entry.id === selectedSquadTeamId) || manager;
  const canEdit = (team.id === manager.id && manager.managerType === 'human') || (isHost && team.managerType === 'cpu');
  const teamSelector = isHost ? `<div class="squad-team-switch"><label for="squad-team-select">Team im Squad Hub</label><select id="squad-team-select" data-squad-team-select>${league.teams.filter((entry) => entry.id === manager.id || entry.managerType === 'cpu').map((entry) => `<option value="${escapeHtml(entry.id)}" ${entry.id === team.id ? 'selected' : ''}>${escapeHtml(entry.name)}${entry.managerType === 'cpu' ? ' · CPU' : ' · Dein Team'}</option>`).join('')}</select></div>` : '';
  const rawRoster = getTeamRoster(league, team.id, state.players);
  const shirtNumbers = resolveTeamShirtNumbers(league, team.id, rawRoster);
  const roster = rawRoster.map((player) => {
    const profile = derivePesProfile(player, league);
    return { ...profile, shirtNumber: shirtNumbers[player.id] || profile.shirtNumber };
  });
  const squad = getTeamSquad(league, team.id);
  const pesStrength = calculateTeamPesStrength(team.id, league, state.players);
  const dbHash = computeGameDbHash(league, state.players);
  const focusedPlayer = roster.find((p) => p.id === selectedSquadPlayerId) || pesStrength.starPlayers[0] || roster[0] || null;
  const pesInspectBanner = focusedPlayer ? `
    <section class="panel squad-pes-inspector-strip" aria-label="FIFA 17 Spieler-Inspektor">
      <div class="squad-pes-strip-left">
        <button type="button" class="pes-stat-badge ${getPesStatTier(focusedPlayer.rating)} pes-ovr-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(focusedPlayer.id)}" title="Auf OVR klicken für detaillierte FIFA 17 Werte"><small>OVR</small>${focusedPlayer.rating}</button>
        <div>
          <div class="eyebrow">FIFA 17 PROFIL · #${shirtNumbers[focusedPlayer.id] || focusedPlayer.shirtNumber} · ${escapeHtml(focusedPlayer.playingStyle)}</div>
          <strong>${escapeHtml(focusedPlayer.name)} (${escapeHtml(focusedPlayer.position || 'CM')} · ${focusedPlayer.age} J. · ${escapeHtml(focusedPlayer.currentClub)})</strong>
          <div class="pes-mini-hex-strip" style="margin-top:4px">
            <span>SCH <b>${focusedPlayer.hexagon.SHO}</b></span>
            <span>DRI <b>${focusedPlayer.hexagon.DRI}</b></span>
            <span>PAS <b>${focusedPlayer.hexagon.PAS}</b></span>
            <span>TEM <b>${focusedPlayer.hexagon.PAC}</b></span>
            <span>PHY <b>${focusedPlayer.hexagon.PHY}</b></span>
            <span>DEF <b>${focusedPlayer.hexagon.DEF}</b></span>
          </div>
        </div>
      </div>
      <div class="squad-pes-strip-actions">
        <span class="pes-team-kpi-pill">OVR ${pesStrength.overall} · ATT ${pesStrength.attack} · MID ${pesStrength.midfield} · DEF ${pesStrength.defense} · HASH ${escapeHtml(dbHash)}</span>
        <button type="button" class="button primary small" data-action="open-pes-player" data-player-id="${escapeHtml(focusedPlayer.id)}">Hexagon &amp; Einzelwerte</button>
      </div>
    </section>
  ` : '';
  return `${pageHeader('KADERMANAGEMENT · STARTELF, RÜCKENNUMMERN & TAKTIK-SYNC', 'Squad Hub.', `Stelle deine Startelf (${squad.formation}), Taktik und Rückennummern (1–99) für den gemeinsamen FIFA 17 Online-Stand (${dbHash}) ein.`, `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="button primary" data-action="export-fifa-links-csv">FIFA 17 Kader &amp; Nr. CSV</button><button class="button light" data-action="export-fifa-players-csv">FIFA 17 players.csv</button><button class="button light" data-view="matches">Zum Online Match Hub</button></div>`)}${teamSelector}${pesInspectBanner}${renderSquadView({ team, roster, squad, slots: SQUAD_SLOTS, canEdit, selectedPlayerId: selectedSquadPlayerId, shirtNumbers })}`;
}

function renderCalendar() {
  const league = activeLeague();
  if (!league) {
    return `${pageHeader('SAISONKALENDER · COMMAND CENTER', 'Noch keine Liga aktiv.', 'Erstelle zuerst im Setup eure 30-Team-Liga, um den interaktiven Saisonkalender und die FIFA 17 Synchronisation zu starten.', '<button class="button primary" data-view="setup">Zum Liga-Setup</button>')}<section class="panel empty-wide"><div class="empty-icon" style="margin:0 auto 12px">${icon('calendar', { size: 22 })}</div><h2>Der Saisonkalender wartet auf eure Liga.</h2><p>Sobald eure 30 Teams stehen und gedraftet haben, steuerst du hier im Command Center die animierte Tag-für-Tag-Simulation, Mensch-gegen-Mensch-Freigaben und den FIFA 17 Sync.</p><button class="button primary" data-view="setup">Liga erstellen</button></section>`;
  }
  const realPool = getRealDraftPool();
  if (!isDraftComplete(league, realPool)) {
    const canHostAutoDraft = canManagerAutoDraft(activeManager(), league.adminName) && realPool.length > 0;
    return `${pageHeader('SAISONKALENDER · COMMAND CENTER', 'Draft läuft noch.', 'Der Saisonkalender startet, sobald alle 30 Teams ihren 30-Mann-Kader im Snake Draft vervollständigt haben.', '<button class="button primary" data-view="draft">Zum Snake Draft</button>')}<section class="panel empty-wide"><div class="empty-icon" style="margin:0 auto 12px">${icon('draft', { size: 22 })}</div><h2>Beende zuerst den Snake Draft (30 Spieler pro Team).</h2><p>Aktuell sind ${league.draft?.picks?.length || 0} von ${getDraftTargetPicks(league.teams.length, realPool.length)} Picks abgeschlossen.</p><div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap"><button class="button primary" data-view="draft">Zum Draft-Raum</button>${canHostAutoDraft ? '<button class="button light" data-action="auto-draft-all">Auto-Draft jetzt abschließen &amp; Kalender starten</button>' : ''}</div></section>`;
  }
  if (!league.schedule?.length) {
    const initialized = ensureCalendar(league);
    if (initialized.error) return `<section class="panel empty-wide"><h2>Kalenderfehler</h2><p>${escapeHtml(initialized.error)}</p></section>`;
    state.league = initialized.league;
    logAction('Saisonkalender erstellt', '58 Spieltage · 870 Ligaspiele · Heim- und Rückrunde');
    save();
  }
  const manager = activeManager();
  const firstDate = state.league.currentDate < state.league.schedule[0].date ? state.league.schedule[0].date : state.league.currentDate;
  selectedCalendarDate ||= firstDate;
  return renderCalendarView({
    league: state.league,
    selectedDate: selectedCalendarDate,
    canAdvance: isLeagueHost(state.league, manager?.id),
    isSimulatingLive: isSimulatingCalendarLive,
    activeManagerTeamId: manager?.id || '',
    simSpeedMs: liveSimSpeedMs,
    tableSubTab,
    players: state.players,
    fifa15State: {
      calendarArenaOpen: fifa15CalendarArenaOpen,
      streamActive: fifa15StreamActive,
      streamRole: fifa15StreamRole,
      cinemaMode: fifa15CinemaMode,
      hudVisible: fifa15HudVisible,
      homeTeamId: pesHomeTeamId,
      awayTeamId: pesAwayTeamId,
      activeFixtureId: state.league?.onlineLobby?.activeFixtureId || state.league?.match?.fixtureId || '',
    },
  });
}

function renderTable() {
  const league = activeLeague();
  if (!league) return `${pageHeader('LIGATABELLE', 'Noch keine Liga aktiv.', 'Erstelle zuerst eure 30-Team-Liga im Setup.', '<button class="button primary" data-view="setup">Zum Liga-Setup</button>')}`;
  const standings = rankTeamsFromResults(league.teams ?? [], league.matchHistory ?? []);
  const leader = standings[0];
  const playedTotal = (league.matchHistory ?? []).length;
  return `${pageHeader('SAISONTABELLE · CHAMPIONS-MODUS', 'Die Ligatabelle.', 'Plätze 1–8 ziehen direkt ins Achtelfinale ein, Plätze 9–24 spielen die Play-offs, Plätze 25–30 scheiden aus. Klicke auf einen Vereinsnamen für die komplette Vereinspage.', `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="button primary" data-view="knockout">K.-o.-Phase &amp; Playoffs öffnen</button><button class="button light" data-view="calendar">Saisonkalender im Command Center</button></div>`)}
    <div class="calendar-stats" style="margin-bottom:14px">
      <div class="panel calendar-stat"><small>TABELLENFÜHRER</small><strong>${escapeHtml(leader?.teamName || '—')} <i>(${leader?.points ?? 0} Pkt)</i></strong></div>
      <div class="panel calendar-stat"><small>ABSOLVIERTE LIGASPIELE</small><strong>${playedTotal} <i>/ 870 Spiele</i></strong></div>
      <div class="panel calendar-stat"><small>QUALIFIKATIONSZONEN</small><strong>Top 8 <i>Achtelfinale · 9–24 Play-offs</i></strong></div>
    </div>
    ${renderStandingsTable(league, { subTab: tableSubTab })}`;
}

function renderClubPage() {
  const league = activeLeague();
  if (!league) return `${pageHeader('VEREINSPAGE', 'Noch keine Liga aktiv.', 'Erstelle zuerst eure 30-Team-Liga im Setup.', '<button class="button primary" data-view="setup">Zum Liga-Setup</button>')}`;
  const targetTeamId = selectedClubPageId || activeManager()?.id || league.teams?.[0]?.id || '';
  return renderClubPageView({
    league,
    teamId: targetTeamId,
    activeTab: clubPageTab,
    playerPool: state.players,
  });
}

function renderKnockout() {
  const league = activeLeague();
  if (!league) return `${pageHeader('K.-O.-PHASE · CHAMPIONS BRACKET', 'Noch keine Liga aktiv.', 'Erstelle zuerst eure 30-Team-Liga im Setup.', '<button class="button primary" data-view="setup">Zum Liga-Setup →</button>')}`;
  if (!league.knockout && isLeaguePhaseComplete(league)) {
    const ensured = ensureKnockoutBracket(league);
    if (!ensured.error) {
      state.league = ensured.league;
      save();
    }
  }
  const manager = activeManager();
  const canControl = isLeagueHost(state.league, manager?.id);
  return renderKnockoutView({
    league: state.league,
    canControl,
    selectedMatchId: selectedKnockoutMatchId,
  });
}

function cleanTrophyCheckerboard() {
  const imgs = Array.from(document.querySelectorAll('img[data-clean-trophy="true"]'));
  if (!imgs.length) return;
  if (cachedCleanTrophyDataUrl) {
    for (const item of imgs) {
      if (item.src !== cachedCleanTrophyDataUrl) item.src = cachedCleanTrophyDataUrl;
    }
    return;
  }
  const img = imgs[0];
  const processImg = () => {
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const isBgPixel = (idx) => {
        const p = idx * 4;
        const r = d[p];
        const g = d[p + 1];
        const b = d[p + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max - min;
        // Neutral light gray / white checkerboard & watermark connected to border
        return sat <= 20 && min >= 170;
      };

      const push = (x, y) => {
        if (x < 0 || x >= w || y < 0 || y >= h) return;
        const idx = y * w + x;
        if (visited[idx]) return;
        if (!isBgPixel(idx)) return;
        visited[idx] = 1;
        queue[tail++] = idx;
      };

      for (let x = 0; x < w; x += 1) {
        push(x, 0);
        push(x, h - 1);
      }
      for (let y = 0; y < h; y += 1) {
        push(0, y);
        push(w - 1, y);
      }

      while (head < tail) {
        const idx = queue[head++];
        d[idx * 4 + 3] = 0;
        const x = idx % w;
        const y = (idx - x) / w;
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
      }

      // Soften 1px silhouette edge next to removed background
      for (let y = 1; y < h - 1; y += 1) {
        for (let x = 1; x < w - 1; x += 1) {
          const idx = y * w + x;
          if (visited[idx]) continue;
          const neighborsBg = visited[idx - 1] + visited[idx + 1] + visited[idx - w] + visited[idx + w];
          if (neighborsBg > 0) {
            const p = idx * 4;
            const max = Math.max(d[p], d[p + 1], d[p + 2]);
            const min = Math.min(d[p], d[p + 1], d[p + 2]);
            if (max - min <= 26 && min >= 150) {
              d[p + 3] = Math.round(d[p + 3] * 0.25);
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      cachedCleanTrophyDataUrl = canvas.toDataURL('image/png');
      for (const item of document.querySelectorAll('img[data-clean-trophy="true"]')) {
        item.src = cachedCleanTrophyDataUrl;
      }
    } catch {
      /* fallback keeps original src */
    }
  };
  if (img.complete && img.naturalWidth > 0) processImg();
  else img.addEventListener('load', processImg, { once: true });
}

function cleanEslLogoBackground() {
  const imgs = Array.from(document.querySelectorAll('img[data-clean-esl-logo="true"]'));
  if (!imgs.length) return;
  if (cachedCleanEslLogoDataUrl) {
    for (const item of imgs) {
      if (item.src !== cachedCleanEslLogoDataUrl) item.src = cachedCleanEslLogoDataUrl;
    }
    return;
  }
  const img = imgs[0];
  const processLogo = () => {
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      const isLightBg = d[0] > 200 && d[1] > 200 && d[2] > 200;

      let cropMinX = w;
      let cropMaxX = 0;
      let cropMinY = h;
      let cropMaxY = 0;

      if (isLightBg) {
        // Detect exact bounding circle of the 3D Starball on a white background
        let bMinX = w;
        let bMaxX = 0;
        let bMinY = h;
        let bMaxY = 0;
        const scanX0 = Math.floor(w * 0.08);
        const scanX1 = Math.ceil(w * 0.92);
        const scanY0 = Math.floor(h * 0.08);
        const scanY1 = Math.ceil(h * 0.92);

        for (let y = scanY0; y <= scanY1; y += 1) {
          for (let x = scanX0; x <= scanX1; x += 1) {
            const p = (y * w + x) * 4;
            const r = d[p];
            const g = d[p + 1];
            const b = d[p + 2];
            if (Math.min(r, g, b) < 220) {
              if (x < bMinX) bMinX = x;
              if (x > bMaxX) bMaxX = x;
              if (y < bMinY) bMinY = y;
              if (y > bMaxY) bMaxY = y;
            }
          }
        }

        const hasValidBallBounds = bMaxX > bMinX + 40 && bMaxY > bMinY + 40;
        const ballCx = hasValidBallBounds ? (bMinX + bMaxX) * 0.5 : w * 0.5;
        const ballCy = hasValidBallBounds ? (bMinY + bMaxY) * 0.5 : h * 0.5;
        const ballRadius = hasValidBallBounds
          ? Math.min(bMaxX - bMinX, bMaxY - bMinY) * 0.495
          : Math.min(w, h) * 0.25;

        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const p = (y * w + x) * 4;
            const r = d[p];
            const g = d[p + 1];
            const b = d[p + 2];
            const dist = Math.hypot(x - ballCx, y - ballCy);
            let alpha = 0;

            if (dist <= ballRadius - 1.5) {
              alpha = 255;
            } else if (dist <= ballRadius + 1.2) {
              const edgeT = Math.max(0, Math.min(1, (ballRadius + 1.2 - dist) / 2.7));
              const whiteness = Math.min(r, g, b) / 255;
              const nonWhiteFactor = whiteness > 0.9 ? Math.max(0, (1 - whiteness) * 10) : 1;
              alpha = Math.round(edgeT * nonWhiteFactor * 255);
            }

            d[p + 3] = alpha;
            if (alpha > 16) {
              if (x < cropMinX) cropMinX = x;
              if (x > cropMaxX) cropMaxX = x;
              if (y < cropMinY) cropMinY = y;
              if (y > cropMaxY) cropMaxY = y;
            }
          }
        }
      } else {
        // Detect exact bounding circle of the 3D Starball in the upper half on a dark background
        let bMinX = w;
        let bMaxX = 0;
        let bMinY = h;
        let bMaxY = 0;
        const scanX0 = Math.floor(w * 0.34);
        const scanX1 = Math.ceil(w * 0.66);
        const scanY0 = Math.floor(h * 0.08);
        const scanY1 = Math.ceil(h * 0.485);

        for (let y = scanY0; y <= scanY1; y += 1) {
          for (let x = scanX0; x <= scanX1; x += 1) {
            const p = (y * w + x) * 4;
            const r = d[p];
            const g = d[p + 1];
            const b = d[p + 2];
            const maxC = Math.max(r, g, b);
            if (maxC >= 46 && (r + g + b) >= 102) {
              if (x < bMinX) bMinX = x;
              if (x > bMaxX) bMaxX = x;
              if (y < bMinY) bMinY = y;
              if (y > bMaxY) bMaxY = y;
            }
          }
        }

        const hasValidBallBounds = bMaxX > bMinX + 40 && bMaxY > bMinY + 40;
        const ballCx = hasValidBallBounds ? (bMinX + bMaxX) * 0.5 : w * 0.5;
        const ballCy = hasValidBallBounds ? (bMinY + bMaxY) * 0.5 : h * 0.312;
        const ballRadius = hasValidBallBounds
          ? Math.max(bMaxX - bMinX, bMaxY - bMinY) * 0.5
          : h * 0.172;

        const textYStart = Math.floor(h * 0.49);
        const textYEnd = Math.ceil(h * 0.78);
        const textXStart = Math.floor(w * 0.28);
        const textXEnd = Math.ceil(w * 0.72);

        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const p = (y * w + x) * 4;
            const r = d[p];
            const g = d[p + 1];
            const b = d[p + 2];
            let alpha = 0;

            if (y < textYStart) {
              const dist = Math.hypot(x - ballCx, y - ballCy);
              if (dist <= ballRadius - 1.5) {
                alpha = 255;
              } else if (dist <= ballRadius + 1.2) {
                const t = Math.max(0, Math.min(1, (ballRadius + 1.2 - dist) / 2.7));
                alpha = Math.round(t * 255);
              }
            } else if (y <= textYEnd && x >= textXStart && x <= textXEnd) {
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              const yellowSignal = Math.max(0, (r + g) * 0.62 - b * 0.85);
              const signal = Math.max(lum, yellowSignal);
              const bgFloor = 36;
              const fgPeak = 118;
              if (signal > bgFloor) {
                const t = Math.min(1, (signal - bgFloor) / (fgPeak - bgFloor));
                const smoothT = t * t * (3 - 2 * t);
                alpha = Math.round(smoothT * 255);
                const inv = Math.max(0.24, smoothT);
                d[p] = Math.min(255, Math.max(0, Math.round((r - 9 * (1 - smoothT)) / inv)));
                d[p + 1] = Math.min(255, Math.max(0, Math.round((g - 15 * (1 - smoothT)) / inv)));
                d[p + 2] = Math.min(255, Math.max(0, Math.round((b - 26 * (1 - smoothT)) / inv)));
              }
            }

            d[p + 3] = alpha;
            if (alpha > 16) {
              if (x < cropMinX) cropMinX = x;
              if (x > cropMaxX) cropMaxX = x;
              if (y < cropMinY) cropMinY = y;
              if (y > cropMaxY) cropMaxY = y;
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // 2. Tight auto-crop around the 3D Starball
      const pad = 12;
      const sx = Math.max(0, cropMinX - pad);
      const sy = Math.max(0, cropMinY - pad);
      const sw = Math.min(w - sx, cropMaxX - cropMinX + pad * 2);
      const sh = Math.min(h - sy, cropMaxY - cropMinY + pad * 2);

      if (sw > 40 && sh > 40) {
        const outCanvas = document.createElement('canvas');
        outCanvas.width = sw;
        outCanvas.height = sh;
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        cachedCleanEslLogoDataUrl = outCanvas.toDataURL('image/png');
      } else {
        cachedCleanEslLogoDataUrl = canvas.toDataURL('image/png');
      }

      for (const item of document.querySelectorAll('img[data-clean-esl-logo="true"]')) {
        item.src = cachedCleanEslLogoDataUrl;
      }
    } catch {
      /* fallback keeps original src */
    }
  };
  if (img.complete && img.naturalWidth > 0) processLogo();
  else img.addEventListener('load', processLogo, { once: true });
}

function renderDesktopNews() {
  const league = activeLeague();
  if (!league) {
    return `${pageHeader('NEWSHUB · COMMAND CENTER', 'Noch keine Liga aktiv.', 'Erstelle zuerst eure 30-Team-Liga im Setup, damit Transfer-Breaking-News, Spieltags-Schlagzeilen, Tabellenführer-Wechsel und Fanstimmen im Command Center erscheinen.', '<button class="button primary" data-view="setup">Zum Liga-Setup</button>')}<section class="panel empty-wide"><div class="empty-icon" style="margin:0 auto 12px">${icon('news', { size: 22 })}</div><h2>NewsHub startet mit eurer Liga.</h2><p>Alle Transfers, Free-Agency-Deals, Transfer-Hijacks, Wunderkind-Entdeckungen und Ergebnisse laufen hier automatisch zusammen.</p><button class="button primary" data-view="setup">Liga erstellen</button></section>`;
  }
  if ((league.draft?.picks?.length || 0) > 0 && !(league.pendingDeals ?? []).length) {
    state.league = ensureHijackableDeals(league, state.players).league;
  }
  const manager = activeManager();
  return renderNewsView({
    league: state.league,
    activeCategory: selectedNewsCategory,
    activeManagerTeamId: manager?.id || '',
    expandedCommentsPostId: expandedNewsCommentsPostId,
  });
}

function renderDesktopMail() {
  const league = activeLeague();
  if (!league) {
    return `${pageHeader('POSTFACH & TRANSFERANGEBOTE · COMMAND CENTER', 'Noch keine Liga aktiv.', 'Erstelle zuerst eure 30-Team-Liga im Setup, um Transferangebote der CPU-Vereine zu empfangen und Angebote per Mail an echte Mitspieler oder CPU-Clubs zu senden.', '<button class="button primary" data-view="setup">Zum Liga-Setup</button>')}`;
  }
  const manager = activeManager();
  if ((league.draft?.picks?.length || 0) > 0 && !(league.mailItems ?? []).length) {
    state.league = ensureMailInboxInitialized(league, state.players, manager?.id || '').league;
  }
  return renderMailInboxView({
    league: state.league,
    players: state.players,
    activeManagerTeamId: manager?.id || '',
    selectedMailId,
    mailFilter: selectedMailFilter,
    preselectedTargetTeamId: preselectedMailTargetTeamId,
    preselectedPlayerId: preselectedMailPlayerId,
    embeddedInTransferHub: false,
  });
}

function renderDesktopFinances() {
  const league = activeLeague();
  if (!league) {
    return `${pageHeader('FINANZEN & GEHALTSBUDGET · FIFA 17 VORSTAND', 'Noch keine Liga aktiv.', 'Erstelle zuerst eure 30-Team-Liga im Setup, um Transfer- und Gehaltsbudget per FIFA 17 Regler zu steuern und Spieler-Verträge mit Beratern auszuhandeln.', '<button class="button primary" data-view="setup">Zum Liga-Setup</button>')}`;
  }
  const manager = activeManager();
  return renderFinanceTabView({
    league: state.league,
    players: state.players,
    activeManagerTeamId: manager?.id || '',
  });
}

function renderDesktopTransfers() {
  const league = activeLeague();
  if (!league) {
    return `${pageHeader('TRANSFERHUB & SCOUTING · COMMAND CENTER', 'Noch keine Liga aktiv.', 'Erstelle zuerst eure 30-Team-Liga im Setup, um das Super League Scouting-System, Postfach-Angebote, Free Agency, Zufalls-Wunderkinder, Transfer-Hijacks und das Vertragssystem zu nutzen.', '<button class="button primary" data-view="setup">Zum Liga-Setup</button>')}<section class="panel empty-wide"><div class="empty-icon" style="margin:0 auto 12px">${icon('transfers', { size: 22 })}</div><h2>TransferHub &amp; Scouting-Zentrale</h2><p>Scoute alle Spieler der 30 Vereine, decke FIFA 17 Attribute auf, prüfe Transferangebote im Postfach, verhandle mit Spieler-Agenten und nutze das Handy für schnelle Live-Deals zwischen menschlichen Managern.</p><button class="button primary" data-view="setup">Liga erstellen</button></section>`;
  }
  ensureGeneratedTalentsInPool(16);
  const manager = activeManager();
  if ((league.draft?.picks?.length || 0) > 0 && !(league.pendingDeals ?? []).length) {
    state.league = ensureHijackableDeals(league, state.players).league;
  }
  if ((league.draft?.picks?.length || 0) > 0 && !(state.league.mailItems ?? []).length) {
    state.league = ensureMailInboxInitialized(state.league, state.players, manager?.id || '').league;
  }
  return renderCommandTransferHubView({
    league: state.league,
    players: state.players,
    activeManagerTeamId: manager?.id || '',
    activeTab: txHubTab,
    clubFilter: fmClubFilter,
    positionFilter: fmPositionFilter,
    scoutingFilter: fmScoutingFilter,
    searchQuery: fmSearchQuery,
    onlineManagerIds,
    selectedMailId,
    mailFilter: selectedMailFilter,
    preselectedTargetTeamId: preselectedMailTargetTeamId,
    preselectedPlayerId: preselectedMailPlayerId,
  });
}

function renderMatches() {
  const league = activeLeague();
  if (!league) return `${pageHeader('MATCH HUB · FIFA 17 ONLINE', 'Matchday & Online-Datenbank.', 'Erstelle zuerst eine Liga, damit Teams, RDBM-Kaderexport, Taktik-Vorschau und PC-zu-PC Online-Lobby bereitstehen.', '<button class="button primary" data-view="setup">Zum Liga-Setup</button>')}`;
  const homeDefaultId = pesHomeTeamId || league.match?.homeId || league.teams[0]?.id || '';
  const awayDefaultId = pesAwayTeamId || league.match?.awayId || league.teams[1]?.id || league.teams[0]?.id || '';
  const homeOptions = league.teams.map((team) => `<option value="${escapeHtml(team.id)}" ${team.id === homeDefaultId ? 'selected' : ''}>${escapeHtml(team.name)} (${escapeHtml(team.managerName)})</option>`).join('');
  const awayOptions = league.teams.map((team) => `<option value="${escapeHtml(team.id)}" ${team.id === awayDefaultId ? 'selected' : ''}>${escapeHtml(team.name)} (${escapeHtml(team.managerName)})</option>`).join('');
  const match = league.match;
  const dbHash = computeGameDbHash(league, state.players);
  const headerActions = `<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="button primary" data-action="export-fifa-players-csv">FIFA 17 players.csv (RDBM)</button><button type="button" class="button light" data-action="export-fifa-links-csv">teamplayerlinks.csv</button><button type="button" class="button light" data-action="confirm-manager-db-sync">Stand synchronisieren (${escapeHtml(dbHash)})</button><button type="button" class="button light" data-action="trigger-pes-live-sync">Live-Ergebnis abrufen</button></div>`;
  return `${pageHeader('MATCH HUB · FIFA 17 PC-ONLINE', 'Euer nächster Online-Matchday.', 'Synchronisiere alle Mitspieler auf denselben Kader-Hash, exportiere die FIFA 17 RDBM Datenbanktabellen für echtes PC-zu-PC-Onlinespiel und speichere Ergebnisse samt Torschützen & Spieler-Entwicklung.', headerActions)}
    <section class="panel match-card"><div class="panel-header" style="padding:0 0 15px"><h2>PC-zu-PC Online-Match-Lobby &amp; Ergebnis-Synchronisation</h2><span>HOST: ${escapeHtml(league.adminName)} · DB-HASH ${escapeHtml(dbHash)}</span></div><form id="match-form"><div class="match-grid" style="margin-top:16px"><div class="field"><label for="home-team">Heimteam</label><select id="home-team" name="home" required>${homeOptions}</select></div><div class="field"><label for="away-team">Auswärtsteam</label><select id="away-team" name="away" required>${awayOptions}</select></div></div><div class="match-state"><div><strong>${match ? `${escapeHtml(match.home)} vs ${escapeHtml(match.away)}${match.round ? ` · Spieltag ${match.round}` : ''}` : 'Noch keine Begegnung ausgewählt'}</strong><div class="draft-sub">${match?.result ? `Ergebnis bestätigt: ${match.result.home} – ${match.result.away} (${escapeHtml(match.result.confirmedBy || 'Synchronisiert')})` : 'Begegnung in FIFA 17 (Direct-Online / Radmin VPN) mit identischem Squad-Hash austragen.'}</div></div><span class="status-chip">${match?.result ? 'ERGEBNIS SYNCHRONISIERT' : match ? `LOBBY BEREIT (${escapeHtml(dbHash)})` : 'LOBBY OFFEN'}</span></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="button primary" type="submit">${match ? 'Lobby & Taktik-Vorschau aktualisieren' : 'Match-Lobby erstellen'}</button><button type="button" class="button light" data-action="trigger-pes-live-sync">Live-Ergebnis jetzt synchronisieren</button><button type="button" class="button light" data-view="calendar">Zum Saisonkalender</button></div></form>
    ${match ? `<form id="score-form" style="margin-top:20px;border-top:1px solid var(--line);padding-top:18px"><h2 style="font:600 13px 'Space Grotesk';margin:0 0 12px">Schnell-Ergebnis nach dem Spiel bestätigen</h2><div class="score-fields"><div class="field"><label for="home-score">${escapeHtml(match.home)}</label><input id="home-score" type="number" min="0" max="99" required value="${match.result?.home ?? ''}"></div><span style="align-self:center;text-align:center;color:#8c978f">:</span><div class="field"><label for="away-score">${escapeHtml(match.away)}</label><input id="away-score" type="number" min="0" max="99" required value="${match.result?.away ?? ''}"></div></div><p class="draft-sub" style="margin:10px 0 12px">Ergebnis wird direkt in Ligatabelle, NewsHub und 1–99 Spieler-Entwicklung übernommen.</p><button class="button light small" type="submit">Ergebnis speichern</button></form>` : ''}</section>
    ${renderPesMatchHubSuite({
      league,
      players: state.players,
      homeTeamId: homeDefaultId,
      awayTeamId: awayDefaultId,
      activeTab: pesHubTab,
      checkedExportIds: pesCheckedExportIds,
      connectionMode: pesConnectionMode,
      onlineManagerIds,
      streamActive: fifa15StreamActive,
      streamRole: fifa15StreamRole,
      cinemaMode: fifa15CinemaMode,
      hudVisible: fifa15HudVisible,
    })}`;
}

function renderTransfers() {
  let league = activeLeague();
  const manager = activeManager();
  if (!league || !manager) return `<div class="phone-empty-app"><strong>Kein aktiver Manager</strong><p>Erstelle zuerst eine Liga im Setup, um im TransferHub zu verhandeln.</p><button class="button primary small" data-action="close-phone-and-setup">Liga-Setup</button></div>`;
  if ((league.draft?.picks?.length || 0) > 0 && !(league.pendingDeals ?? []).length) {
    state.league = ensureHijackableDeals(league, state.players).league;
    league = state.league;
  }
  const windowOpen = isTransferWindowOpen(league.currentDate);
  const calls = league.calls ?? [];
  const mine = calls.filter((call) => [call.callerTeamId, call.targetTeamId].includes(manager.id) && ['ringing', 'negotiating'].includes(call.status)).reverse();
  const openHijackDeals = (league.pendingDeals ?? []).filter((d) => d.sellerTeamId !== manager.id && d.buyerTeamId !== manager.id);
  const myNeeds = analyzeTeamPositionNeeds(league, manager.id, state.players);
  const needSummary = myNeeds.missingPositions.slice(0, 3).map((n) => `${n.position} (${n.count}/${n.target})`).join(' · ') || 'Alle Positionen voll besetzt';

  const tabsHtml = `
    <div class="ios-segmented" role="tablist" aria-label="TransferHub Navigation">
      <button type="button" class="ios-seg-btn ${phoneTransferTab === 'room' ? 'is-active' : ''}" data-action="set-phone-transfer-tab" data-tab="room">
        ${icon('handshake', { size: 13 })} <span>Raum${mine.length ? ` (${mine.length})` : ''}</span>
      </button>
      <button type="button" class="ios-seg-btn ${phoneTransferTab === 'hijacks' ? 'is-active' : ''}" data-action="set-phone-transfer-tab" data-tab="hijacks">
        ${icon('hijack', { size: 13 })} <span>Hijack (${openHijackDeals.length})</span>
      </button>
      <button type="button" class="ios-seg-btn ${phoneTransferTab === 'clubs' ? 'is-active' : ''}" data-action="set-phone-transfer-tab" data-tab="clubs">
        ${icon('clubs', { size: 13 })} <span>Vereine (${league.teams.length - 1})</span>
      </button>
      <button type="button" class="ios-seg-btn ${phoneTransferTab === 'deals' ? 'is-active' : ''}" data-action="set-phone-transfer-tab" data-tab="deals">
        ${icon('deals', { size: 13 })} <span>Deals (${(league.transfers ?? []).length})</span>
      </button>
    </div>
  `;

  if (phoneTransferTab === 'hijacks') {
    const hijackRows = openHijackDeals.map((deal) => {
      const hijackFee = Number(deal.hijackFee || deal.minHijackFee || Math.round((deal.currentFee || 20) * 1.12));
      return `
        <div class="ios-list-row">
          <div class="ios-list-main">
            <strong>${escapeHtml(deal.playerName)} (${escapeHtml(deal.position || 'CM')} · OVR ${Number(deal.rating) || 80})</strong>
            <small>${escapeHtml(deal.sellerTeamName)} → ${escapeHtml(deal.buyerTeamName)} · ${escapeHtml(deal.stageLabel || `Runde ${deal.round}/3`)}</small>
            <small class="ios-reason-note">Aktuelles Gebot: ${Number(deal.currentFee).toLocaleString('de-DE')} Mio. € · Hijack ab ${hijackFee} Mio. €</small>
          </div>
          <button type="button" class="ios-pill-btn" data-action="hijack-transfer-deal" data-deal-id="${escapeHtml(deal.id)}" data-hijack-fee="${hijackFee}">Hijacken (${hijackFee}M)</button>
        </div>
      `;
    }).join('');

    return `
      <div class="ios-app-container">
        ${tabsHtml}
        <div class="ios-card">
          <div class="ios-card-head">
            <div>
              <strong>Transfer-Hijack-Radar</strong>
              <small>Laufende 3-Runden-Deals anderer Vereine kapern</small>
            </div>
            <button type="button" class="ios-pill-btn" data-action="refresh-hijack-deals">Aktualisieren</button>
          </div>
          <div class="ios-list-group">
            ${hijackRows || '<div class="ios-empty-note">Aktuell keine offenen Rivalen-Deals. Klicke auf Aktualisieren.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  if (phoneTransferTab === 'clubs') {
    const otherClubs = league.teams
      .filter((team) => team.id !== manager.id)
      .sort((a, b) => (b.managerType === 'human' ? 1 : 0) - (a.managerType === 'human' ? 1 : 0) || a.name.localeCompare(b.name));
    const contacts = otherClubs.map((team) => {
      const teamNeeds = analyzeTeamPositionNeeds(league, team.id, state.players);
      const topMissing = teamNeeds.missingPositions[0];
      const needLabel = topMissing ? `Sucht ${topMissing.position} (${topMissing.count}/${topMissing.target})` : 'Kader komplett';
      const isHuman = team.managerType === 'human';
      const statusText = onlineManagerIds.includes(team.id) ? 'LIVE ONLINE' : (isHuman ? 'MITSPIELER' : 'CPU-VEREIN');
      return `
        <div class="ios-list-row">
          <div class="ios-avatar">${escapeHtml(initials(team.name))}</div>
          <div class="ios-list-main">
            <strong>${escapeHtml(team.name)}</strong>
            <small>${escapeHtml(team.managerName || team.name)} · ${statusText} · ${Number(team.budget ?? 150).toLocaleString('de-DE')} Mio. € · ${escapeHtml(needLabel)}</small>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button type="button" class="ios-pill-btn" data-action="call-manager" data-team-id="${escapeHtml(team.id)}">Anruf</button>
            <button type="button" class="ios-pill-btn" data-action="mail-offer-club" data-team-id="${escapeHtml(team.id)}">Mail</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="ios-app-container">
        ${tabsHtml}
        <div class="ios-card">
          <div class="ios-card-head">
            <div>
              <strong>Direktleitung &amp; Vereinsliste (${otherClubs.length})</strong>
              <small>Schnelle Live-Anrufe direkt im Handy oder schriftliche Transferangebote über das Postfach senden.</small>
            </div>
            <button type="button" class="ios-pill-btn" data-action="close-phone-and-open-mail">Postfach</button>
          </div>
          <div class="ios-list-group">
            ${contacts}
          </div>
        </div>
      </div>
    `;
  }

  if (phoneTransferTab === 'deals') {
    const recentTransfers = (league.transfers ?? []).slice(-15).reverse().map((tr) => {
      const trRating = Number(tr.rating || state.players.find((p) => p.id === tr.playerId)?.rating) || 80;
      return `
      <div class="ios-list-row">
        <div class="ios-list-main">
          <strong>${escapeHtml(tr.playerName)} · ${escapeHtml(tr.position || 'PRO')} · <button type="button" class="pes-inline-ovr-btn" data-action="open-pes-player" data-player-id="${escapeHtml(tr.playerId)}" title="Auf OVR klicken für detaillierte FIFA 17 Werte">OVR ${trRating}</button></strong>
          <small>${escapeHtml(tr.sellerTeamName)} → ${escapeHtml(tr.buyerTeamName)} · <b>${Number(tr.fee).toLocaleString('de-DE')} Mio. €</b></small>
          ${tr.reason ? `<small class="ios-reason-note">${escapeHtml(tr.reason)}</small>` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" class="ios-pill-btn" data-action="open-pes-player" data-player-id="${escapeHtml(tr.playerId)}">Hexagon</button>
          <button type="button" class="ios-pill-btn" data-action="replay-transfer-signature" data-call-id="${escapeHtml(tr.callId)}">Signatur</button>
        </div>
      </div>
    `;
    }).join('');

    return `
      <div class="ios-app-container">
        ${tabsHtml}
        <div class="ios-card">
          <div class="ios-card-head">
            <div>
              <strong>Abgeschlossene Transfers</strong>
              <small>${(league.transfers ?? []).length} Deals insgesamt</small>
            </div>
            <button type="button" class="ios-pill-btn" data-action="trigger-cpu-market">Markt-Sim</button>
          </div>
          <div class="ios-list-group">
            ${recentTransfers || '<div class="ios-empty-note">Noch keine abgeschlossenen Transfers.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  // Default Tab: 'room' (Active Negotiation Room & Club Budget Summary)
  const rooms = mine.map((call) => {
    const otherId = manager.id === call.callerTeamId ? call.targetTeamId : call.callerTeamId;
    const other = league.teams.find((team) => team.id === otherId);
    const last = call.offers?.at(-1);
    const isIncomingRinging = call.status === 'ringing' && call.targetTeamId === manager.id;
    const playerOptions = (league.draft?.picks ?? [])
      .filter((pick) => [call.callerTeamId, call.targetTeamId].includes(pick.teamId))
      .map((pick) => {
        const playerObj = state.players.find((p) => p.id === pick.playerId);
        const pos = pick.position || playerObj?.position || 'CM';
        const rating = pick.rating || playerObj?.rating || 80;
        const mktVal = calculatePlayerMarketValue({ rating, position: pos });
        const selectedAttr = preselectedNegotiationPlayerId && pick.playerId === preselectedNegotiationPlayerId ? 'selected' : '';
        return `<option value="${escapeHtml(pick.playerId)}" ${selectedAttr}>${escapeHtml(pick.playerName)} (${escapeHtml(pos)} · OVR ${rating} · ~${mktVal} Mio.) · ${escapeHtml(pick.teamName)}</option>`;
      }).join('');
    const latestPlayer = last && state.players.find((player) => player.id === last.playerId);
    const draftPlayer = last && (league.draft?.picks ?? []).find((pick) => pick.playerId === last.playerId);
    const seller = last && league.teams.find((team) => team.id === last.sellerTeamId);
    const buyer = last && league.teams.find((team) => team.id === last.buyerTeamId);
    const playerRating = Number(latestPlayer?.rating ?? draftPlayer?.rating ?? last?.rating) || 80;
    const playerPos = latestPlayer?.position || draftPlayer?.position || last?.position || 'CM';
    const estimatedValue = calculatePlayerMarketValue({ rating: playerRating, position: playerPos });
    const waitingForMyDecision = last?.status === 'pending' && last.fromTeamId !== manager.id;
    const currentRound = Math.min(3, Math.max(1, Number(call.negotiationRound) || Math.ceil((call.offers?.length || 1) / 2)));
    const stageLabels = {
      1: 'Runde 1/3 · Sondierung & Erstgebot',
      2: 'Runde 2/3 · Ablösepoker & Hijack-Gefahr',
      3: 'Runde 3/3 · Einigung & Medizincheck',
    };
    const activeHijackAlert = call.competingBid && call.competingBid.status === 'active' ? call.competingBid : null;

    if (call.status === 'ringing') {
      const ringingOfferPreview = last ? `
        <div class="ios-incoming-offer-box">
          <div class="ios-incoming-offer-player">
            <span class="ios-avatar">${escapeHtml(initials(last.playerName || 'SP'))}</span>
            <div>
              <strong>${escapeHtml(last.playerName)} (${escapeHtml(playerPos)} · OVR ${playerRating})</strong>
              <small>${escapeHtml(seller?.name || call.callerTeamName)} → ${escapeHtml(buyer?.name || call.targetTeamName)}</small>
            </div>
          </div>
          <div class="ios-incoming-offer-fee">
            <small>GEBOTENE ABLÖSE</small>
            <strong>${Number(last.fee).toLocaleString('de-DE')} Mio. €</strong>
          </div>
        </div>
      ` : '';
      return `
        <section class="ios-card negotiation-room ios-incoming-call-hero" role="region" aria-label="Eingehender Transferanruf">
          <div class="ios-incoming-call-top">
            <div class="ios-incoming-avatar-ring">
              <span>${escapeHtml(initials(other?.name || call.callerTeamName || 'FC'))}</span>
            </div>
            <div class="ios-incoming-meta">
              <span class="ios-status-label is-ringing">${icon('phoneIncoming', { size: 12 })} ${isIncomingRinging ? 'EINGEHENDER TRANSFERANRUF' : 'AUSGEHENDER ANRUF'}</span>
              <strong>${escapeHtml(other?.name || call.callerTeamName || 'Verein')}</strong>
              <small>Manager: ${escapeHtml(other?.managerName || call.callerManagerName || 'CPU-Manager')}</small>
            </div>
          </div>
          ${ringingOfferPreview}
          ${isIncomingRinging ? `
            <p class="ios-room-note">${escapeHtml(call.reason || 'Möchte über einen Spielerwechsel in der 3-Runden-Verhandlung sprechen.')}</p>
            <div class="ios-action-row ios-incoming-actions">
              <button type="button" class="ios-primary-btn is-answer" data-action="answer-call" data-call-id="${escapeHtml(call.id)}">${icon('phoneCall', { size: 15 })} <span>Annehmen &amp; Verhandeln</span></button>
              <button type="button" class="ios-secondary-btn is-decline" data-action="decline-call" data-call-id="${escapeHtml(call.id)}">${icon('phoneOff', { size: 15 })} <span>Ablehnen</span></button>
            </div>
          ` : `
            <p class="ios-room-note">Verbindung zu ${escapeHtml(other?.name || 'Team')} wird aufgebaut…</p>
            <button type="button" class="ios-secondary-btn is-decline" data-action="hangup-call" data-call-id="${escapeHtml(call.id)}">${icon('phoneOff', { size: 15 })} <span>Auflegen</span></button>
          `}
        </section>
      `;
    }

    const hijackAlertCard = activeHijackAlert ? `
      <div class="ios-hijack-alert" role="alert">
        <div class="ios-hijack-alert-head">
          <span class="ios-hijack-badge">HIJACK-ALARM</span>
          <strong>${escapeHtml(activeHijackAlert.rivalTeamName)} funkt dazwischen!</strong>
        </div>
        <p>${escapeHtml(activeHijackAlert.message || `${activeHijackAlert.rivalTeamName} bietet ${activeHijackAlert.fee || activeHijackAlert.rivalFee} Mio. € für ${activeHijackAlert.playerName}!`)}</p>
        <div class="ios-action-row">
          <button type="button" class="ios-primary-btn" data-action="outbid-rival-hijack" data-call-id="${escapeHtml(call.id)}">
            Überbieten (${activeHijackAlert.outbidFee || activeHijackAlert.requiredOutbidFee} Mio. €)
          </button>
          <button type="button" class="ios-secondary-btn" data-action="concede-rival-hijack" data-call-id="${escapeHtml(call.id)}">
            Deal überlassen
          </button>
        </div>
      </div>
    ` : '';

    const offerCard = last ? `
      <div class="ios-deal-sheet">
        <div class="ios-round-tracker">
          <span>${escapeHtml(stageLabels[currentRound] || stageLabels[1])}</span>
          <b>${call.isHijack ? 'GEKAPERTER DEAL' : `RUNDE ${currentRound}/3`}</b>
        </div>
        <div class="ios-deal-player">
          <div class="ios-avatar is-large">${escapeHtml(initials(last.playerName || 'SP'))}</div>
          <div class="ios-deal-player-info">
            <strong>${escapeHtml(last.playerName)}</strong>
            <span>${escapeHtml(playerPos)} · <button type="button" class="pes-inline-ovr-btn" data-action="open-pes-player" data-player-id="${escapeHtml(last.playerId)}" title="Auf OVR klicken für detaillierte FIFA 17 Werte">OVR ${playerRating}</button> · ${escapeHtml(seller?.name || '')} → ${escapeHtml(buyer?.name || '')}</span>
          </div>
          <button type="button" class="ios-pill-btn" data-action="open-pes-player" data-player-id="${escapeHtml(last.playerId)}">FIFA-Hexagon</button>
        </div>
        <div class="ios-deal-metrics">
          <div>
            <small>AKTUELLES GEBOT / FORDERUNG</small>
            <strong>${Number(last.fee).toLocaleString('de-DE')} Mio. €</strong>
          </div>
          <div>
            <small>MARKTWERT (<button type="button" class="pes-inline-ovr-btn" data-action="open-pes-player" data-player-id="${escapeHtml(last.playerId)}" title="Auf OVR klicken für detaillierte FIFA 17 Werte">OVR ${playerRating}</button>)</small>
            <strong>~${estimatedValue} Mio. €</strong>
          </div>
        </div>
        ${last.reason ? `<p class="ios-reason-note">Grund: ${escapeHtml(last.reason)}</p>` : ''}
        ${hijackAlertCard}
        <p class="ios-room-note">
          ${waitingForMyDecision
            ? (windowOpen ? 'Mehrrunden-Verhandlung: Du kannst das Gegenangebot direkt annehmen & unterschreiben oder ein neues Gebot für die nächste Runde abgeben.' : 'Transferfenster geschlossen (Abschluss im Juli/August oder Januar).')
            : 'Angebot übermittelt · Verhandlungsrunde läuft.'}
        </p>
        ${waitingForMyDecision ? `
          <div class="ios-action-row">
            <button type="button" class="ios-primary-btn" data-action="accept-offer" data-call-id="${escapeHtml(call.id)}">Annehmen &amp; Unterschreiben</button>
            <button type="button" class="ios-secondary-btn" data-action="reject-offer" data-call-id="${escapeHtml(call.id)}">Ablehnen</button>
          </div>
        ` : ''}
      </div>
    ` : '<p class="ios-room-note">Wähle unten einen Spieler und eine Ablöse für Runde 1/3 der Verhandlung.</p>';

    return `
      <section class="ios-card negotiation-room">
        <div class="ios-card-head">
          <div>
            <strong>${escapeHtml(other?.name || 'Verein')}</strong>
            <small>Mehrrunden-Verhandlung mit ${escapeHtml(other?.managerName || other?.name || 'Manager')}</small>
          </div>
          <button type="button" class="ios-text-danger" data-action="hangup-call" data-call-id="${escapeHtml(call.id)}">Beenden</button>
        </div>
        ${offerCard}
        <form class="ios-offer-form offer-form" data-call-id="${escapeHtml(call.id)}">
          <label class="ios-field">
            <span>Spieler auswählen</span>
            <select name="playerId" required>${playerOptions || '<option value="">Keine Spieler verfügbar</option>'}</select>
          </label>
          <div class="ios-offer-submit-row">
            <label class="ios-field">
              <span>Ablöse (Mio. €)</span>
              <input name="fee" type="number" min="0" step="1" value="${last?.fee ? Math.round(last.fee * 1.06) : 35}" required>
            </label>
            <button class="ios-primary-btn" type="submit">${last?.status === 'pending' ? 'Gegenangebot (Nächste Runde)' : 'Angebot senden'}</button>
          </div>
        </form>
      </section>
    `;
  }).join('');

  return `
    <div class="ios-app-container">
      ${tabsHtml}

      <div class="ios-kpi-strip">
        <div><small>VEREIN</small><strong>${escapeHtml(manager.name)}</strong></div>
        <div><small>BUDGET</small><strong>${Number(manager.budget ?? 150).toLocaleString('de-DE')} Mio.</strong></div>
        <div><small>HIJACKS</small><strong>${openHijackDeals.length} offen</strong></div>
      </div>

      <div class="ios-card ios-needs-bar">
        <div>
          <small>KADERBEDARF</small>
          <strong>${escapeHtml(needSummary)}</strong>
        </div>
        <button type="button" class="ios-pill-btn" data-action="trigger-cpu-market">CPU-Markt &amp; Anruf</button>
      </div>

      ${rooms || `
        <div class="ios-card ios-empty-room">
          <strong>Kein aktives Gespräch</strong>
          <p>Starte einen Anruf über „Vereine“, kapere einen fremden Deal unter „Hijack (${openHijackDeals.length})“ oder simuliere den CPU-Transfermarkt.</p>
          <div class="ios-action-row">
            <button type="button" class="ios-primary-btn" data-action="set-phone-transfer-tab" data-tab="hijacks">Hijack-Radar (${openHijackDeals.length})</button>
            <button type="button" class="ios-secondary-btn" data-action="set-phone-transfer-tab" data-tab="clubs">Vereine anrufen</button>
          </div>
        </div>
      `}
    </div>
  `;
}

function buildCallWidgetHtml() {
  const manager = activeManager();
  const calls = state.league?.calls ?? [];
  const incoming = manager && calls.find((call) => call.targetTeamId === manager.id && call.status === 'ringing');
  const active = manager && calls.find((call) => [call.callerTeamId, call.targetTeamId].includes(manager.id) && call.status === 'negotiating');
  const ringing = manager && calls.find((call) => call.callerTeamId === manager.id && call.status === 'ringing');
  const call = incoming || active || ringing;

  if (!call) {
    return `<section class="iphone-call-widget is-idle" aria-label="Telefon-Widget unter dem Dock">
      <div class="call-widget-avatar">
        ${icon('phoneCall', { size: 16 })}
      </div>
      <div class="call-widget-copy">
        <span class="call-widget-kicker">SCHNELL-VERHANDLUNG · LIVE-LEITUNG</span>
        <strong>Direktleitung für Mitspieler</strong>
        <small>CPU-Angebote im Postfach · Live-Calls hier</small>
      </div>
      <button type="button" class="call-widget-sim-btn" data-action="close-phone-and-open-mail" title="Postfach & CPU-Transferangebote öffnen">${icon('news', { size: 13 })} <span>Postfach</span></button>
    </section>`;
  }

  const isIncoming = call === incoming;
  const isActive = call === active;
  const otherName = isIncoming ? call.callerManagerName : manager.id === call.callerTeamId ? call.targetManagerName : call.callerManagerName;
  const otherTeam = isIncoming ? call.callerTeamName : manager.id === call.callerTeamId ? call.targetTeamName : call.callerTeamName;
  const lastOffer = call.offers?.at(-1);
  const subline = lastOffer
    ? `${lastOffer.playerName} · ${Number(lastOffer.fee).toLocaleString('de-DE')} Mio. €`
    : (call.reason || otherTeam || '');
  const avatar = escapeHtml(initials(otherTeam || otherName || 'FC'));

  return `<section class="iphone-call-widget ${isIncoming ? 'is-incoming' : isActive ? 'is-active' : 'is-outgoing'}" aria-label="${isIncoming ? 'Eingehender Anruf' : isActive ? 'Aktiver Verhandlungsanruf' : 'Ausgehender Anruf'}">
    <div class="call-widget-avatar">${avatar}</div>
    <div class="call-widget-copy">
      <span class="call-widget-kicker">${isIncoming ? 'EINGEHENDER ANRUF · ANGEBOT' : isActive ? 'VERHANDLUNG AKTIV' : 'WÄHLE VERBINDUNG…'}</span>
      <strong>${escapeHtml(otherName || 'Manager')} (${escapeHtml(otherTeam || '')})</strong>
      <small>${escapeHtml(subline)}${isActive ? ` · <span data-call-duration data-start="${escapeHtml(call.acceptedAt || call.createdAt)}">00:00</span>` : ''}</small>
    </div>
    ${isIncoming
      ? `<div class="call-widget-actions">
          <button type="button" class="call-answer" data-action="answer-call" data-call-id="${escapeHtml(call.id)}" aria-label="Anruf von ${escapeHtml(otherName)} annehmen" title="Abheben">${icon('phoneCall', { size: 14 })}</button>
          <button type="button" class="call-decline" data-action="decline-call" data-call-id="${escapeHtml(call.id)}" aria-label="Anruf ablehnen" title="Ablehnen">${icon('phoneOff', { size: 14 })}</button>
        </div>`
      : `<div class="call-widget-actions">
          <button type="button" class="call-island-room" data-action="open-phone-app" data-app="transfers">${isActive ? 'Zum Raum' : 'Öffnen'}</button>
          <button type="button" class="call-decline call-end" data-action="hangup-call" data-call-id="${escapeHtml(call.id)}" aria-label="Anruf beenden" title="Auflegen">${icon('phoneOff', { size: 14 })}</button>
        </div>`}
  </section>`;
}

function renderPhoneHome() {
  const league = activeLeague();
  const manager = activeManager();
  const activeCallsCount = (league?.calls ?? []).filter((c) => manager && [c.callerTeamId, c.targetTeamId].includes(manager.id) && ['ringing', 'negotiating'].includes(c.status)).length;
  const unreadMailsCount = (league?.mailItems ?? []).filter((m) => (m.unread || !m.read)).length;
  const rosterCount = manager ? (league?.draft?.picks ?? []).filter((p) => p.teamId === manager.id).length : 0;

  return `
    <div class="iphone-home-screen">
      <div class="iphone-weather-clock">
        <div class="iphone-clock-brand">SUPER LEAGUE</div>
        <div class="iphone-clock-time">09:41</div>
        <div class="iphone-clock-sub">${escapeHtml(league?.currentDate || '2026-08-01')} · FIFA 17 ONLINE OS</div>
      </div>

      <section class="iphone-club-widget">
        <div class="iphone-club-widget-top">
          <span class="iphone-widget-tag">LIVE VERHANDLUNGS-ZENTRALE</span>
          <span class="iphone-window-state">${escapeHtml(isTransferWindowOpen(league?.currentDate) ? 'Transferfenster offen' : 'Fenster geschlossen')}</span>
        </div>
        <strong>${escapeHtml(manager ? `${manager.name} · ${manager.managerName}` : 'Noch kein Team gewählt')}</strong>
        <div class="iphone-club-metrics">
          <div><small>BUDGET</small><b>${Number(manager?.budget ?? 150).toLocaleString('de-DE')} Mio. €</b></div>
          <div><small>KADER</small><b>${rosterCount} / 30</b></div>
          <div><small>POSTFACH</small><b>${unreadMailsCount} neu</b></div>
        </div>
        <div class="iphone-widget-actions">
          <button type="button" class="iphone-cpu-sim-btn" data-action="open-phone-app" data-app="transfers">${icon('phoneCall', { size: 13 })} <span>Schnell-Verhandlung</span></button>
          <button type="button" class="iphone-cpu-sim-btn is-secondary" data-action="close-phone-and-open-mail">${icon('news', { size: 13 })} <span>Postfach (${(league?.mailItems ?? []).length})</span></button>
        </div>
      </section>

      <div class="iphone-app-grid" role="navigation" aria-label="Verhandlungs-Handy Funktionen">
        <button type="button" class="iphone-app-tile" data-action="open-phone-app" data-app="transfers">
          <span class="iphone-app-icon-wrap is-glass-tile is-blue">
            ${icon('handshake', { size: 24 })}
            ${activeCallsCount ? `<b class="iphone-app-badge">${activeCallsCount}</b>` : ''}
          </span>
          <span class="iphone-app-label">Verhandlungen</span>
          <small>Schnell-Calls &amp; Hijacks</small>
        </button>

        <button type="button" class="iphone-app-tile" data-action="close-phone-and-open-mail">
          <span class="iphone-app-icon-wrap is-glass-tile is-cyan">
            ${icon('news', { size: 24 })}
            ${unreadMailsCount ? `<b class="iphone-app-badge">${unreadMailsCount}</b>` : ''}
          </span>
          <span class="iphone-app-label">Postfach</span>
          <small>CPU &amp; Mail-Gebote</small>
        </button>

        <button type="button" class="iphone-app-tile" data-action="close-phone-and-command-transfers">
          <span class="iphone-app-icon-wrap is-glass-tile is-emerald">
            ${icon('transfers', { size: 24 })}
          </span>
          <span class="iphone-app-label">TransferHub</span>
          <small>Scouting &amp; Agenten</small>
        </button>

        <button type="button" class="iphone-app-tile" data-action="close-phone-and-open-finances">
          <span class="iphone-app-icon-wrap is-glass-tile is-gold">
            ${icon('clubs', { size: 24 })}
          </span>
          <span class="iphone-app-label">Finanzen</span>
          <small>FIFA 17 Budget-Regler</small>
        </button>
      </div>
    </div>
  `;
}

function renderPhoneShell() {
  const shell = document.querySelector('#phone-shell-root');
  const islandRoot = document.querySelector('#call-island-root');
  if (islandRoot) islandRoot.innerHTML = '';
  if (!shell) return;
  clearInterval(callIslandTimer);

  const league = activeLeague();
  const manager = activeManager();
  const calls = league?.calls ?? [];
  const incoming = manager && calls.find((c) => c.targetTeamId === manager.id && c.status === 'ringing');
  const active = manager && calls.find((c) => [c.callerTeamId, c.targetTeamId].includes(manager.id) && c.status === 'negotiating');
  const openHijackCount = (league?.pendingDeals ?? []).filter((d) => manager && d.sellerTeamId !== manager.id && d.buyerTeamId !== manager.id).length;
  const badgeCount = (incoming ? 1 : 0) + (active ? 1 : 0);
  const topbarPhoneBtn = document.querySelector('[data-action="open-phone"]');
  if (topbarPhoneBtn) {
    topbarPhoneBtn.classList.toggle('is-ringing', Boolean(incoming));
    topbarPhoneBtn.innerHTML = `${icon(incoming ? 'phoneIncoming' : 'smartphone', { size: 16 })}<span class="phone-top-label">${incoming ? 'Anruf!' : 'Handy'}</span>${badgeCount ? `<span class="phone-top-badge">${badgeCount}</span>` : ''}`;
  }

  if (islandRoot && incoming && !phoneOpen) {
    const lastOffer = incoming.offers?.at(-1);
    const offerText = lastOffer ? `${lastOffer.playerName} · ${Number(lastOffer.fee).toLocaleString('de-DE')} Mio. €` : (incoming.reason || 'Live-Transfergespräch');
    islandRoot.innerHTML = `
      <div class="call-island-floating" role="alert">
        <div class="call-island-avatar">${escapeHtml(initials(incoming.callerTeamName || 'FC'))}</div>
        <div class="call-island-copy">
          <small>${icon('phoneIncoming', { size: 12 })} EINGEHENDER TRANSFERANRUF</small>
          <strong>${escapeHtml(incoming.callerManagerName)} (${escapeHtml(incoming.callerTeamName)})</strong>
          <span>${escapeHtml(offerText)}</span>
        </div>
        <div class="call-island-actions">
          <button type="button" class="button primary small" data-action="answer-call" data-call-id="${escapeHtml(incoming.id)}">${icon('phoneCall', { size: 14 })} <span>Annehmen</span></button>
          <button type="button" class="button light small" data-action="decline-call" data-call-id="${escapeHtml(incoming.id)}">${icon('phoneOff', { size: 14 })}</button>
        </div>
      </div>
    `;
  }

  const callWidgetHtml = buildCallWidgetHtml();

  if (!phoneOpen) {
    shell.className = `phone-shell-minimized ${phoneVibrating || incoming ? 'is-vibrating' : ''}`;
    shell.innerHTML = `
      <div class="phone-minimized-stack">
        ${(incoming || active) ? `<div class="phone-minimized-call-floating">${callWidgetHtml}</div>` : ''}
        <button type="button" class="phone-peek-button ${incoming ? 'is-ringing' : ''}" data-action="open-phone" aria-label="Verhandlungs-Handy öffnen">
          <div class="phone-peek-bar">
            <span class="phone-peek-island">${icon(incoming ? 'phoneIncoming' : 'smartphone', { size: 14 })}</span>
            <div class="phone-peek-text">
              <strong>${incoming ? `Anruf: ${escapeHtml(incoming.callerTeamName)}` : 'Verhandlungs-Handy'}</strong>
              <small>${incoming ? 'Klicken zum Öffnen & Verhandeln' : 'Live-Transfergespräche & Angebote'}</small>
            </div>
          </div>
        </button>
      </div>
    `;
  } else {
    let appContent = '';
    if (activePhoneApp === 'transfers') appContent = renderTransfers();
    else appContent = renderPhoneHome();

    shell.className = `phone-shell-open ${phoneFullscreen ? 'is-fullscreen' : ''} ${phoneVibrating || incoming ? 'is-vibrating' : ''}`;
    shell.innerHTML = `
      <div class="iphone-backdrop" data-action="close-phone"></div>
      <aside class="iphone-device-modal ${phoneFullscreen ? 'is-fullscreen' : ''} ${phoneWideMode ? 'is-wide' : ''} ${phoneViewMode === 'back' ? 'is-back-view' : ''}" aria-label="Career OS Verhandlungs-Smartphone">
        <div class="iphone-hardware-toolbar">
          <button type="button" class="iphone-tool-btn" data-action="flip-phone">${icon('flip', { size: 13 })} <span>${phoneViewMode === 'back' ? 'Vorderseite' : 'Rückseite'}</span></button>
          <button type="button" class="iphone-tool-btn" data-action="toggle-phone-width">${icon('smartphone', { size: 13 })} <span>${phoneWideMode ? 'Portrait' : 'Breitansicht'}</span></button>
          <button type="button" class="iphone-tool-btn ${phoneFullscreen ? 'is-active' : ''}" data-action="toggle-phone-fullscreen" aria-label="${phoneFullscreen ? 'Vollbild beenden' : 'Vollbild aktivieren'}">${icon('maximize', { size: 13 })} <span>${phoneFullscreen ? 'Vollbild beenden' : 'Vollbild'}</span></button>
          <button type="button" class="iphone-tool-btn is-close" data-action="close-phone">${icon('close', { size: 13 })} <span>Schließen</span></button>
        </div>

        ${phoneViewMode === 'back' ? `
          <div class="iphone-back-showcase">
            <img src="/assets/phone-back.svg" alt="Smartphone Rückseite mit Pro Kamera">
            <div class="iphone-back-caption">
              <strong>iPhone 16 Pro · Verhandlungs-Edition</strong>
              <small>Exklusiv für Live-Transferanrufe · Haptisches Feedback · NFC Vertrags-Signatur</small>
              <button type="button" class="ios-primary-btn" data-action="flip-phone">${icon('flip', { size: 14 })} <span>Zurück zum Verhandlungsraum</span></button>
            </div>
          </div>
        ` : `
          <div class="iphone-front-chassis">
            <header class="iphone-status-bar">
              <span class="iphone-time">9:41</span>
              <div class="iphone-dynamic-island ${incoming ? 'is-ringing' : active ? 'is-active' : ''}" data-action="open-phone-app" data-app="transfers">
                <span class="island-camera-dot"></span>
                <span class="island-label">${incoming ? 'Eingehender Anruf' : active ? 'Verhandlung aktiv' : 'Transfer-Leitung'}</span>
              </div>
              <span class="iphone-status-icons" aria-label="5G, WLAN, Akku 100%">
                <svg width="46" height="11" viewBox="0 0 46 11" fill="currentColor" aria-hidden="true">
                  <rect x="0" y="7" width="2.5" height="4" rx="0.8"/>
                  <rect x="3.5" y="5.5" width="2.5" height="5.5" rx="0.8"/>
                  <rect x="7" y="3.5" width="2.5" height="7.5" rx="0.8"/>
                  <rect x="10.5" y="1.5" width="2.5" height="9.5" rx="0.8"/>
                  <text x="15.5" y="9.5" font-size="7.5" font-weight="700" font-family="sans-serif">5G</text>
                  <rect x="28" y="2" width="14" height="7.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.1"/>
                  <rect x="29.5" y="3.5" width="11" height="4.5" rx="1"/>
                  <rect x="43" y="4.2" width="1.5" height="3" rx="0.6"/>
                </svg>
              </span>
            </header>

            <div class="iphone-app-nav">
              <button type="button" class="iphone-back-home" data-action="open-phone-app" data-app="${activePhoneApp === 'home' ? 'transfers' : 'home'}">${activePhoneApp === 'home' ? 'Zum Raum' : '‹ Zentrale'}</button>
              <strong>${escapeHtml(PHONE_APPS[activePhoneApp] || 'Live-Verhandlungen')}</strong>
              <div class="iphone-app-nav-actions">
                <button type="button" class="iphone-app-width-toggle" data-action="toggle-phone-width">${phoneWideMode ? 'Kompakt' : 'Groß'}</button>
                <button type="button" class="iphone-app-width-toggle ${phoneFullscreen ? 'is-active' : ''}" data-action="toggle-phone-fullscreen" title="Vollbild umschalten">${phoneFullscreen ? 'Normal' : 'Vollbild'}</button>
              </div>
            </div>

            <div class="iphone-app-viewport" data-active-app="${escapeHtml(activePhoneApp)}">
              ${appContent}
            </div>

            <div class="iphone-bottom-stack">
              <nav class="iphone-dock" aria-label="Verhandlungs-Handy Dock">
                <button type="button" class="dock-app-btn ${activePhoneApp === 'home' ? 'is-active' : ''}" data-action="open-phone-app" data-app="home" title="Zentrale">
                  <span class="dock-icon-glyph">${icon('home', { size: 18 })}</span>
                  <small>Zentrale</small>
                </button>
                <button type="button" class="dock-app-btn ${activePhoneApp === 'transfers' && phoneTransferTab === 'room' ? 'is-active' : ''}" data-action="set-phone-transfer-tab" data-tab="room" title="Verhandlungsraum">
                  <span class="dock-icon-glyph is-accent">${icon('handshake', { size: 18 })}</span>
                  <small>Verhandlung</small>
                </button>
                <button type="button" class="dock-app-btn ${activePhoneApp === 'transfers' && phoneTransferTab === 'hijacks' ? 'is-active' : ''}" data-action="set-phone-transfer-tab" data-tab="hijacks" title="Transfer-Hijacks">
                  <span class="dock-icon-glyph is-warn">${icon('hijack', { size: 18 })}${openHijackCount ? `<b class="dock-mini-badge">${openHijackCount}</b>` : ''}</span>
                  <small>Hijack</small>
                </button>
                <button type="button" class="dock-app-btn ${activePhoneApp === 'transfers' && phoneTransferTab === 'clubs' ? 'is-active' : ''}" data-action="set-phone-transfer-tab" data-tab="clubs" title="Vereine anrufen">
                  <span class="dock-icon-glyph">${icon('phoneCall', { size: 18 })}</span>
                  <small>Vereine</small>
                </button>
              </nav>

              <div class="iphone-under-dock-slot">
                ${callWidgetHtml}
              </div>
              <div class="iphone-home-indicator" data-action="open-phone-app" data-app="transfers"></div>
            </div>
          </div>
        `}
      </aside>
    `;
  }

  if (active) {
    callIslandTimer = setInterval(() => {
      const timer = shell.querySelector('[data-call-duration]');
      if (!timer) return;
      const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(timer.dataset.start)) / 1000));
      timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
  }
}

function strokesToSvgPath(strokes = []) {
  const parts = [];
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || !stroke.length) continue;
    parts.push(`M ${stroke[0].x.toFixed(1)} ${stroke[0].y.toFixed(1)}`);
    for (let i = 1; i < stroke.length; i += 1) {
      parts.push(`L ${stroke[i].x.toFixed(1)} ${stroke[i].y.toFixed(1)}`);
    }
  }
  return parts.join(' ');
}

function initSignaturePadCanvas(canvasSelector = '#signature-pad-canvas', strokeStore = recordedSignatureStrokes) {
  const canvas = document.querySelector(canvasSelector);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;
  let currentStroke = [];
  let startTime = Date.now();

  const getCoords = (event) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches?.[0]?.clientX ?? event.clientX;
    const clientY = event.touches?.[0]?.clientY ?? event.clientY;
    return {
      x: ((clientX - rect.left) / (rect.width || 180)) * 180,
      y: ((clientY - rect.top) / (rect.height || 54)) * 54,
      t: Math.max(0, Date.now() - startTime),
    };
  };

  const startDraw = (event) => {
    clearTimeout(signingTimer);
    drawing = true;
    if (!strokeStore.length) startTime = Date.now();
    const pt = getCoords(event);
    currentStroke = [pt];
    strokeStore.push(currentStroke);
    ctx.beginPath();
    ctx.moveTo((pt.x / 180) * canvas.width, (pt.y / 54) * canvas.height);
  };

  const moveDraw = (event) => {
    if (!drawing) return;
    event.preventDefault();
    const pt = getCoords(event);
    currentStroke.push(pt);
    ctx.lineTo((pt.x / 180) * canvas.width, (pt.y / 54) * canvas.height);
    ctx.stroke();
  };

  const endDraw = () => { drawing = false; };

  canvas.addEventListener('pointerdown', startDraw);
  canvas.addEventListener('pointermove', moveDraw);
  window.addEventListener('pointerup', endDraw, { once: false });
}

function stopDealDoneShowreelLoop() {
  if (showreelRafId) {
    cancelAnimationFrame(showreelRafId);
    showreelRafId = null;
  }
  stopShowreelSoundtrack();
}

function startDealDoneShowreelLoop(transfer) {
  stopDealDoneShowreelLoop();
  const stageEl = document.querySelector('#deal-showreel-svg-stage');
  const timecodeEl = document.querySelector('#deal-showreel-timecode');
  const progressFill = document.querySelector('#deal-showreel-progress-fill');
  if (!stageEl) return;

  const meta = {
    playerName: transfer?.playerName || 'MBAPPE',
    position: transfer?.position || 'ST',
    rating: Number(transfer?.rating) || 91,
    sellerClub: transfer?.sellerTeamName || 'REAL MADRID',
    buyerClub: transfer?.buyerTeamName || 'SUPER LEAGUE',
    fee: Number(transfer?.fee) || 95,
    salary: Number(transfer?.salary) || 14.5,
    years: Number(transfer?.contractYears) || 4,
    agentName: transfer?.agentName || 'M. RAIOLA II',
    signaturePath: transfer?.signatureSvgPath
      || transfer?.signatures?.[0]?.svgPath
      || DEFAULT_SIGNATURE_PATH,
  };

  playShowreelSoundtrack();
  showreelStartTime = performance.now();

  const tick = (now) => {
    const elapsed = ((now - showreelStartTime) / 1000) % SHOWREEL_DURATION;
    stageEl.innerHTML = buildShowreelFrameSvg(elapsed, meta);
    if (timecodeEl) {
      const beat = Math.floor(elapsed * 2) + 1;
      const bar = Math.floor((beat - 1) / 4) + 1;
      timecodeEl.textContent = `${elapsed.toFixed(2)}s / 15.00s · BAR ${bar} · BEAT ${beat}/30 · 120 BPM`;
    }
    if (progressFill) {
      progressFill.style.width = `${((elapsed / SHOWREEL_DURATION) * 100).toFixed(1)}%`;
    }
    showreelRafId = requestAnimationFrame(tick);
  };

  showreelRafId = requestAnimationFrame(tick);
}

function transferKey(transfer) { return `${transfer.callId}|${transfer.playerId}|${transfer.signedAt || transfer.at}`; }
function announceNewTransfer(previous, next) {
  if (!sharedReady) return;
  const prior = new Set((previous?.league?.transfers ?? []).map(transferKey));
  const signed = (next?.league?.transfers ?? []).find((transfer) => !prior.has(transferKey(transfer)));
  if (signed) showSigningAnimation(signed, next.league, { autoPlayShowreel: true });
}

function showSigningAnimation(transfer, league, { autoPlayShowreel = true } = {}) {
  const overlay = document.querySelector('#signing-overlay-root');
  if (!overlay || !transfer || !league) return;
  clearTimeout(signingTimer);
  activeSigningCallId = transfer.callId;
  recordedSignatureStrokes = [];
  const manager = activeManager();

  overlay.innerHTML = `
    <div class="signing-backdrop">
      <section class="signing-modal sl-deal-done-modal" role="dialog" aria-modal="true" aria-labelledby="signing-title">
        <div class="signing-modal-top">
          <div>
            <span>THE IRON SEAL · 120 BPM DEAL DONE SHOWREEL &amp; GEZEICHNETE UNTERSCHRIFT</span>
            <h2 id="signing-title">VERTRAG UNTERZEICHNET — ${escapeHtml(transfer.playerName)} WECHSELT ZU ${escapeHtml(transfer.buyerTeamName)}</h2>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button type="button" class="button light small" data-action="replay-deal-showreel" data-call-id="${escapeHtml(transfer.callId)}">15s Showreel neu starten (120 BPM)</button>
            <button type="button" class="signing-close" data-action="dismiss-signing" aria-label="Bestätigung schließen">×</button>
          </div>
        </div>

        <div class="sl-deal-done-split">
          <div class="sl-showreel-player-card">
            <div class="sl-showreel-topbar">
              <strong>THE IRON SEAL · 15.0S MOTION DESIGN SHOWREEL</strong>
              <span id="deal-showreel-timecode" class="sl-showreel-timecode">0.00s / 15.00s · BAR 1 · BEAT 1/30 · 120 BPM</span>
            </div>
            <div id="deal-showreel-svg-stage" class="sl-showreel-svg-stage" aria-label="15-Sekunden Deal Done Motion Design Showreel"></div>
            <div class="sl-showreel-progress-track">
              <span id="deal-showreel-progress-fill" style="width:0%"></span>
            </div>
          </div>

          <div class="sl-contract-static-column">
            ${renderStaticSignatureCard(transfer, league)}
            <div class="signature-pad-box">
              <div class="signature-pad-head">
                <strong>Statische Unterschrift zeichnen / aktualisieren (${escapeHtml(manager?.managerName || 'Manager')})</strong>
                <div style="display:flex;gap:6px">
                  <button type="button" class="button light small" data-action="clear-signature-pad">Löschen</button>
                  <button type="button" class="button primary small" data-action="save-recorded-signature" data-call-id="${escapeHtml(transfer.callId)}">Unterschrift für alle speichern</button>
                </div>
              </div>
              <canvas id="signature-pad-canvas" width="360" height="108"></canvas>
              <small>Zeichne deine Unterschrift — alle anderen Manager sehen exakt dieses gezeichnete Signaturbild auf dem Vertrag.</small>
            </div>
            <button type="button" class="button primary signing-done" data-action="dismiss-signing" style="width:100%;justify-content:center">Weiter zur Super League</button>
          </div>
        </div>
      </section>
    </div>
  `;

  initSignaturePadCanvas('#signature-pad-canvas', recordedSignatureStrokes);
  if (autoPlayShowreel) {
    startDealDoneShowreelLoop(transfer);
  } else {
    const stageEl = document.querySelector('#deal-showreel-svg-stage');
    if (stageEl) {
      stageEl.innerHTML = buildShowreelFrameSvg(12.25, {
        playerName: transfer?.playerName || 'PROFI',
        position: transfer?.position || 'CM',
        rating: Number(transfer?.rating) || 84,
        sellerClub: transfer?.sellerTeamName || 'CLUB A',
        buyerClub: transfer?.buyerTeamName || 'CLUB B',
        fee: Number(transfer?.fee) || 40,
        salary: Number(transfer?.salary) || 8.5,
        years: Number(transfer?.contractYears) || 4,
        agentName: transfer?.agentName || 'AGENT',
        signaturePath: transfer?.signatureSvgPath || transfer?.signatures?.[0]?.svgPath || DEFAULT_SIGNATURE_PATH,
      });
    }
  }
}

function renderAgentNegotiationOverlay() {
  const container = document.querySelector('#agent-negotiation-root');
  if (!container) return;
  if (!activeAgentNegotiationId || !state.league) {
    container.innerHTML = '';
    return;
  }
  const session = (state.league.agentNegotiations ?? []).find((s) => s.id === activeAgentNegotiationId);
  if (!session) {
    activeAgentNegotiationId = '';
    container.innerHTML = '';
    return;
  }
  container.innerHTML = renderAgentNegotiationModal({
    league: state.league,
    session,
    players: state.players,
  });
  if (session.status === 'agreed' || session.status === 'AWAITING_SIGNATURE') {
    agentSignatureStrokes = [];
    initSignaturePadCanvas('#agent-signature-pad-canvas', agentSignatureStrokes);
  }
}

function renderLog() {
  const rows = state.log.map((entry) => `<div class="log-entry"><span class="log-time">${new Date(entry.at).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' })}</span><span class="log-copy"><strong>${escapeHtml(entry.actor)}</strong> · ${escapeHtml(entry.detail)}</span><span class="log-type">${escapeHtml(entry.action)}</span></div>`).join('');
  return `${pageHeader('HOST-TRANSPARENZ', 'Admin-Protokoll.', 'Aktionen des Hosts, CPU-Transfers und Unterschriften werden mit Zeitstempel lokal protokolliert.', state.league ? '<button class="button light" data-action="reset-local">Liga zurücksetzen</button>' : '')}<section class="panel"><div class="panel-header"><h2>Aktivitätsverlauf</h2><span>${state.log.length} EINTRÄGE</span></div>${rows ? `<div class="log-list">${rows}</div>` : `<div class="empty-wide"><div class="empty-icon" style="margin:0 auto 12px">${icon('log', { size: 22 })}</div><h2>Noch keine Admin-Aktionen.</h2><p>Nach dem Erstellen einer Liga, Draft-Picks und Transfers erscheinen die Aktionen hier.</p></div>`}</section>`;
}

function renderPesInspectorOverlay() {
  const container = document.querySelector('#pes-inspector-root');
  if (!container) return;
  if (!inspectedPesPlayerId) {
    container.innerHTML = '';
    return;
  }
  const rawPlayer = state.players.find((p) => p.id === inspectedPesPlayerId)
    || (state.league?.draft?.picks ?? [])
      .filter((pick) => pick.playerId === inspectedPesPlayerId)
      .map((pick) => ({ id: pick.playerId, name: pick.playerName, position: pick.position, rating: pick.rating, club: pick.teamName }))[0];
  if (!rawPlayer) {
    inspectedPesPlayerId = '';
    container.innerHTML = '';
    return;
  }
  const manager = activeManager();
  const realPool = getRealDraftPool();
  const enforceScouting = Boolean(state.league && isDraftComplete(state.league, realPool));
  container.innerHTML = renderPesPlayerModal(rawPlayer, state.league, {
    activeManagerTeamId: manager?.id || '',
    enforceScouting,
  });
}

function renderMatchReportOverlay() {
  const container = document.querySelector('#pes-player-modal-root');
  if (!container) return;
  if (!inspectedMatchFixtureId || !state.league) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = renderMatchReportModal(state.league, inspectedMatchFixtureId);
}

function downloadPesFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function render() {
  if (!(currentView in DASHBOARD_VIEWS)) currentView = 'overview';
  if (state.players?.length) {
    state.players = syncPlayersWithLeague(state.players, state.league);
  }
  const realPool = getRealDraftPool();
  const draftDone = Boolean(state.league && isDraftComplete(state.league, realPool));
  if (currentView === 'draft' && draftDone) {
    currentView = 'calendar';
  }
  const draftNavBtn = document.querySelector('.nav-item[data-view="draft"]');
  if (draftNavBtn) {
    draftNavBtn.hidden = draftDone;
    draftNavBtn.disabled = draftDone;
    if (draftDone) {
      draftNavBtn.setAttribute('aria-hidden', 'true');
    } else {
      draftNavBtn.removeAttribute('aria-hidden');
    }
  }
  const unreadMailCount = (state.league?.mailItems ?? []).filter((m) => !m.read).length;
  const mailBadge = document.querySelector('#mail-nav-count');
  if (mailBadge) {
    mailBadge.hidden = unreadMailCount === 0;
    mailBadge.textContent = String(unreadMailCount);
  }
  const koNavLock = document.querySelector('#knockout-nav-lock');
  if (koNavLock) {
    const isKoUnlocked = Boolean(state.league && isLeaguePhaseComplete(state.league));
    koNavLock.classList.toggle('is-locked', !isKoUnlocked);
    koNavLock.classList.toggle('is-unlocked', isKoUnlocked);
    koNavLock.textContent = isKoUnlocked ? 'OPEN' : 'LOCK';
    koNavLock.title = isKoUnlocked ? 'Playoffs & K.-o.-Phase freigeschaltet' : 'Gesperrt: Erst nach Spieltag 58 verfügbar';
  }
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === currentView || (currentView === 'club' && button.dataset.view === 'table')));
  document.querySelector('#crumb-title').textContent = DASHBOARD_VIEWS[currentView] || 'Übersicht';
  document.querySelector('#host-name').textContent = state.league?.adminName || 'Admin';
  document.querySelector('.top-avatar').textContent = initials(state.league?.adminName || 'Admin');
  refreshManagerSelector();
  const pages = {
    overview: renderOverview,
    setup: renderSetup,
    draft: renderDraft,
    calendar: renderCalendar,
    mail: renderDesktopMail,
    transfers: renderDesktopTransfers,
    finances: renderDesktopFinances,
    news: renderDesktopNews,
    table: renderTable,
    club: renderClubPage,
    knockout: renderKnockout,
    squad: renderSquad,
    matches: renderMatches,
    log: renderLog,
  };
  renderTitleScreen();
  root.innerHTML = pages[currentView]();
  if (currentView === 'knockout' || currentView === 'overview') cleanTrophyCheckerboard(root);
  cleanEslLogoBackground();
  bindCrystalStarballActions(document);
  if (!titleScreenOpen) {
    const overviewBallMount = root.querySelector('#sl-overview-crystal-ball');
    if (overviewBallMount) {
      mountCrystalStarball3D(overviewBallMount, { variant: 'hero' });
    }
  }
  renderPhoneShell();
  renderMatchReportOverlay();
  renderPesInspectorOverlay();
  renderAgentNegotiationOverlay();
  if (currentView === 'setup') refreshSetupSummary();
}

function refreshSetupSummary() {
  const selectedCountEl = root.querySelector('#selected-count');
  if (!selectedCountEl) return;
  const selected = root.querySelectorAll('[data-team-id]:checked').length;
  const humanCount = setupManagers.filter((m) => (m.name || '').trim()).length || 1;
  selectedCountEl.textContent = selected;
  root.querySelector('#summary-teams').textContent = `${selected} / 30`;
  root.querySelector('#summary-humans').textContent = humanCount;
  root.querySelector('#summary-cpu').textContent = Math.max(0, 30 - humanCount);
  const summaryPlayersEl = root.querySelector('#summary-players');
  if (summaryPlayersEl) summaryPlayersEl.textContent = state.players.length || 1816;
}
function finalizeCompletedDraft() {
  const realPool = getRealDraftPool();
  if (!state.league || !isDraftComplete(state.league, realPool)) return;
  if (!state.league.schedule?.length) {
    const initialized = ensureCalendar(state.league);
    if (!initialized.error) state.league = initialized.league;
  }
  ensureGeneratedTalentsInPool(16);
  const ensuredDeals = ensureHijackableDeals(state.league, state.players);
  if (ensuredDeals.league) state.league = ensuredDeals.league;
  const manager = activeManager();
  const ensuredMail = ensureMailInboxInitialized(state.league, state.players, manager?.id || '');
  if (ensuredMail.league) state.league = ensuredMail.league;
  const firstPick = state.league.draft.picks[0];
  state.league = appendNewsEvent(state.league, {
    id: `draft-completed-${state.league.season || '2026-27'}`,
    type: 'draft-completed',
    firstPickPlayer: firstPick?.playerName || 'Top-Pick',
    firstPickTeam: firstPick?.teamName || 'Pick #1',
    totalPicks: state.league.draft.picks.length,
    createdAt: new Date().toISOString(),
  });
}
function runCpuTransferMarket({ manual = false } = {}) {
  if (!state.league || !(state.league.draft?.picks?.length)) {
    if (manual) toast('Starte zuerst eine Liga und drafte die Kader (z. B. per Auto-Draft).');
    return;
  }
  const manager = activeManager();
  const market = simulateCpuTransferMarketStep(state.league, {
    players: state.players,
    seed: `${Date.now()}-${state.league.transfers?.length || 0}-${state.league.calls?.length || 0}`,
    maxCpuToCpuDeals: 2,
    targetHumanTeamId: '', // CPU offers to human now arrive via Postfach (Mail App), not Phone!
    allowOutsideWindow: manual,
  });
  let nextLeague = market.league;
  // Convert any CPU-to-Human offer into a Postfach (Mail App) item only when window is open (or manual)
  const windowIsOpen = isTransferWindowOpen(nextLeague.currentDate || '2026-08-01');
  const myRosterPicks = (nextLeague.draft?.picks ?? []).filter((p) => p.teamId === manager?.id);
  const cpuClubs = (nextLeague.teams ?? []).filter((t) => t.id !== manager?.id && t.managerType === 'cpu');
  let newMailOffer = null;
  const shouldSendOffer = (manual || (windowIsOpen && Math.random() < 0.35)) && manager && myRosterPicks.length && cpuClubs.length;
  if (shouldSendOffer) {
    const buyerClub = cpuClubs[(Date.now() + (nextLeague.mailItems?.length || 0)) % cpuClubs.length];
    const targetPick = myRosterPicks[(Date.now() + 3) % myRosterPicks.length];
    const mktVal = calculatePlayerMarketValue({ rating: targetPick.rating || 82, position: targetPick.position || 'CM' });
    const fee = Math.max(8, Math.round(mktVal * 1.06));
    newMailOffer = {
      id: `mail-cpu-offer-${Date.now()}`,
      type: 'incoming-offer',
      status: 'pending',
      stage: 'club-fee',
      read: false,
      senderName: `${buyerClub.managerName || 'Sportdirektor'} (${buyerClub.name})`,
      senderRole: 'CPU-Transferangebot · Postfach',
      senderTeamId: buyerClub.id,
      senderTeamName: buyerClub.name,
      recipientTeamId: manager.id,
      recipientTeamName: manager.name,
      fromTeamId: buyerClub.id,
      fromTeamName: buyerClub.name,
      toTeamId: manager.id,
      toTeamName: manager.name,
      sellerTeamId: manager.id,
      sellerTeamName: manager.name,
      buyerTeamId: buyerClub.id,
      buyerTeamName: buyerClub.name,
      playerId: targetPick.playerId,
      playerName: targetPick.playerName,
      position: targetPick.position || 'CM',
      rating: targetPick.rating || 82,
      fee,
      offeredFee: fee,
      currentFee: fee,
      marketValue: mktVal,
      subject: `Offizielles Transferangebot: ${fee} Mio. € für ${targetPick.playerName}`,
      body: `${buyerClub.name} hinterlegt im Postfach ein schriftliches Ablöseangebot über ${fee} Mio. € für ${targetPick.playerName} (${targetPick.position || 'CM'}, OVR ${targetPick.rating || 82}). Du kannst im Postfach annehmen, gegenbieten oder ablehnen.`,
      createdAt: new Date().toISOString(),
    };
    nextLeague.mailItems = [newMailOffer, ...(nextLeague.mailItems ?? [])].slice(0, 120);
    selectedMailId = newMailOffer.id;
    logAction('CPU-Transferangebot im Postfach', `${buyerClub.name} bietet schriftlich ${fee} Mio. € für ${targetPick.playerName}`);
  }
  const hijackStep = ensureHijackableDeals(nextLeague, state.players, {
    advanceExisting: true,
    seed: `${Date.now()}-hijack`,
  });
  if (hijackStep.league) {
    nextLeague = hijackStep.league;
    for (const completedDeal of hijackStep.completedDeals || []) {
      nextLeague = appendNewsEvent(nextLeague, {
        id: `pending-deal-done-${completedDeal.callId}`,
        type: 'transfer-completed',
        playerName: completedDeal.playerName,
        sellerTeamId: completedDeal.sellerTeamId,
        sellerTeamName: completedDeal.sellerTeamName,
        buyerTeamId: completedDeal.buyerTeamId,
        buyerTeamName: completedDeal.buyerTeamName,
        fee: completedDeal.fee,
        createdAt: completedDeal.signedAt,
      });
    }
  }
  for (const tr of market.cpuTransfers) {
    nextLeague = appendNewsEvent(nextLeague, {
      id: `cpu-transfer-${tr.callId}`,
      type: 'transfer-completed',
      playerName: tr.playerName,
      sellerTeamId: tr.sellerTeamId,
      sellerTeamName: tr.sellerTeamName,
      buyerTeamId: tr.buyerTeamId,
      buyerTeamName: tr.buyerTeamName,
      fee: tr.fee,
      createdAt: tr.signedAt,
    });
    logAction('CPU-Transfer abgeschlossen', `${tr.playerName} (${tr.position} · OVR ${tr.rating}) wechselt für ${tr.fee} Mio. € von ${tr.sellerTeamName} zu ${tr.buyerTeamName} (${tr.reason})`);
  }
  state.league = nextLeague;
  save();
  checkIncomingVibration();
  render();
  if (newMailOffer) {
    toast(`Neues Transferangebot im Postfach: ${newMailOffer.fromTeamName} bietet ${newMailOffer.fee} Mio. € für ${newMailOffer.playerName}!`);
  } else if (market.cpuTransfers.length) {
    toast(`${market.cpuTransfers.length} realistische CPU-Transfers abgeschlossen & Hijack-Radar aktualisiert!`);
  } else if (manual) {
    toast('Postfach, Hijack-Radar & laufende Transfer-Verhandlungen wurden aktualisiert.');
  }
}
function startLeague(form, { autoDraft = false } = {}) {
  const data = new FormData(form);
  // Read current manager inputs from DOM to ensure any unsaved keystrokes are recorded
  root.querySelectorAll('[data-setup-manager-name]').forEach((inp) => {
    const idx = Number(inp.dataset.setupManagerName);
    if (setupManagers[idx]) {
      setupManagers[idx].name = inp.value.trim() || setupManagers[idx].name;
    }
  });
  root.querySelectorAll('[data-setup-manager-team]').forEach((sel) => {
    const idx = Number(sel.dataset.setupManagerTeam);
    if (setupManagers[idx]) {
      setupManagers[idx].teamId = sel.value;
    }
  });

  const selectedIds = [...root.querySelectorAll('[data-team-id]:checked')].map((input) => input.dataset.teamId);
  if (selectedIds.length !== 30) return toast('Für Schritt 1 müssen genau 30 Teams ausgewählt sein.');

  const startingBudget = Math.max(80, Math.min(350, Number(data.get('startingBudget')) || 150));
  const wonderkidCount = Math.max(8, Math.min(32, Number(data.get('wonderkidCount')) || 16));

  const { teams, humanCount, adminName } = assignManagersToTeams(selectedIds, setupManagers, seedTeams, startingBudget);

  const name = String(data.get('leagueName')).trim() || 'Super League';
  const season = String(data.get('season')).trim() || '2026/27';
  setupBuilderOpen = false;

  state.league = {
    name,
    season,
    adminName,
    teams,
    createdAt: new Date().toISOString(),
    draft: { order: shuffle(teams.map((team) => team.id)), picks: [] },
    match: null,
    matchHistory: [],
    calls: [],
    transfers: [],
    news: [],
    scouting: {},
    shortlists: {},
    contracts: {},
  };
  // Regenerate fresh wonderkids for the new league
  const realPlayers = (state.players ?? []).filter((p) => !p.isGeneratedTalent);
  const usedIds = new Set(realPlayers.map((p) => p.id));
  const generatedTalents = generateRandomTalents(wonderkidCount, {
    seed: `${name}-${season}-${Date.now()}`,
    existingIds: usedIds,
  });
  state.players = [...realPlayers, ...generatedTalents];

  const hostTeam = teams.find((t) => t.managerType === 'human' && t.managerName === adminName) || teams.find((t) => t.managerType === 'human') || teams[0];
  sessionStorage.setItem(`${SESSION_KEY}-manager`, hostTeam.id);
  logAction('Schritt 1 abgeschlossen · Liga erstellt', `${name} · 30 Teams · ${humanCount} menschliche Manager · ${generatedTalents.length} Zufalls-Wunderkinder`);
  const realPool = getRealDraftPool();
  if (autoDraft && realPool.length) {
    state.league.draft.picks = autoDraftAllPicks(state.league.teams, state.league.draft.order, [], realPool);
    finalizeCompletedDraft();
    logAction('Schritt 2 abgeschlossen · Auto-Draft', `Alle ${state.league.draft.picks.length} Spieler (30 pro Team) wurden im Snake Draft verteilt · Draft-Tab gesperrt`);
    save();
    toast(`Super League erstellt & ${state.league.draft.picks.length} Spieler gedraftet! Snake Draft abgeschlossen.`);
    setView('calendar');
    return;
  }
  save();
  toast('Schritt 1 bestätigt! Jetzt startet Schritt 2: Der Snake Draft.');
  setView('draft');
}
function addPick(player) {
  const team = nextPick();
  if (!team || state.league.draft.picks.some((pick) => pick.playerId === player.id)) return;
  const pick = { playerId: player.id, playerName: player.name, position: player.position || 'CM', rating: player.rating, teamId: team.id, teamName: team.name, managerName: team.managerName, number: state.league.draft.picks.length + 1, round: Math.floor(state.league.draft.picks.length / 30) + 1, at: new Date().toISOString() };
  state.league.draft.picks.push(pick);
  logAction(team.managerType === 'cpu' ? 'CPU-Draftpick' : 'Draftpick', `${team.managerName} wählt ${player.name} für ${team.name}`);
  const realPool = getRealDraftPool();
  if (isDraftComplete(state.league, realPool)) {
    finalizeCompletedDraft();
    save();
    toast('Snake Draft abgeschlossen! Der Draft-Tab ist nun geschlossen.');
    setView('calendar');
    return;
  }
  save();
  render();
}
function simulateCpuPick() {
  const team = nextPick();
  if (!canManagerSimulateCpu(team, activeManager(), state.league?.adminName)) return toast('Nur der Host darf CPU-Picks simulieren.');
  const realPool = getRealDraftPool();
  const previousCount = state.league.draft.picks.length;
  const picks = simulateCpuPicksUntilHumanTurn(state.league.teams, state.league.draft.order, state.league.draft.picks, realPool);
  if (picks.length === previousCount) return toast('Keine CPU-Auswahl möglich.');
  const added = picks.slice(previousCount);
  state.league.draft.picks = picks;
  for (const pick of added) logAction('CPU-Draftpick', `${pick.managerName} wählt ${pick.playerName} für ${pick.teamName}`);
  if (isDraftComplete(state.league, realPool)) {
    finalizeCompletedDraft();
    save();
    toast('Snake Draft abgeschlossen! Der Draft-Tab ist nun geschlossen.');
    setView('calendar');
    return;
  }
  save(); render();
  toast(`${added.length} CPU-Pick${added.length === 1 ? '' : 's'} simuliert.`);
}
function autoDraftAll() {
  if (!state.league) return toast('Erstelle zuerst eine Liga.');
  if (!canManagerAutoDraft(activeManager(), state.league.adminName)) return toast('Nur der Host darf den kompletten Auto-Draft ausführen.');
  const realPool = getRealDraftPool();
  if (!realPool.length) return toast('Noch kein Spielerpool geladen.');
  const previousCount = state.league.draft.picks.length;
  const picks = autoDraftAllPicks(state.league.teams, state.league.draft.order, state.league.draft.picks, realPool);
  const addedCount = picks.length - previousCount;
  if (!addedCount) return toast('Alle 30 Teams haben bereits 30 Spieler gedraftet.');
  state.league.draft.picks = picks;
  finalizeCompletedDraft();
  logAction('Auto-Draft abgeschlossen', `${addedCount} Picks automatisch verteilt · ${picks.length} Spieler in 30 Kadern (30 pro Team)`);
  save();
  toast(`Auto-Draft abgeschlossen: Alle 30 Teams haben 30 Spieler! Snake-Draft-Tab wurde geschlossen.`);
  setView('calendar');
}
function importCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const players = parseRosterCsv(reader.result);
      if (!players.length) throw new Error('CSV enthält keine Spielerzeilen.');
      if (csvImportMode === 'replace' && state.league?.draft?.picks?.length) return toast('Ein laufender Draft bleibt erhalten. Nutze „Spieler hinzufügen“, um neue Spieler anzuhängen.');
      const previousCount = state.players.length;
      const nextPlayers = csvImportMode === 'append' ? mergeRosterPools(state.players, players) : players;
      const addedCount = nextPlayers.length - previousCount;
      if (csvImportMode === 'append' && !addedCount) return toast('Die CSV enthält keine neuen Spieler, die noch nicht im Draftpool sind.');
      state.players = nextPlayers;
      logAction(csvImportMode === 'append' ? 'Spielerpool erweitert' : 'Spielerpool importiert', `${csvImportMode === 'append' ? `${addedCount} neue Spieler ergänzt · ` : ''}${nextPlayers.length} von maximal ${MAX_DRAFT_POOL} Spielern`);
      save();
      toast(csvImportMode === 'append' ? `${addedCount} neue Spieler ergänzt.` : `${players.length} Spieler für den Draft importiert.`);
      render();
    } catch (error) { toast(error.message); }
  };
  reader.onerror = () => toast('Die CSV-Datei konnte nicht gelesen werden.');
  reader.readAsText(file, 'utf-8');
}
function addCustomTeam() {
  const nameInput = root.querySelector('#custom-team-name');
  const replaceSelect = root.querySelector('#replace-team');
  const name = nameInput.value.trim();
  if (!name) return toast('Gib zuerst einen Namen für dein eigenes Team ein.');
  const replacement = seedTeams.find((team) => team.id === replaceSelect.value);
  const selection = root.querySelector(`[data-team-id="${replacement?.id}"]`);
  if (!selection?.checked) return toast('Wähle einen aktuell ausgewählten Club zum Ersetzen.');
  const replacementName = replacement.name;
  replacement.name = name;
  replacement.league = 'Eigenes Team';
  replacement.custom = true;
  const card = selection.closest('.team-option');
  const label = card.querySelector('label');
  label.querySelector('.crest').textContent = initials(name);
  label.querySelector('.club-name').textContent = name;
  label.querySelector('.league-name').textContent = 'Eigenes Team';
  card.dataset.replaced = replacementName;
  nameInput.value = '';
  toast(`${name} ersetzt ${replacementName} im Team-Pool.`);
}
function downloadTemplate() {
  const content = 'player_name,club,position,overall,coach\n"Sample Player",Arsenal,CM,85,"Coach Name"\n';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  link.download = 'career-roster-template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}
function createMatch(form) {
  const data = new FormData(form);
  const home = state.league.teams.find((team) => team.id === data.get('home'));
  const away = state.league.teams.find((team) => team.id === data.get('away'));
  if (!home || !away || home.id === away.id) return toast('Wähle zwei unterschiedliche Teams.');
  pesHomeTeamId = home.id;
  pesAwayTeamId = away.id;
  state.league.match = { id: globalThis.crypto?.randomUUID?.() ?? `match-${Date.now()}`, home: home.name, away: away.name, homeId: home.id, awayId: away.id, status: 'Lobby bereit · FIFA 17 Online', result: null, at: new Date().toISOString() };
  logAction('Match-Lobby erstellt', `${home.name} gegen ${away.name}`);
  save(); render(); toast('Match-Lobby & FIFA 17 Taktik-Vorschau vorbereitet.');
}
function saveScore() {
  if (!state.league?.match) return;
  const home = Number(root.querySelector('#home-score').value);
  const away = Number(root.querySelector('#away-score').value);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) return toast('Bitte ein gültiges Ergebnis eingeben.');
  const previousLeague = structuredClone(state.league);
  state.league.match.result = { home, away, confirmedBy: state.league.adminName, at: new Date().toISOString() };
  state.league.matchHistory ??= [];
  const matchRecord = { matchId: state.league.match.id, homeId: state.league.match.homeId, awayId: state.league.match.awayId, homeScore: home, awayScore: away, at: state.league.match.result.at };
  const previous = state.league.matchHistory.findIndex((entry) => entry.matchId === matchRecord.matchId);
  if (previous >= 0) state.league.matchHistory[previous] = matchRecord; else state.league.matchHistory.push(matchRecord);
  state.league = detectSimulationNewsEvents(previousLeague, state.league);
  if (home !== away) {
    const homeTeam = state.league.teams.find((t) => t.id === state.league.match.homeId);
    const awayTeam = state.league.teams.find((t) => t.id === state.league.match.awayId);
    if (homeTeam && awayTeam) {
      const slanderPost = buildMatchDefeatSlanderPost(matchRecord, homeTeam, awayTeam, state.league.draftPicks ?? []);
      if (slanderPost) state.league = appendNewsEvent(state.league, slanderPost);
    }
  }
  state.league = appendNewsEvent(state.league, {
    id: `match-hub-${state.league.match.id}-${home}-${away}`,
    type: 'human-match-result',
    homeTeamId: state.league.match.homeId,
    homeTeamName: state.league.match.home,
    awayTeamId: state.league.match.awayId,
    awayTeamName: state.league.match.away,
    homeScore: home,
    awayScore: away,
    createdAt: state.league.match.result.at,
  });
  logAction('Ergebnis erfasst', `${state.league.match.home} ${home}:${away} ${state.league.match.away}`);
  save(); render(); toast('Ergebnis lokal gespeichert.');
}
function saveCalendarFixtureScore(form) {
  const manager = activeManager();
  const inputs = [...form.querySelectorAll('[aria-label^="Tore "]')];
  const homeScore = Number(inputs[0]?.value);
  const awayScore = Number(inputs[1]?.value);
  const allowOverwrite = form.dataset.allowOverwrite === 'true';
  const previousLeague = structuredClone(state.league);
  const result = recordHumanFixtureResult(state.league, form.dataset.fixtureId, homeScore, awayScore, {
    managerTeamId: manager?.id,
    allowOverwrite,
  });
  if (result.error) return toast(result.error);
  const home = result.league.teams.find((team) => team.id === result.fixture.homeId);
  const away = result.league.teams.find((team) => team.id === result.fixture.awayId);
  let nextLeague = detectSimulationNewsEvents(previousLeague, result.league);
  if (home && away && homeScore !== awayScore) {
    const slanderPost = buildMatchDefeatSlanderPost(result.fixture, home, away, state.league.draftPicks ?? []);
    if (slanderPost) nextLeague = appendNewsEvent(nextLeague, slanderPost);
  }
  nextLeague = appendNewsEvent(nextLeague, {
    id: `human-fixture-${result.fixture.id}-${homeScore}-${awayScore}-${result.edited ? 'edit' : 'new'}`,
    type: 'human-match-result',
    homeTeamId: home?.id,
    homeTeamName: home?.name,
    awayTeamId: away?.id,
    awayTeamName: away?.name,
    homeScore,
    awayScore,
    round: result.fixture.round,
    createdAt: new Date().toISOString(),
  });
  state.league = nextLeague;
  logAction(result.edited ? 'Menschenspiel bearbeitet' : 'Menschenspiel eingetragen', `${home?.name} ${homeScore}:${awayScore} ${away?.name} (ST ${result.fixture.round})`);
  save(); render(); toast(result.edited ? 'Ergebnis wurde im Saisonkalender aktualisiert.' : 'Ergebnis im gemeinsamen Saisonkalender gespeichert.');
}
function stopLiveCalendarSimulation() {
  isSimulatingCalendarLive = false;
  if (liveCalendarSimTimer) {
    clearInterval(liveCalendarSimTimer);
    liveCalendarSimTimer = null;
  }
}

function simulateCalendarDate(explicitTargetDate = '') {
  const manager = activeManager();
  if (!isLeagueHost(state.league, manager?.id)) return toast('Nur der Host darf den Kalender fortschreiben.');
  const targetInput = document.querySelector('#calendar-target-date');
  let targetDate = explicitTargetDate || targetInput?.value || selectedCalendarDate;
  const currentIso = state.league?.currentDate;

  // Fallback if targetDate is empty or in the past: auto-target next uncompleted matchday
  if (!targetDate || (currentIso && targetDate < currentIso)) {
    const uncompletedToday = (state.league?.schedule ?? []).some((f) => f.date === currentIso && f.status !== 'completed');
    if (uncompletedToday) {
      targetDate = currentIso;
    } else {
      const nextFixture = (state.league?.schedule ?? []).find((f) => f.date > currentIso && f.status !== 'completed');
      targetDate = nextFixture ? nextFixture.date : currentIso;
    }
  }

  const previousLeague = structuredClone(state.league);
  const result = simulateThroughDate(state.league, targetDate, { bypassHumanLock: true, isHost: true });
  if (result.error) {
    stopLiveCalendarSimulation();
    if (result.stoppedAtDate) selectedCalendarDate = result.stoppedAtDate;
    render();
    return toast(result.error);
  }
  state.league = detectSimulationNewsEvents(previousLeague, result.league);
  selectedCalendarDate = result.summary.currentDate || targetDate;
  logAction('Kalender simuliert', `Bis ${selectedCalendarDate}: ${result.summary.simulatedCount} Spiele simuliert`);
  runCpuTransferMarket({ manual: false });
  save(); render();
  toast(`${result.summary.simulatedCount} Spiele bis ${selectedCalendarDate} erfolgreich simuliert.`);
}

function toggleLiveCalendarSimulation() {
  const manager = activeManager();
  if (!isLeagueHost(state.league, manager?.id)) return toast('Nur der Host darf die Live-Simulation steuern.');
  if (isSimulatingCalendarLive) {
    stopLiveCalendarSimulation();
    render();
    toast('Live-Simulation pausiert.');
    return;
  }

  const targetInput = document.querySelector('#calendar-target-date');
  const lastDate = state.league?.schedule?.at(-1)?.date || state.league?.currentDate;
  let finalTarget = targetInput?.value || selectedCalendarDate || lastDate;
  if (!finalTarget || finalTarget <= state.league.currentDate) {
    finalTarget = lastDate;
  }

  isSimulatingCalendarLive = true;
  render();

  liveCalendarSimTimer = setInterval(() => {
    if (!state.league || !isSimulatingCalendarLive) {
      stopLiveCalendarSimulation();
      return;
    }
    const stepDate = getNextCalendarStepDate(state.league, finalTarget);
    if (!stepDate || stepDate <= state.league.currentDate) {
      stopLiveCalendarSimulation();
      render();
      toast('Zieldatum der Live-Simulation erreicht.');
      return;
    }
    const previousLeague = structuredClone(state.league);
    const stepResult = simulateThroughDate(state.league, stepDate, { bypassHumanLock: true, isHost: true });
    if (stepResult.error) {
      stopLiveCalendarSimulation();
      render();
      toast(stepResult.error);
      return;
    }
    state.league = detectSimulationNewsEvents(previousLeague, stepResult.league);
    selectedCalendarDate = stepResult.summary.currentDate;
    if (stepResult.summary.simulatedCount > 0) {
      logAction('Live-Simulation Spieltag', `${selectedCalendarDate}: ${stepResult.summary.simulatedCount} Spiele berechnet`);
    }
    if (selectedCalendarDate >= finalTarget) {
      stopLiveCalendarSimulation();
      save();
      render();
      toast(`Live-Simulation bis ${selectedCalendarDate} abgeschlossen.`);
      return;
    }
    save();
    render();
  }, liveSimSpeedMs);
}

function simulateSingleDay() {
  const manager = activeManager();
  if (!isLeagueHost(state.league, manager?.id)) return toast('Nur der Host darf den Kalender fortschreiben.');
  const currentIso = state.league?.currentDate;
  if (!currentIso) return toast('Kein Kalenderstand vorhanden.');
  // Add 1 day
  const d = new Date(`${currentIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const nextDay = d.toISOString().slice(0, 10);
  simulateCalendarDate(nextDay);
}

function simulateMonthStep() {
  const manager = activeManager();
  if (!isLeagueHost(state.league, manager?.id)) return toast('Nur der Host darf den Kalender fortschreiben.');
  const currentIso = state.league?.currentDate;
  if (!currentIso) return toast('Kein Kalenderstand vorhanden.');
  // Add 30 days
  const d = new Date(`${currentIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  const nextMonth = d.toISOString().slice(0, 10);
  const lastDate = state.league?.schedule?.at(-1)?.date || nextMonth;
  const target = nextMonth > lastDate ? lastDate : nextMonth;
  simulateCalendarDate(target);
}

function stepToNextMatchday() {
  const manager = activeManager();
  if (!isLeagueHost(state.league, manager?.id)) return toast('Nur der Host darf zum nächsten Spieltag springen.');
  const currentIso = state.league?.currentDate;
  const uncompletedToday = (state.league?.schedule ?? []).find((f) => f.date === currentIso && f.status !== 'completed');
  if (uncompletedToday) {
    return simulateCalendarDate(currentIso);
  }
  const nextFixture = (state.league?.schedule ?? []).find((f) => f.date > currentIso && f.status !== 'completed');
  if (!nextFixture) return toast('Alle Spieltage der Saison sind bereits abgeschlossen.');
  simulateCalendarDate(nextFixture.date);
}

async function triggerPesLiveMatchSync(fixtureId = '') {
  if (!state.league) return toast('Erstelle zuerst eine Liga.');
  const schedule = state.league.schedule ?? [];
  let targetFixture = fixtureId ? schedule.find((f) => f.id === fixtureId) : null;
  if (!targetFixture && state.league.match?.fixtureId) {
    targetFixture = schedule.find((f) => f.id === state.league.match.fixtureId) || null;
  }
  if (!targetFixture) {
    targetFixture = schedule.find((f) => {
      if (f.status === 'completed') return false;
      const h = state.league.teams.find((t) => t.id === f.homeId);
      const a = state.league.teams.find((t) => t.id === f.awayId);
      return h?.managerType === 'human' && a?.managerType === 'human' && (!state.league.currentDate || f.date <= state.league.currentDate);
    }) || schedule.find((f) => {
      if (f.status === 'completed') return false;
      const h = state.league.teams.find((t) => t.id === f.homeId);
      const a = state.league.teams.find((t) => t.id === f.awayId);
      return h?.managerType === 'human' && a?.managerType === 'human';
    }) || null;
  }

  const homeId = targetFixture?.homeId || state.league.match?.homeId || pesHomeTeamId || state.league.teams[0]?.id;
  const awayId = targetFixture?.awayId || state.league.match?.awayId || pesAwayTeamId || state.league.teams[1]?.id;
  const homeStrength = calculateTeamPesStrength(homeId, state.league, state.players);
  const awayStrength = calculateTeamPesStrength(awayId, state.league, state.players);
  const seedMod = (homeStrength.overall + awayStrength.overall + (state.league.matchHistory?.length || 0)) % 4;
  const homeScore = Math.max(0, Math.min(5, Math.round((homeStrength.attack - awayStrength.defense) / 10) + 1 + (seedMod % 2)));
  const awayScore = Math.max(0, Math.min(5, Math.round((awayStrength.attack - homeStrength.defense) / 11) + 1 + ((seedMod + 1) % 2 === 0 ? 1 : 0)));

  const payload = {
    source: 'pes-sider-live',
    fixtureId: targetFixture?.id || state.league.match?.fixtureId || '',
    homeTeamId: homeId,
    awayTeamId: awayId,
    homeScore,
    awayScore,
  };

  try {
    if (sharedReady) {
      await saveQueue;
      const resp = await fetch('/api/pes-sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const syncedData = await resp.json();
        await pollSharedState();
        if (syncedData.syncRecord) {
          toast(`FIFA 17 Live-Sync: ${syncedData.syncRecord.homeName} ${syncedData.syncRecord.homeScore}:${syncedData.syncRecord.awayScore} ${syncedData.syncRecord.awayName} übertragen!`);
          return;
        }
      }
    }
  } catch {
    // Fallback to local sync if server call is unavailable
  }

  const previousLeague = structuredClone(state.league);
  const synced = applyPesLiveMatchSync(state.league, payload);
  if (synced.error) return toast(synced.error);
  let nextLeague = detectSimulationNewsEvents(previousLeague, synced.league);
  nextLeague = appendNewsEvent(nextLeague, {
    id: `pes-sync-${synced.syncRecord.fixtureId}-${synced.syncRecord.homeScore}-${synced.syncRecord.awayScore}`,
    type: 'human-match-result',
    homeTeamId: synced.homeTeam.id,
    homeTeamName: synced.homeTeam.name,
    awayTeamId: synced.awayTeam.id,
    awayTeamName: synced.awayTeam.name,
    homeScore: synced.syncRecord.homeScore,
    awayScore: synced.syncRecord.awayScore,
    round: synced.syncRecord.round,
    createdAt: synced.syncRecord.syncedAt,
  });
  state.league = nextLeague;
  logAction('FIFA 17 Live-Sync', `${synced.homeTeam.name} ${synced.syncRecord.homeScore}:${synced.syncRecord.awayScore} ${synced.awayTeam.name}`);
  save();
  render();
  toast(`FIFA 17 Live-Sync: ${synced.homeTeam.name} ${synced.syncRecord.homeScore}:${synced.syncRecord.awayScore} ${synced.awayTeam.name} synchronisiert!`);
}
function updateLeague(result, logMeta = null) {
  if (result.error) return toast(result.error);
  const previous = structuredClone(state);
  state.league = result.league;
  if (logMeta) logAction(logMeta.action, logMeta.detail);
  save(); render();
  announceNewTransfer(previous, state);
}
function handleOfferSubmission(callId, playerId, fee) {
  const manager = activeManager();
  if (!manager || !state.league) return;
  const result = submitOffer(state.league, callId, manager.id, { playerId, fee });
  if (result.error) return toast(result.error);
  const isCounter = (result.call.offers?.length ?? 0) > 1;
  let nextLeague = result.league;
  if (isCounter) {
    nextLeague = appendNewsEvent(nextLeague, {
      id: `counter-${result.offer.id}`,
      type: 'offer-countered',
      playerName: result.offer.playerName,
      sellerTeamId: result.offer.sellerTeamId,
      sellerTeamName: result.sellerName,
      buyerTeamId: result.offer.buyerTeamId,
      buyerTeamName: result.buyerName,
      fee: result.offer.fee,
      createdAt: result.offer.createdAt,
    });
  }
  state.league = nextLeague;
  logAction(isCounter ? 'Gegenangebot gesendet' : 'Transferangebot gesendet', `${result.offer.playerName}: ${Number(result.offer.fee).toLocaleString('de-DE')} Mio. (${result.sellerName} → ${result.buyerName})`);
  save(); render();

  const otherId = manager.id === result.call.callerTeamId ? result.call.targetTeamId : result.call.callerTeamId;
  const otherTeam = state.league.teams.find((t) => t.id === otherId);
  if (otherTeam?.managerType === 'cpu' && !onlineManagerIds.includes(otherId)) {
    setTimeout(() => {
      const liveCall = state.league?.calls?.find((c) => c.id === callId);
      const pendingOffer = liveCall?.offers?.at(-1);
      if (!liveCall || liveCall.status !== 'negotiating' || !pendingOffer || pendingOffer.status !== 'pending' || pendingOffer.fromTeamId !== manager.id) return;
      const pick = state.league.draft?.picks?.find((p) => p.playerId === pendingOffer.playerId);
      const sellerRosterCount = (state.league.draft?.picks ?? []).filter((p) => p.teamId === pendingOffer.sellerTeamId).length;
      const humanOffersCount = (liveCall.offers ?? []).filter((o) => o.fromTeamId === manager.id).length;
      const cpuEval = evaluateCpuOfferResponse({
        playerRating: pick?.rating ?? 80,
        position: pick?.position ?? 'CM',
        fee: pendingOffer.fee,
        sellerRosterCount,
        offerRound: humanOffersCount,
        requireMultiRound: true,
      });
      if (cpuEval.decision === 'accept') {
        if (!isTransferWindowOpen(state.league.currentDate)) {
          toast(`${otherTeam.name} stimmt den Konditionen zu — der Abschluss ist ab Öffnung des Transferfensters möglich.`);
          return;
        }
        const accepted = acceptOffer(state.league, callId, otherId);
        if (!accepted.error) {
          const previous = structuredClone(state);
          state.league = appendNewsEvent(accepted.league, {
            id: `transfer-${accepted.transfer.callId}-${accepted.transfer.playerId}`,
            type: 'transfer-completed',
            playerName: accepted.transfer.playerName,
            sellerTeamId: accepted.transfer.sellerTeamId,
            sellerTeamName: accepted.transfer.sellerTeamName,
            buyerTeamId: accepted.transfer.buyerTeamId,
            buyerTeamName: accepted.transfer.buyerTeamName,
            fee: accepted.transfer.fee,
            createdAt: accepted.transfer.signedAt,
          });
          logAction('Transfer abgeschlossen', `${accepted.transfer.playerName} wechselt für ${Number(accepted.transfer.fee).toLocaleString('de-DE')} Mio. von ${accepted.transfer.sellerTeamName} zu ${accepted.transfer.buyerTeamName}`);
          save(); render();
          showSigningAnimation(accepted.transfer, state.league);
          announceNewTransfer(previous, state);
        }
      } else if (cpuEval.decision === 'counter') {
        const countered = submitOffer(state.league, callId, otherId, { playerId: pendingOffer.playerId, fee: cpuEval.counterFee });
        if (!countered.error) {
          let updatedLeague = appendNewsEvent(countered.league, {
            id: `counter-${countered.offer.id}`,
            type: 'offer-countered',
            playerName: countered.offer.playerName,
            sellerTeamId: countered.offer.sellerTeamId,
            sellerTeamName: countered.sellerName,
            buyerTeamId: countered.offer.buyerTeamId,
            buyerTeamName: countered.buyerName,
            fee: countered.offer.fee,
            createdAt: countered.offer.createdAt,
          });
          const activeCallInLeague = updatedLeague.calls.find((c) => c.id === callId);
          if (activeCallInLeague) {
            activeCallInLeague.negotiationRound = Math.min(3, (activeCallInLeague.negotiationRound || 1) + 1);
            activeCallInLeague.maxRounds = activeCallInLeague.maxRounds || 3;
          }
          // In Round 2+, a rival club can attempt to hijack the ongoing negotiation!
          let hijackAlertMsg = '';
          if (humanOffersCount >= 1 && !activeCallInLeague?.competingBid) {
            const rivalAttempt = triggerRivalHijackOnCall(updatedLeague, callId, { seed: `${callId}-${humanOffersCount}` });
            if (!rivalAttempt.error && rivalAttempt.competingBid) {
              updatedLeague = rivalAttempt.league;
              hijackAlertMsg = ` · ACHTUNG: ${rivalAttempt.competingBid.rivalTeamName} bietet ${rivalAttempt.competingBid.fee} Mio. € dazwischen!`;
              logAction('Hijack-Alarm in Verhandlung', `${rivalAttempt.competingBid.rivalTeamName} grätscht mit ${rivalAttempt.competingBid.fee} Mio. € für ${countered.offer.playerName} dazwischen`);
            }
          }
          state.league = updatedLeague;
          logAction(`Verhandlungsrunde ${activeCallInLeague?.negotiationRound || 2}/3`, `${otherTeam.name} fordert ${Number(cpuEval.counterFee).toLocaleString('de-DE')} Mio. € für ${countered.offer.playerName} (${cpuEval.stageLabel || 'Nachverhandlung'})`);
          save();
          triggerPhoneVibration(`Runde ${activeCallInLeague?.negotiationRound || 2}/3 · Gegenangebot von ${otherTeam.name}: ${cpuEval.counterFee} Mio. €${hijackAlertMsg}`);
          render();
        }
      } else {
        const declined = declineOffer(state.league, callId, otherId);
        if (!declined.error) {
          state.league = appendNewsEvent(declined.league, {
            id: `reject-${callId}-${pendingOffer.id}`,
            type: 'offer-rejected',
            playerName: pendingOffer.playerName,
            sellerTeamId: pendingOffer.sellerTeamId,
            sellerTeamName: state.league.teams.find((t) => t.id === pendingOffer.sellerTeamId)?.name || '',
            buyerTeamId: pendingOffer.buyerTeamId,
            buyerTeamName: state.league.teams.find((t) => t.id === pendingOffer.buyerTeamId)?.name || '',
            fee: pendingOffer.fee,
          });
          logAction('CPU lehnt Angebot ab', `${otherTeam.name} lehnt das Angebot für ${pendingOffer.playerName} ab`);
          save(); render();
          toast(`${otherTeam.name} hat das Transferangebot abgelehnt.`);
        }
      }
    }, 900);
  }
}
function assignSquadPlayer(slotId, playerId) {
  const manager = activeManager();
  const team = state.league?.teams?.find((entry) => entry.id === selectedSquadTeamId);
  if (!team || !manager) return;
  const result = setStartingPlayer(state.league, team.id, slotId, playerId, manager.id);
  if (result.error) return toast(result.error);
  const player = state.players.find((entry) => entry.id === playerId) || getTeamRoster(state.league, team.id, state.players).find((entry) => entry.id === playerId);
  const slot = SQUAD_SLOTS.find((entry) => entry.id === slotId);
  state.league = result.league;
  selectedSquadPlayerId = '';
  logAction('Aufstellung geändert', `${team.name}: ${player?.name || 'Spieler'} → ${slot?.label || slotId}`);
  save(); render();
}
async function initiateCall(targetId) {
  if (sharedReady) {
    await saveQueue;
    try {
      const response = await fetch('/api/state');
      const latest = await response.json();
      if (latest.revision > sharedRevision && latest.state) {
        sharedRevision = latest.revision;
        await applySharedState(latest.state);
      }
    } catch { /* offline fallback */ }
  }
  const manager = activeManager();
  if (!manager || !state.league) return toast('Kein Manager ausgewählt.');
  const result = createCall(state.league, manager.id, targetId);
  if (result.error) return toast(result.error);
  result.call.cpuRoll = Math.random();
  state.league = result.league;
  phoneOpen = true;
  activePhoneApp = 'transfers';
  logAction('Manager angerufen', `${manager.name} ruft ${result.call.targetManagerName} an`);
  save(); render();
  const target = state.league.teams.find((team) => team.id === targetId);
  if (target?.managerType === 'cpu' && !onlineManagerIds.includes(targetId)) {
    const callId = result.call.id;
    setTimeout(() => {
      const live = state.league?.calls?.find((call) => call.id === callId);
      if (!live || live.status !== 'ringing' || onlineManagerIds.includes(targetId)) return;
      const standings = rankTeamsFromResults(state.league.teams, state.league.matchHistory ?? []);
      const rank = standings.find((row) => row.teamId === targetId)?.rank ?? 15;
      const answered = cpuAnswersCall({
        rank,
        teamCount: state.league.teams.length,
        rosterNeed: rosterNeedForTeam(state.league, targetId),
        budget: target.budget ?? 150,
        teamStrength: teamStrength(state.league, targetId),
        randomValue: live.cpuRoll,
      });
      const response = respondToCall(state.league, callId, targetId, answered ? 'accept' : 'decline');
      if (!response.error) { state.league = response.league; logAction(answered ? 'CPU-Anruf angenommen' : 'CPU-Anruf abgelehnt', `${target.managerName} ${answered ? 'nimmt ab' : 'ist nicht erreichbar'}`); save(); render(); }
    }, 900);
  }
}
async function resetLocal() {
  setupManagers = [
    { id: 'mgr-1', name: 'Admin', teamId: 'club-7' },
  ];
  sessionStorage.removeItem(`${SESSION_KEY}-manager`);
  selectedSquadTeamId = '';
  selectedSquadPlayerId = '';
  selectedCalendarDate = '';
  selectedNewsCategory = 'all';
  expandedNewsCommentsPostId = '';
  phoneOpen = false;
  activePhoneApp = 'home';
  state = {
    players: [],
    league: null,
    log: [
      {
        action: 'Liga zurückgesetzt',
        detail: 'Spielstand zurückgesetzt · 1.800-Spieler-Pool wird neu geladen',
        at: new Date().toISOString(),
        actor: 'Admin',
      },
    ],
  };
  save();
  await saveQueue;
  await loadDefaultPlayerPool();
  setView('setup');
  toast(`Liga wurde zurückgesetzt. ${state.players.length} reale Spieler sind bereit für den neuen Draft.`);
}

document.addEventListener('keydown', (event) => {
  if (!titleScreenOpen) return;
  if (event.target.matches('input,textarea,select,button')) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    enterSuperLeague(state.league ? 'overview' : 'setup');
  }
});

document.addEventListener('click', async (event) => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { event.preventDefault(); titleScreenOpen = false; return setView(viewButton.dataset.view); }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === 'enter-super-league' || action === 'title-continue-league') {
    setupBuilderOpen = false;
    enterSuperLeague(state.league ? 'overview' : 'setup');
    return;
  }
  if (action === 'title-new-league') {
    setupBuilderOpen = true;
    enterSuperLeague('setup');
    toast('Neue Super League konfigurieren: Füge Manager mit dem Plus-Symbol hinzu und wähle eure 30 Teams.');
    return;
  }
  if (action === 'title-join-league') {
    titleJoinModalOpen = !titleJoinModalOpen;
    renderTitleScreen();
    if (titleJoinModalOpen) {
      requestAnimationFrame(() => {
        document.querySelector('.sl-join-drawer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
    return;
  }
  if (action === 'close-title-join') {
    titleJoinModalOpen = false;
    renderTitleScreen();
    return;
  }
  if (action === 'title-quick-join-manager') {
    const teamId = actionButton.dataset.teamId;
    if (teamId) {
      sessionStorage.setItem(`${SESSION_KEY}-manager`, teamId);
      selectedSquadTeamId = teamId;
      refreshManagerSelector();
      heartbeatPresence();
    }
    setupBuilderOpen = false;
    enterSuperLeague('overview');
    const joinedTeam = state.league?.teams?.find((t) => t.id === teamId);
    if (joinedTeam) toast(`Verbunden als ${joinedTeam.managerName || joinedTeam.name} (${joinedTeam.name})!`);
    return;
  }
  if (action === 'open-setup-builder') {
    setupBuilderOpen = true;
    setView('setup');
    return;
  }
  if (action === 'open-title-screen') {
    titleScreenOpen = true;
    titleJoinModalOpen = false;
    renderTitleScreen();
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }
  if (action === 'go-setup') { setupBuilderOpen = true; setView('setup'); }
  if (action === 'go-knockout') setView('knockout');
  if (action === 'open-phone') { phoneOpen = !phoneOpen; renderPhoneShell(); }
  if (action === 'close-phone') { phoneOpen = false; phoneFullscreen = false; renderPhoneShell(); }
  if (action === 'flip-phone') { phoneViewMode = phoneViewMode === 'back' ? 'front' : 'back'; renderPhoneShell(); }
  if (action === 'toggle-phone-width') { phoneWideMode = !phoneWideMode; if (phoneWideMode) phoneFullscreen = false; renderPhoneShell(); }
  if (action === 'toggle-phone-fullscreen') { phoneFullscreen = !phoneFullscreen; renderPhoneShell(); }
  if (action === 'open-phone-app') { openPhoneApp(actionButton.dataset.app || 'home'); }
  if (action === 'set-phone-calendar-tab' || action === 'phone-cal-tab') { phoneCalendarTab = actionButton.dataset.tab || 'month'; renderPhoneShell(); }
  if (action === 'set-phone-transfer-tab' || action === 'phone-tx-tab') { activePhoneApp = 'transfers'; phoneTransferTab = actionButton.dataset.tab || 'room'; renderPhoneShell(); }
  if (action === 'close-phone-and-command-transfers') { phoneOpen = false; phoneFullscreen = false; setView('transfers'); }
  if (action === 'close-phone-and-knockout' || action === 'open-knockout-from-phone') { phoneOpen = false; phoneFullscreen = false; setView('knockout'); }
  if (action === 'close-phone-and-setup') { phoneOpen = false; phoneFullscreen = false; setView('setup'); }
  if (action === 'close-phone-and-draft') { phoneOpen = false; phoneFullscreen = false; setView('draft'); }
  if (action === 'set-tx-hub-tab') {
    txHubTab = actionButton.dataset.tab || 'scouting';
    render();
    return;
  }
  if (action === 'set-setup-league-filter') {
    setupLeagueFilter = actionButton.dataset.league || 'all';
    render();
    return;
  }
  if (action === 'add-setup-manager') {
    if (setupManagers.length >= 30) {
      toast('Maximal 30 Manager möglich (1 pro Team).');
      return;
    }
    const assignedTeamIds = new Set(setupManagers.map((m) => m.teamId));
    const nextTeam = seedTeams.find((t) => !assignedTeamIds.has(t.id)) || seedTeams[0];
    const newMgrIndex = setupManagers.length + 1;
    setupManagers.push({
      id: `mgr-${Date.now()}-${newMgrIndex}`,
      name: `Manager ${newMgrIndex}`,
      teamId: nextTeam?.id || 'club-1',
    });
    render();
    refreshSetupSummary();
    toast(`Manager #${newMgrIndex} hinzugefügt! Gib den Namen ein und wähle das Team.`);
    return;
  }
  if (action === 'remove-setup-manager') {
    const idx = Number(actionButton.dataset.index);
    if (idx === 0) {
      toast('Der Host/Admin (Manager #1) kann nicht gelöscht werden.');
      return;
    }
    if (idx >= 0 && idx < setupManagers.length) {
      const removed = setupManagers.splice(idx, 1)[0];
      render();
      refreshSetupSummary();
      toast(`${removed.name || 'Manager'} entfernt.`);
    }
    return;
  }
  if (action === 'filter-club-scouting') {
    fmClubFilter = actionButton.dataset.clubId || 'all';
    txHubTab = 'scouting';
    render();
    return;
  }
  if (action === 'scout-player' || action === 'scout-player-full') {
    const manager = activeManager();
    if (!state.league || !manager) return toast('Kein aktiver Manager für das Scouting ausgewählt.');
    const playerId = actionButton.dataset.playerId;
    const rawPlayer = state.players.find((p) => p.id === playerId)
      || (state.league.draft?.picks ?? []).filter((pk) => pk.playerId === playerId).map((pk) => ({ id: pk.playerId, name: pk.playerName, position: pk.position, rating: pk.rating, club: pk.teamName }))[0];
    if (!rawPlayer) return toast('Spieler nicht im Datenbank-Pool gefunden.');
    const full = action === 'scout-player-full';
    const res = scoutPlayer(state.league, manager.id, rawPlayer, { full });
    if (res.error) return toast(res.error);
    state.league = res.league;
    const progress = res.report?.progress ?? 100;
    const grade = res.report?.grade || 'A';
    const cost = Number(res.cost || 0.5);
    logAction(full ? 'Voll-Scouting (100%)' : 'Scouting-Stufe erhöht', `${manager.name} scoutet ${rawPlayer.name} (${progress}% · Note ${grade}) für ${cost.toFixed(1).replace('.', ',')} Mio. €`);
    save();
    render();
    toast(`${rawPlayer.name} gescoutet (${progress}% Wissen · Scout-Note ${grade})!`);
    return;
  }
  if (action === 'scout-top-targets') {
    const manager = activeManager();
    if (!state.league || !manager) return toast('Kein aktiver Manager ausgewählt.');
    const picksByPlayer = new Map((state.league.draft?.picks ?? []).map((pk) => [pk.playerId, pk]));
    const candidates = state.players
      .filter((p) => picksByPlayer.get(p.id)?.teamId !== manager.id)
      .filter((p) => !getPlayerScoutingReport(state.league, manager.id, p).isFullyScouted)
      .sort((a, b) => (b.isGeneratedTalent ? 1 : 0) - (a.isGeneratedTalent ? 1 : 0) || (b.rating || 70) - (a.rating || 70))
      .slice(0, 5);
    if (!candidates.length) return toast('Alle Top-Ziele sind bereits zu 100 % gescoutet.');
    let nextLeague = state.league;
    let count = 0;
    for (const candidate of candidates) {
      const res = scoutPlayer(nextLeague, manager.id, candidate, { full: true });
      if (res.error) break;
      nextLeague = res.league;
      count += 1;
    }
    if (!count) return toast('Nicht genügend Budget für das Paket-Scouting.');
    state.league = nextLeague;
    logAction('Scouting-Paket abgeschlossen', `${manager.name} hat ${count} Top-Ziele & Wunderkinder vollständig (100%) gescoutet`);
    save();
    render();
    toast(`${count} Top-Talente & Zielspieler wurden auf 100 % Wissen gescoutet!`);
    return;
  }
  if (action === 'toggle-shortlist') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const playerId = actionButton.dataset.playerId;
    const res = toggleShortlistPlayer(state.league, manager.id, playerId);
    if (res.error) return toast(res.error);
    state.league = res.league;
    save();
    render();
    toast(res.added ? 'Spieler auf die Scouting-Shortlist gesetzt.' : 'Spieler von der Shortlist entfernt.');
    return;
  }
  if (action === 'generate-new-talents') {
    const usedIds = new Set((state.players ?? []).map((p) => p.id));
    const newTalents = generateRandomTalents(6, {
      seed: `${state.league?.name || 'career'}-${Date.now()}`,
      existingIds: usedIds,
    });
    state.players = [...(state.players ?? []), ...newTalents];
    if (state.league) {
      state.league = appendNewsEvent(state.league, {
        id: `wonderkids-batch-${Date.now()}`,
        type: 'custom-post',
        authorName: 'Chefscout · Jugendakademie',
        authorHandle: '@SuperLeagueScouting',
        category: 'transfers',
        title: `${newTalents.length} neue Jugend-Wunderkinder entdeckt!`,
        body: `Unsere internationalen Jugendscouts melden ${newTalents.length} neue zufallsgenerierte Top-Talente (16–20 J.) wie ${newTalents.slice(0, 3).map((t) => `${t.name} (${t.position}, POT ${t.potential})`).join(', ')} in der Free Agency!`,
      });
    }
    logAction('Neue Zufalls-Talente entdeckt', `${newTalents.length} neue Wunderkinder in Scouting & Free Agency verfügbar`);
    save();
    render();
    toast(`${newTalents.length} neue Zufalls-Wunderkinder wurden für Scouting & Free Agency generiert!`);
    return;
  }
  if (action === 'sign-free-agent') {
    const manager = activeManager();
    if (!state.league || !manager) return toast('Kein aktiver Manager ausgewählt.');
    const playerId = actionButton.dataset.playerId;
    const contractYears = Number(actionButton.dataset.years) || 3;
    const rawPlayer = state.players.find((p) => p.id === playerId);
    if (!rawPlayer) return toast('Free Agent nicht gefunden.');
    const res = signFreeAgent(state.league, manager.id, rawPlayer, { contractYears });
    if (res.error) return toast(res.error);
    const signingFee = res.transfer?.fee ?? 0;
    let nextLeague = appendNewsEvent(res.league, {
      id: `fa-sign-${rawPlayer.id}-${Date.now()}`,
      type: 'transfer-completed',
      playerName: rawPlayer.name,
      sellerTeamId: 'free-agency',
      sellerTeamName: rawPlayer.isGeneratedTalent ? 'Free Agency (Wunderkind)' : 'Free Agency',
      buyerTeamId: manager.id,
      buyerTeamName: manager.name,
      fee: signingFee,
      createdAt: res.transfer.signedAt,
    });
    state.league = nextLeague;
    logAction('Free Agent verpflichtet', `${rawPlayer.name} (${rawPlayer.position} · OVR ${rawPlayer.rating}) unterschreibt bei ${manager.name} (${contractYears} J. · Handgeld ${signingFee} Mio. €)`);
    save();
    render();
    showSigningAnimation(res.transfer, state.league);
    toast(`${rawPlayer.name} ablösefrei verpflichtet (${contractYears} Jahre Vertrag)!`);
    return;
  }
  if (action === 'extend-contract') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const playerId = actionButton.dataset.playerId;
    const additionalYears = Number(actionButton.dataset.years) || 2;
    const rawPlayer = state.players.find((p) => p.id === playerId)
      || (state.league.draft?.picks ?? []).filter((pk) => pk.playerId === playerId).map((pk) => ({ id: pk.playerId, name: pk.playerName, position: pk.position, rating: pk.rating }))[0];
    if (!rawPlayer) return toast('Spieler nicht gefunden.');
    const res = extendPlayerContract(state.league, manager.id, rawPlayer, { additionalYears });
    if (res.error) return toast(res.error);
    state.league = res.league;
    logAction('Vertrag verlängert', `${rawPlayer.name} verlängert bei ${manager.name} bis ${res.contract.contractUntil} (Handgeld ${res.bonusCost} Mio. €)`);
    save();
    render();
    toast(`Vertrag mit ${rawPlayer.name} bis ${res.contract.contractUntil} verlängert!`);
    return;
  }
  if (action === 'release-player') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const playerId = actionButton.dataset.playerId;
    const res = releasePlayerToFreeAgency(state.league, manager.id, playerId);
    if (res.error) return toast(res.error);
    state.league = res.league;
    logAction('Vertrag aufgelöst', `${res.releasedPlayerName} wurde von ${manager.name} in die Free Agency entlassen`);
    save();
    render();
    toast(`${res.releasedPlayerName} ist nun Free Agent.`);
    return;
  }
  if (action === 'hijack-transfer-deal') {
    const manager = activeManager();
    if (!state.league || !manager) return toast('Kein aktiver Manager für den Transfer-Hijack ausgewählt.');
    const dealId = actionButton.dataset.dealId;
    const hijackFee = Number(actionButton.dataset.hijackFee) || 0;
    const res = hijackTransferDeal(state.league, manager.id, dealId, { customFee: hijackFee });
    if (res.error) return toast(res.error);
    let nextLeague = appendNewsEvent(res.league, {
      id: `hijack-${dealId}-${Date.now()}`,
      type: 'transfer-hijacked',
      playerName: res.hijackedDeal.playerName,
      hijackerTeamId: manager.id,
      hijackerTeamName: manager.name,
      previousBuyerName: res.hijackedDeal.buyerTeamName,
      sellerTeamId: res.hijackedDeal.sellerTeamId,
      sellerTeamName: res.hijackedDeal.sellerTeamName,
      fee: res.offer.fee,
      createdAt: new Date().toISOString(),
    });
    state.league = nextLeague;
    phoneOpen = true;
    activePhoneApp = 'transfers';
    phoneTransferTab = 'room';
    logAction('Transfer-Hijack gestartet', `${manager.name} grätscht mit ${res.offer.fee} Mio. € in den ${res.hijackedDeal.playerName}-Deal (${res.hijackedDeal.buyerTeamName}) dazwischen!`);
    save();
    render();
    toast(`Hijack erfolgreich gestartet! Du verhandelst jetzt im Handy direkt mit ${res.hijackedDeal.sellerTeamName} über ${res.hijackedDeal.playerName}.`);
    // Trigger CPU seller response in the hijacked call
    const sellerTeam = state.league.teams.find((t) => t.id === res.hijackedDeal.sellerTeamId);
    if (sellerTeam?.managerType === 'cpu') {
      const callId = res.call.id;
      setTimeout(() => {
        const liveCall = state.league?.calls?.find((c) => c.id === callId);
        const pendingOffer = liveCall?.offers?.at(-1);
        if (!liveCall || !pendingOffer || pendingOffer.fromTeamId !== manager.id) return;
        const cpuEval = evaluateCpuOfferResponse({
          playerRating: res.hijackedDeal.rating || 82,
          position: res.hijackedDeal.position || 'CM',
          fee: pendingOffer.fee,
          sellerRosterCount: 30,
          offerRound: 2,
          requireMultiRound: true,
        });
        const counterFee = Math.max(pendingOffer.fee + 2, cpuEval.counterFee || pendingOffer.fee + 3);
        const countered = submitOffer(state.league, callId, sellerTeam.id, {
          playerId: pendingOffer.playerId,
          fee: counterFee,
        });
        if (!countered.error) {
          const updatedCall = countered.league.calls.find((c) => c.id === callId);
          if (updatedCall) {
            updatedCall.negotiationRound = 2;
            updatedCall.maxRounds = 3;
          }
          state.league = countered.league;
          save();
          triggerPhoneVibration(`${sellerTeam.name} reagiert auf deinen Hijack: ${counterFee} Mio. € für sofortigen Zuschlag!`);
          render();
        }
      }, 850);
    }
    return;
  }
  if (action === 'refresh-hijack-deals') {
    if (!state.league) return;
    const ensured = ensureHijackableDeals(state.league, state.players, {
      advanceExisting: true,
      seed: `manual-hijack-${Date.now()}`,
    });
    state.league = ensured.league;
    logAction('Hijack-Radar aktualisiert', `${(state.league.pendingDeals ?? []).length} laufende Liga-Deals auf dem Radar`);
    save();
    render();
    toast('Hijack-Radar aktualisiert: Neue laufende Liga-Verhandlungen gesichtet.');
    return;
  }
  if (action === 'outbid-rival-hijack' || action === 'concede-rival-hijack') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const callId = actionButton.dataset.callId;
    const mode = action === 'outbid-rival-hijack' ? 'outbid' : 'concede';
    const res = resolveCompetingHijack(state.league, callId, manager.id, mode);
    if (res.error) return toast(res.error);
    state.league = res.league;
    if (mode === 'outbid') {
      logAction('Rivalen-Hijack überboten', `${manager.name} erhöht auf ${res.outbidFee} Mio. € (Runde 3/3 Finale)`);
      save();
      render();
      toast(`Du hast den Rivalen mit ${res.outbidFee} Mio. € ausgestochen!`);
      // Let CPU respond to the final round 3 outbid offer
      const liveCall = state.league.calls.find((c) => c.id === callId);
      const otherId = liveCall ? (manager.id === liveCall.callerTeamId ? liveCall.targetTeamId : liveCall.callerTeamId) : '';
      const otherTeam = state.league.teams.find((t) => t.id === otherId);
      if (otherTeam?.managerType === 'cpu' && isTransferWindowOpen(state.league.currentDate)) {
        setTimeout(() => {
          const accepted = acceptOffer(state.league, callId, otherId);
          if (!accepted.error) {
            state.league = appendNewsEvent(accepted.league, {
              id: `transfer-${accepted.transfer.callId}-${accepted.transfer.playerId}`,
              type: 'transfer-completed',
              playerName: accepted.transfer.playerName,
              sellerTeamId: accepted.transfer.sellerTeamId,
              sellerTeamName: accepted.transfer.sellerTeamName,
              buyerTeamId: accepted.transfer.buyerTeamId,
              buyerTeamName: accepted.transfer.buyerTeamName,
              fee: accepted.transfer.fee,
              createdAt: accepted.transfer.signedAt,
            });
            logAction('Transfer nach Hijack-Duell perfekt', `${accepted.transfer.playerName} wechselt für ${accepted.transfer.fee} Mio. € zu ${accepted.transfer.buyerTeamName}`);
            save();
            render();
            showSigningAnimation(accepted.transfer, state.league);
          }
        }, 750);
      }
    } else {
      logAction('Verhandlung an Rivalen abgegeben', `${manager.name} zieht sich aus dem Poker zurück`);
      save();
      render();
      toast('Du hast dich aus dem Bieterwettstreit zurückgezogen.');
    }
    return;
  }
  if (action === 'call-player-club') {
    const teamId = actionButton.dataset.teamId;
    preselectedNegotiationPlayerId = actionButton.dataset.playerId || '';
    if (teamId) initiateCall(teamId);
    return;
  }
  if (action === 'open-pes-player') {
    inspectedPesPlayerId = actionButton.dataset.playerId || '';
    renderPesInspectorOverlay();
    return;
  }
  if (action === 'close-pes-player') {
    inspectedPesPlayerId = '';
    renderPesInspectorOverlay();
    return;
  }
  if (action === 'set-pes-hub-tab') {
    pesHubTab = actionButton.dataset.tab || 'strength';
    render();
    return;
  }
  if (action === 'set-pes-connection-mode') {
    pesConnectionMode = actionButton.dataset.mode || 'radmin-direct';
    if (state.league) {
      const updated = updateOnlineLobbySettings(state.league, state.players, { networkMode: pesConnectionMode });
      state.league = updated.league;
      save();
    }
    render();
    return;
  }
  if (action === 'set-game-engine') {
    if (!state.league) return;
    const engineVersion = actionButton.dataset.engine || 'FIFA17';
    const updated = updateOnlineLobbySettings(state.league, state.players, { engineVersion, refreshSyncHash: true });
    state.league = updated.league;
    const newHash = computeGameDbHash(state.league, state.players, { engineVersion });
    logAction('Spiel-Engine gewechselt', `Aktive Engine: ${engineVersion} · Neuer DB-Sync-Hash: ${newHash}`);
    save();
    render();
    toast(`Engine auf ${engineVersion} umgestellt (DB-Hash ${newHash})!`);
    return;
  }
  if (action === 'confirm-manager-db-sync') {
    if (!state.league) return;
    const manager = activeManager();
    const res = confirmManagerDbSync(state.league, state.players, manager?.id || '', { syncAll: true });
    if (res.error) return toast(res.error);
    state.league = res.league;
    logAction('Multi-Manager DB-Sync bestätigt', `Alle Mitspieler sind auf Datenbank-Stand ${res.dbHash} synchronisiert`);
    save();
    render();
    toast(`Alle Mitspieler erfolgreich auf Stand ${res.dbHash} synchronisiert!`);
    return;
  }
  if (action === 'toggle-online-lobby-ready') {
    if (!state.league) return;
    const side = actionButton.dataset.side;
    const currentLobby = state.league.onlineLobby ?? {};
    const updates = side === 'away'
      ? { awayReady: !currentLobby.awayReady }
      : { homeReady: !currentLobby.homeReady };
    const res = updateOnlineLobbySettings(state.league, state.players, updates);
    state.league = res.league;
    save();
    render();
    toast('Online-Lobby Bereitschaftsstatus aktualisiert.');
    return;
  }
  if (action === 'set-squad-formation') {
    const manager = activeManager();
    const teamId = selectedSquadTeamId || manager?.id;
    if (!state.league || !manager || !teamId) return;
    const res = setSquadFormation(state.league, teamId, actionButton.dataset.formation || '4-3-3', manager.id);
    if (res.error) return toast(res.error);
    state.league = res.league;
    const hash = computeGameDbHash(state.league, state.players);
    logAction('Formation geändert', `${res.formation} im Squad Hub gespeichert (DB-Hash ${hash})`);
    save();
    render();
    toast(`Formation auf ${res.formation} umgestellt!`);
    return;
  }
  if (action === 'open-club-page') {
    const teamId = actionButton.dataset.teamId;
    if (teamId) {
      if (currentView !== 'club') previousViewBeforeClub = currentView;
      selectedClubPageId = teamId;
      clubPageTab = 'overview';
      inspectedMatchFixtureId = '';
      phoneOpen = false;
      setView('club');
    }
    return;
  }
  if (action === 'back-from-club-page') {
    setView(previousViewBeforeClub || 'table');
    return;
  }
  if (action === 'set-club-page-tab') {
    clubPageTab = actionButton.dataset.tab || 'overview';
    render();
    return;
  }
  if (action === 'set-table-subtab') {
    tableSubTab = actionButton.dataset.subtab || 'table';
    render();
    return;
  }
  if (action === 'open-match-report') {
    inspectedMatchFixtureId = actionButton.dataset.fixtureId || '';
    renderMatchReportOverlay();
    return;
  }
  if (action === 'close-match-report') {
    inspectedMatchFixtureId = '';
    renderMatchReportOverlay();
    return;
  }
  if (action === 'auto-fill-squad') {
    const manager = activeManager();
    const teamId = selectedSquadTeamId || manager?.id;
    if (!state.league || !manager || !teamId) return;
    const res = autoFillStartingEleven(state.league, teamId, state.players, manager.id);
    if (res.error) return toast(res.error);
    state.league = res.league;
    const hash = computeGameDbHash(state.league, state.players);
    const summaryMsg = res.analysis?.summaryText || `Beste 11 Spieler und Rückennummern aufgestellt (DB-Hash ${hash})`;
    logAction('Startelf automatisch besetzt', summaryMsg);
    save();
    render();
    toast(summaryMsg);
    return;
  }
  if (action === 'save-shirt-number') {
    const manager = activeManager();
    const teamId = selectedSquadTeamId || manager?.id;
    const playerId = actionButton.dataset.playerId || selectedSquadPlayerId;
    const input = document.querySelector('#squad-shirt-number');
    if (!state.league || !manager || !teamId || !playerId || !input) return;
    const res = setPlayerShirtNumber(state.league, teamId, playerId, Number(input.value), manager.id);
    if (res.error) return toast(res.error);
    state.league = res.league;
    const hash = computeGameDbHash(state.league, state.players);
    logAction('Rückennummer vergeben', `Trikotnummer #${res.shirtNumber} gespeichert (DB-Hash ${hash})`);
    save();
    render();
    toast(`Rückennummer #${res.shirtNumber} gespeichert & mit FIFA 17 Export synchronisiert!`);
    return;
  }
  if (action === 'export-fifa-players-csv') {
    const engine = state.league?.onlineLobby?.engineVersion || 'FIFA17';
    const csv = exportFifaRdbmPlayersCsv(state.league, state.players, { engineVersion: engine });
    downloadPesFile(`${engine.toLowerCase()}-rdbm-players-${state.league?.season?.replace('/', '-') || '2026-27'}.csv`, csv, 'text/csv;charset=utf-8');
    logAction(`${engine} RDBM players.csv exportiert`, `${state.players.length} Spieler inkl. 1–99 Attribute, Skill Moves & Vereins-IDs`);
    save();
    toast(`${engine} RDBM players.csv exportiert!`);
    return;
  }
  if (action === 'export-fifa-links-csv') {
    const engine = state.league?.onlineLobby?.engineVersion || 'FIFA17';
    const csv = exportFifaTeamPlayerLinksCsv(state.league, state.players);
    downloadPesFile(`${engine.toLowerCase()}-rdbm-teamplayerlinks-${state.league?.season?.replace('/', '-') || '2026-27'}.csv`, csv, 'text/csv;charset=utf-8');
    logAction(`${engine} teamplayerlinks.csv exportiert`, 'Alle 30er-Kader, Startelf-Positionen & Rückennummern (1–99) gegen Online-Desync exportiert');
    save();
    toast(`${engine} teamplayerlinks.csv (Kader, Startelf & Rückennummern) exportiert!`);
    return;
  }
  if (action === 'export-fifa-formations-csv') {
    const engine = state.league?.onlineLobby?.engineVersion || 'FIFA17';
    const csv = exportFifaFormationsCsv(state.league, state.players);
    downloadPesFile(`${engine.toLowerCase()}-rdbm-formations-${state.league?.season?.replace('/', '-') || '2026-27'}.csv`, csv, 'text/csv;charset=utf-8');
    logAction(`${engine} formations.csv exportiert`, 'Formationen & Taktik-Vorgaben aller Liga-Teams exportiert');
    save();
    toast(`${engine} formations.csv exportiert!`);
    return;
  }
  if (action === 'toggle-pes-check') {
    const stepId = actionButton.dataset.stepId;
    if (stepId) {
      if (pesCheckedExportIds.includes(stepId)) {
        pesCheckedExportIds = pesCheckedExportIds.filter((id) => id !== stepId);
      } else {
        pesCheckedExportIds = [...pesCheckedExportIds, stepId];
      }
      render();
    }
    return;
  }
  if (action === 'export-pes-csv') {
    const csv = exportPesEditorCsv(state.league, state.players);
    downloadPesFile(`fifa17-super-league-${state.league?.season?.replace('/', '-') || '2026-27'}.csv`, csv, 'text/csv;charset=utf-8');
    logAction('FIFA 17 Kader-CSV exportiert', `${state.players.length} synchronisierte Spieler inkl. Verein, Alter & Werte`);
    save();
    toast('FIFA 17 Kader-CSV exportiert!');
    return;
  }
  if (action === 'export-pes-json') {
    const json = exportPesSiderJson(state.league, state.players);
    downloadPesFile(`super-league-fifa17-manifest-${state.league?.season?.replace('/', '-') || '2026-27'}.json`, json, 'application/json;charset=utf-8');
    logAction('FIFA 17 JSON-Manifest exportiert', `${state.players.length} Spieler & ${(state.league?.transfers ?? []).length} Transfers exportiert`);
    save();
    toast('Komplett-Manifest (JSON) exportiert!');
    return;
  }
  if (action === 'reset-ko-bracket' || action === 'init-knockout') {
    if (!state.league) return;
    if (!isLeaguePhaseComplete(state.league)) {
      return toast('Die Ligaphase läuft noch. K.-o.-Phase & Playoffs erst nach Spieltag 58.');
    }
    const created = createKnockoutBracket(state.league);
    if (created.error) return toast(created.error);
    state.league = created.league;
    selectedKnockoutMatchId = state.league.knockout?.rounds?.playoffs?.[0]?.id || 'po-1';
    logAction('K.-o.-Baum aktualisiert', 'UEFA 2024+ Setzliste (Plätze 1–8 direkt, 9–24 Playoffs) aus Tabelle generiert');
    save(); render();
    toast('UEFA Champions Turnierbaum wurde aus der Ligatabelle gesetzt.');
  }
  if (action === 'simulate-ko-round' || action === 'simulate-knockout-round') {
    if (!state.league) return;
    if (!isLeaguePhaseComplete(state.league)) {
      return toast('Die K.-o.-Phase ist gesperrt, solange die Ligaphase läuft.');
    }
    const roundKey = actionButton.dataset.round || getNextKnockoutRoundKey(state.league.knockout);
    if (!roundKey) return toast('Alle K.-o.-Runden sind bereits abgeschlossen.');
    const res = simulateKnockoutRound(state.league, roundKey);
    if (res.error) return toast(res.error);
    state.league = res.league;
    const roundLabels = { playoffs: 'Play-offs', r16: 'Achtelfinale', qf: 'Viertelfinale', sf: 'Halbfinale', final: 'Finale' };
    const champName = state.league.knockout?.champion?.teamName;
    logAction('K.-o.-Runde simuliert', `${roundLabels[roundKey] || roundKey}`);
    if (champName) {
      logAction('Champions gekürt', `${champName} gewinnt die K.-o.-Phase!`);
      toast(`${champName} ist Champion der K.-o.-Phase!`);
    } else {
      toast(`${roundLabels[roundKey] || 'Runde'} erfolgreich simuliert.`);
    }
    save(); render();
  }
  if (action === 'simulate-ko-all' || action === 'simulate-knockout-all') {
    if (!state.league) return;
    if (!isLeaguePhaseComplete(state.league)) {
      return toast('Die K.-o.-Phase ist gesperrt, solange die Ligaphase läuft.');
    }
    const res = simulateEntireKnockout(state.league);
    if (res.error) return toast(res.error);
    state.league = res.league;
    selectedKnockoutMatchId = 'final-1';
    const champName = state.league.knockout?.champion?.teamName || 'Unbekannt';
    logAction('Komplette K.-o.-Phase simuliert', `Champion: ${champName}`);
    save(); render();
    toast(`Turnier simuliert! Champion: ${champName}`);
  }
  if (action === 'select-ko-match' || action === 'select-knockout-match') {
    selectedKnockoutMatchId = actionButton.dataset.matchId || '';
    render();
  }
  if (action === 'trigger-cpu-market') { runCpuTransferMarket({ manual: true }); }
  if (action === 'import-csv') { csvImportMode = 'replace'; document.querySelector('#csv-file').click(); }
  if (action === 'import-csv-append') { csvImportMode = 'append'; document.querySelector('#csv-file').click(); }
  if (action === 'download-template') downloadTemplate();
  if (action === 'add-custom-team') addCustomTeam();
  if (action === 'simulate-cpu') simulateCpuPick();
  if (action === 'auto-draft-all') autoDraftAll();
  if (action === 'start-league-autodraft') {
    const form = document.querySelector('#setup-form');
    if (form) startLeague(form, { autoDraft: true });
  }
  if (action === 'simulate-calendar') simulateCalendarDate();
  if (action === 'simulate-entire-season') {
    if (!state.league) return toast('Keine aktive Liga vorhanden.');
    const manager = activeManager();
    if (!isLeagueHost(state.league, manager?.id)) {
      return toast('Nur der Liga-Host darf die gesamte Saison simulieren.');
    }
    stopLiveCalendarSimulation();
    const previousLeague = structuredClone(state.league);
    const result = simulateEntireSeason(state.league, { bypassHumanLock: true, isHost: true });
    if (result.error) return toast(result.error);
    state.league = detectSimulationNewsEvents(previousLeague, result.league);
    selectedCalendarDate = result.summary.currentDate;
    logAction('Ganze Saison simuliert', `Alle 58 Spieltage (${result.summary.simulatedCount} Partien) erfolgreich simuliert`);
    runCpuTransferMarket({ manual: false });
    save();
    render();
    toast(`Ganze Saison erfolgreich simuliert! Alle 58 Spieltage beendet (${result.summary.simulatedCount} Spiele berechnet). K.-o.-Phase & Playoffs sind jetzt freigeschaltet!`);
    return;
  }
  if (action === 'toggle-live-calendar-sim') {
    toggleLiveCalendarSimulation();
    return;
  }
  if (action === 'step-next-matchday' || action === 'step-matchday') {
    stepToNextMatchday();
    return;
  }
  if (action === 'simulate-single-day') {
    simulateSingleDay();
    return;
  }
  if (action === 'simulate-month-step') {
    simulateMonthStep();
    return;
  }
  if (action === 'set-sim-speed') {
    const spd = Number(actionButton.dataset.speed) || 420;
    liveSimSpeedMs = spd;
    if (isSimulatingCalendarLive) {
      stopLiveCalendarSimulation();
      toggleLiveCalendarSimulation();
    }
    render();
    toast(`Simulations-Tempo auf ${spd === 100 ? 'Turbo (0.1s)' : spd === 300 ? 'Schnell (0.3s)' : 'Normal (0.6s)'} gesetzt.`);
    return;
  }
  if (action === 'approve-human-fixture') {
    const fixtureId = actionButton.dataset.fixtureId;
    const teamId = actionButton.dataset.teamId || activeManager()?.id;
    const res = approveHumanFixture(state.league, fixtureId, teamId);
    if (res.error) return toast(res.error);
    state.league = res.league;
    const teamName = state.league.teams.find((t) => t.id === teamId)?.managerName || 'Manager';
    logAction('Spieltags-Zustimmung (1v1)', `${teamName} hat für Spiel ${fixtureId} abgestimmt (${res.humanConsentGranted ? 'Beide bereit · Sperre frei' : '1/2 bereit'})`);
    save(); render();
    toast(res.humanConsentGranted ? 'Beide Manager haben zugestimmt! Die Simulations-Sperre für diesen Spieltag ist aufgehoben.' : `Zustimmung für ${teamName} aktualisiert.`);
    return;
  }
  if (action === 'approve-human-fixture-both') {
    const fixtureId = actionButton.dataset.fixtureId;
    const res = approveHumanFixture(state.league, fixtureId, activeManager()?.id, { approveBoth: true });
    if (res.error) return toast(res.error);
    state.league = res.league;
    logAction('Beide Manager stimmen zu (1v1)', `Simulations-Sperre für Mensch-gegen-Mensch-Duell (${fixtureId}) freigegeben`);
    save(); render();
    toast('Beide Manager haben zugestimmt — Simulations-Sperre aufgehoben!');
    return;
  }
  if (action === 'launch-pes-fixture') {
    const fixtureId = actionButton.dataset.fixtureId || '';
    const fixture = (state.league?.schedule ?? []).find((f) => f.id === fixtureId);
    const home = state.league?.teams?.find((t) => t.id === (actionButton.dataset.homeId || fixture?.homeId));
    const away = state.league?.teams?.find((t) => t.id === (actionButton.dataset.awayId || fixture?.awayId));
    if (!home || !away) return toast('Teams für den FIFA 15 Browser-Launch wurden nicht gefunden.');
    pesHomeTeamId = home.id;
    pesAwayTeamId = away.id;
    pesHubTab = 'strength';
    fifa15StreamActive = true;
    fifa15StreamRole = 'host';
    const roomCode = generateFifa15RoomCode(`${fixture?.id || ''}-${home.id}-${away.id}-${state.league?.season || '2026'}`);
    const modPkg = buildFifa15SuperLeagueModPackage(state.league, state.players, {
      homeTeamId: home.id,
      awayTeamId: away.id,
      roomCode,
    });
    state.league = updateOnlineLobbySettings(state.league, {
      roomCode,
      activeFixtureId: fixture?.id || '',
      autoFriendlyMode: true,
      liveHomeScore: 0,
      liveAwayScore: 0,
      matchClock: '00:00',
      customSaveSeed: modPkg.dbHash,
    }).league;
    state.league.match = {
      id: fixture?.id || `match-${Date.now()}`,
      fixtureId: fixture?.id || '',
      round: fixture?.round || null,
      date: fixture?.date || state.league.currentDate,
      home: home.name,
      away: away.name,
      homeId: home.id,
      awayId: away.id,
      status: `FIFA 15 Super League Mod aktiv · Auto-Freundschaftsspiel · Raum ${roomCode}`,
      result: null,
      at: new Date().toISOString(),
    };
    logAction('1-Klick FIFA 15 Super League Mod-Launch', `${home.name} vs ${away.name} (ST ${fixture?.round || '—'} · Raum ${roomCode}) mit aktuellem Kader-Mod direkt im Online-Freundschaftsspiel gestartet`);
    save();
    setView('matches');
    toast(`FIFA 15 Super League Mod geladen: ${home.name} vs ${away.name} startet direkt im 1v1 Online-Freundschaftsspiel (Raum ${roomCode})!`);
    return;
  }
  if (action === 'toggle-calendar-fifa15-arena') {
    fifa15CalendarArenaOpen = !fifa15CalendarArenaOpen;
    render();
    return;
  }
  if (action === 'launch-calendar-fifa15-inline') {
    const fixtureId = actionButton.dataset.fixtureId || '';
    const fixture = (state.league?.schedule ?? []).find((f) => f.id === fixtureId);
    const home = state.league?.teams?.find((t) => t.id === (actionButton.dataset.homeId || fixture?.homeId));
    const away = state.league?.teams?.find((t) => t.id === (actionButton.dataset.awayId || fixture?.awayId));
    if (home && away) {
      pesHomeTeamId = home.id;
      pesAwayTeamId = away.id;
      const roomCode = generateFifa15RoomCode(`${fixture?.id || ''}-${home.id}-${away.id}`);
      const modPkg = buildFifa15SuperLeagueModPackage(state.league, state.players, {
        homeTeamId: home.id,
        awayTeamId: away.id,
        roomCode,
      });
      state.league = updateOnlineLobbySettings(state.league, {
        roomCode,
        activeFixtureId: fixture?.id || '',
        autoFriendlyMode: true,
        liveHomeScore: 0,
        liveAwayScore: 0,
        matchClock: '00:00',
        customSaveSeed: modPkg.dbHash,
      }).league;
      state.league.match = {
        id: fixture?.id || `match-${Date.now()}`,
        fixtureId: fixture?.id || '',
        round: fixture?.round || null,
        date: fixture?.date || state.league.currentDate,
        home: home.name,
        away: away.name,
        homeId: home.id,
        awayId: away.id,
        status: `FIFA 15 Super League Mod im Kalender aktiv · Raum ${roomCode}`,
        result: null,
        at: new Date().toISOString(),
      };
      save();
    }
    fifa15CalendarArenaOpen = true;
    fifa15StreamActive = true;
    render();
    toast('FIFA 15 Super League Mod & Auto-Freundschaftsspiel direkt im Saisonkalender gestartet!');
    return;
  }
  if (action === 'start-fifa15-stream') {
    const role = actionButton.dataset.role || 'host';
    fifa15StreamRole = role === 'guest' ? 'guest' : 'host';
    fifa15StreamActive = true;
    if (state.league) {
      const existingCode = state.league.onlineLobby?.roomCode || generateFifa15RoomCode(state.league.id || 'ESL');
      const modPkg = buildFifa15SuperLeagueModPackage(state.league, state.players, {
        homeTeamId: pesHomeTeamId,
        awayTeamId: pesAwayTeamId,
        roomCode: existingCode,
      });
      state.league = updateOnlineLobbySettings(state.league, {
        roomCode: existingCode,
        autoFriendlyMode: true,
        customSaveSeed: modPkg.dbHash,
      }).league;
      save();
    }
    render();
    toast(
      fifa15StreamRole === 'guest'
        ? `FIFA 15 Super League Mod als Gast (Pad 2) mit Raumcode ${state.league?.onlineLobby?.roomCode || ''} verbunden!`
        : `FIFA 15 Super League Mod als Host (Pad 1) gestartet — wechselt direkt ins 1v1 Online-Freundschaftsspiel!`,
    );
    return;
  }
  if (action === 'trigger-fifa15-auto-friendly') {
    if (!state.league) return;
    fifa15StreamActive = true;
    const roomCode = state.league.onlineLobby?.roomCode || generateFifa15RoomCode(state.league.id || 'ESL');
    const home = state.league.teams?.find((t) => t.id === (pesHomeTeamId || state.league.match?.homeId)) || state.league.teams?.[0];
    const away = state.league.teams?.find((t) => t.id === (pesAwayTeamId || state.league.match?.awayId)) || state.league.teams?.[1];
    const modPkg = buildFifa15SuperLeagueModPackage(state.league, state.players, {
      homeTeamId: home?.id || '',
      awayTeamId: away?.id || '',
      roomCode,
    });
    const macro = buildFifa15AutoFriendlyMacro({
      homeTeamName: home?.name || 'Heim',
      awayTeamName: away?.name || 'Gast',
      roomCode,
    });
    state.league = updateOnlineLobbySettings(state.league, {
      roomCode,
      autoFriendlyMode: true,
      customSaveSeed: modPkg.dbHash,
    }).league;
    const iframe = document.querySelector('#fifa15-browser-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ type: 'ESL_FIFA15_AUTO_FRIENDLY', macro, modPackage: modPkg }, '*');
      } catch { /* cross-origin iframe ignores direct script, query params handle autorun */ }
    }
    logAction('Super League Mod & Auto-Freundschaftsspiel aktiviert', `${home?.name || 'Heim'} vs ${away?.name || 'Gast'} · Raum ${roomCode} · 1v1 Anstoß-Sequenz gesendet`);
    save();
    render();
    toast(`Super League Mod & Auto-Freundschaftsspiel (1v1) für ${home?.name || 'Heim'} vs ${away?.name || 'Gast'} aktiviert!`);
    return;
  }
  if (action === 'toggle-fifa15-hud') {
    fifa15HudVisible = !fifa15HudVisible;
    render();
    return;
  }
  if (action === 'toggle-fifa15-cinema') {
    fifa15CinemaMode = !fifa15CinemaMode;
    render();
    toast(fifa15CinemaMode ? 'Kinomodus aktiviert — volle Breite für FIFA 15 Browser-Arena.' : 'Kinomodus beendet.');
    return;
  }
  if (action === 'apply-fifa15-room') {
    if (!state.league) return;
    const input = document.querySelector('#fifa15-room-code-input');
    const code = sanitizeFifa15RoomCode(input?.value || state.league.onlineLobby?.roomCode || '');
    if (!code) return toast('Bitte gib einen gültigen 6-stelligen Raumcode ein.');
    state.league = updateOnlineLobbySettings(state.league, { roomCode: code }).league;
    logAction('FIFA 15 1v1 Raumcode gesetzt', `Online-Raumcode auf ${code} synchronisiert`);
    save();
    render();
    toast(`Raumcode ${code} für 1v1 Online-Freundschaftsspiel gespeichert!`);
    return;
  }
  if (action === 'regenerate-fifa15-room') {
    if (!state.league) return;
    const newCode = generateFifa15RoomCode(`${Date.now()}-${Math.random()}`);
    state.league = updateOnlineLobbySettings(state.league, { roomCode: newCode }).league;
    logAction('Neuer FIFA 15 Raumcode', `1v1 Raumcode ${newCode} generiert`);
    save();
    render();
    toast(`Neuer 6-stelliger 1v1 Raumcode generiert: ${newCode}`);
    return;
  }
  if (action === 'adjust-fifa15-score') {
    if (!state.league) return;
    const side = actionButton.dataset.side || 'home';
    const delta = Number(actionButton.dataset.delta) || 0;
    const curHome = Number(state.league.onlineLobby?.liveHomeScore ?? 0);
    const curAway = Number(state.league.onlineLobby?.liveAwayScore ?? 0);
    const nextHome = side === 'home' ? Math.max(0, Math.min(99, curHome + delta)) : curHome;
    const nextAway = side === 'away' ? Math.max(0, Math.min(99, curAway + delta)) : curAway;
    state.league = updateOnlineLobbySettings(state.league, {
      liveHomeScore: nextHome,
      liveAwayScore: nextAway,
    }).league;
    save();
    render();
    return;
  }
  if (action === 'set-fifa15-clock') {
    if (!state.league) return;
    const clock = actionButton.dataset.clock || '45:00';
    state.league = updateOnlineLobbySettings(state.league, { matchClock: clock }).league;
    save();
    render();
    return;
  }
  if (action === 'commit-fifa15-live-score') {
    if (!state.league) return;
    const homeTeamId = actionButton.dataset.homeId || pesHomeTeamId || state.league.match?.homeId || state.league.teams?.[0]?.id;
    const awayTeamId = actionButton.dataset.awayId || pesAwayTeamId || state.league.match?.awayId || state.league.teams?.[1]?.id;
    const fixtureId = actionButton.dataset.fixtureId || state.league.onlineLobby?.activeFixtureId || state.league.match?.fixtureId || '';
    const homeScore = Number(state.league.onlineLobby?.liveHomeScore ?? 0);
    const awayScore = Number(state.league.onlineLobby?.liveAwayScore ?? 0);
    const synced = applyPesLiveMatchSync(state.league, state.players, {
      fixtureId,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      confirmedBy: activeManager()?.managerName || state.league.adminName || 'FIFA 15 TV-Scoreboard',
    });
    if (synced.error) return toast(synced.error);
    state.league = synced.league;
    state.players = synced.players;
    state.league = updateOnlineLobbySettings(state.league, { matchClock: '90:00' }).league;
    logAction('FIFA 15 TV-Scoreboard Ergebnis übernommen', `${synced.summary.homeTeamName} ${homeScore}:${awayScore} ${synced.summary.awayTeamName} in Tabelle & NewsHub gespeichert`);
    save();
    render();
    toast(`Endstand ${synced.summary.homeTeamName} ${homeScore}:${awayScore} ${synced.summary.awayTeamName} in Ligatabelle übernommen!`);
    return;
  }
  if (action === 'export-fifa15-save-seed') {
    if (!state.league) return;
    const seedPayload = buildFifa15SuperLeagueModPackage(state.league, state.players, {
      homeTeamId: pesHomeTeamId,
      awayTeamId: pesAwayTeamId,
      roomCode: state.league.onlineLobby?.roomCode || generateFifa15RoomCode(state.league.id || 'ESL'),
    });
    downloadPesFile(
      `esl-fifa15-save-seed-${state.league?.season?.replace('/', '-') || '2026-27'}.json`,
      JSON.stringify(seedPayload, null, 2),
      'application/json;charset=utf-8',
    );
    logAction('FIFA 15 Xbox-360 Super League Mod-Seed exportiert', `Kader- & Profil-Mod (${seedPayload.dbHash}) heruntergeladen`);
    save();
    toast('FIFA 15 Xbox-360 Super League Mod-Seed (JSON) für alle Manager exportiert!');
    return;
  }
  if (action === 'download-sider-lua') {
    const lua = generatePesSiderLuaScript(state.league, { serverUrl: window.location.origin });
    downloadPesFile('career_sync.lua', lua, 'text/plain;charset=utf-8');
    logAction('FIFA 17 Sync-Skript exportiert', 'Automatischer Ergebnis-Sync heruntergeladen');
    save();
    toast('Sync-Skript heruntergeladen!');
    return;
  }
  if (action === 'download-career-package') {
    window.location.href = '/api/career/export-package';
    toast('Karriere-Snapshot wird heruntergeladen (fifa_career_save.json)...');
    return;
  }
  if (action === 'trigger-pes-live-sync' || action === 'sync-pes-fixture-now') {
    triggerPesLiveMatchSync(actionButton.dataset.fixtureId || '');
    return;
  }
  if (action === 'select-calendar-date') {
    selectedCalendarDate = actionButton.dataset.date;
    render();
  }
  if (action === 'shift-calendar-month') {
    const current = new Date(`${selectedCalendarDate || state.league?.currentDate || '2026-08-01'}T00:00:00Z`);
    current.setUTCDate(1);
    current.setUTCMonth(current.getUTCMonth() + Number(actionButton.dataset.delta));
    selectedCalendarDate = current.toISOString().slice(0, 10);
    render();
  }
  if (action === 'select-news-category') {
    selectedNewsCategory = actionButton.dataset.category || 'all';
    render();
  }
  if (action === 'like-news') {
    state.league = toggleNewsLike(state.league, actionButton.dataset.postId, activeManager()?.id || 'admin');
    save(); render();
  }
  if (action === 'repost-news') {
    state.league = toggleNewsRepost(state.league, actionButton.dataset.postId, activeManager()?.id || 'admin');
    save(); render();
  }
  if (action === 'toggle-news-comments') {
    expandedNewsCommentsPostId = expandedNewsCommentsPostId === actionButton.dataset.postId ? '' : actionButton.dataset.postId;
    render();
  }
  if (action === 'load-more-troll-comments') {
    const postId = actionButton.dataset.postId;
    if (postId && state.league) {
      state.league.news ??= [];
      let post = state.league.news.find((p) => p.id === postId);
      if (!post) {
        const derived = buildNewsFeed(state.league).find((p) => p.id === postId);
        if (derived) {
          state.league.news.unshift(derived);
          post = state.league.news[0];
        }
      }
      if (post) {
        post.comments ??= [];
        const extraComments = generateXFootballComments(post, 8, { offset: post.comments.length });
        post.comments.push(...extraComments);
        save();
        render();
        toast('8 neue X-Kommentare geladen!');
      }
    }
  }
  if (action === 'select-squad-player' || action === 'select-squad-slot-player') {
    selectedSquadPlayerId = selectedSquadPlayerId === actionButton.dataset.playerId ? '' : actionButton.dataset.playerId;
    render();
  }
  if (action === 'assign-squad-slot') {
    const playerId = selectedSquadPlayerId || actionButton.dataset.playerId;
    if (playerId) assignSquadPlayer(actionButton.dataset.slotId, playerId);
    else toast('Wähle zuerst einen Spieler von der Bank oder aus der Aufstellung.');
  }
  if (action === 'pick-player') {
    const team = nextPick();
    if (!canManagerPick(team, activeManager())) return toast(team?.managerType === 'cpu' ? 'Die CPU ist am Zug.' : 'Dieser Pick gehört dem anderen Manager.');
    const player = state.players.find((entry) => entry.id === actionButton.dataset.playerId);
    if (player) addPick(player);
  }
  if (action === 'reset-local') resetLocal();
  if (action === 'call-manager') initiateCall(actionButton.dataset.teamId);
  if (action === 'answer-call') {
    const res = respondToCall(state.league, actionButton.dataset.callId, activeManager().id, 'accept');
    phoneOpen = true;
    activePhoneApp = 'transfers';
    phoneTransferTab = 'room';
    updateLeague(res, { action: 'Anruf angenommen', detail: `${activeManager()?.name} öffnet den Verhandlungsraum im Smartphone` });
  }
  if (action === 'decline-call') {
    const res = respondToCall(state.league, actionButton.dataset.callId, activeManager().id, 'decline');
    updateLeague(res, { action: 'Anruf abgelehnt', detail: `${activeManager()?.name} lehnt den Anruf ab` });
  }
  if (action === 'close-phone-and-open-mail') {
    phoneOpen = false;
    phoneFullscreen = false;
    setView('mail');
    return;
  }
  if (action === 'close-phone-and-open-finances') {
    phoneOpen = false;
    phoneFullscreen = false;
    setView('finances');
    return;
  }
  if (action === 'select-mail-item') {
    selectedMailId = actionButton.dataset.mailId || '';
    if (state.league && selectedMailId) {
      state.league = markMailRead(state.league, selectedMailId);
      save();
    }
    render();
    return;
  }
  if (action === 'set-mail-filter') {
    selectedMailFilter = actionButton.dataset.filter || 'all';
    render();
    return;
  }
  if (action === 'mark-all-mail-read') {
    if (state.league && Array.isArray(state.league.mailItems)) {
      for (const m of state.league.mailItems) {
        m.unread = false;
        m.read = true;
      }
      save();
      render();
      toast('Alle Nachrichten im Postfach als gelesen markiert.');
    }
    return;
  }
  if (action === 'set-compose-mail-fee') {
    const feeInput = document.querySelector('#mail-offer-fee');
    if (feeInput && actionButton.dataset.fee) {
      feeInput.value = actionButton.dataset.fee;
    }
    return;
  }
  if (action === 'bump-mail-counter-fee') {
    const counterInput = document.querySelector('#mail-counter-fee-input');
    if (counterInput && actionButton.dataset.fee) {
      counterInput.value = actionButton.dataset.fee;
    }
    return;
  }
  if (action === 'mail-offer-player') {
    preselectedMailTargetTeamId = actionButton.dataset.teamId || '';
    preselectedMailPlayerId = actionButton.dataset.playerId || '';
    phoneOpen = false;
    setView('mail');
    toast('Schriftliches Angebot vorbereitet: Wähle im Postfach die gewünschte Ablösesumme.');
    return;
  }
  if (action === 'mail-offer-club') {
    preselectedMailTargetTeamId = actionButton.dataset.teamId || '';
    preselectedMailPlayerId = '';
    phoneOpen = false;
    setView('mail');
    toast('Postfach geöffnet: Wähle den gewünschten Spieler und deine Ablöse für das schriftliche Angebot.');
    return;
  }
  if (action === 'mail-accept-offer' || action === 'mail-counter-offer' || action === 'mail-decline-offer') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const mailId = actionButton.dataset.mailId || selectedMailId;
    const decision = action === 'mail-accept-offer'
      ? 'accept'
      : action === 'mail-counter-offer'
        ? 'counter'
        : 'decline';
    const counterInput = document.querySelector('#mail-counter-fee-input');
    const counterFee = counterInput ? Number(counterInput.value) : 0;
    const res = respondToMailOffer(state.league, mailId, manager.id, {
      decision,
      counterFee,
      players: state.players,
    });
    if (res.error) return toast(res.error);
    state.league = res.league;

    if (res.transfer) {
      state.league = appendNewsEvent(state.league, {
        id: `mail-tx-${res.transfer.callId}`,
        type: 'transfer-completed',
        playerName: res.transfer.playerName,
        sellerTeamId: res.transfer.sellerTeamId,
        sellerTeamName: res.transfer.sellerTeamName,
        buyerTeamId: res.transfer.buyerTeamId,
        buyerTeamName: res.transfer.buyerTeamName,
        fee: res.transfer.fee,
        createdAt: res.transfer.signedAt,
      });
      logAction('Postfach-Verkauf abgeschlossen', `${res.transfer.playerName} wechselt für ${res.transfer.fee} Mio. € von ${res.transfer.sellerTeamName} zu ${res.transfer.buyerTeamName}`);
      save();
      render();
      showSigningAnimation(res.transfer, state.league, { autoPlayShowreel: true });
      toast(`Deal perfekt: ${res.transfer.playerName} für ${res.transfer.fee} Mio. € verkauft!`);
      return;
    }

    if (res.stage2Ready && res.agentSession) {
      activeAgentNegotiationId = res.agentSession.id;
      logAction('Stufe 1 (Ablöse) geeinigt · Stufe 2 (Agent) gestartet', `Ablöse für ${res.agentSession.playerName} (${res.agentSession.agreedFee} Mio. €) akzeptiert — jetzt Gehalt & Unterschrift mit Berater ${res.agentSession.agent.agentName}`);
      save();
      render();
      toast(`Ablöse geeinigt! Verhandle jetzt in Stufe 2 Gehalt & Laufzeit mit Berater ${res.agentSession.agent.agentName}.`);
      return;
    }

    logAction(
      decision === 'counter' ? 'Postfach-Gegenangebot' : 'Postfach-Angebot abgelehnt',
      `${manager.name} hat auf das Angebot im Postfach reagiert`,
    );
    save();
    render();
    toast(decision === 'counter' ? 'Gegenangebot im Postfach gesendet!' : 'Transferangebot im Postfach abgelehnt.');
    return;
  }
  if (action === 'open-agent-negotiation-modal') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const mailId = actionButton.dataset.mailId || '';
    const existingSessionId = actionButton.dataset.sessionId || '';
    if (existingSessionId && (state.league.agentNegotiations ?? []).some((s) => s.id === existingSessionId)) {
      activeAgentNegotiationId = existingSessionId;
      render();
      return;
    }
    const mailItem = (state.league.mailItems ?? []).find((m) => m.id === mailId);
    if (mailItem) {
      const created = createAgentNegotiationSession(state.league, {
        buyerTeamId: manager.id,
        sellerTeamId: mailItem.sellerTeamId,
        playerId: mailItem.playerId,
        agreedFee: mailItem.agreedFee || mailItem.fee,
        mode: 'transfer',
        mailId: mailItem.id,
        players: state.players,
      });
      if (created.error) return toast(created.error);
      state.league = created.league;
      activeAgentNegotiationId = created.session.id;
      save();
      render();
    }
    return;
  }
  if (action === 'start-agent-extension') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const playerId = actionButton.dataset.playerId || '';
    const created = createAgentNegotiationSession(state.league, {
      buyerTeamId: manager.id,
      sellerTeamId: manager.id,
      playerId,
      agreedFee: 0,
      mode: 'extension',
      players: state.players,
    });
    if (created.error) return toast(created.error);
    state.league = created.league;
    activeAgentNegotiationId = created.session.id;
    save();
    render();
    toast(`Berater-Gespräch mit ${created.session.agent.agentName} über ${created.session.playerName} eröffnet.`);
    return;
  }
  if (action === 'close-agent-modal') {
    activeAgentNegotiationId = '';
    renderAgentNegotiationOverlay();
    return;
  }
  if (action === 'agent-open-finance-tab') {
    activeAgentNegotiationId = '';
    renderAgentNegotiationOverlay();
    setView('finances');
    toast('Verschiebe mit dem FIFA 17 Budget-Regler Mittel ins Gehaltsbudget und kehre dann zum Agenten zurück.');
    return;
  }
  if (action === 'clear-agent-signature-pad') {
    agentSignatureStrokes = [];
    const canvas = document.querySelector('#agent-signature-pad-canvas');
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (action === 'finalize-agent-signature') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const sessionIdToFinalize = actionButton.dataset.sessionId || activeAgentNegotiationId;
    const svgPath = strokesToSvgPath(agentSignatureStrokes);
    if (!svgPath) return toast('Bitte zeichne zuerst deine Unterschrift auf das Vertragspad.');
    const res = finalizeAgentDealWithSignature(state.league, sessionIdToFinalize, {
      svgPath,
      strokes: agentSignatureStrokes,
      signerName: manager.managerName || manager.name,
      players: state.players,
    });
    if (res.error) return toast(res.error);
    state.league = appendNewsEvent(res.league, {
      id: `agent-deal-${res.transfer.callId}`,
      type: 'transfer-completed',
      playerName: res.transfer.playerName,
      sellerTeamId: res.transfer.sellerTeamId,
      sellerTeamName: res.transfer.sellerTeamName,
      buyerTeamId: res.transfer.buyerTeamId,
      buyerTeamName: res.transfer.buyerTeamName,
      fee: res.transfer.fee,
      createdAt: res.transfer.signedAt,
    });
    activeAgentNegotiationId = '';
    logAction(
      res.session.mode === 'extension' ? 'Vertragsverlängerung mit Agent unterzeichnet' : '2-Stufen-Transfer & Agentenvertrag unterzeichnet',
      `${res.transfer.playerName} (${res.transfer.salary} Mio. €/J. · ${res.transfer.contractYears} J.) eigenhändig unterschrieben`,
    );
    save();
    render();
    showSigningAnimation(res.transfer, state.league, { autoPlayShowreel: true });
    toast(`Vertrag mit ${res.transfer.playerName} & Berater ${res.transfer.agentName} unterzeichnet!`);
    return;
  }
  if (action === 'apply-fifa-budget-split') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const slider = document.querySelector('#fifa-budget-slider');
    const splitPct = slider ? Number(slider.value) : 75;
    const res = adjustTeamBudgetSplit(state.league, manager.id, splitPct, state.players);
    if (res.error) return toast(res.error);
    state.league = res.league;
    logAction('FIFA 17 Budget-Regler angepasst', `${manager.name}: ${res.summary.splitRatio}% Transferbudget (${res.summary.transferBudget} Mio. €) / ${100 - res.summary.splitRatio}% Freies Gehaltsbudget (${res.summary.freeWageBudget} Mio. €/J.)`);
    save();
    render();
    toast(`Budgetverteilung bestätigt: ${res.summary.transferBudget} Mio. € Transfer / ${res.summary.freeWageBudget} Mio. €/J. freies Gehaltsbudget.`);
    return;
  }
  if (action === 'hangup-call') {
    const res = respondToCall(state.league, actionButton.dataset.callId, activeManager().id, 'hangup');
    updateLeague(res, { action: 'Anruf beendet', detail: `${activeManager()?.name} hat das Gespräch beendet` });
  }
  if (action === 'dismiss-signing') {
    clearTimeout(signingTimer);
    stopDealDoneShowreelLoop();
    const overlay = document.querySelector('#signing-overlay-root');
    if (overlay) overlay.innerHTML = '';
    return;
  }
  if (action === 'replay-deal-showreel') {
    const callId = actionButton.dataset.callId || activeSigningCallId;
    const transfer = (state.league?.transfers ?? []).find((t) => t.callId === callId);
    if (transfer) startDealDoneShowreelLoop(transfer);
    return;
  }
  if (action === 'clear-signature-pad') {
    recordedSignatureStrokes = [];
    const canvas = document.querySelector('#signature-pad-canvas');
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (action === 'save-recorded-signature') {
    const callId = actionButton.dataset.callId || activeSigningCallId;
    const manager = activeManager();
    if (!callId || !manager) return;
    const svgPath = strokesToSvgPath(recordedSignatureStrokes);
    if (!svgPath) return toast('Bitte zeichne zuerst deine Unterschrift in das Feld.');
    const res = recordManagerSignature(state.league, callId, manager.id, {
      strokes: recordedSignatureStrokes,
      svgPath,
      signedAt: new Date().toISOString(),
    });
    if (res.error) return toast(res.error);
    state.league = res.league;
    logAction('Vertrag eigenhändig unterschrieben', `${manager.managerName || manager.name} hat seine gezeichnete Unterschrift für alle Spieler gespeichert`);
    save();
    showSigningAnimation(res.transfer, state.league, { autoPlayShowreel: false });
    toast('Deine gezeichnete Unterschrift wurde gespeichert und ist für alle Spieler sichtbar!');
  }
  if (action === 'replay-signature-modal' || action === 'replay-transfer-signature') {
    const callId = actionButton.dataset.callId || activeSigningCallId;
    const transfer = (state.league?.transfers ?? []).find((t) => t.callId === callId);
    if (transfer) showSigningAnimation(transfer, state.league, { autoPlayShowreel: true });
  }
  if (action === 'accept-offer') {
    const manager = activeManager();
    const call = state.league?.calls?.find((c) => c.id === actionButton.dataset.callId);
    const lastOffer = call?.offers?.at(-1);
    // If active manager is the BUYER accepting a seller's offer, launch Stage 2 Agent Negotiation!
    if (manager && lastOffer && lastOffer.buyerTeamId === manager.id) {
      const created = createAgentNegotiationSession(state.league, {
        buyerTeamId: manager.id,
        sellerTeamId: lastOffer.sellerTeamId,
        playerId: lastOffer.playerId,
        agreedFee: lastOffer.fee,
        mode: 'transfer',
        players: state.players,
      });
      if (!created.error) {
        // Close the phone call as agreed on club fee
        const nextCalls = (created.league.calls ?? []).map((c) => (c.id === call.id ? { ...c, status: 'completed' } : c));
        state.league = { ...created.league, calls: nextCalls };
        activeAgentNegotiationId = created.session.id;
        phoneOpen = false;
        logAction('Stufe 1 im Handy geeinigt · Stufe 2 (Agent) gestartet', `${lastOffer.playerName} (${lastOffer.fee} Mio. €) — verhandle jetzt Gehalt & Unterschrift mit Berater ${created.session.agent.agentName}`);
        save();
        render();
        toast(`Vereins-Ablöse (${lastOffer.fee} Mio. €) geeinigt! Verhandle jetzt Gehalt & Unterschrift mit dem Berater.`);
        return;
      }
    }
    const res = acceptOffer(state.league, actionButton.dataset.callId, activeManager().id);
    if (res.error) return toast(res.error);
    res.league = appendNewsEvent(res.league, {
      id: `transfer-${res.transfer.callId}-${res.transfer.playerId}`,
      type: 'transfer-completed',
      playerName: res.transfer.playerName,
      sellerTeamId: res.transfer.sellerTeamId,
      sellerTeamName: res.transfer.sellerTeamName,
      buyerTeamId: res.transfer.buyerTeamId,
      buyerTeamName: res.transfer.buyerTeamName,
      fee: res.transfer.fee,
      createdAt: res.transfer.signedAt,
    });
    updateLeague(res, { action: 'Transfer abgeschlossen', detail: `${res.transfer.playerName} wechselt für ${Number(res.transfer.fee).toLocaleString('de-DE')} Mio. von ${res.transfer.sellerTeamName} zu ${res.transfer.buyerTeamName}` });
    showSigningAnimation(res.transfer, state.league, { autoPlayShowreel: true });
  }
  if (action === 'reject-offer') {
    const call = state.league?.calls?.find((c) => c.id === actionButton.dataset.callId);
    const lastOffer = call?.offers?.at(-1);
    const res = declineOffer(state.league, actionButton.dataset.callId, activeManager().id);
    if (res.error) return toast(res.error);
    if (lastOffer) {
      res.league = appendNewsEvent(res.league, {
        id: `reject-${call.id}-${lastOffer.id}`,
        type: 'offer-rejected',
        playerName: lastOffer.playerName,
        sellerTeamId: lastOffer.sellerTeamId,
        sellerTeamName: state.league.teams.find((t) => t.id === lastOffer.sellerTeamId)?.name || '',
        buyerTeamId: lastOffer.buyerTeamId,
        buyerTeamName: state.league.teams.find((t) => t.id === lastOffer.buyerTeamId)?.name || '',
        fee: lastOffer.fee,
      });
    }
    updateLeague(res, { action: 'Angebot abgelehnt', detail: `${activeManager()?.name} lehnt das Angebot für ${lastOffer?.playerName || 'Spieler'} ab` });
  }
});
document.addEventListener('dragstart', (event) => {
  const playerCard = event.target.closest('.squad-player-card[data-player-id], .squad-slot[data-player-id]');
  if (!playerCard || !activeManager()) return;
  event.dataTransfer?.setData('text/plain', playerCard.dataset.playerId);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragover', (event) => {
  const slot = event.target.closest('.squad-slot[data-drop-target="true"]');
  if (slot) event.preventDefault();
});
document.addEventListener('drop', (event) => {
  const slot = event.target.closest('.squad-slot[data-drop-target="true"]');
  const playerId = event.dataTransfer?.getData('text/plain');
  if (!slot || !playerId) return;
  event.preventDefault();
  assignSquadPlayer(slot.dataset.slotId, playerId);
});
document.querySelector('#active-manager').addEventListener('change', async (event) => {
  sessionStorage.setItem(`${SESSION_KEY}-manager`, event.target.value);
  selectedSquadTeamId = event.target.value;
  selectedSquadPlayerId = '';
  refreshManagerSelector(); await heartbeatPresence(); render();
});
document.addEventListener('change', (event) => {
  if (event.target.matches('[data-team-id]')) refreshSetupSummary();
  if (event.target.id === 'mail-target-team') {
    preselectedMailTargetTeamId = event.target.value;
    preselectedMailPlayerId = '';
    render();
    return;
  }
  if (event.target.id === 'mail-target-player') {
    preselectedMailPlayerId = event.target.value;
    render();
    return;
  }
  if (event.target.matches('[data-setup-manager-team]')) {
    const idx = Number(event.target.dataset.setupManagerTeam);
    if (setupManagers[idx]) {
      setupManagers[idx].teamId = event.target.value;
      render();
      refreshSetupSummary();
    }
    return;
  }
  if (event.target.matches('[data-action="switch-club-page"]')) {
    selectedClubPageId = event.target.value;
    render();
    return;
  }
  if (event.target.matches('[data-squad-team-select]')) { selectedSquadTeamId = event.target.value; selectedSquadPlayerId = ''; render(); }
  if (event.target.matches('[data-squad-preset-select]')) {
    const manager = activeManager();
    const teamId = selectedSquadTeamId || manager?.id;
    if (state.league && manager && teamId) {
      const res = setSquadTacticalPreset(state.league, teamId, event.target.value, manager.id);
      if (!res.error) {
        state.league = res.league;
        save();
        render();
        toast('Taktik-Stil aktualisiert.');
      }
    }
  }
  if (event.target.matches('[data-pes-team-select="home"]')) { pesHomeTeamId = event.target.value; render(); }
  if (event.target.matches('[data-pes-team-select="away"]')) { pesAwayTeamId = event.target.value; render(); }
  if (event.target.matches('[data-fm-filter="club"]')) { fmClubFilter = event.target.value; render(); }
  if (event.target.matches('[data-fm-filter="position"]')) { fmPositionFilter = event.target.value; render(); }
  if (event.target.matches('[data-fm-filter="scouting"]')) { fmScoutingFilter = event.target.value; render(); }
  if (event.target.id === 'home-team') { pesHomeTeamId = event.target.value; render(); }
  if (event.target.id === 'away-team') { pesAwayTeamId = event.target.value; render(); }
  if (event.target.id === 'calendar-target-date') selectedCalendarDate = event.target.value;
  if (event.target.id === 'csv-file') importCsvFile(event.target.files?.[0]);
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'fifa-budget-slider') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const ratio = Number(event.target.value);
    const fin = getTeamFinanceSummary(state.league, manager.id, state.players);
    const nextTx = Math.round(fin.AllocatablePool * (ratio / 100) * 10) / 10;
    const nextFreeWage = Math.round((fin.AllocatablePool - nextTx) * 10) / 10;
    const txLabel = document.querySelector('#fifa-slider-tx-val');
    const wageLabel = document.querySelector('#fifa-slider-wage-val');
    const ratioLabel = document.querySelector('#fifa-slider-ratio-label');
    if (txLabel) txLabel.textContent = `${nextTx.toLocaleString('de-DE')} Mio. €`;
    if (wageLabel) wageLabel.textContent = `${nextFreeWage.toLocaleString('de-DE')} Mio. € / Jahr`;
    if (ratioLabel) ratioLabel.textContent = `${ratio}% Transfer / ${100 - ratio}% Gehalt`;
    return;
  }
  if (event.target.matches('[data-setup-manager-name]')) {
    const idx = Number(event.target.dataset.setupManagerName);
    if (setupManagers[idx]) {
      setupManagers[idx].name = event.target.value;
      refreshSetupSummary();
      const assignedTeamId = setupManagers[idx].teamId;
      const tag = root.querySelector(`label[for="${assignedTeamId}"] .team-human-tag`);
      if (tag) {
        tag.innerHTML = `${icon('squad', { size: 10 })} ${escapeHtml(event.target.value || 'Manager')}`;
      }
    }
    return;
  }
  if (event.target.matches('[data-fm-filter="search"]')) {
    fmSearchQuery = event.target.value;
    const activeId = event.target.id;
    const caret = event.target.selectionStart;
    render();
    const nextInput = document.getElementById(activeId);
    if (nextInput) {
      nextInput.focus();
      try { nextInput.setSelectionRange(caret, caret); } catch { /* ignore */ }
    }
  }
});
document.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'mail-offer-compose-form') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const data = new FormData(event.target);
    const toTeamId = String(data.get('toTeamId') || '');
    const playerId = String(data.get('playerId') || '');
    const fee = Number(data.get('fee') || 0);
    const note = String(data.get('note') || '');
    const res = sendMailTransferOffer(state.league, {
      fromTeamId: manager.id,
      toTeamId,
      playerId,
      fee,
      note,
      players: state.players,
    });
    if (res.error) return toast(res.error);
    state.league = res.league;
    selectedMailId = res.cpuReplyMail?.id || res.mailItem.id;
    if (res.stage2Session) {
      activeAgentNegotiationId = res.stage2Session.id;
      logAction('Postfach-Angebot akzeptiert · Stufe 2 (Agent) bereit', `${res.mailItem.toTeamName} akzeptiert ${fee} Mio. € für ${res.mailItem.playerName} — jetzt Gehalt & Unterschrift mit Agent ${res.stage2Session.agent.agentName}`);
      save();
      render();
      toast(`${res.mailItem.toTeamName} nimmt dein Angebot (${fee} Mio. €) an! Verhandle jetzt in Stufe 2 mit dem Berater.`);
      return;
    }
    logAction('Schriftliches Angebot per Postfach gesendet', `${manager.name} bietet ${fee} Mio. € an ${res.mailItem.toTeamName} für ${res.mailItem.playerName}`);
    save();
    render();
    if (res.cpuReplyMail) {
      toast(`Antwort im Postfach: ${res.cpuReplyMail.subject}`);
    } else {
      toast(`Schriftliches Angebot (${fee} Mio. €) wurde in das Postfach von ${res.mailItem.toTeamName} zugestellt!`);
    }
    return;
  }
  if (event.target.id === 'agent-contract-offer-form') {
    const manager = activeManager();
    if (!state.league || !manager) return;
    const sessionIdToSubmit = event.target.dataset.sessionId || activeAgentNegotiationId;
    const data = new FormData(event.target);
    const res = submitAgentContractOffer(state.league, sessionIdToSubmit, {
      salary: Number(data.get('salary') || 0),
      years: Number(data.get('years') || 3),
      signingBonus: Number(data.get('signingBonus') || 0),
      role: String(data.get('role') || 'Stammspieler'),
      players: state.players,
    });
    if (res.error) return toast(res.error);
    state.league = res.league;
    save();
    renderAgentNegotiationOverlay();
    if (res.decision === 'accept') {
      toast(`Berater ${res.session.agent.agentName} nimmt dein Vertragsangebot an! Zeichne jetzt unten deine Unterschrift.`);
    } else if (res.decision === 'counter') {
      toast(`Gegenforderung von Berater ${res.session.agent.agentName}: ${res.session.demandedSalary} Mio. €/J.`);
    } else {
      toast(`Berater ${res.session.agent.agentName} hat die Verhandlungen abgebrochen.`);
    }
    return;
  }
  if (event.target.id === 'title-join-league-form') {
    const data = new FormData(event.target);
    const managerName = String(data.get('managerName') || '').trim() || 'Mitspieler';
    const teamId = String(data.get('teamId') || 'club-1');
    const roomCode = String(data.get('roomCode') || 'SUPER-LEAGUE-26').trim();

    if (state.league && Array.isArray(state.league.teams)) {
      const targetTeam = state.league.teams.find((t) => t.id === teamId);
      if (targetTeam) {
        targetTeam.managerType = 'human';
        targetTeam.managerName = managerName;
      }
      if (roomCode) {
        state.league.onlineLobby = {
          ...(state.league.onlineLobby || {}),
          networkRoomName: roomCode,
        };
      }
      sessionStorage.setItem(`${SESSION_KEY}-manager`, teamId);
      selectedSquadTeamId = teamId;
      logAction('Mitspieler beigetreten', `${managerName} übernimmt ${targetTeam?.name || teamId} (Lobby ${roomCode})`);
      save();
      refreshManagerSelector();
      heartbeatPresence();
      setupBuilderOpen = false;
      enterSuperLeague('overview');
      toast(`${managerName} ist der Super League beigetreten und steuert jetzt ${targetTeam?.name || 'das Team'}!`);
      return;
    }

    const existingIdx = setupManagers.findIndex((m) => m.teamId === teamId);
    if (existingIdx >= 0) {
      setupManagers[existingIdx].name = managerName;
    } else {
      setupManagers.push({
        id: `mgr-${Date.now()}`,
        name: managerName,
        teamId,
      });
    }
    setupBuilderOpen = true;
    enterSuperLeague('setup');
    toast(`${managerName} wurde dem Liga-Setup hinzugefügt! Bestätige jetzt den Start der Super League.`);
    return;
  }
  if (event.target.id === 'setup-form') startLeague(event.target);
  if (event.target.id === 'match-form') createMatch(event.target);
  if (event.target.id === 'score-form') saveScore(event.target);
  if (event.target.id === 'online-lobby-config-form') {
    if (!state.league) return;
    const data = new FormData(event.target);
    const res = updateOnlineLobbySettings(state.league, state.players, {
      networkRoomName: String(data.get('networkRoomName') || 'SUPER-LEAGUE-26'),
      hostVirtualIp: String(data.get('hostVirtualIp') || '26.104.88.10'),
    });
    state.league = res.league;
    logAction('PC-zu-PC Online-Lobby aktualisiert', `Raum ${res.onlineLobby.networkRoomName} · Host-IP ${res.onlineLobby.hostVirtualIp}`);
    save();
    render();
    toast('Online-Netzwerkdaten für alle Mitspieler gespeichert!');
    return;
  }
  if (event.target.id === 'pes-telemetry-form') {
    if (!state.league) return;
    const data = new FormData(event.target);
    const homeTeamId = String(data.get('homeTeamId') || pesHomeTeamId || state.league.teams[0]?.id || '');
    const awayTeamId = String(data.get('awayTeamId') || pesAwayTeamId || state.league.teams[1]?.id || '');
    const homeScore = Number(data.get('homeScore') ?? 0);
    const awayScore = Number(data.get('awayScore') ?? 0);
    const homeScorerId = String(data.get('homeScorerId') || '');
    const homeAssistId = String(data.get('homeAssistId') || '');
    const awayScorerId = String(data.get('awayScorerId') || '');
    const possessionHome = Number(data.get('possessionHome') || 52);

    const findName = (pid) => state.players.find((p) => p.id === pid)?.name
      || (state.league.draft?.picks ?? []).find((pk) => pk.playerId === pid)?.playerName
      || 'Torschütze';

    const customScorers = [];
    if (homeScorerId && homeScore > 0) {
      customScorers.push({
        playerId: homeScorerId,
        playerName: findName(homeScorerId),
        teamId: homeTeamId,
        minute: 24,
        assistPlayerId: homeAssistId,
        assistPlayerName: homeAssistId ? findName(homeAssistId) : '',
      });
    }
    if (awayScorerId && awayScore > 0) {
      customScorers.push({
        playerId: awayScorerId,
        playerName: findName(awayScorerId),
        teamId: awayTeamId,
        minute: 67,
      });
    }

    const previousLeague = structuredClone(state.league);
    const synced = applyPesLiveMatchSync(state.league, {
      source: `${state.league.onlineLobby?.engineVersion || 'FIFA17'}-telemetry`,
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      possessionHome,
      ...(customScorers.length ? { scorers: customScorers } : {}),
    }, { players: state.players });

    if (synced.error) return toast(synced.error);
    let nextLeague = detectSimulationNewsEvents(previousLeague, synced.league);
    nextLeague = appendNewsEvent(nextLeague, {
      id: `telemetry-sync-${synced.syncRecord.fixtureId}-${Date.now()}`,
      type: 'human-match-result',
      homeTeamId: synced.homeTeam.id,
      homeTeamName: synced.homeTeam.name,
      awayTeamId: synced.awayTeam.id,
      awayTeamName: synced.awayTeam.name,
      homeScore: synced.syncRecord.homeScore,
      awayScore: synced.syncRecord.awayScore,
      round: synced.syncRecord.round,
      createdAt: synced.syncRecord.syncedAt,
    });
    state.league = nextLeague;
    const upgradeCount = synced.syncRecord.attributeUpgrades?.length || 0;
    logAction('Online-Match & Spieler-Entwicklung gespeichert', `${synced.homeTeam.name} ${homeScore}:${awayScore} ${synced.awayTeam.name} · ${upgradeCount} Attribut-Boosts · Neuer Hash ${synced.dbHash}`);
    save();
    render();
    toast(`Ergebnis (${homeScore}:${awayScore}), Torschützen & ${upgradeCount} Spieler-Aufwertungen gespeichert (Hash ${synced.dbHash})!`);
    return;
  }
  if (event.target.matches('.calendar-score-form')) saveCalendarFixtureScore(event.target);
  if (event.target.matches('[data-ko-score-form], [data-knockout-score-form]')) {
    const data = new FormData(event.target);
    const matchId = event.target.dataset.matchId;
    const homeScore = Number(data.get('homeScore'));
    const awayScore = Number(data.get('awayScore'));
    const res = recordKnockoutMatchScore(state.league, matchId, homeScore, awayScore);
    if (res.error) return toast(res.error);
    state.league = res.league;
    logAction('K.-o.-Ergebnis eingetragen', `${res.match.home?.teamName || 'Heim'} ${homeScore}:${awayScore} ${res.match.away?.teamName || 'Gast'}`);
    save(); render();
    toast('K.-o.-Ergebnis gespeichert und Turnierbaum aktualisiert.');
  }
  if (event.target.matches('.offer-form')) {
    const data = new FormData(event.target);
    handleOfferSubmission(event.target.dataset.callId, String(data.get('playerId')), Number(data.get('fee')));
  }
  if (event.target.id === 'news-composer-form') {
    const data = new FormData(event.target);
    const manager = activeManager();
    const res = createCustomNewsPost(state.league, {
      authorName: manager ? `${manager.managerName || manager.name} (${manager.name})` : 'Liga-Insider',
      teamId: manager?.id || '',
      category: String(data.get('category') || 'fans'),
      text: String(data.get('postText') || ''),
    });
    if (res.error) return toast(res.error);
    state.league = res.league;
    logAction('NewsHub-Beitrag veröffentlicht', `${manager?.name || 'Admin'} veröffentlicht einen Beitrag im NewsHub`);
    save(); render(); toast('Beitrag im NewsHub veröffentlicht.');
  }
  if (event.target.matches('[data-news-comment-form]')) {
    const data = new FormData(event.target);
    const manager = activeManager();
    const postId = event.target.dataset.postId;
    const res = addNewsComment(state.league, postId, {
      authorName: manager ? `${manager.managerName || manager.name} · ${manager.name}` : 'Manager',
      teamId: manager?.id || '',
      text: String(data.get('commentText') || ''),
    });
    if (res.error) return toast(res.error);
    state.league = res.league;
    expandedNewsCommentsPostId = postId;
    save(); render();
  }
});
checkIncomingVibration();
initStadiumTitleMotion();
triggerTitleEntranceSpring();
render();
initializeSharedState();
window.addEventListener('beforeunload', () => { fetch(`/api/presence?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE', keepalive: true }); clearInterval(syncTimer); clearInterval(presenceTimer); });
