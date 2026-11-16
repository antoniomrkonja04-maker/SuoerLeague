import test from 'node:test';
import assert from 'node:assert/strict';
import { seedTeams } from '../src/teams.mjs';
import {
  createKnockoutBracket,
  ensureKnockoutBracket,
  getNextKnockoutRoundKey,
  isLeaguePhaseComplete,
  recordKnockoutMatchScore,
  simulateEntireKnockout,
  simulateKnockoutRound,
} from '../src/knockout-core.mjs';

function makeLeague(withSchedule = false) {
  const teams = seedTeams.map((team, idx) => ({
    ...team,
    managerType: idx === 0 ? 'human' : 'cpu',
    managerName: idx === 0 ? 'Admin' : `CPU ${idx}`,
  }));

  const matchHistory = [
    { matchId: 'm1', homeId: teams[0].id, awayId: teams[1].id, homeScore: 3, awayScore: 0 },
    { matchId: 'm2', homeId: teams[2].id, awayId: teams[3].id, homeScore: 2, awayScore: 1 },
  ];

  const schedule = withSchedule
    ? [
        { id: 'fx1', homeId: teams[0].id, awayId: teams[1].id },
        { id: 'fx2', homeId: teams[2].id, awayId: teams[3].id },
        { id: 'fx3', homeId: teams[4].id, awayId: teams[5].id },
      ]
    : [];

  return {
    name: 'Test League',
    season: '2026/27',
    teams,
    schedule,
    matchHistory,
    draft: { picks: [] },
  };
}

test('isLeaguePhaseComplete and ensureKnockoutBracket strictly gate access during ongoing regular season', () => {
  const league = makeLeague(true); // 3 fixtures, only 2 played
  assert.equal(isLeaguePhaseComplete(league), false);

  const locked = ensureKnockoutBracket(league);
  assert.equal(locked.locked, true);
  assert.ok(locked.error.includes('Ligaphase'));

  // Mark all fixtures completed
  league.matchHistory.push({ matchId: 'm3', homeId: league.teams[4].id, awayId: league.teams[5].id, homeScore: 1, awayScore: 0 });
  assert.equal(isLeaguePhaseComplete(league), true);

  const unlocked = ensureKnockoutBracket(league);
  assert.ok(!unlocked.error);
  assert.ok(unlocked.knockout);
  assert.equal(unlocked.knockout.rounds.playoffs.length, 8);
});

test('createKnockoutBracket seeds 24 teams for UEFA 2024+ format (8 direct R16 + 16 in 8 Play-off ties)', () => {
  const league = makeLeague();
  const res = createKnockoutBracket(league, { allowIncomplete: true });
  assert.ok(!res.error);
  assert.equal(res.knockout.seeds.length, 24);

  // Plätze 1–8: Direkt Achtelfinale
  for (let i = 0; i < 8; i += 1) {
    assert.equal(res.knockout.seeds[i].qualification, 'direct-knockout');
  }
  // Plätze 9–24: Play-offs
  for (let i = 8; i < 24; i += 1) {
    assert.equal(res.knockout.seeds[i].qualification, 'playoff');
  }

  // 8 Play-off Duelle
  assert.equal(res.knockout.rounds.playoffs.length, 8);
  const po1 = res.knockout.rounds.playoffs.find((m) => m.id === 'po-1');
  assert.equal(po1.home.seed, 9);
  assert.equal(po1.away.seed, 24);

  const po8 = res.knockout.rounds.playoffs.find((m) => m.id === 'po-8');
  assert.equal(po8.home.seed, 16);
  assert.equal(po8.away.seed, 17);

  // 8 Achtelfinal-Partien
  assert.equal(res.knockout.rounds.r16.length, 8);
  // Seed #1 is at home in r16-w1, away team waits for winner of po-8
  const r16w1 = res.knockout.rounds.r16.find((m) => m.id === 'r16-w1');
  assert.equal(r16w1.home.seed, 1);
  assert.equal(r16w1.away, null);
  assert.equal(r16w1.status, 'pending');
});

