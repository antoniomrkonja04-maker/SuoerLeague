import { buildNewsFeed, buildNewsSidebarData, filterNewsPosts } from './news-core.mjs';
import { icon } from './icons.mjs';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const CATEGORIES = [
  { id: 'all', label: 'Alle', iconName: 'news', sub: 'Kompletter Liga-Feed' },
  { id: 'hatercentral', label: 'Hater Central', iconName: 'flame', sub: 'Trolls, Slander & Memes' },
  { id: 'transfers', label: 'Transfers', iconName: 'transfers', sub: 'Deals, Angebote & Hijacks' },
  { id: 'matchday', label: 'Spieltag', iconName: 'matches', sub: 'Ergebnisse & Topspiele' },
  { id: 'my-club', label: 'Mein Verein', iconName: 'clubs', sub: 'Vereins-Chronik' },
  { id: 'fans', label: 'Fans', iconName: 'message', sub: 'Kurve & Statements' },
];

function formatPostText(rawText) {
  const escaped = escapeHtml(rawText);
  return escaped.replace(/(#[A-Za-z0-9ÄÖÜäöüß_-]+)/g, '<span class="news-hashtag">$1</span>');
}

function formatTime(isoString) {
  if (!isoString) return 'Gerade eben';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return escapeHtml(String(isoString).slice(0, 10));
  return date.toLocaleString('de-AT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

export function renderPhoneNewsView({
  league,
  activeCategory = 'all',
  activeManagerTeamId = '',
  expandedCommentsPostId = '',
  activeSubTab = 'feed',
} = {}) {
  const allPosts = buildNewsFeed(league);
  const filteredPosts = filterNewsPosts(allPosts, activeCategory, activeManagerTeamId);
  const { leader, topThree, rumors, bigMatches, trends } = buildNewsSidebarData(league);
  const managerTeam = league?.teams?.find((t) => t.id === activeManagerTeamId);

  const topSegmented = `
    <div class="ios-segmented" role="tablist" aria-label="NewsHub Bereiche">
      <button type="button" class="ios-seg-btn ${activeSubTab === 'feed' ? 'is-active' : ''}" data-action="set-phone-news-tab" data-tab="feed">Timeline (${filteredPosts.length})</button>
      <button type="button" class="ios-seg-btn ${activeSubTab === 'trends' ? 'is-active' : ''}" data-action="set-phone-news-tab" data-tab="trends">Liga-Puls &amp; Gerüchte</button>
    </div>
  `;

  if (activeSubTab === 'trends') {
    return `
      <div class="ios-app-container">
        ${topSegmented}
        <div class="ios-card">
          <div class="ios-card-head">
            <strong>Tabellenführer</strong>
            <small>Top 3 der Liga</small>
          </div>
          ${leader ? `
            <div class="ios-list-group">
              ${topThree.map((row) => `
                <div class="ios-list-row">
                  <div class="ios-list-main">
                    <strong>#${row.rank} ${escapeHtml(row.teamName)}</strong>
                    <small>${row.played} Spiele · TD ${row.goalDifference >= 0 ? `+${row.goalDifference}` : row.goalDifference}</small>
                  </div>
                  <b class="ios-fixture-score">${row.points} Pkt</b>
                </div>
              `).join('')}
            </div>
          ` : '<div class="ios-empty-note">Noch keine Tabelle verfügbar.</div>'}
        </div>

        <div class="ios-card">
          <div class="ios-card-head">
            <strong>Transfergerüchte</strong>
            <small>Markt-Insider</small>
          </div>
          <div class="ios-list-group">
            ${rumors.map((item) => `
              <div class="ios-list-row">
                <div class="ios-list-main">
                  <strong>${escapeHtml(item.title)}</strong>
                  <small>${escapeHtml(item.sub)}</small>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="ios-card">
          <div class="ios-card-head">
            <strong>Trending &amp; Topspiele</strong>
            <small>Liga-Puls</small>
          </div>
          <div class="ios-list-group">
            ${trends.map((item) => `
              <div class="ios-list-row">
                <div class="ios-list-main">
                  <strong>${escapeHtml(item.tag)}</strong>
                  <small>${escapeHtml(item.meta)}</small>
                </div>
              </div>
            `).join('')}
            ${bigMatches.slice(0, 3).map((entry) => `
              <div class="ios-list-row">
                <div class="ios-list-main">
                  <strong>${escapeHtml(entry.home?.name || entry.fixture.homeId)} vs ${escapeHtml(entry.away?.name || entry.fixture.awayId)}</strong>
                  <small>ST ${entry.fixture.round} · ${escapeHtml(entry.fixture.date)}</small>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  const channelTabs = CATEGORIES.map((cat) => {
    const isActive = cat.id === activeCategory;
    return `<button type="button" class="ios-filter-tab ${isActive ? 'is-active' : ''}" data-action="select-news-category" data-category="${cat.id}" aria-pressed="${isActive}">
      ${escapeHtml(cat.label)}
    </button>`;
  }).join('');

  const postsHtml = filteredPosts.map((post) => {
    const liked = (post.likes ?? []).includes(activeManagerTeamId);
    const reposted = (post.reposts ?? []).includes(activeManagerTeamId);
    const commentList = post.comments ?? [];
    const commentsOpen = expandedCommentsPostId === post.id;
    const commentsMarkup = commentsOpen ? `<div class="ios-comments-box">
      ${commentList.length ? `<div class="ios-comment-list">${commentList.map((c) => `
        <div class="ios-comment-item">
          <div class="ios-comment-head">
            <strong>${escapeHtml(c.authorName)}</strong>
            ${c.verified ? '<span class="news-comment-verified">PRO</span>' : ''}
            <small>${escapeHtml(c.authorHandle || `@${String(c.authorName).toLowerCase().replace(/[^a-z0-9]/g, '_')}`)} · ${formatTime(c.createdAt)}</small>
          </div>
          <p class="ios-comment-text">${escapeHtml(c.text)}</p>
          <div class="ios-comment-foot"><span class="news-comment-likes">[L] ${c.likes ?? Math.floor(Math.random() * 180 + 12)} Likes</span></div>
        </div>`).join('')}</div>` : '<p class="ios-empty-note">Noch keine Antworten.</p>'}
      <div class="ios-comment-more-wrap">
        <button type="button" class="ios-sub-btn" data-action="load-more-troll-comments" data-post-id="${escapeHtml(post.id)}">
          ${icon('refresh', { size: 12 })} <span>Mehr X-Kommentare laden</span>
        </button>
      </div>
      <form class="ios-comment-form" data-news-comment-form data-post-id="${escapeHtml(post.id)}">
        <input type="text" name="commentText" maxlength="240" placeholder="Antwort schreiben…" aria-label="Kommentar zu Beitrag von ${escapeHtml(post.authorName)}" required>
        <button type="submit" class="ios-pill-btn">Senden</button>
      </form>
    </div>` : '';

    const safeAvatar = String(post.authorAvatar || post.authorName || 'FC')
      .replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'FC';

    return `
      <article class="ios-post-card" data-post-id="${escapeHtml(post.id)}" data-post-type="${escapeHtml(post.type)}">
        <div class="ios-post-top">
          <div class="ios-avatar">${escapeHtml(safeAvatar)}</div>
          <div class="ios-post-meta">
            <strong>${escapeHtml(post.authorName)}</strong>
            <span>${escapeHtml(post.authorHandle)} · <time>${formatTime(post.createdAt)}</time></span>
          </div>
        </div>
        <p class="ios-post-body">${formatPostText(post.text)}</p>
        <div class="ios-post-actions">
          <button type="button" class="ios-post-action ${commentsOpen ? 'is-active' : ''}" data-action="toggle-news-comments" data-post-id="${escapeHtml(post.id)}">
            Antworten · ${commentList.length}
          </button>
          <button type="button" class="ios-post-action ${reposted ? 'is-reposted' : ''}" data-action="repost-news" data-post-id="${escapeHtml(post.id)}">
            Repost · ${(post.reposts ?? []).length}
          </button>
          <button type="button" class="ios-post-action ${liked ? 'is-liked' : ''}" data-action="like-news" data-post-id="${escapeHtml(post.id)}">
            Gefällt mir · ${(post.likes ?? []).length}
          </button>
        </div>
        ${commentsMarkup}
      </article>
    `;
  }).join('');

  return `
    <div class="ios-app-container">
      ${topSegmented}
      <div class="ios-filter-bar" role="navigation" aria-label="News Kanäle">${channelTabs}</div>

      <form id="news-composer-form" class="ios-card ios-composer-card">
        <textarea id="news-post-input" name="postText" rows="2" maxlength="280" placeholder="Statement abgeben oder Transfer kommentieren… (#SuperLeague)" aria-label="Neuen Beitrag im NewsHub verfassen" required></textarea>
        <div class="ios-composer-foot">
          <select id="news-post-category" name="category" aria-label="Beitragskanal">
            <option value="fans" ${activeCategory === 'fans' ? 'selected' : ''}>Fanbereich</option>
            <option value="transfers" ${activeCategory === 'transfers' ? 'selected' : ''}>Transfernews</option>
            <option value="matchday" ${activeCategory === 'matchday' ? 'selected' : ''}>Spieltag</option>
          </select>
          <button type="submit" class="ios-primary-btn">${managerTeam ? `Als ${escapeHtml(managerTeam.name)} posten` : 'Beitrag posten'}</button>
        </div>
      </form>

      <div class="ios-feed-stack">
        ${postsHtml || '<div class="ios-card"><div class="ios-empty-note">Noch keine Beiträge in diesem Kanal.</div></div>'}
      </div>
    </div>
  `;
}

export function renderNewsView({
  league,
  activeCategory = 'all',
  activeManagerTeamId = '',
  expandedCommentsPostId = '',
} = {}) {
  const allPosts = buildNewsFeed(league);
  const filteredPosts = filterNewsPosts(allPosts, activeCategory, activeManagerTeamId);
  const { leader, topThree, rumors, bigMatches, trends } = buildNewsSidebarData(league);
  const managerTeam = league?.teams?.find((t) => t.id === activeManagerTeamId);
  const openHijacksCount = (league?.pendingDeals ?? []).filter((d) => d.status === 'open').length;

  const navItems = CATEGORIES.map((cat) => {
    const count = filterNewsPosts(allPosts, cat.id, activeManagerTeamId).length;
    const isActive = cat.id === activeCategory;
    return `<button type="button" class="news-nav-btn ${isActive ? 'is-active' : ''}" data-action="select-news-category" data-category="${cat.id}" aria-pressed="${isActive}">
      <span class="news-nav-icon" aria-hidden="true">${icon(cat.iconName, { size: 15 })}</span>
      <span class="news-nav-copy"><strong>${escapeHtml(cat.label)}</strong><small>${escapeHtml(cat.sub)}</small></span>
      <span class="news-nav-count">${count}</span>
    </button>`;
  }).join('');

  const postsHtml = filteredPosts.map((post) => {
    const liked = (post.likes ?? []).includes(activeManagerTeamId);
    const reposted = (post.reposts ?? []).includes(activeManagerTeamId);
    const commentList = post.comments ?? [];
    const commentsOpen = expandedCommentsPostId === post.id;
    const commentsMarkup = commentsOpen ? `<div class="news-comments-box">
      ${commentList.length ? `<div class="news-comment-list">${commentList.map((c) => `
        <div class="news-comment-item">
          <div class="news-comment-head">
            <strong>${escapeHtml(c.authorName)}</strong>
            ${c.verified ? '<span class="news-comment-verified">PRO</span>' : ''}
            <span class="news-comment-handle">${escapeHtml(c.authorHandle || `@${String(c.authorName).toLowerCase().replace(/[^a-z0-9]/g, '_')}`)}</span>
            <span class="news-comment-dot">·</span>
            <time>${formatTime(c.createdAt)}</time>
          </div>
          <p class="news-comment-text">${escapeHtml(c.text)}</p>
          <div class="news-comment-foot">
            <span class="news-comment-likes">[L] ${c.likes ?? Math.floor(Math.random() * 320 + 8)} Likes</span>
          </div>
        </div>`).join('')}</div>` : '<p class="draft-sub">Noch keine Antworten. Schreibe den ersten Kommentar.</p>'}
      <div class="news-comment-actions-bar">
        <button type="button" class="button light small news-load-more-btn" data-action="load-more-troll-comments" data-post-id="${escapeHtml(post.id)}">
          ${icon('refresh', { size: 12 })} <span>Mehr X-Kommentare laden</span>
        </button>
      </div>
      <form class="news-comment-form" data-news-comment-form data-post-id="${escapeHtml(post.id)}">
        <input type="text" name="commentText" maxlength="240" placeholder="Antwort posten… (oder X-Troll rauslassen)" aria-label="Kommentar zu Beitrag von ${escapeHtml(post.authorName)}" required>
        <button type="submit" class="button light small">${icon('send', { size: 13 })} <span>Antworten</span></button>
      </form>
    </div>` : '';

    const safeAvatar = String(post.authorAvatar || post.authorName || 'FC')
      .replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'FC';

    return `<article class="news-post-card ${post.type === 'transfer-hijacked' ? 'is-hijack-post' : ''}" data-post-id="${escapeHtml(post.id)}" data-post-type="${escapeHtml(post.type)}">
      <div class="news-post-avatar" aria-hidden="true">${escapeHtml(safeAvatar)}</div>
      <div class="news-post-body">
        <header class="news-post-header">
          <div class="news-post-author">
            <strong>${escapeHtml(post.authorName)}</strong>
            ${post.verified ? '<span class="news-verified" title="Verifizierter Liga-Account">PRO</span>' : ''}
            <span class="news-handle">${escapeHtml(post.authorHandle)}</span>
            <span class="news-dot">·</span>
            <time>${formatTime(post.createdAt)}</time>
          </div>
          <span class="news-type-badge is-${escapeHtml(post.category)}">${escapeHtml(post.badge || 'NEWS')}</span>
        </header>
        <p class="news-post-text">${formatPostText(post.text)}</p>
        <footer class="news-post-actions" aria-label="Beitragsaktionen">
          <button type="button" class="news-action-btn ${commentsOpen ? 'is-active' : ''}" data-action="toggle-news-comments" data-post-id="${escapeHtml(post.id)}" aria-label="Kommentare (${commentList.length})">
            ${icon('message', { size: 14 })} <span aria-hidden="true">Kommentare</span> <b>${commentList.length}</b>
          </button>
          <button type="button" class="news-action-btn ${reposted ? 'is-reposted' : ''}" data-action="repost-news" data-post-id="${escapeHtml(post.id)}" aria-label="Repost (${(post.reposts ?? []).length})">
            ${icon('repost', { size: 14 })} <span aria-hidden="true">Repost</span> <b>${(post.reposts ?? []).length}</b>
          </button>
          <button type="button" class="news-action-btn ${liked ? 'is-liked' : ''}" data-action="like-news" data-post-id="${escapeHtml(post.id)}" aria-label="Gefällt mir (${(post.likes ?? []).length})">
            ${icon('heart', { size: 14 })} <span aria-hidden="true">Gefällt mir</span> <b>${(post.likes ?? []).length}</b>
          </button>
        </footer>
        ${commentsMarkup}
      </div>
    </article>`;
  }).join('');

  return `<section class="calendar-page newshub-page" aria-label="NewsHub">
    <div class="page-heading">
      <div>
        <div class="eyebrow">COMMAND CENTER · SOCIAL TIMELINE, LIGA-INSIDER &amp; TRANSFER-TICKER</div>
        <h1>NewsHub.</h1>
        <p>Alle Transfers, Mehrrunden-Gegenangebote, Transfer-Hijacks, Top-Spiele, Tabellenführerwechsel und Stimmen aus eurer Karriere in Echtzeit.</p>
      </div>
      <div class="calendar-heading-actions">
        <button type="button" class="button light small" data-view="transfers">Zum TransferHub &amp; Hijack-Radar (${openHijacksCount})</button>
        <span class="calendar-host-badge">${escapeHtml(league?.season || '2026/27')} · LIVE-FEED (${allPosts.length})</span>
      </div>
    </div>

    <div class="calendar-stats newshub-kpi-strip">
      <div class="panel calendar-stat">
        <small>AKTIVER KANAL &amp; TIMELINE</small>
        <strong>${filteredPosts.length} Beiträge <i>· ${escapeHtml(CATEGORIES.find((c) => c.id === activeCategory)?.label || 'Alle')}</i></strong>
      </div>
      <div class="panel calendar-stat">
        <small>TABELLENFÜHRER AKTUELL</small>
        <strong>${escapeHtml(leader?.teamName || 'Saisonstart')} <i>· ${leader ? `${leader.points} Pkt (${leader.played} Sp.)` : '58 Spieltage'}</i></strong>
      </div>
      <div class="panel calendar-stat">
        <small>OFFENE HIJACK-CHANCEN &amp; DEALS</small>
        <strong>${openHijacksCount} Verhandlungen offen <i>· ${(league?.transfers ?? []).length} abgeschlossene Transfers</i></strong>
      </div>
    </div>

    <div class="newshub-grid">
      <aside class="panel newshub-left" aria-label="NewsHub Filter">
        <div class="panel-header"><h2>Kanäle</h2><span>TIMELINE</span></div>
        <nav class="news-nav-list">${navItems}</nav>
        ${managerTeam ? `<div class="news-club-card">
          <small>AKTIVER VEREIN</small>
          <strong>${escapeHtml(managerTeam.name)}</strong>
          <span>Manager: ${escapeHtml(managerTeam.managerName || managerTeam.name)} · Budget: ${Number(managerTeam.budget ?? 150).toLocaleString('de-DE')} Mio. €</span>
        </div>` : ''}
      </aside>

      <section class="panel newshub-center" aria-label="Zentrale Timeline">
        <div class="panel-header">
          <h2>Live-Redaktion &amp; Vereins-Statements</h2>
          <span>${filteredPosts.length} MELDUNGEN</span>
        </div>
        <form id="news-composer-form" class="news-composer">
          <div class="news-composer-top">
            <div class="news-post-avatar">${escapeHtml((managerTeam?.name || 'FC').slice(0, 2).toUpperCase())}</div>
            <textarea id="news-post-input" name="postText" rows="2" maxlength="280" placeholder="Statement abgeben, Transfer-Hijack kommentieren oder im Fanbereich posten… (#SuperLeague)" aria-label="Neuen Beitrag im NewsHub verfassen" required></textarea>
          </div>
          <div class="news-composer-bar">
            <div class="news-composer-channel">
              <label for="news-post-category" class="draft-sub">Kanal:</label>
              <select id="news-post-category" name="category" aria-label="Beitragskanal">
                <option value="fans" ${activeCategory === 'fans' ? 'selected' : ''}>Fanbereich</option>
                <option value="transfers" ${activeCategory === 'transfers' ? 'selected' : ''}>Transfernews</option>
                <option value="matchday" ${activeCategory === 'matchday' ? 'selected' : ''}>Spieltag</option>
              </select>
            </div>
            <button type="submit" class="button primary small">Beitrag veröffentlichen</button>
          </div>
        </form>

        <div class="news-timeline">
          ${postsHtml || '<div class="empty-state"><strong>Noch keine Beiträge in diesem Kanal.</strong><p>Simuliere Spieltage, führe Transferverhandlungen oder veröffentliche das erste Statement.</p></div>'}
        </div>
      </section>

      <aside class="newshub-right" aria-label="Trends und Liga-Widgets">
        <section class="panel news-widget">
          <div class="panel-header"><h2>Tabellenführer</h2><span>TOP 3</span></div>
          ${leader ? `<div class="news-leader-box">
            <div class="news-leader-Headline">
              <span class="qual-badge is-knockout">PLATZ 1</span>
              <strong>${escapeHtml(leader.teamName)}</strong>
              <small>${leader.points} Pkt · TD ${leader.goalDifference >= 0 ? `+${leader.goalDifference}` : leader.goalDifference} · ${leader.played} Sp.</small>
            </div>
            <div class="news-mini-table">
              ${topThree.map((row) => `<div class="news-mini-row"><span>#${row.rank} ${escapeHtml(row.teamName)}</span><b>${row.points} Pkt</b></div>`).join('')}
            </div>
          </div>` : '<div class="empty-state">Noch keine Tabelle verfügbar.</div>'}
        </section>

        <section class="panel news-widget">
          <div class="panel-header"><h2>Aktuelle Transfergerüchte</h2><span>MARKT &amp; HIJACK</span></div>
          <div class="news-widget-list">
            ${rumors.map((item) => `
              <div class="news-widget-item">
                <div class="news-widget-item-copy">
                  <strong>${escapeHtml(item.title)}</strong>
                  <small>${escapeHtml(item.sub)}</small>
                </div>
                ${item.dealId ? `<button type="button" class="button light small" data-action="hijack-transfer-deal" data-deal-id="${escapeHtml(item.dealId)}">Hijacken</button>` : ''}
              </div>
            `).join('')}
          </div>
        </section>

        <section class="panel news-widget">
          <div class="panel-header"><h2>Trending Topics</h2><span>LIGA-PULS</span></div>
          <div class="news-widget-list">
            ${trends.map((item) => `<div class="news-widget-item"><strong>${escapeHtml(item.tag)}</strong><small>${escapeHtml(item.meta)}</small></div>`).join('')}
          </div>
        </section>

        <section class="panel news-widget">
          <div class="panel-header"><h2>Nächste große Spiele</h2><span>SPIELPLAN</span></div>
          <div class="news-widget-list">
            ${bigMatches.length ? bigMatches.map((entry) => `<div class="news-widget-item ${entry.isHuman ? 'is-human-highlight' : ''}">
              <strong>${escapeHtml(entry.home?.name || entry.fixture.homeId)} vs ${escapeHtml(entry.away?.name || entry.fixture.awayId)}</strong>
              <small>ST ${entry.fixture.round} · ${escapeHtml(entry.fixture.date)} · ${entry.isHuman ? 'Mensch-gegen-Mensch' : 'Top-Duell'}</small>
            </div>`).join('') : '<div class="empty-state">Alle Saisonspiele abgeschlossen oder Spielplan steht nach dem Draft bereit.</div>'}
          </div>
        </section>
      </aside>
    </div>
  </section>`;
}
