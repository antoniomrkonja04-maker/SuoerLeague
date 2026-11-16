import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addNewsComment,
  appendNewsEvent,
  buildNewsFeed,
  createCustomNewsPost,
  detectSimulationNewsEvents,
  filterNewsPosts,
  toggleNewsLike,
  toggleNewsRepost,
} from '../src/news-core.mjs';
import { renderNewsView } from '../src/news-view.mjs';

function sampleLeague() {
  return {
    name: 'Career Premier League',
    season: '2026/27',
    currentDate: '2026-08-15',
    teams: [
      { id: 't1', name: 'Arsenal', managerType: 'human', managerName: 'Admin', budget: 150 },
      { id: 't2', name: 'Real Madrid', managerType: 'human', managerName: 'Alex', budget: 150 },
      { id: 't3', name: 'Bayern München', managerType: 'cpu', managerName: 'CPU 1', budget: 150 },
    ],
    draft: {
      picks: [
        { playerId: 'p1', playerName: 'Bukayo Saka', rating: 92, teamId: 't1', teamName: 'Arsenal' },
        { playerId: 'p2', playerName: 'Kylian Mbappé', rating: 97, teamId: 't2', teamName: 'Real Madrid' },
        { playerId: 'p3', playerName: 'Jamal Musiala', rating: 93, teamId: 't3', teamName: 'Bayern München' },
      ],
    },
    schedule: [
      { id: 'm1', round: 1, date: '2026-08-16', homeId: 't1', awayId: 't2', status: 'scheduled' },
    ],
    matchHistory: [
      { matchId: 'm0', fixtureId: 'm0', round: 1, date: '2026-08-10', homeId: 't1', awayId: 't3', homeScore: 3, awayScore: 1, at: '2026-08-10T18:00:00Z' },
    ],
    transfers: [],
    calls: [],
    news: [],
  };
}

test('appendNewsEvent creates all required automatic news event types without duplicates', () => {
  let league = sampleLeague();

  league = appendNewsEvent(league, {
    id: 'evt-transfer-1',
    type: 'transfer-completed',
    playerName: 'Bukayo Saka',
    sellerTeamId: 't1',
    sellerTeamName: 'Arsenal',
    buyerTeamId: 't2',
    buyerTeamName: 'Real Madrid',
    fee: 95,
    createdAt: '2026-08-15T12:00:00Z',
  });
  league = appendNewsEvent(league, {
    id: 'evt-reject-1',
    type: 'offer-rejected',
    playerName: 'Kylian Mbappé',
    sellerTeamId: 't2',
    sellerTeamName: 'Real Madrid',
    buyerTeamId: 't1',
    buyerTeamName: 'Arsenal',
    fee: 60,
    createdAt: '2026-08-15T12:05:00Z',
  });
  league = appendNewsEvent(league, {
    id: 'evt-counter-1',
    type: 'offer-countered',
    playerName: 'Jamal Musiala',
    sellerTeamId: 't3',
    sellerTeamName: 'Bayern München',
    buyerTeamId: 't1',
    buyerTeamName: 'Arsenal',
    fee: 88,
    createdAt: '2026-08-15T12:10:00Z',
  });
  league = appendNewsEvent(league, {
    id: 'evt-human-match-1',
    type: 'human-match-result',
    homeTeamId: 't1',
    homeTeamName: 'Arsenal',
    awayTeamId: 't2',
    awayTeamName: 'Real Madrid',
    homeScore: 2,
    awayScore: 2,
    round: 2,
    createdAt: '2026-08-15T14:00:00Z',
  });
  league = appendNewsEvent(league, {
    id: 'evt-cpu-match-1',
    type: 'big-cpu-match',
    homeTeamId: 't3',
    homeTeamName: 'Bayern München',
    awayTeamId: 't1',
    awayTeamName: 'Arsenal',
    homeScore: 4,
    awayScore: 1,
    round: 3,
    createdAt: '2026-08-15T15:00:00Z',
  });
  league = appendNewsEvent(league, {
    id: 'evt-leader-1',
    type: 'leader-change',
    teamId: 't3',
    teamName: 'Bayern München',
    previousTeamName: 'Arsenal',
    points: 6,
    createdAt: '2026-08-15T15:05:00Z',
  });
  league = appendNewsEvent(league, {
    id: 'evt-window-1',
    type: 'transfer-window',
    windowEvent: 'deadline-summer',
    title: 'Sommer-Deadline erreicht',
    createdAt: '2026-08-31T23:59:00Z',
  });
  league = appendNewsEvent(league, {
    id: 'evt-injury-1',
    type: 'injury-suspension',
    playerName: 'Bukayo Saka',
    teamId: 't1',
    teamName: 'Arsenal',
    detail: 'Gelbsperre (1 Spiel)',
    createdAt: '2026-08-15T16:00:00Z',
  });

  // Duplicate ID must be ignored
  league = appendNewsEvent(league, {
    id: 'evt-transfer-1',
    type: 'transfer-completed',
    playerName: 'Bukayo Saka',
  });

  assert.equal(league.news.length, 8);
  const feed = buildNewsFeed(league);
  assert.ok(feed.some((post) => post.type === 'transfer-completed' && post.text.includes('Bukayo Saka')));
  assert.ok(feed.some((post) => post.type === 'offer-rejected' && post.text.includes('Kylian Mbappé')));
  assert.ok(feed.some((post) => post.type === 'offer-countered' && post.text.includes('Jamal Musiala')));
  assert.ok(feed.some((post) => post.type === 'human-match-result' && post.text.includes('2:2')));
  assert.ok(feed.some((post) => post.type === 'big-cpu-match' && post.text.includes('4:1')));
  assert.ok(feed.some((post) => post.type === 'leader-change' && post.text.includes('Bayern München')));
  assert.ok(feed.some((post) => post.type === 'transfer-window'));
  assert.ok(feed.some((post) => post.type === 'injury-suspension' && post.text.includes('Gelbsperre')));
});

