import { isTransferWindowOpen, rankTeamsFromResults, rosterNeedForTeam } from './transfer-core.mjs';
import { buildMatchDefeatSlanderPost, generateXFootballComments, getPlayerSlanderName } from './twitter-slander-engine.mjs';

const clone = (value) => structuredClone(value);

const initials = (name = '') => String(name)
  .replace(/[^A-Za-zÄÖÜäöüß0-9\s]/g, ' ')
  .trim()
  .split(/\s+/)
  .map((part) => part[0] ?? '')
  .slice(0, 2)
  .join('')
  .toUpperCase() || 'FC';

const handleFrom = (name = '') => `@${String(name)
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '') || 'career_fc'}`;

function formatEventPost(event) {
  let initialComments = [];
  if (Array.isArray(event.comments)) {
    initialComments = event.comments;
  } else if (event.type && event.type !== 'custom') {
    initialComments = generateXFootballComments(event, 5);
  }

  const base = {
    id: event.id,
    type: event.type || 'custom',
    category: event.category || 'all',
    authorName: event.authorName || 'Career Insider',
    authorHandle: event.authorHandle || '@career_insider',
    authorAvatar: event.authorAvatar || 'CI',
    verified: event.verified ?? true,
    createdAt: event.createdAt || new Date().toISOString(),
    teamIds: event.teamIds || [event.teamId, event.sellerTeamId, event.buyerTeamId, event.homeTeamId, event.awayTeamId].filter(Boolean),
    likes: Array.isArray(event.likes) ? event.likes : [],
    reposts: Array.isArray(event.reposts) ? event.reposts : [],
    comments: initialComments,
    badge: event.badge || 'LIGA-NEWS',
    text: event.text || '',
  };

  switch (event.type) {
    case 'defeat-slander': {
      return {
        ...base,
        category: 'hatercentral',
        authorName: event.authorName || 'Hater Central',
        authorHandle: event.authorHandle || '@TheHaterCentral',
        authorAvatar: event.authorAvatar || 'HC',
        badge: event.badge || 'HATER CENTRAL SLANDER',
        verified: true,
        text: event.text || '',
      };
    }
    case 'transfer-completed': {
      const feeText = Number(event.fee || 0).toLocaleString('de-DE');
      return {
        ...base,
        category: 'transfers',
        authorName: 'Fabrizio Career · TransferDesk',
        authorHandle: '@career_transferdesk',
        authorAvatar: 'TD',
        badge: 'HERE WE GO · FIX',
        text: event.text || `OFFIZIELL: ${event.playerName} wechselt von ${event.sellerTeamName} zu ${event.buyerTeamName}! Vereinbarte Ablöse: ${feeText} Mio. Alle Dokumente sind unterschrieben. #Transfernews #DoneDeal`,
      };
    }
    case 'offer-rejected': {
      const feeText = Number(event.fee || 0).toLocaleString('de-DE');
      return {
        ...base,
        category: 'transfers',
        authorName: 'Transfermarkt Insider',
        authorHandle: '@tm_geruechte',
        authorAvatar: 'TM',
        badge: 'ABGELEHNT',
        text: event.text || `${event.sellerTeamName} hat das Angebot von ${event.buyerTeamName} für ${event.playerName} (${feeText} Mio.) abgelehnt. Die Verhandlungen sind vorerst geplatzt. #Transfermarkt`,
      };
    }
    case 'offer-countered': {
      const feeText = Number(event.fee || 0).toLocaleString('de-DE');
      return {
        ...base,
        category: 'transfers',
        authorName: 'Sky Career Transfer Update',
        authorHandle: '@sky_transfers',
        authorAvatar: 'SK',
        badge: 'GEGENANGEBOT',
        text: event.text || `Poker um ${event.playerName}: Im Gespräch zwischen ${event.sellerTeamName} und ${event.buyerTeamName} liegt jetzt ein Gegenangebot über ${feeText} Mio. auf dem Tisch! #Verhandlung`,
      };
    }
    case 'human-match-result': {
      return {
        ...base,
        category: 'matchday',
        authorName: 'Career Matchday Live',
        authorHandle: '@career_matchday',
        authorAvatar: 'MD',
        badge: `TOPSPIEL · ST ${event.round || '—'}`,
        text: event.text || `ABPFIFF im Manager-Duell! ${event.homeTeamName} ${event.homeScore}:${event.awayScore} ${event.awayTeamName}. Ein packendes Direktduell zweier menschlicher Manager! #Matchday #ManagerDuell`,
      };
    }
    case 'big-cpu-match': {
      return {
        ...base,
        category: 'matchday',
        authorName: 'Liga-Konferenz',
        authorHandle: '@liga_konferenz',
        authorAvatar: 'LK',
        badge: `HIGHLIGHT · ST ${event.round || '—'}`,
        text: event.text || `Ausrufezeichen am ${event.round || ''}. Spieltag: ${event.homeTeamName} und ${event.awayTeamName} trennen sich ${event.homeScore}:${event.awayScore}! #Spieltag #Highlight`,
      };
    }
    case 'leader-change': {
      return {
        ...base,
        category: 'matchday',
        authorName: 'Career Statistik & Tabelle',
        authorHandle: '@career_stats',
        authorAvatar: 'ST',
        badge: 'TABELLENFÜHRER',
        text: event.text || `Wachablösung an der Spitze! ${event.teamName} übernimmt mit ${event.points ?? 0} Punkten die Tabellenführung${event.previousTeamName ? ` vor ${event.previousTeamName}` : ''}. #Tabellenführer #Titelkampf`,
      };
    }
    case 'transfer-window': {
      return {
        ...base,
        category: 'transfers',
        authorName: 'Career Ligaleitung',
        authorHandle: '@career_official',
        authorAvatar: 'CL',
        badge: 'TRANSFERFENSTER',
        text: event.text || `${event.title || 'Transferfenster-Update'}: Bitte beachtet die offiziellen Fristen (Sommer: 31. August · Winter: 31. Januar). #DeadlineDay #Transferfenster`,
      };
    }
    case 'injury-suspension': {
      return {
        ...base,
        category: 'matchday',
        authorName: `${event.teamName || 'Medical'} Update`,
        authorHandle: handleFrom(event.teamName || 'medical_dept'),
        authorAvatar: initials(event.teamName || 'MD'),
        badge: 'KADER-UPDATE',
        text: event.text || `Bittere Nachricht für ${event.teamName}: ${event.playerName} fällt vorerst aus (${event.detail || 'Verletzung/Sperre'}). #KaderUpdate`,
      };
    }
    default: {
      return {
        ...base,
        category: event.category || 'fans',
        authorName: event.authorName || 'Fanstimme',
        authorHandle: event.authorHandle || handleFrom(event.authorName || 'fan'),
        authorAvatar: event.authorAvatar || initials(event.authorName || 'Fan'),
        verified: Boolean(event.verified),
        badge: event.category === 'fans' ? 'FANBEREICH' : 'VEREINSSTATEMENT',
        text: event.text || '',
      };
    }
  }
}

