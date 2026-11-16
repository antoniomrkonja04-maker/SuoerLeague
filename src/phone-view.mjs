import { isDraftComplete } from './calendar-core.mjs';
import { buildNewsFeed } from './news-core.mjs';
import { analyzeTeamPositionNeeds, isTransferWindowOpen } from './transfer-core.mjs';

const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const initials = (name = '') =>
  String(name)
    .replace(/[^A-Za-zÄÖÜäöüß0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'FC';

export const PHONE_APPS = ['transfers', 'news', 'calendar'];

export function strokesToSvgPath(strokes = [], sourceWidth = 320, sourceHeight = 96) {
  if (!Array.isArray(strokes) || !strokes.length) return { pathData: '', durationMs: 0 };
  const targetW = 180;
  const targetH = 54;
  const scaleX = targetW / Math.max(1, sourceWidth);
  const scaleY = targetH / Math.max(1, sourceHeight);
  const parts = [];
  let minT = Infinity;
  let maxT = -Infinity;

  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || !stroke.length) continue;
    for (let i = 0; i < stroke.length; i += 1) {
      const pt = stroke[i];
      const x = Math.max(2, Math.min(targetW - 2, Number(pt.x) * scaleX)).toFixed(1);
      const y = Math.max(2, Math.min(targetH - 2, Number(pt.y) * scaleY)).toFixed(1);
      if (Number.isFinite(pt.t)) {
        if (pt.t < minT) minT = pt.t;
        if (pt.t > maxT) maxT = pt.t;
      }
      parts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
    }
  }
  const durationMs = Number.isFinite(minT) && Number.isFinite(maxT) && maxT > minT
    ? Math.max(600, Math.min(3500, Math.round(maxT - minT)))
    : 1250;
  return { pathData: parts.join(' '), durationMs };
}

export function hasIncomingPhoneAlert(league, managerTeamId) {
  if (!league || !managerTeamId) return false;
  const calls = league.calls ?? [];
  return calls.some((call) => {
    if (call.targetTeamId === managerTeamId && call.status === 'ringing') return true;
    if ((call.callerTeamId === managerTeamId || call.targetTeamId === managerTeamId) && call.status === 'negotiating') {
      const last = call.offers?.at(-1);
      if (last?.status === 'pending' && last.fromTeamId !== managerTeamId) return true;
    }
    return false;
  });
}