test('detectSimulationNewsEvents records transfer window crossings, big CPU matches, and leader changes', () => {
  const before = sampleLeague();
  before.currentDate = '2026-08-29';
  const after = structuredClone(before);
  after.currentDate = '2026-09-01';
  after.matchHistory.push({
    matchId: 'm-big',
    fixtureId: 'm-big',
    round: 2,
    date: '2026-08-31',
    homeId: 't3',
    awayId: 't2',
    homeScore: 4,
    awayScore: 0,
    at: '2026-08-31T12:00:00Z',
  });

  const updated = detectSimulationNewsEvents(before, after);
  const types = updated.news.map((item) => item.type);
  assert.ok(types.includes('big-cpu-match'));
  assert.ok(types.includes('leader-change'));
  assert.ok(types.includes('transfer-window'));
});

test('NewsHub supports category filtering, likes, reposts, comments, and custom fan/club posts', () => {
  let league = sampleLeague();
  league = appendNewsEvent(league, {
    id: 'evt-t1',
    type: 'transfer-completed',
    playerName: 'Bukayo Saka',
    sellerTeamId: 't1',
    sellerTeamName: 'Arsenal',
    buyerTeamId: 't2',
    buyerTeamName: 'Real Madrid',
    fee: 95,
    createdAt: '2026-08-15T12:00:00Z',
  });
  league = createCustomNewsPost(league, {
    id: 'fan-1',
    authorName: 'Nordkurve Arsenal',
    teamId: 't1',
    category: 'fans',
    text: 'Was für ein Saisonauftakt im Emirates! #COYG',
    now: '2026-08-15T13:00:00Z',
  }).league;

  const allPosts = buildNewsFeed(league);
  assert.equal(filterNewsPosts(allPosts, 'transfers', 't1').length, 1);
  assert.equal(filterNewsPosts(allPosts, 'fans', 't1').length, 1);
  assert.ok(filterNewsPosts(allPosts, 'my-club', 't1').length >= 2);

  league = toggleNewsLike(league, 'fan-1', 't1');
  assert.deepEqual(league.news.find((p) => p.id === 'fan-1').likes, ['t1']);
  league = toggleNewsLike(league, 'fan-1', 't1');
  assert.deepEqual(league.news.find((p) => p.id === 'fan-1').likes, []);

  league = toggleNewsRepost(league, 'fan-1', 't2');
  assert.deepEqual(league.news.find((p) => p.id === 'fan-1').reposts, ['t2']);

  league = addNewsComment(league, 'fan-1', {
    authorName: 'Alex (Real Madrid)',
    teamId: 't2',
    text: 'Wir sehen uns am nächsten Spieltag!',
    now: '2026-08-15T13:15:00Z',
  }).league;
  assert.equal(league.news.find((p) => p.id === 'fan-1').comments.length, 1);
});

test('renderNewsView renders left navigation, central timeline with social controls, right sidebar widgets, and escapes HTML', () => {
  let league = sampleLeague();
  league = createCustomNewsPost(league, {
    id: 'xss-post',
    authorName: '<script>alert(1)</script>',
    teamId: 't1',
    category: 'fans',
    text: '<b>Unsafe</b> & raw text #Career',
    now: '2026-08-15T14:00:00Z',
  }).league;

  const html = renderNewsView({
    league,
    activeCategory: 'all',
    activeManagerTeamId: 't1',
    expandedCommentsPostId: 'xss-post',
  });

  // Left sidebar categories
  assert.match(html, /NewsHub/);
  assert.match(html, /Transfernews/);
  assert.match(html, /Spieltag/);
  assert.match(html, /Mein Verein/);
  assert.match(html, /Fanbereich/);

  // Right sidebar sections
  assert.match(html, /Trending Topics/);
  assert.match(html, /Aktuelle Transfergerüchte/i);
  assert.match(html, /Nächste große Spiele/i);
  assert.match(html, /Tabellenführer/);

  // Escaped content
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /data-action="like-news"/);
  assert.match(html, /data-action="repost-news"/);
  assert.match(html, /data-action="toggle-news-comments"/);
});