export function appendNewsEvent(league, event) {
  if (!league || !event) return league;
  const next = clone(league);
  next.news ??= [];
  const id = event.id || `news-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (next.news.some((entry) => entry.id === id)) return next;
  const post = formatEventPost({ ...event, id });
  next.news.unshift(post);
  next.news = next.news.slice(0, 150);
  return next;
}

export function detectSimulationNewsEvents(previousLeague, nextLeague) {
  if (!nextLeague) return nextLeague;
  let updated = clone(nextLeague);
  updated.news ??= [];

  const prevDate = String(previousLeague?.currentDate || '').slice(0, 10);
  const nextDate = String(updated.currentDate || '').slice(0, 10);

  // 1. Check transfer window transitions between prevDate and nextDate
  if (prevDate && nextDate && prevDate !== nextDate) {
    const years = new Set([prevDate.slice(0, 4), nextDate.slice(0, 4)]);
    const milestones = [];
    for (const y of years) {
      milestones.push(
        { date: `${y}-07-01`, id: `window-open-summer-${y}`, title: `Sommer-Transferfenster ${y} geöffnet`, text: `Das Sommer-Transferfenster ist offiziell geöffnet! Bis zum 31. August können Transfers finalisiert werden. #Transferfenster #Sommer` },
        { date: `${y}-08-31`, id: `window-deadline-summer-${y}`, title: `Sommer-Deadline Day (${y})`, text: `DEADLINE DAY! Am 31. August schließt das Sommer-Transferfenster. Letzte Chance für Kader-Deals! #DeadlineDay` },
        { date: `${y}-09-01`, id: `window-closed-summer-${y}`, title: `Sommer-Transferfenster geschlossen`, text: `Das Sommer-Transferfenster ist jetzt geschlossen. Neue Transfers können erst wieder ab 1. Januar abgeschlossen werden. #Transferfenster` },
        { date: `${y}-01-01`, id: `window-open-winter-${y}`, title: `Winter-Transferfenster ${y} geöffnet`, text: `Das Winter-Transferfenster ist eröffnet! Bis zum 31. Januar dürfen Neuzugänge registriert werden. #Winterfenster` },
        { date: `${y}-01-31`, id: `window-deadline-winter-${y}`, title: `Winter-Deadline Day (${y})`, text: `WINTER-DEADLINE DAY! Heute am 31. Januar endet die Winter-Transferperiode. #DeadlineDay` },
        { date: `${y}-02-01`, id: `window-closed-winter-${y}`, title: `Winter-Transferfenster geschlossen`, text: `Das Winter-Transferfenster ist geschlossen. Fokus auf den Saisonendspurt! #Transferfenster` },
      );
    }
    for (const milestone of milestones) {
      if (milestone.date > prevDate && milestone.date <= nextDate) {
        updated = appendNewsEvent(updated, {
          id: milestone.id,
          type: 'transfer-window',
          title: milestone.title,
          text: milestone.text,
          createdAt: `${milestone.date}T09:00:00Z`,
        });
      }
    }
  }

  // 2. Check new matches for defeat slander and notable games
  const prevMatchIds = new Set((previousLeague?.matchHistory ?? []).map((m) => m.matchId ?? m.fixtureId));
  const newMatches = (updated.matchHistory ?? []).filter((m) => !prevMatchIds.has(m.matchId ?? m.fixtureId));
  const teamsById = new Map((updated.teams ?? []).map((t) => [t.id, t]));

  // Generate defeat slander roasting the top 2 decisive losing teams and star players per step
  const decisiveMatches = newMatches
    .filter((m) => Number(m.homeScore ?? 0) !== Number(m.awayScore ?? 0))
    .sort((a, b) => Math.abs(Number(b.homeScore) - Number(b.awayScore)) - Math.abs(Number(a.homeScore) - Number(a.awayScore)))
    .slice(0, 2);

  for (const match of decisiveMatches) {
    const home = teamsById.get(match.homeId);
    const away = teamsById.get(match.awayId);
    if (!home || !away) continue;
    const slanderPost = buildMatchDefeatSlanderPost(match, home, away, updated.draftPicks ?? []);
    if (slanderPost) {
      updated = appendNewsEvent(updated, slanderPost);
    }
  }

  const notableMatches = newMatches
    .filter((m) => Math.abs(Number(m.homeScore) - Number(m.awayScore)) >= 3 || (Number(m.homeScore) + Number(m.awayScore)) >= 5)
    .slice(-3);

  for (const match of notableMatches) {
    const home = teamsById.get(match.homeId);
    const away = teamsById.get(match.awayId);
    if (!home || !away) continue;
    updated = appendNewsEvent(updated, {
      id: `big-cpu-${match.matchId ?? match.fixtureId}`,
      type: 'big-cpu-match',
      homeTeamId: home.id,
      homeTeamName: home.name,
      awayTeamId: away.id,
      awayTeamName: away.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      round: match.round,
      createdAt: match.at || `${match.date || nextDate}T18:00:00Z`,
    });
  }

  // 3. Check table leader change
  const prevPlayed = (previousLeague?.matchHistory ?? []).length;
  const nextPlayed = (updated.matchHistory ?? []).length;
  if (nextPlayed > prevPlayed && (updated.teams?.length ?? 0) > 0) {
    const prevStandings = rankTeamsFromResults(updated.teams, previousLeague?.matchHistory ?? []);
    const nextStandings = rankTeamsFromResults(updated.teams, updated.matchHistory ?? []);
    const prevLeader = prevPlayed > 0 ? prevStandings[0] : null;
    const nextLeader = nextStandings[0];
    if (nextLeader && nextLeader.played > 0 && (!prevLeader || prevLeader.teamId !== nextLeader.teamId)) {
      updated = appendNewsEvent(updated, {
        id: `leader-${nextLeader.teamId}-played-${nextPlayed}`,
        type: 'leader-change',
        teamId: nextLeader.teamId,
        teamName: nextLeader.teamName,
        previousTeamName: prevLeader?.teamName || '',
        points: nextLeader.points,
        createdAt: `${nextDate || '2026-08-01'}T20:00:00Z`,
      });
    }
  }

  return updated;
}

