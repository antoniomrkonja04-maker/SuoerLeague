import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPesLiveMatchSync,
  buildEditModeChecklist,
  buildFifa15AutoFriendlyMacro,
  buildFifa15BrowserUrl,
  buildFifa15SuperLeagueModPackage,
  calculateTeamPesStrength,
  computeGameDbHash,
  confirmManagerDbSync,
  derivePesProfile,
  ESL_LOGO_ASSET_PATH,
  ESL_SCOREBOARD_ASSET_PATH,
  exportFifaFormationsCsv,
  exportFifaRdbmPlayersCsv,
  exportFifaTeamPlayerLinksCsv,
  exportPesEditorCsv,
  exportPesSiderJson,
  generateFifa15RoomCode,
  generatePesSiderLuaScript,
  getManagerSyncSummary,
  syncPlayersWithLeague,
} from '../src/pes-core.mjs';
import {
  renderEslBroadcastScoreboard,
  renderFifa15BrowserArena,
  renderPesHexagonSvg,
  renderPesMatchHubSuite,
  renderPesPlayerModal,
} from '../src/pes-view.mjs';
import { parseRosterCsv } from '../src/league-core.mjs';

function makeSampleLeague() {
  return {
    name: 'Champions League OS',
    season: '2026/27',
    currentDate: '2026-08-01',
    teams: [
      { id: 'real-madrid', name: 'Real Madrid', managerName: 'Admin', managerType: 'human' },
      { id: 'bayern', name: 'FC Bayern', managerName: 'CPU 1', managerType: 'cpu' },
    ],
    draft: {
      order: ['real-madrid', 'bayern'],
      picks: [
        { playerId: 'p-mbappe', playerName: 'Kylian Mbappé', position: 'ST', rating: 92, teamId: 'real-madrid', teamName: 'Real Madrid', number: 1 },
        { playerId: 'p-musiala', playerName: 'Jamal Musiala', position: 'AM', rating: 89, teamId: 'bayern', teamName: 'FC Bayern', number: 2 },
        { playerId: 'p-saliba', playerName: 'William Saliba', position: 'CB', rating: 88, teamId: 'real-madrid', teamName: 'Real Madrid', number: 3 },
      ],
    },
    transfers: [],
    matchHistory: [],
    schedule: [],
  };
}

const samplePlayers = [
  { id: 'p-mbappe', name: 'Kylian Mbappé', club: 'Real Madrid CF', position: 'ST', rating: 92, potential: 95, age: 27 },
  { id: 'p-musiala', name: 'Jamal Musiala', club: 'FC Bayern München', position: 'AM', rating: 89, potential: 95, age: 22 },
  { id: 'p-saliba', name: 'William Saliba', club: 'Arsenal FC', position: 'CB', rating: 88, potential: 92, age: 24 },
];

test('derivePesProfile generates 40-99 PES single attributes and 6-axis Hexagon by position', () => {
  const league = makeSampleLeague();
  const striker = derivePesProfile(samplePlayers[0], league);
  const defender = derivePesProfile(samplePlayers[2], league);

  for (const key of ['SHO', 'DRI', 'PAS', 'PAC', 'PHY', 'DEF']) {
    assert.ok(striker.hexagon[key] >= 40 && striker.hexagon[key] <= 99, `Striker ${key} out of 40-99 range`);
    assert.ok(defender.hexagon[key] >= 40 && defender.hexagon[key] <= 99, `Defender ${key} out of 40-99 range`);
  }

  assert.ok(striker.hexagon.SHO > defender.hexagon.SHO, 'Striker should have higher SHO than CB');
  assert.ok(defender.hexagon.DEF > striker.hexagon.DEF, 'CB should have higher DEF than Striker');
  assert.ok(striker.attributes.finishing >= 85);
  assert.ok(defender.attributes.defensiveAwareness >= 85);
  assert.equal(striker.currentClub, 'Real Madrid');
  assert.equal(defender.originClub, 'Arsenal FC');
  assert.equal(defender.currentClub, 'Real Madrid');
});