test('Football Twitter Slander Engine roasts losing teams, maps 250+ player slander names with multi-variants, and generates 100+ unique viral X comments', async () => {
  const { KNOWN_SLANDER_NAMES, PLAYER_SLANDER_VARIANTS, getPlayerSlanderName, buildMatchDefeatSlanderPost, generateXFootballComments } = await import('../src/twitter-slander-engine.mjs');

  // Verify massive dictionary of known slander nicknames (250+)
  assert.ok(Object.keys(KNOWN_SLANDER_NAMES).length >= 250);
  assert.equal(KNOWN_SLANDER_NAMES['Erling Haaland'], 'Tapinand (Ghost of Manchester)');
  assert.equal(KNOWN_SLANDER_NAMES['Harry Kane'], 'Harold (0 Trophies in 2026)');
  assert.equal(KNOWN_SLANDER_NAMES['Kylian Mbappé'], 'Ninja Turtle (Mpaypal)');
  assert.equal(KNOWN_SLANDER_NAMES['Casemiro'], 'Grandpa Casemiro (Red Card Speedrun)');
  assert.equal(KNOWN_SLANDER_NAMES['André Onana'], 'Onana (No Hands / Butterfingers)');
  assert.equal(KNOWN_SLANDER_NAMES['Romelu Lukaku'], 'Lakaka (First Touch of a Trampoline)');

  // Verify multi-variant slander names for the same player
  assert.ok(PLAYER_SLANDER_VARIANTS['Erling Haaland'].length >= 4);
  const v0 = getPlayerSlanderName('Erling Haaland', 'ST', 0);
  const v1 = getPlayerSlanderName('Erling Haaland', 'ST', 1);
  assert.notEqual(v0, v1);

  // Verify procedural generator fallback for any unknown custom player with multiple variants
  const generatedDefenderSlander0 = getPlayerSlanderName('Hans Müller', 'CB', 0);
  const generatedDefenderSlander1 = getPlayerSlanderName('Hans Müller', 'CB', 1);
  assert.ok(generatedDefenderSlander0.includes('Müller'));
  assert.notEqual(generatedDefenderSlander0, generatedDefenderSlander1);

  // Verify defeat slander generator
  const mockMatch = {
    fixtureId: 'fix-1',
    round: 4,
    homeScore: 0,
    awayScore: 4,
    at: '2026-09-12T18:00:00Z',
  };
  const homeTeam = { id: 'team-chelsea', name: 'Chelsea FC' };
  const awayTeam = { id: 'team-arsenal', name: 'Arsenal FC' };
  const picks = [
    { teamId: 'team-chelsea', playerName: 'Nicolas Jackson', position: 'ST', rating: 83 },
    { teamId: 'team-chelsea', playerName: 'Enzo Fernandez', position: 'CM', rating: 82 },
  ];

  const slanderPost = buildMatchDefeatSlanderPost(mockMatch, homeTeam, awayTeam, picks);
  assert.equal(slanderPost.category, 'hatercentral');
  assert.match(slanderPost.text, /HUMILIATION|DISASTERCLASS|CRIME SCENE|PUBLIC EXECUTION|STOP THE FIGHT|COOKED/);
  assert.match(slanderPost.text, /Jackson|Drogba from Temu|Miss-son|Chaos Agent/);
  assert.ok(slanderPost.comments.length >= 5);
  assert.ok(slanderPost.comments.some((c) => /Ratio|LMAO|cooked|DISASTERCLASS|Fraud|Hater|007|DEAD/i.test(c.text)));

  // Verify 100+ unique comment variations can be generated across batches without repetition
  let accumulated = [];
  for (let batch = 0; batch < 10; batch++) {
    const nextBatch = generateXFootballComments(
      { ...slanderPost, comments: accumulated },
      12,
      { offset: accumulated.length }
    );
    accumulated = accumulated.concat(nextBatch);
  }
  const uniqueCommentTexts = new Set(accumulated.map((c) => c.text));
  assert.ok(uniqueCommentTexts.size >= 100, `Expected at least 100 unique comments, got ${uniqueCommentTexts.size}`);

  // Verify filterNewsPosts with 'hatercentral'
  const posts = [slanderPost, { id: 'p2', category: 'transfers', text: 'Transfer fix' }];
  const haterPosts = filterNewsPosts(posts, 'hatercentral');
  assert.equal(haterPosts.length, 1);
  assert.equal(haterPosts[0].id, slanderPost.id);
});