export function buildNewsFeed(league) {
  if (!league) return [];
  const stored = Array.isArray(league.news) ? league.news.map(formatEventPost) : [];
  const existingIds = new Set(stored.map((item) => item.id));
  const derived = [];

  // Derive posts from existing transfers if not yet in league.news
  for (const transfer of league.transfers ?? []) {
    const id = `derived-transfer-${transfer.callId || transfer.playerId}-${transfer.signedAt || transfer.at}`;
    if (!existingIds.has(id) && !stored.some((p) => p.type === 'transfer-completed' && p.text.includes(transfer.playerName))) {
      derived.push(formatEventPost({
        id,
        type: 'transfer-completed',
        playerName: transfer.playerName,
        sellerTeamId: transfer.sellerTeamId,
        sellerTeamName: transfer.sellerTeamName,
        buyerTeamId: transfer.buyerTeamId,
        buyerTeamName: transfer.buyerTeamName,
        fee: transfer.fee,
        createdAt: transfer.signedAt || transfer.at || league.createdAt,
      }));
    }
  }

  // Derive posts from optional injuries/suspensions array if present on league
  for (const item of league.injuries ?? []) {
    const id = `derived-injury-${item.id || `${item.playerId}-${item.at}`}`;
    if (!existingIds.has(id)) {
      derived.push(formatEventPost({
        id,
        type: 'injury-suspension',
        playerName: item.playerName,
        teamId: item.teamId,
        teamName: item.teamName,
        detail: item.detail || item.reason,
        createdAt: item.at || league.createdAt,
      }));
    }
  }

  // Always include a welcome/season kickoff post if feed would otherwise be sparse
  const welcomeId = `welcome-${league.season || '2026-27'}`;
  if (!existingIds.has(welcomeId)) {
    const windowOpen = isTransferWindowOpen(league.currentDate || '2026-08-01');
    derived.push({
      id: welcomeId,
      type: 'welcome',
      category: 'all',
      authorName: 'Career Ligaleitung',
      authorHandle: '@career_official',
      authorAvatar: 'CL',
      verified: true,
      badge: 'SAISONSTART',
      teamIds: [],
      likes: [],
      reposts: [],
      comments: [],
      text: `Willkommen im offiziellen NewsHub von ${league.name || 'Career'}! Hier laufen alle Transferabschlüsse, Gegenangebote, Top-Ergebnisse, Tabellenführerwechsel und Fan-Stimmen live zusammen. Aktuelles Transferfenster: ${windowOpen ? 'OFFEN' : 'GESCHLOSSEN'}. #Career #Saison2627`,
      createdAt: league.createdAt || '2026-07-01T08:00:00Z',
    });
  }

  return [...stored, ...derived].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function filterNewsPosts(posts, category = 'all', managerTeamId = '') {
  if (!Array.isArray(posts)) return [];
  if (category === 'hatercentral') {
    return posts.filter((post) => (
      post.category === 'hatercentral' ||
      post.type === 'defeat-slander' ||
      (post.badge && (post.badge.includes('SLANDER') || post.badge.includes('DISASTERCLASS') || post.badge.includes('BANTER'))) ||
      (post.authorHandle && (post.authorHandle.toLowerCase().includes('hater') || post.authorHandle.toLowerCase().includes('troll') || post.authorHandle.toLowerCase().includes('fraud')))
    ));
  }
  if (category === 'transfers') return posts.filter((post) => post.category === 'transfers');
  if (category === 'matchday') return posts.filter((post) => post.category === 'matchday');
  if (category === 'fans') return posts.filter((post) => post.category === 'fans');
  if (category === 'my-club') {
    if (!managerTeamId) return posts;
    return posts.filter((post) => (post.teamIds ?? []).includes(managerTeamId));
  }
  return posts;
}

export function toggleNewsLike(league, postId, managerTeamId) {
  if (!league || !postId || !managerTeamId) return league;
  const next = clone(league);
  next.news ??= buildNewsFeed(next);
  let post = next.news.find((entry) => entry.id === postId);
  if (!post) {
    const derived = buildNewsFeed(next).find((entry) => entry.id === postId);
    if (!derived) return next;
    next.news.unshift(derived);
    post = next.news[0];
  }
  post.likes ??= [];
  if (post.likes.includes(managerTeamId)) {
    post.likes = post.likes.filter((id) => id !== managerTeamId);
  } else {
    post.likes.push(managerTeamId);
  }
  return next;
}

export function toggleNewsRepost(league, postId, managerTeamId) {
  if (!league || !postId || !managerTeamId) return league;
  const next = clone(league);
  next.news ??= buildNewsFeed(next);
  let post = next.news.find((entry) => entry.id === postId);
  if (!post) {
    const derived = buildNewsFeed(next).find((entry) => entry.id === postId);
    if (!derived) return next;
    next.news.unshift(derived);
    post = next.news[0];
  }
  post.reposts ??= [];
  if (post.reposts.includes(managerTeamId)) {
    post.reposts = post.reposts.filter((id) => id !== managerTeamId);
  } else {
    post.reposts.push(managerTeamId);
  }
  return next;
}

export function addNewsComment(league, postId, { authorName, teamId, text, now = new Date().toISOString() } = {}) {
  const cleanText = String(text ?? '').trim();
  if (!cleanText) return { league, error: 'Bitte gib einen Kommentartext ein.' };
  const next = clone(league);
  next.news ??= buildNewsFeed(next);
  let post = next.news.find((entry) => entry.id === postId);
  if (!post) {
    const derived = buildNewsFeed(next).find((entry) => entry.id === postId);
    if (!derived) return { league, error: 'Beitrag nicht gefunden.' };
    next.news.unshift(derived);
    post = next.news[0];
  }
  post.comments ??= [];
  post.comments.push({
    id: `comment-${Date.now()}-${ post.comments.length + 1 }`,
    authorName: authorName || 'Manager',
    teamId: teamId || '',
    text: cleanText.slice(0, 280),
    createdAt: now,
  });
  return { league: next, post };
}

export function createCustomNewsPost(league, { id, authorName, teamId, category = 'fans', text, now = new Date().toISOString() } = {}) {
  const cleanText = String(text ?? '').trim();
  if (!cleanText) return { league, error: 'Bitte schreibe zuerst einen Beitragstext.' };
  const next = appendNewsEvent(league, {
    id: id || `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'custom',
    category: category === 'my-club' ? 'fans' : category,
    authorName: authorName || 'Manager',
    authorHandle: handleFrom(authorName || 'manager'),
    authorAvatar: initials(authorName || 'MG'),
    verified: true,
    teamId,
    teamIds: teamId ? [teamId] : [],
    text: cleanText.slice(0, 320),
    createdAt: now,
  });
  return { league: next, post: next.news[0] };
}

export function buildNewsSidebarData(league) {
  const standings = rankTeamsFromResults(league?.teams ?? [], league?.matchHistory ?? []);
  const leader = standings[0] ?? null;
  const topThree = standings.slice(0, 3);
  const teamsById = new Map((league?.teams ?? []).map((t) => [t.id, t]));

  // Active transfer rumors from pending hijackable deals, calls, or roster needs
  const rumors = [];
  for (const deal of (league?.pendingDeals ?? []).filter((d) => d.status === 'open').slice(0, 3)) {
    rumors.push({
      title: `${deal.playerName} (${deal.sellerTeamName} → ${deal.buyerTeamName})`,
      sub: `${deal.stageLabel || `Runde ${deal.round}/3`} · Gebot: ${Number(deal.currentFee).toLocaleString('de-DE')} Mio. € · Hijack ab ${Number(deal.minHijackFee || deal.currentFee + 3)} Mio. €`,
      dealId: deal.id,
    });
  }
  for (const call of (league?.calls ?? []).slice(-4).reverse()) {
    if (rumors.length >= 5) break;
    const lastOffer = call.offers?.at(-1);
    if (lastOffer) {
      rumors.push({
        title: `${lastOffer.playerName} → ${teamsById.get(lastOffer.buyerTeamId)?.name || 'Interessent'}`,
        sub: `Gebot: ${Number(lastOffer.fee).toLocaleString('de-DE')} Mio. · Status: ${lastOffer.status === 'pending' ? 'Offen' : lastOffer.status === 'countered' ? 'Gegenangebot' : lastOffer.status}`,
      });
    } else {
      rumors.push({
        title: `${call.callerTeamName} / ${call.targetTeamName}`,
        sub: call.status === 'negotiating' ? 'Geheimgespräch im Verhandlungsraum' : 'Kontaktaufnahme zwischen den Managern',
      });
    }
  }
  if (rumors.length < 3) {
    const needyTeams = (league?.teams ?? [])
      .map((t) => ({ team: t, need: rosterNeedForTeam(league, t.id) }))
      .sort((a, b) => b.need - a.need)
      .slice(0, 3 - rumors.length);
    for (const entry of needyTeams) {
      rumors.push({
        title: `${entry.team.name} sondiert den Markt`,
        sub: `Budget: ${Number(entry.team.budget ?? 150).toLocaleString('de-DE')} Mio. · Kader-Scouting aktiv`,
      });
    }
  }

  // Upcoming big matches (human-vs-human first, then top ranked clashes)
  const rankMap = new Map(standings.map((row) => [row.teamId, row.rank]));
  const openFixtures = (league?.schedule ?? []).filter((f) => f.status !== 'completed');
  const bigMatches = openFixtures
    .map((f) => {
      const home = teamsById.get(f.homeId);
      const away = teamsById.get(f.awayId);
      const isHuman = home?.managerType === 'human' && away?.managerType === 'human';
      const rankSum = (rankMap.get(f.homeId) ?? 20) + (rankMap.get(f.awayId) ?? 20);
      return { fixture: f, home, away, isHuman, priority: (isHuman ? 0 : 100) + rankSum };
    })
    .sort((a, b) => a.priority - b.priority || a.fixture.date.localeCompare(b.fixture.date))
    .slice(0, 4);

  // Trending topics
  const windowOpen = isTransferWindowOpen(league?.currentDate || '2026-08-01');
  const trends = [
    { tag: windowOpen ? '#TransferfensterOffen' : '#Kaderplanung', meta: `${(league?.transfers ?? []).length} fixe Transfers in dieser Saison` },
    { tag: leader ? `#${leader.teamName.replace(/\s+/g, '')}` : '#Titelkampf', meta: leader ? `Platz 1 · ${leader.points} Punkte` : '30 Teams · 58 Spieltage' },
    { tag: '#KOPhaseTop8', meta: 'Plätze 1–8 direkt qualifiziert · 9–16 Playoffs' },
    { tag: '#ManagerDuell', meta: `${openFixtures.filter((f) => teamsById.get(f.homeId)?.managerType === 'human' && teamsById.get(f.awayId)?.managerType === 'human').length} Mensch-gegen-Mensch-Spiele offen` },
  ];

  return { leader, topThree, rumors, bigMatches, trends };
}
