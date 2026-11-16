import test from 'node:test';
import assert from 'node:assert/strict';

async function loadTransferCore() {
  const mod = await import('../src/transfer-core.mjs').catch(() => null);
  assert.equal(typeof mod?.createCall, 'function', 'createCall must be exported');
  return mod;
}

function leagueFixture() {
  return {
    teams: [
      { id: 'a', name: 'Alpha FC', managerType: 'human', managerName: 'Alex' },
      { id: 'b', name: 'Beta FC', managerType: 'human', managerName: 'Sam' },
    ],
    draft: { picks: [
      { playerId: 'p-a', playerName: 'Player A', rating: 88, teamId: 'a', teamName: 'Alpha FC' },
      { playerId: 'p-b', playerName: 'Player B', rating: 81, teamId: 'b', teamName: 'Beta FC' },
    ] },
    matchHistory: [],
    calls: [],
    transfers: [],
  };
}

test('only call recipient may answer and accepted calls enter negotiation', async () => {
  const { createCall, respondToCall } = await loadTransferCore();
  let league = leagueFixture();
  ({ league } = createCall(league, 'a', 'b', { now: '2026-10-13T12:00:00Z', callId: 'call-1' }));
  assert.equal(league.calls[0].status, 'ringing');
  const forbidden = respondToCall(league, 'call-1', 'a', 'accept', '2026-10-13T12:00:01Z');
  assert.match(forbidden.error, /angerufene Manager/i);
  assert.equal(league.calls[0].status, 'ringing');
  ({ league } = respondToCall(league, 'call-1', 'b', 'accept', '2026-10-13T12:00:02Z'));
  assert.equal(league.calls[0].status, 'negotiating');
  assert.equal(league.calls[0].acceptedAt, '2026-10-13T12:00:02Z');
  ({ league } = respondToCall(league, 'call-1', 'b', 'hangup', '2026-10-13T12:00:03Z'));
  assert.equal(league.calls[0].status, 'ended');
  const restarted = createCall(league, 'a', 'b', { now: '2026-10-13T12:00:04Z', callId: 'call-1-retry' });
  assert.equal(restarted.error, undefined, 'both teams must be able to start another call after hangup');
  assert.equal(restarted.call.status, 'ringing');
});

test('counteroffer can be accepted once and transfers the named player to the buyer', async () => {
  const { createCall, respondToCall, submitOffer, acceptOffer } = await loadTransferCore();
  let league = leagueFixture();
  ({ league } = createCall(league, 'a', 'b', { now: '2026-10-13T12:00:00Z', callId: 'call-2' }));
  ({ league } = respondToCall(league, 'call-2', 'b', 'accept', '2026-10-13T12:00:01Z'));
  ({ league } = submitOffer(league, 'call-2', 'a', { playerId: 'p-b', fee: 20 }, '2026-10-13T12:01:00Z'));
  ({ league } = submitOffer(league, 'call-2', 'b', { playerId: 'p-b', fee: 25 }, '2026-10-13T12:02:00Z'));
  assert.equal(league.calls[0].offers[0].status, 'countered');
  ({ league } = acceptOffer(league, 'call-2', 'a', '2026-10-13T12:03:00Z'));
  assert.equal(league.draft.picks.find((pick) => pick.playerId === 'p-b').teamId, 'a');
  assert.equal(league.transfers[0].fee, 25);
  assert.equal(league.transfers[0].signedAt, '2026-10-13T12:03:00Z');
  assert.deepEqual(league.transfers[0].signatures.map((signature) => signature.managerName), ['Sam', 'Alex']);
  assert.equal(league.calls[0].status, 'completed');
  assert.match(acceptOffer(league, 'call-2', 'a').error, /kein offenes Angebot/i);
});

test('CPU call response gets more likely with a low rank and a thin roster', async () => {
  const { cpuAnswersCall } = await loadTransferCore();
  assert.equal(cpuAnswersCall({ rank: 1, teamCount: 30, rosterNeed: 0, randomValue: 0.5 }), false);
  assert.equal(cpuAnswersCall({ rank: 30, teamCount: 30, rosterNeed: 1, randomValue: 0.5 }), true);
});