export function renderUnderDockCallWidget({ league, manager }) {
  const calls = league?.calls ?? [];
  const incoming = manager && calls.find((call) => call.targetTeamId === manager.id && call.status === 'ringing');
  const active = manager && calls.find((call) => [call.callerTeamId, call.targetTeamId].includes(manager.id) && call.status === 'negotiating');
  const ringing = manager && calls.find((call) => call.callerTeamId === manager.id && call.status === 'ringing');
  const call = incoming || active || ringing;

  if (!call) {
    return `<section class="iphone-under-dock-call is-idle" aria-label="Anruf Widget unterm Dock">
      <div class="under-dock-call-avatar">TEL</div>
      <div class="under-dock-call-copy">
        <span class="under-dock-call-status"><i></i>ANRUF-WIDGET · LEITUNG FREI</span>
        <strong>${manager ? escapeHtml(`${manager.managerName || manager.name} · ${manager.name}`) : 'Kein aktiver Anruf'}</strong>
        <small>Eingehende Anrufe &amp; CPU-Angebote erscheinen hier unterm Dock</small>
      </div>
      ${league?.draft?.picks?.length ? `<button type="button" class="under-dock-action-pill" data-action="trigger-cpu-market" title="Simuliert CPU-Transfers &amp; einen eingehenden CPU-Anruf">CPU-Anruf</button>` : ''}
    </section>`;
  }

  const isIncoming = call === incoming;
  const isActive = call === active;
  const otherName = isIncoming ? call.callerManagerName : manager.id === call.callerTeamId ? call.targetManagerName : call.callerManagerName;
  const otherTeam = isIncoming ? call.callerTeamName : manager.id === call.callerTeamId ? call.targetTeamName : call.callerTeamName;
  const lastOffer = call.offers?.at(-1);
  const offerPreview = lastOffer
    ? `${escapeHtml(lastOffer.playerName)} · ${Number(lastOffer.fee).toLocaleString('de-DE')} Mio.`
    : '';
  const avatar = escapeHtml(initials(otherName || 'MG'));

  return `<section class="iphone-under-dock-call ${isIncoming ? 'is-incoming' : isActive ? 'is-active' : 'is-outgoing'}" aria-label="${isIncoming ? 'Eingehender Anruf unterm Dock' : isActive ? 'Aktiver Anruf unterm Dock' : 'Ausgehender Anruf unterm Dock'}">
    <div class="under-dock-call-avatar">${avatar}</div>
    <div class="under-dock-call-copy">
      <span class="under-dock-call-status"><i></i>${isIncoming ? 'EINGEHENDER ANRUF · VIBRATION AKTIV' : isActive ? 'VERHANDLUNG AKTIV' : 'ANRUF LÄUFT…'}</span>
      <strong>${escapeHtml(otherName || 'Manager')} (${escapeHtml(otherTeam || '')})</strong>
      <small>${offerPreview ? `Angebot: ${offerPreview}` : escapeHtml(call.reason || otherTeam || '')}${isActive ? ` · <span data-call-duration data-start="${escapeHtml(call.acceptedAt || call.createdAt)}">00:00</span>` : ''}</small>
    </div>
    ${isIncoming
      ? `<div class="under-dock-call-actions">
          <button type="button" class="call-answer" data-action="answer-call" data-call-id="${escapeHtml(call.id)}" aria-label="Anruf von ${escapeHtml(otherName)} annehmen" title="Abheben">OK</button>
          <button type="button" class="call-decline" data-action="decline-call" data-call-id="${escapeHtml(call.id)}" aria-label="Anruf ablehnen" title="Ablehnen">×</button>
        </div>`
      : `<div class="under-dock-call-actions">
          <button type="button" class="under-dock-action-pill" data-action="open-phone-app" data-phone-app="transfers">${isActive ? 'Zum Raum' : 'Öffnen'}</button>
          <button type="button" class="call-decline call-end" data-action="hangup-call" data-call-id="${escapeHtml(call.id)}" aria-label="Anruf beenden" title="Auflegen">×</button>
        </div>`}
  </section>`;
}