test('syncPlayersWithLeague automatically updates club, age, and evolved OVR after transfers and calendar progression', () => {
  const league = makeSampleLeague();
  // Simulate a transfer of Jamal Musiala from FC Bayern to Real Madrid + advance season date & matches
  league.transfers.push({
    callId: 'call-1',
    playerId: 'p-musiala',
    playerName: 'Jamal Musiala',
    position: 'AM',
    rating: 89,
    sellerTeamId: 'bayern',
    sellerTeamName: 'FC Bayern',
    buyerTeamId: 'real-madrid',
    buyerTeamName: 'Real Madrid',
    fee: 115,
    signedAt: '2026-08-15T12:00:00Z',
  });
  league.currentDate = '2027-08-10';
  league.matchHistory = Array.from({ length: 180 }, (_, idx) => ({ matchId: `m-${idx}` }));

  const synced = syncPlayersWithLeague(samplePlayers, league);
  const musiala = synced.find((p) => p.id === 'p-musiala');

  assert.equal(musiala.currentClub, 'Real Madrid');
  assert.equal(musiala.originClub, 'FC Bayern München');
  assert.equal(musiala.age, 23, 'Age should increment when season advances to 2027/28');
  assert.ok(musiala.rating > 89, 'Young high-potential player should gain OVR over simulated matchdays');
  assert.ok(musiala.ratingDelta > 0);
});

test('calculateTeamPesStrength computes H2H metrics and 11-slot 4-3-3 tactical lineup', () => {
  const league = makeSampleLeague();
  const strength = calculateTeamPesStrength('real-madrid', league, samplePlayers);

  assert.equal(strength.teamName, 'Real Madrid');
  assert.ok(strength.overall >= 80 && strength.overall <= 99);
  assert.equal(strength.lineup.length, 11);
  assert.ok(strength.starPlayers.length >= 2);
  assert.equal(strength.starPlayers[0].name, 'Kylian Mbappé');
});

test('exportPesEditorCsv and exportPesSiderJson round-trip cleanly and include updated clubs and 40-99 stats', () => {
  const league = makeSampleLeague();
  league.transfers.push({
    callId: 'call-99',
    playerId: 'p-musiala',
    playerName: 'Jamal Musiala',
    position: 'AM',
    rating: 89,
    sellerTeamId: 'bayern',
    sellerTeamName: 'FC Bayern',
    buyerTeamId: 'real-madrid',
    buyerTeamName: 'Real Madrid',
    fee: 120,
    signedAt: '2026-08-20T10:00:00Z',
  });

  const csv = exportPesEditorCsv(league, samplePlayers);
  assert.match(csv, /PES_ID,Name,CurrentClub,OriginClub,Position,Age,OVR/);
  assert.match(csv, /Jamal Musiala,Real Madrid,FC Bayern München/);

  const reparsed = parseRosterCsv(csv);
  assert.equal(reparsed.length, 3);
  const parsedMusiala = reparsed.find((p) => p.name === 'Jamal Musiala');
  assert.equal(parsedMusiala.club, 'Real Madrid');
  assert.ok(parsedMusiala.hexagon?.DRI >= 40);
  assert.ok(parsedMusiala.attributes?.dribbling >= 40);

  const siderJson = JSON.parse(exportPesSiderJson(league, samplePlayers));
  assert.equal(siderJson.schema, 'sp-football-life-pes2021-sider-v1');
  assert.equal(siderJson.completedTransfersCount, 1);
  assert.equal(siderJson.transfers[0].toClub, 'Real Madrid');

  const checklist = buildEditModeChecklist(league, samplePlayers);
  assert.equal(checklist.transfers.length, 1);
  assert.match(checklist.transfers[0].instruction, /Edit-Modus → Transfers → Jamal Musiala/);
});