test('league standings rank teams from played results', async () => {
  const { rankTeamsFromResults } = await loadTransferCore();
  const table = rankTeamsFromResults(leagueFixture().teams, [
    { homeId: 'a', awayId: 'b', homeScore: 2, awayScore: 0 },
  ]);
  assert.deepEqual(table.map((row) => [row.teamId, row.points, row.rank]), [['a', 3, 1], ['b', 0, 2]]);
});

test('transfer windows allow negotiation anytime but block transfer completion outside July-August and January', async () => {
  const { createCall, respondToCall, submitOffer, acceptOffer, isTransferWindowOpen } = await loadTransferCore();
  assert.equal(typeof isTransferWindowOpen, 'function');
  assert.equal(isTransferWindowOpen('2026-07-01'), true);
  assert.equal(isTransferWindowOpen('2026-08-31'), true);
  assert.equal(isTransferWindowOpen('2026-09-01'), false);
  assert.equal(isTransferWindowOpen('2027-01-01'), true);
  assert.equal(isTransferWindowOpen('2027-01-31'), true);
  assert.equal(isTransferWindowOpen('2027-02-01'), false);

  let league = {
    ...leagueFixture(),
    currentDate: '2026-10-15',
    teams: [
      { id: 'a', name: 'Alpha FC', managerType: 'human', managerName: 'Alex', budget: 100 },
      { id: 'b', name: 'Beta FC', managerType: 'human', managerName: 'Sam', budget: 100 },
    ],
  };
  ({ league } = createCall(league, 'a', 'b', { now: '2026-10-15T12:00:00Z', callId: 'call-win' }));
  ({ league } = respondToCall(league, 'call-win', 'b', 'accept', '2026-10-15T12:00:01Z'));
  const offered = submitOffer(league, 'call-win', 'a', { playerId: 'p-b', fee: 30 }, '2026-10-15T12:01:00Z');
  assert.equal(offered.error, undefined, 'offers may be prepared outside a transfer window');
  league = offered.league;

  const blocked = acceptOffer(league, 'call-win', 'b', '2026-10-15T12:02:00Z');
  assert.match(blocked.error, /Transferfenster/i);
  assert.equal(blocked.league.draft.picks.find((pick) => pick.playerId === 'p-b').teamId, 'b');
  assert.equal(blocked.league.teams.find((t) => t.id === 'a').budget, 100);

  league = { ...league, currentDate: '2027-01-05' };
  const completed = acceptOffer(league, 'call-win', 'b', '2027-01-05T12:00:00Z');
  assert.equal(completed.error, undefined);
  assert.equal(completed.league.draft.picks.find((pick) => pick.playerId === 'p-b').teamId, 'a');
  assert.equal(completed.league.teams.find((t) => t.id === 'a').budget, 70);
  assert.equal(completed.league.teams.find((t) => t.id === 'b').budget, 130);
});

test('CPU call response considers budget and teamStrength alongside rank and rosterNeed', async () => {
  const { cpuAnswersCall } = await loadTransferCore();
  const strongRich = cpuAnswersCall({ rank: 10, teamCount: 30, rosterNeed: 0.2, budget: 150, teamStrength: 74, randomValue: 0.42 });
  const strongBroke = cpuAnswersCall({ rank: 10, teamCount: 30, rosterNeed: 0.2, budget: 0, teamStrength: 92, randomValue: 0.42 });
  assert.equal(strongRich, true);
  assert.equal(strongBroke, false);
});