test('simulateKnockoutRound advances Play-off winners into Achtelfinale, then through QF, SF and crowns Champion', () => {
  const league = makeLeague();
  const init = createKnockoutBracket(league, { allowIncomplete: true });
  const initialLeague = init.league;

  // Step 1: First round key is 'playoffs'
  assert.equal(getNextKnockoutRoundKey(initialLeague.knockout), 'playoffs');

  // Step 2: Simulate 8 Play-offs
  const rPo = simulateKnockoutRound(initialLeague, 'playoffs', { allowIncomplete: true });
  assert.equal(rPo.simulatedCount, 8);
  assert.ok(rPo.knockout.rounds.playoffs.every((m) => m.status === 'completed' && m.winnerTeamId));

  // The 8 Play-off winners now fill all 8 Achtelfinale away slots!
  assert.ok(rPo.knockout.rounds.r16.every((m) => m.home && m.away && m.status === 'scheduled'));

  // Step 3: Next round key is 'r16'
  assert.equal(getNextKnockoutRoundKey(rPo.knockout), 'r16');
  const rR16 = simulateKnockoutRound(rPo.league, 'r16', { allowIncomplete: true });
  assert.equal(rR16.simulatedCount, 8);
  assert.ok(rR16.knockout.rounds.qf.every((m) => m.home && m.away && m.status === 'scheduled'));

  // Step 4: Next round key is 'qf'
  assert.equal(getNextKnockoutRoundKey(rR16.knockout), 'qf');
  const rQf = simulateKnockoutRound(rR16.league, 'qf', { allowIncomplete: true });
  assert.equal(rQf.simulatedCount, 4);
  assert.ok(rQf.knockout.rounds.sf.every((m) => m.home && m.away && m.status === 'scheduled'));

  // Step 5: Next round key is 'sf'
  assert.equal(getNextKnockoutRoundKey(rQf.knockout), 'sf');
  const rSf = simulateKnockoutRound(rQf.league, 'sf', { allowIncomplete: true });
  assert.equal(rSf.simulatedCount, 2);
  assert.ok(rSf.knockout.rounds.final[0].home && rSf.knockout.rounds.final[0].away);

  // Step 6: Next round key is 'final'
  assert.equal(getNextKnockoutRoundKey(rSf.knockout), 'final');
  const rFinal = simulateKnockoutRound(rSf.league, 'final', { allowIncomplete: true });
  assert.equal(rFinal.simulatedCount, 1);
  assert.ok(rFinal.knockout.champion);
  assert.ok(rFinal.knockout.champion.teamName);
  assert.equal(getNextKnockoutRoundKey(rFinal.knockout), null);
});

test('simulateEntireKnockout completes all 23 UEFA matches (8 PO + 8 R16 + 4 QF + 2 SF + 1 Final) and crowns champion', () => {
  const league = makeLeague();
  const done = simulateEntireKnockout(league, { allowIncomplete: true });
  assert.equal(done.simulatedCount, 23);
  assert.ok(done.knockout.champion);
  assert.notEqual(done.knockout.rounds.final[0].homeScore, done.knockout.rounds.final[0].awayScore);
});

test('recordKnockoutMatchScore advances winner of Play-off match into Achtelfinale', () => {
  const league = makeLeague();
  const init = createKnockoutBracket(league, { allowIncomplete: true });

  // Record score for Play-off 8: Seed 16 vs Seed 17 -> Winner goes to r16-w1 away
  const res = recordKnockoutMatchScore(init.league, 'po-8', 3, 1);
  assert.ok(!res.error);
  assert.equal(res.match.homeScore, 3);
  assert.equal(res.match.awayScore, 1);
  assert.equal(res.match.winnerTeamId, res.match.home.teamId);

  const r16w1 = res.knockout.rounds.r16.find((m) => m.id === 'r16-w1');
  assert.ok(r16w1.away);
  assert.equal(r16w1.away.seed, 16);
  assert.equal(r16w1.status, 'scheduled');
});