export function renderPhoneShell({
  league,
  players = [],
  manager,
  phoneOpen = false,
  activePhoneApp = 'home',
  phoneExpanded = false,
  appContentHtml = '',
} = {}) {
  const vibrating = hasIncomingPhoneAlert(league, manager?.id);
  const calls = league?.calls ?? [];
  const activeCallsCount = manager
    ? calls.filter((c) => [c.callerTeamId, c.targetTeamId].includes(manager.id) && ['ringing', 'negotiating'].includes(c.status)).length
    : 0;
  const newsCount = league ? buildNewsFeed(league).length : 0;
  const calendarUnlocked = isDraftComplete(league, players);
  const windowOpen = isTransferWindowOpen(league?.currentDate || '2026-08-01');
  const latestTransfer = (league?.transfers ?? []).at(-1);
  const needs = league && manager ? analyzeTeamPositionNeeds(league, manager.id, players) : null;
  const topMissing = needs?.missingPositions?.slice(0, 3).map((m) => m.position).join(', ') || 'Komplett besetzt';

  // Page 1 of Mockup: Docked Phone from the Back ("Handy von hinten") at bottom-right
  if (!phoneOpen) {
    return `<aside class="phone-back-dock-wrap" aria-label="Manager-Smartphone (Rückseite)">
      <button type="button" class="phone-back-trigger ${vibrating ? 'is-vibrating' : ''}" data-action="open-phone" aria-label="Smartphone umdrehen und öffnen">
        <div class="phone-back-alert-pill ${vibrating ? 'is-urgent' : ''}">
          <span class="phone-back-dot"></span>
          <span>${vibrating ? 'ANRUF / ANGEBOT EINGEGANGEN!' : 'HANDY UMDREHEN · 3 APPS'}</span>
        </div>
        <div class="phone-back-hardware">
          <img class="phone-back-image" src="/assets/phone-back.svg" alt="Smartphone Rückseite mit Kamera" referrerpolicy="no-referrer">
          ${activeCallsCount > 0 ? `<span class="phone-back-badge">${activeCallsCount}</span>` : ''}
        </div>
      </button>
    </aside>`;
  }

  // Page 2 of Mockup: Centered Front-Side iPhone ("Handy Vorderseite") with Back Button on the left, Apps, Dock, and Call Widget under the Dock
  const appTitles = {
    home: 'iOS Home',
    transfers: 'TransferHub',
    news: 'NewsHub',
    calendar: 'Saisonkalender',
  };

  const homeScreenHtml = `<div class="iphone-home-screen">
    <div class="iphone-date-header">
      <small>${escapeHtml(league?.season || 'SAISON 2026/27')} · ${escapeHtml(league?.currentDate || '2026-08-01')}</small>
      <strong>${escapeHtml(manager?.name || league?.name || 'Super League Smartphone')}</strong>
    </div>

    <div class="iphone-app-grid" role="navigation" aria-label="Smartphone Apps">
      <button type="button" class="iphone-app-tile" data-action="open-phone-app" data-phone-app="transfers">
        <span class="iphone-app-icon-wrap">
          <img src="/assets/app-transferhub.svg" alt="TransferHub Icon" referrerpolicy="no-referrer">
          ${activeCallsCount > 0 ? `<b class="iphone-app-badge">${activeCallsCount}</b>` : ''}
        </span>
        <span class="iphone-app-label">TransferHub</span>
      </button>

      <button type="button" class="iphone-app-tile" data-action="open-phone-app" data-phone-app="news">
        <span class="iphone-app-icon-wrap">
          <img src="/assets/app-newshub.svg" alt="NewsHub Icon" referrerpolicy="no-referrer">
          ${newsCount > 0 ? `<b class="iphone-app-badge is-blue">${Math.min(99, newsCount)}</b>` : ''}
        </span>
        <span class="iphone-app-label">NewsHub</span>
      </button>

      <button type="button" class="iphone-app-tile ${calendarUnlocked ? '' : 'is-locked'}" data-action="open-phone-app" data-phone-app="calendar">
        <span class="iphone-app-icon-wrap">
          <img src="/assets/app-calendar.svg" alt="Kalender Icon" referrerpolicy="no-referrer">
          <b class="iphone-app-badge ${calendarUnlocked ? 'is-green' : 'is-amber'}">${calendarUnlocked ? '58' : 'X'}</b>
        </span>
        <span class="iphone-app-label">Kalender</span>
      </button>
    </div>

    <section class="iphone-home-widget" aria-label="Transfermarkt &amp; Kader-Status">
      <div class="iphone-widget-top">
        <span>MANAGER-RADAR · ${windowOpen ? 'FENSTER OFFEN' : 'FENSTER ZU'}</span>
        <b>${Number(manager?.budget ?? 150).toLocaleString('de-DE')} Mio. €</b>
      </div>
      <div class="iphone-widget-row">
        <small>Kaderbedarf (Fehlende Pos.):</small>
        <strong>${escapeHtml(topMissing)}</strong>
      </div>
      <div class="iphone-widget-row">
        <small>Letzter Transfer:</small>
        <strong>${latestTransfer ? `${escapeHtml(latestTransfer.playerName)} (${escapeHtml(latestTransfer.sellerTeamName)} → ${escapeHtml(latestTransfer.buyerTeamName)} · ${Number(latestTransfer.fee).toLocaleString('de-DE')} Mio.)` : 'Noch kein Transfer abgeschlossen'}</strong>
      </div>
      ${league?.draft?.picks?.length ? `<button type="button" class="iphone-widget-cta" data-action="trigger-cpu-market">CPU-Transfers &amp; Angebot simulieren</button>` : `<button type="button" class="iphone-widget-cta" data-action="close-phone-go-setup">Erst Liga &amp; Auto-Draft starten</button>`}
    </section>
  </div>`;

  const activeAppHtml = `<div class="iphone-app-window" data-active-phone-app="${escapeHtml(activePhoneApp)}">
    <header class="iphone-app-topbar">
      <button type="button" class="iphone-nav-pill" data-action="phone-home" aria-label="Zurück zum Handy-Homescreen">‹ Home</button>
      <strong class="iphone-app-title">${escapeHtml(appTitles[activePhoneApp] || 'App')}</strong>
      <button type="button" class="iphone-nav-pill" data-action="toggle-phone-expand" aria-label="Handy-Ansicht vergrößern oder verkleinern">${phoneExpanded ? 'Kompakt' : 'Groß'}</button>
    </header>
    <div class="iphone-app-scroll">
      ${appContentHtml}
    </div>
  </div>`;

  return `<div class="phone-stage-backdrop" role="dialog" aria-modal="false" aria-label="Manager Smartphone Vorderseite">
    <div class="phone-stage-layout ${phoneExpanded ? 'is-expanded' : ''}">
      <div class="phone-stage-left-controls">
        <button type="button" class="phone-stage-back-btn" data-action="phone-back" aria-label="${activePhoneApp === 'home' ? 'Handy umdrehen und weglegen' : 'Zurück zum Handy-Homescreen'}" title="${activePhoneApp === 'home' ? 'Handy weglegen' : 'Zurück zum Homescreen'}">←</button>
        <span class="phone-stage-back-caption">${activePhoneApp === 'home' ? 'Weglegen' : 'Zurück'}</span>
      </div>

      <div class="iphone-front-device ${phoneExpanded ? 'is-expanded' : ''} ${vibrating ? 'is-vibrating' : ''}">
        <img class="iphone-wallpaper-layer" src="/assets/phone-wallpaper.svg" alt="Smartphone Hintergrundbild" referrerpolicy="no-referrer">
        <img class="iphone-bezel-layer" src="/assets/phone-front.svg" alt="Smartphone Vorderseite Rahmen" referrerpolicy="no-referrer">

        <div class="iphone-screen-content">
          <header class="iphone-status-bar">
            <span class="iphone-time">09:41</span>
            <div class="iphone-dynamic-island" data-action="phone-home" title="Dynamic Island · Home">
              <span class="island-camera-dot"></span>
              <span class="island-status-text">${vibrating ? 'ANRUF' : activePhoneApp === 'home' ? 'SUPER LEAGUE' : escapeHtml(appTitles[activePhoneApp])}</span>
            </div>
            <span class="iphone-status-icons">5G 100%</span>
          </header>

          <div class="iphone-main-area">
            ${activePhoneApp === 'home' ? homeScreenHtml : activeAppHtml}
          </div>

          <div class="iphone-bottom-stack">
            <nav class="iphone-dock" aria-label="iPhone App Dock">
              <button type="button" class="iphone-dock-item ${activePhoneApp === 'transfers' ? 'is-active' : ''}" data-action="open-phone-app" data-phone-app="transfers" title="TransferHub">
                <img src="/assets/app-transferhub.svg" alt="TransferHub" referrerpolicy="no-referrer">
                <span>TransferHub</span>
              </button>
              <button type="button" class="iphone-dock-item ${activePhoneApp === 'news' ? 'is-active' : ''}" data-action="open-phone-app" data-phone-app="news" title="NewsHub">
                <img src="/assets/app-newshub.svg" alt="NewsHub" referrerpolicy="no-referrer">
                <span>NewsHub</span>
              </button>
              <button type="button" class="iphone-dock-item ${activePhoneApp === 'calendar' ? 'is-active' : ''}" data-action="open-phone-app" data-phone-app="calendar" title="Kalender">
                <img src="/assets/app-calendar.svg" alt="Kalender" referrerpolicy="no-referrer">
                <span>Kalender</span>
              </button>
            </nav>

            ${renderUnderDockCallWidget({ league, manager })}

            <button type="button" class="iphone-home-indicator" data-action="phone-home" aria-label="Home Indicator"></button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