test('standings compute goalDifference, last-5 form, and 1-8 / 9-16 / 17-30 qualification zones', async () => {
  const { rankTeamsFromResults } = await loadTransferCore();
  const thirtyTeams = Array.from({ length: 30 }, (_, index) => ({
    id: `t${String(index + 1).padStart(2, '0')}`,
    name: `Club ${index + 1}`,
  }));
  const results = [
    { homeId: 't01', awayId: 't02', homeScore: 3, awayScore: 0 },
    { homeId: 't01', awayId: 't03', homeScore: 1, awayScore: 1 },
    { homeId: 't04', awayId: 't01', homeScore: 2, awayScore: 1 },
    { homeId: 't01', awayId: 't05', homeScore: 2, awayScore: 0 },
    { homeId: 't06', awayId: 't01', homeScore: 0, awayScore: 4 },
    { homeId: 't01', awayId: 't07', homeScore: 1, awayScore: 0 },
  ];
  const table = rankTeamsFromResults(thirtyTeams, results);
  const t01 = table.find((row) => row.teamId === 't01');
  assert.equal(t01.played, 6);
  assert.equal(t01.goalDifference, 9);
  assert.deepEqual(t01.form, ['U', 'N', 'S', 'S', 'S']);
  assert.equal(table[0].qualification, 'direct-knockout');
  assert.equal(table[7].qualification, 'direct-knockout');
  assert.equal(table[8].qualification, 'playoff');
  assert.equal(table[23].qualification, 'playoff');
  assert.equal(table[24].qualification, 'eliminated');
  assert.equal(table[29].qualification, 'eliminated');
});

test('acceptOffer removes transferred player from seller starting lineup and evaluates CPU offers deterministically', async () => {
  const { createCall, respondToCall, submitOffer, acceptOffer, evaluateCpuOfferResponse } = await loadTransferCore();
  let league = {
    ...leagueFixture(),
    currentDate: '2026-08-10',
    squads: {
      b: { formation: '4-3-3', starters: { gk: 'p-b', lb: null } },
    },
  };
  ({ league } = createCall(league, 'a', 'b', { now: '2026-08-10T10:00:00Z', callId: 'call-lineup' }));
  ({ league } = respondToCall(league, 'call-lineup', 'b', 'accept', '2026-08-10T10:00:01Z'));
  ({ league } = submitOffer(league, 'call-lineup', 'a', { playerId: 'p-b', fee: 45 }, '2026-08-10T10:00:02Z'));
  ({ league } = acceptOffer(league, 'call-lineup', 'b', '2026-08-10T10:00:03Z'));
  assert.equal(league.squads.b.starters.gk, null);

  assert.equal(typeof evaluateCpuOfferResponse, 'function');
  const fairDecision = evaluateCpuOfferResponse({ playerRating: 82, fee: 55, sellerRosterCount: 12 });
  assert.equal(fairDecision.decision, 'accept');
  const lowballDecision = evaluateCpuOfferResponse({ playerRating: 90, fee: 15, sellerRosterCount: 12 });
  assert.equal(lowballDecision.decision, 'counter');
  assert.ok(lowballDecision.counterFee > 15);
});

test('calculatePlayerMarketValue scales exponentially with rating and position scarcity', async () => {
  const { calculatePlayerMarketValue } = await loadTransferCore();
  const val76 = calculatePlayerMarketValue({ rating: 76, position: 'CM', sellerRosterCount: 25, sellerPositionCount: 4 });
  const val85 = calculatePlayerMarketValue({ rating: 85, position: 'CM', sellerRosterCount: 25, sellerPositionCount: 4 });
  const val93 = calculatePlayerMarketValue({ rating: 93, position: 'ST', sellerRosterCount: 25, sellerPositionCount: 3 });
  const scarce93 = calculatePlayerMarketValue({ rating: 93, position: 'ST', sellerRosterCount: 14, sellerPositionCount: 1 });
  assert.ok(val93 > val85 && val85 > val76);
  assert.ok(scarce93 > val93);
});