test('renderPesPlayerModal and renderPesMatchHubSuite render Hexagon SVG and all 4 Football Life tabs', () => {
  const league = makeSampleLeague();
  const hexSvg = renderPesHexagonSvg({ SHO: 91, DRI: 92, PAS: 84, PAC: 96, PHY: 80, DEF: 45 });
  assert.match(hexSvg, /<svg class="pes-hexagon-svg"/);
  assert.match(hexSvg, /SCH/);

  const modalHtml = renderPesPlayerModal(samplePlayers[0], league);
  assert.match(modalHtml, /Kylian Mbappé/);
  assert.match(modalHtml, /6-Achsen Hexagon/);
  assert.match(modalHtml, /Offensivbewusstsein/);
  assert.match(modalHtml, /Dribbling/);

  for (const tab of ['strength', 'export', 'editmode', 'parsec']) {
    const suiteHtml = renderPesMatchHubSuite({
      league,
      players: samplePlayers,
      homeTeamId: 'real-madrid',
      awayTeamId: 'bayern',
      activeTab: tab,
    });
    assert.match(suiteHtml, /FIFA 17 Online Command Center/);
  }
});

test('generatePesSiderLuaScript and applyPesLiveMatchSync synchronize SPFL/PES match results into schedule and matchHistory', () => {
  const league = makeSampleLeague();
  league.schedule = [
    { id: '2026/27-r1-real-madrid-bayern', round: 1, date: '2026-08-01', homeId: 'real-madrid', awayId: 'bayern', status: 'awaiting-human' },
  ];

  const luaScript = generatePesSiderLuaScript(league, { serverUrl: 'http://localhost:3000' });
  assert.match(luaScript, /career_sync\.lua/);
  assert.match(luaScript, /http:\/\/localhost:3000\/api\/pes-sync/);

  const synced = applyPesLiveMatchSync(league, {
    fixtureId: '2026/27-r1-real-madrid-bayern',
    homeScore: 3,
    awayScore: 1,
    source: 'sider-lua-bridge',
  });
  assert.equal(synced.error, undefined);
  assert.equal(synced.fixture.status, 'completed');
  assert.equal(synced.fixture.homeScore, 3);
  assert.equal(synced.fixture.awayScore, 1);
  assert.equal(synced.league.matchHistory.length, 1);
  assert.equal(synced.league.lastPesSync.homeScore, 3);
});

test('FIFA 16 / 17 RDBM relational exports, DB-Hash anti-desync, and post-match telemetry attribute upgrades work end-to-end', () => {
  const league = makeSampleLeague();
  league.schedule = [
    { id: '2026/27-r1-real-madrid-bayern', round: 1, date: '2026-08-01', homeId: 'real-madrid', awayId: 'bayern', status: 'awaiting-human' },
  ];

  // 1. Multi-Manager DB-Hash & Anti-Desync check
  const hashBefore = computeGameDbHash(league, samplePlayers);
  assert.match(hashBefore, /^(F17|F16|SPFL)-R\d+-[0-9A-F]{6}$/);

  const confirmed = confirmManagerDbSync(league, samplePlayers, 'real-madrid');
  assert.equal(confirmed.error, undefined);
  const summaryAfter = getManagerSyncSummary(confirmed.league, samplePlayers);
  assert.equal(summaryAfter.allHumansSynced, true);
  assert.equal(summaryAfter.isDesyncFree, true);

  // 2. Relational FIFA 16 / 17 RDBM CSV exports
  const playersCsv = exportFifaRdbmPlayersCsv(confirmed.league, samplePlayers);
  assert.match(playersCsv, /playerid,firstname,lastname,commonname,overallrating,potential/);
  assert.match(playersCsv, /Kylian Mbappé/);

  const linksCsv = exportFifaTeamPlayerLinksCsv(confirmed.league, samplePlayers);
  assert.match(linksCsv, /teamid,teamname,playerid,playername,jerseynumber,positionid,positioncode,isstarter/);

  const formationsCsv = exportFifaFormationsCsv(confirmed.league, samplePlayers);
  assert.match(formationsCsv, /teamid,teamname,managername,formation,tacticalpreset,overall/);
  assert.match(formationsCsv, /Real Madrid,Admin,4-3-3/);

  // 3. Post-Match Telemetry + Scorers + Player Attribute Upgrade (+1 OVR / Finishing)
  const matchResult = applyPesLiveMatchSync(
    confirmed.league,
    {
      fixtureId: '2026/27-r1-real-madrid-bayern',
      homeScore: 2,
      awayScore: 0,
      possessionHome: 58,
      shotsHome: 14,
      shotsAway: 5,
      motmPlayerName: 'Kylian Mbappé',
      source: 'fifa17-online-telemetry',
    },
    { players: samplePlayers }
  );

  assert.equal(matchResult.error, undefined);
  assert.equal(matchResult.syncRecord.scorers.length, 2);
  assert.ok(matchResult.syncRecord.attributeUpgrades.length >= 1);

  const boostedMbappe = derivePesProfile(samplePlayers[0], matchResult.league);
  assert.ok(boostedMbappe.seasonGoals >= 1);
  assert.ok(boostedMbappe.matchBoost >= 1, 'Mbappe should receive a match performance OVR boost');
});