test('simulateCpuTransferMarketStep executes realistic CPU-to-CPU deals for missing positions and sends CPU-to-Human call offers', async () => {
  const { simulateCpuTransferMarketStep, analyzeTeamPositionNeeds } = await loadTransferCore();
  const cpuA = { id: 'cpu-a', name: 'CPU Alpha', managerType: 'cpu', managerName: 'CPU A', budget: 200 };
  const cpuB = { id: 'cpu-b', name: 'CPU Beta', managerType: 'cpu', managerName: 'CPU B', budget: 200 };
  const human = { id: 'hum-1', name: 'Human United', managerType: 'human', managerName: 'Host', budget: 200 };

  // Give cpu-a 15 players but NO Goalkeeper (GK); give cpu-b 22 players including 3 GKs; give human a top GK
  const picks = [
    ...Array.from({ length: 15 }, (_, i) => ({
      playerId: `ca-${i}`,
      playerName: `Alpha Field ${i}`,
      position: ['CB', 'LB', 'RB', 'CM', 'ST'][i % 5],
      rating: 80,
      teamId: 'cpu-a',
    })),
    { playerId: 'cb-gk-1', playerName: 'Beta Keeper 1', position: 'GK', rating: 88, teamId: 'cpu-b' },
    { playerId: 'cb-gk-2', playerName: 'Beta Keeper 2', position: 'GK', rating: 83, teamId: 'cpu-b' },
    { playerId: 'cb-gk-3', playerName: 'Beta Keeper 3', position: 'GK', rating: 79, teamId: 'cpu-b' },
    ...Array.from({ length: 19 }, (_, i) => ({
      playerId: `cb-${i}`,
      playerName: `Beta Field ${i}`,
      position: ['CB', 'LB', 'RB', 'CM', 'LW', 'RW', 'ST'][i % 7],
      rating: 80,
      teamId: 'cpu-b',
    })),
    { playerId: 'h-st-1', playerName: 'Human Star Striker', position: 'ST', rating: 91, teamId: 'hum-1' },
    { playerId: 'h-gk-1', playerName: 'Human Star Keeper', position: 'GK', rating: 89, teamId: 'hum-1' },
  ];

  const needsA = analyzeTeamPositionNeeds({ draft: { picks } }, 'cpu-a');
  assert.equal(needsA.missingPositions[0].position, 'GK');

  const league = {
    currentDate: '2026-08-12',
    teams: [cpuA, cpuB, human],
    draft: { picks },
    calls: [],
    transfers: [],
  };

  const result = simulateCpuTransferMarketStep(league, {
    seed: 'test-market-1',
    maxCpuToCpuDeals: 2,
    targetHumanTeamId: 'hum-1',
    now: '2026-08-12T15:00:00Z',
  });

  assert.ok(result.cpuTransfers.length >= 1, 'at least one CPU-to-CPU transfer should complete');
  const gkDeal = result.cpuTransfers.find((t) => t.buyerTeamId === 'cpu-a');
  assert.ok(gkDeal);
  assert.equal(gkDeal.position, 'GK');
  assert.equal(gkDeal.isCpuToCpu, true);
  assert.ok(gkDeal.fee > 0);

  assert.ok(result.incomingCall, 'CPU should initiate an incoming ringing call with an offer to the human manager');
  assert.equal(result.incomingCall.status, 'ringing');
  assert.equal(result.incomingCall.targetTeamId, 'hum-1');
  assert.equal(result.incomingCall.initiatedByCpu, true);
  assert.equal(result.incomingCall.offers.length, 1);
  assert.ok(result.incomingCall.offers[0].fee >= 10);
});

test('recordManagerSignature stores recorded signature strokes on a transfer so other managers can replay the animation', async () => {
  const { createCall, respondToCall, submitOffer, acceptOffer, recordManagerSignature } = await loadTransferCore();
  let league = { ...leagueFixture(), currentDate: '2026-08-10' };
  ({ league } = createCall(league, 'a', 'b', { now: '2026-08-10T10:00:00Z', callId: 'call-sig' }));
  ({ league } = respondToCall(league, 'call-sig', 'b', 'accept', '2026-08-10T10:00:01Z'));
  ({ league } = submitOffer(league, 'call-sig', 'a', { playerId: 'p-b', fee: 45 }, '2026-08-10T10:00:02Z'));
  ({ league } = acceptOffer(league, 'call-sig', 'b', '2026-08-10T10:00:03Z'));

  const strokes = [[{ x: 12, y: 40, t: 0 }, { x: 80, y: 35, t: 120 }, { x: 160, y: 48, t: 260 }]];
  const updated = recordManagerSignature(league, 'call-sig', 'b', {
    strokes,
    svgPath: 'M 12 40 L 80 35 L 160 48',
    signedAt: '2026-08-10T10:00:05Z',
  });
  assert.equal(updated.error, undefined);
  const sig = updated.transfer.signatures.find((s) => s.managerTeamId === 'b');
  assert.equal(sig.svgPath, 'M 12 40 L 80 35 L 160 48');
  assert.equal(sig.strokes.length, 1);
  assert.equal(sig.strokes[0].length, 3);
});