test('FIFA 15 Browser-Arena URL builder, 1v1 room code sync, auto-friendly macro, and ESL TV-Broadcast Scoreboard work end-to-end', () => {
  const league = makeSampleLeague();
  const roomCode = generateFifa15RoomCode('real-madrid-vs-bayern');
  assert.equal(roomCode.length, 6);
  assert.match(roomCode, /^[A-Z2-9]{6}$/);

  const hostUrl = buildFifa15BrowserUrl({ mode: 'host', roomCode, autorun: true, autoFriendly: true });
  assert.match(hostUrl, /^https:\/\/fifa15\.gamingretro\.online\/\?/);
  assert.match(hostUrl, /autorun=1/);
  assert.match(hostUrl, /mode=friendly-1v1/);

  const guestUrl = buildFifa15BrowserUrl({ mode: 'guest', roomCode });
  assert.match(guestUrl, new RegExp(`join=${roomCode}`));

  const macro = buildFifa15AutoFriendlyMacro({ homeTeamName: 'Real Madrid', awayTeamName: 'FC Bayern', roomCode });
  assert.equal(macro.roomCode, roomCode);
  assert.equal(macro.profileSettingsOffset, '0x26F0');
  assert.ok(macro.macroSequence.length >= 4);

  const scoreboardHtml = renderEslBroadcastScoreboard({
    homeTeamName: 'Real Madrid',
    awayTeamName: 'FC Bayern',
    homeScore: 2,
    awayScore: 1,
    matchClock: '64:18',
    roomCode,
    interactive: true,
  });
  assert.match(scoreboardHtml, new RegExp(ESL_SCOREBOARD_ASSET_PATH));
  assert.match(scoreboardHtml, new RegExp(ESL_LOGO_ASSET_PATH));
  assert.match(scoreboardHtml, /data-clean-esl-logo="true"/);
  assert.match(scoreboardHtml, /Real Madrid/);
  assert.match(scoreboardHtml, /FC Bayern/);
  assert.match(scoreboardHtml, /64:18/);

  const modPkg = buildFifa15SuperLeagueModPackage(league, samplePlayers, {
    homeTeamId: 'real-madrid',
    awayTeamId: 'bayern',
    roomCode,
  });
  assert.equal(modPkg.titleId, '454109DB');
  assert.equal(modPkg.branding.logoTransparentBackground, true);
  assert.equal(modPkg.branding.scoreboardTransparentBackground, false);
  assert.equal(modPkg.autoSetup.bootDirectToMatch, true);
  assert.equal(modPkg.matchup.homeStarters.length, 11);

  const homeStrength = calculateTeamPesStrength('real-madrid', league, samplePlayers);
  const awayStrength = calculateTeamPesStrength('bayern', league, samplePlayers);
  const syncSummary = getManagerSyncSummary(league, samplePlayers, { homeTeamId: 'real-madrid', awayTeamId: 'bayern' });
  const arenaHtml = renderFifa15BrowserArena({
    league,
    homeStrength,
    awayStrength,
    syncSummary,
    streamActive: true,
    streamRole: 'host',
    cinemaMode: true,
    hudVisible: true,
  });
  assert.match(arenaHtml, /fifa15-browser-iframe/);
  assert.match(arenaHtml, /is-cinema-mode/);
  assert.match(arenaHtml, /Auto-Freundschaftsspiel/);
  assert.match(arenaHtml, /MOD AKTIV/);
});




