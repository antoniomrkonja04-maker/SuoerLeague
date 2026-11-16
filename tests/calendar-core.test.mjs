import test from 'node:test';
import assert from 'node:assert/strict';
import { approveHumanFixture, buildSchedule, getTopAssisters, getTopRatedPlayers, getTopScorers, isDraftComplete, recordHumanFixtureResult, simulateEntireSeason, simulateFixture, simulateThroughDate } from '../src/calendar-core.mjs';

const teams = Array.from({ length: 30 }, (_, index) => ({
  id: `t${index + 1}`, name: `Team ${index + 1}`,
  managerType: index < 3 || index === 29 ? 'human' : 'cpu', managerName: `Manager ${index + 1}`,
}));

test('30 teams create 58 rounds and 870 unique fixtures, with home and away legs', () => {
  const schedule = buildSchedule(teams);
  assert.equal(schedule.length, 870);
  assert.equal(new Set(schedule.map((fixture) => fixture.id)).size, 870);
  assert.equal(new Set(schedule.map((fixture) => fixture.round)).size, 58);
  const pair = schedule.filter((fixture) => new Set([fixture.homeId, fixture.awayId]).has('t1') && new Set([fixture.homeId, fixture.awayId]).has('t2'));
  assert.equal(pair.length, 2);
  assert.deepEqual(pair.map((fixture) => `${fixture.homeId}:${fixture.awayId}`).sort(), ['t1:t2', 't2:t1']);
});

test('draft completion is checked against the current pool without changing picks', () => {
  const league = { draft: { picks: [{ playerId: 'p1' }] } };
  assert.equal(isDraftComplete(league, [{ id: 'p1' }]), true);
  assert.equal(isDraftComplete(league, [{ id: 'p1' }, { id: 'p2' }]), false);
  assert.equal(league.draft.picks.length, 1);
  assert.equal(isDraftComplete({ draft: { picks: [{ playerId: 'p1' }, { playerId: 'p1' }] } }, [{ id: 'p1' }, { id: 'p2' }]), false);
});

test('simulating through a date includes CPU games, leaves human games open, and is idempotent', () => {
  const schedule = buildSchedule(teams, '2026-08-01');
  const league = { season: '2026/27', teams, draft: { picks: [] }, schedule, currentDate: '2026-07-31', matchHistory: [] };
  const first = simulateThroughDate(league, '2026-08-01');
  assert.equal(first.error, undefined);
  assert.equal(first.league.currentDate, '2026-08-01');
  assert.equal(first.summary.simulatedCount, 14);
  assert.equal(first.summary.humanPendingCount, 1);
  const repeated = simulateThroughDate(first.league, '2026-08-01');
  assert.equal(repeated.summary.simulatedCount, 0);
  assert.equal(repeated.league.matchHistory.length, first.league.matchHistory.length);
  assert.equal(repeated.league.schedule.length, 870);
});

test('blocks advancing calendar past a human-vs-human matchday until result is recorded or both managers consent', () => {
  const schedule = buildSchedule(teams, '2026-08-01');
  const league = { season: '2026/27', teams, draft: { picks: [] }, schedule, currentDate: '2026-07-31', matchHistory: [] };

  // Jumping straight to 2026-08-09 stops automatically on 2026-08-01 where t1 vs t30 (human vs human) takes place
  const jumped = simulateThroughDate(league, '2026-08-09');
  assert.equal(jumped.error, undefined);
  assert.equal(jumped.league.currentDate, '2026-08-01');
  assert.equal(jumped.summary.stoppedEarlyAtHumanGate, true);
  assert.equal(jumped.summary.blockedByHumanMatch, true);

  // Trying to advance further while 2026-08-01 is still open and unconsented returns a block error
  const blocked = simulateThroughDate(jumped.league, '2026-08-05');
  assert.ok(blocked.error);
  assert.equal(blocked.blockedByHumanMatch, true);
  assert.equal(blocked.stoppedAtDate, '2026-08-01');

  // Approving by only one manager is not enough
  const humanFixture = jumped.league.schedule.find((f) => f.date === '2026-08-01' && f.status === 'awaiting-human');
  const oneApproved = approveHumanFixture(jumped.league, humanFixture.id, humanFixture.homeId);
  assert.equal(oneApproved.humanConsentGranted, false);
  const stillBlocked = simulateThroughDate(oneApproved.league, '2026-08-05');
  assert.ok(stillBlocked.error);

  // Approving by the second manager unlocks simulation past 2026-08-01
  const bothApproved = approveHumanFixture(oneApproved.league, humanFixture.id, humanFixture.awayId);
  assert.equal(bothApproved.humanConsentGranted, true);
  const unlocked = simulateThroughDate(bothApproved.league, '2026-08-05');
  assert.equal(unlocked.error, undefined);
  assert.equal(unlocked.league.currentDate, '2026-08-05');
});

test('rejects a calendar date before the current date without mutating the league', () => {
  const league = { teams, schedule: buildSchedule(teams), currentDate: '2026-08-05', matchHistory: [] };
  const result = simulateThroughDate(league, '2026-08-04');
  assert.equal(result.error, 'Das Zieldatum liegt vor dem aktuellen Kalenderstand.');
  assert.equal(league.currentDate, '2026-08-05');
});

test('rejects dates beyond the final fixture and malformed calendar days', () => {
  const league = { teams, schedule: buildSchedule(teams), currentDate: '2026-07-31', matchHistory: [] };
  assert.equal(simulateThroughDate(league, '2027-04-01').error, 'Das Zieldatum liegt außerhalb der Saison.');
  assert.equal(simulateThroughDate(league, '2026-02-30').error, 'Bitte wähle ein gültiges Kalenderdatum.');
});

test('CPU simulation is deterministic for the same league, fixture, and roster', () => {
  const schedule = buildSchedule(teams, '2026-08-01');
  const picks = [
    { playerId: 'p1', rating: 90, teamId: 't4' },
    { playerId: 'p2', rating: 75, teamId: 't5' },
  ];
  const leagueA = { season: '2026/27', teams, draft: { picks }, schedule: structuredClone(schedule), currentDate: '2026-07-31', matchHistory: [] };
  const leagueB = { season: '2026/27', teams, draft: { picks }, schedule: structuredClone(schedule), currentDate: '2026-07-31', matchHistory: [] };
  const simA = simulateThroughDate(leagueA, '2026-08-01');
  const simB = simulateThroughDate(leagueB, '2026-08-01');
  assert.deepEqual(simA.league.matchHistory, simB.league.matchHistory);
});

test('host can record human-vs-human match result with stable ID and cannot overwrite without explicit edit flag', () => {
  const schedule = buildSchedule(teams, '2026-08-01');
  const simulated = simulateThroughDate({ season: '2026/27', teams, draft: { picks: [] }, schedule, currentDate: '2026-07-31', matchHistory: [] }, '2026-08-01').league;
  const humanFixture = simulated.schedule.find((fixture) => fixture.status === 'awaiting-human');
  assert.ok(humanFixture);

  const nonHost = recordHumanFixtureResult(simulated, humanFixture.id, 2, 1, { managerTeamId: 't2', now: '2026-08-01T18:00:00Z' });
  assert.match(nonHost.error, /Host/i);

  const saved = recordHumanFixtureResult(simulated, humanFixture.id, 2, 1, { managerTeamId: 't1', now: '2026-08-01T18:00:00Z' });
  assert.equal(saved.error, undefined);
  assert.equal(saved.fixture.status, 'completed');
  assert.equal(saved.fixture.homeScore, 2);
  assert.equal(saved.fixture.awayScore, 1);
  assert.equal(saved.league.matchHistory.filter((m) => m.fixtureId === humanFixture.id).length, 1);

  const accidentalOverwrite = recordHumanFixtureResult(saved.league, humanFixture.id, 3, 3, { managerTeamId: 't1', allowOverwrite: false, now: '2026-08-01T19:00:00Z' });
  assert.match(accidentalOverwrite.error, /bereits gespeichert|bearbeiten/i);
  assert.equal(accidentalOverwrite.league.schedule.find((f) => f.id === humanFixture.id).homeScore, 2);

  const explicitEdit = recordHumanFixtureResult(saved.league, humanFixture.id, 3, 3, { managerTeamId: 't1', allowOverwrite: true, now: '2026-08-01T19:05:00Z' });
  assert.equal(explicitEdit.error, undefined);
  assert.equal(explicitEdit.edited, true);
  assert.equal(explicitEdit.league.schedule.find((f) => f.id === humanFixture.id).homeScore, 3);
  assert.equal(explicitEdit.league.matchHistory.filter((m) => m.fixtureId === humanFixture.id).length, 1);
});

test('simulateThroughDate with isHost=true bypasses human match lock, and simulateEntireSeason completes all 870 games', () => {
  const schedule = buildSchedule(teams, '2026-08-01');
  const league = { season: '2026/27', teams, draft: { picks: [] }, schedule, currentDate: '2026-07-31', matchHistory: [] };

  // Host simulates through 2026-08-09 without stopping at 2026-08-01 human gate
  const hostSim = simulateThroughDate(league, '2026-08-09', { isHost: true });
  assert.equal(hostSim.error, undefined);
  assert.equal(hostSim.league.currentDate, '2026-08-09');
  assert.equal(hostSim.summary.blockedByHumanMatch, false);

  // Host simulates entire season
  const fullSeason = simulateEntireSeason(league, { isHost: true });
  assert.equal(fullSeason.error, undefined);
  assert.equal(fullSeason.league.matchHistory.length, 870);
  assert.ok(fullSeason.league.schedule.every((f) => f.status === 'completed'));
});

test('simulateFixture generates realistic possession, xG, goalscorers, player ratings, and Man of the Match', () => {
  const customTeams = [
    { id: 't1', name: 'Real Madrid', managerType: 'cpu' },
    { id: 't2', name: 'Arsenal FC', managerType: 'cpu' },
  ];
  const picks = [
    { teamId: 't1', playerId: 'p1', playerName: 'K. Mbappe', position: 'ST', rating: 91 },
    { teamId: 't1', playerId: 'p2', playerName: 'V. Vinicius', position: 'LW', rating: 89 },
    { teamId: 't1', playerId: 'p3', playerName: 'J. Bellingham', position: 'CAM', rating: 90 },
    { teamId: 't1', playerId: 'p4', playerName: 'A. Rüdiger', position: 'CB', rating: 86 },
    { teamId: 't1', playerId: 'p5', playerName: 'T. Courtois', position: 'GK', rating: 89 },
    { teamId: 't2', playerId: 'p6', playerName: 'B. Saka', position: 'RW', rating: 87 },
    { teamId: 't2', playerId: 'p7', playerName: 'K. Havertz', position: 'ST', rating: 83 },
    { teamId: 't2', playerId: 'p8', playerName: 'M. Odegaard', position: 'CAM', rating: 88 },
    { teamId: 't2', playerId: 'p9', playerName: 'W. Saliba', position: 'CB', rating: 87 },
    { teamId: 't2', playerId: 'p10', playerName: 'D. Raya', position: 'GK', rating: 84 },
  ];
  const league = {
    season: '2026/27',
    teams: customTeams,
    draft: { picks },
    schedule: [{ id: 'fix-1', homeId: 't1', awayId: 't2', round: 1, date: '2026-08-01', status: 'scheduled' }],
    squads: {
      t1: { formation: '4-3-3', starters: { ST: 'p1', LW: 'p2', LCM: 'p3', LCB: 'p4', GK: 'p5' }, tacticalPreset: 'possession' },
      t2: { formation: '4-3-3', starters: { RW: 'p6', ST: 'p7', RCM: 'p8', RCB: 'p9', GK: 'p10' }, tacticalPreset: 'counter' },
    },
  };

  const sim = simulateFixture(league, league.schedule[0]);
  assert.equal(typeof sim.homeScore, 'number');
  assert.equal(typeof sim.awayScore, 'number');
  assert.ok(sim.stats.possession.home >= 32 && sim.stats.possession.home <= 68);
  assert.equal(sim.stats.possession.home + sim.stats.possession.away, 100);
  assert.ok(sim.stats.xG.home > 0 && sim.stats.xG.away > 0);
  assert.ok(sim.stats.shots.home >= sim.homeScore);
  assert.ok(sim.stats.shots.away >= sim.awayScore);
  assert.ok(Array.isArray(sim.lineups.home) && sim.lineups.home.length === 11);
  assert.ok(Array.isArray(sim.lineups.away) && sim.lineups.away.length === 11);

  // Every player has a match rating between 4.5 and 10.0
  for (const player of [...sim.lineups.home, ...sim.lineups.away]) {
    assert.ok(player.matchRating >= 4.5 && player.matchRating <= 10.0);
  }

  // Man of the Match is defined
  assert.ok(sim.manOfTheMatch);
  assert.ok(sim.manOfTheMatch.matchRating >= 6.5);

  // If goals were scored, events have minute, player, goalType
  for (const ev of sim.events) {
    assert.equal(ev.type, 'goal');
    assert.ok(ev.minute >= 1 && ev.minute <= 95);
    assert.ok(ev.player);
    assert.ok(ev.goalType);
  }
});

test('strikers score with higher probability than defenders, but defenders can still score', () => {
  const customTeams = [
    { id: 't1', name: 'Attack FC', managerType: 'cpu' },
    { id: 't2', name: 'Rival FC', managerType: 'cpu' },
  ];
  const picks = [
    { teamId: 't1', playerId: 'p-st', playerName: 'Super Striker', position: 'ST', rating: 88 },
    { teamId: 't1', playerId: 'p-cb', playerName: 'Solid Defender', position: 'CB', rating: 85 },
  ];
  const league = {
    season: '2026/27',
    teams: customTeams,
    draft: { picks },
    schedule: [],
    squads: {
      t1: { formation: '4-3-3', starters: { ST: 'p-st', LCB: 'p-cb' } },
    },
  };

  let strikerGoals = 0;
  let defenderGoals = 0;
  for (let i = 1; i <= 60; i += 1) {
    const fixture = { id: `multi-sim-${i}`, homeId: 't1', awayId: 't2', round: i, date: '2026-08-01', status: 'scheduled' };
    const sim = simulateFixture(league, fixture);
    for (const ev of sim.events) {
      if (ev.playerId === 'p-st') strikerGoals += 1;
      if (ev.playerId === 'p-cb') defenderGoals += 1;
    }
  }

  assert.ok(strikerGoals > 0, 'Striker should score goals across 60 matches');
  assert.ok(strikerGoals > defenderGoals, 'Striker should score significantly more than defender');
});

test('player season stats accumulate and getTopScorers ranks highest goalscorers accurately', () => {
  const schedule = buildSchedule(teams, '2026-08-01');
  const league = { season: '2026/27', teams, draft: { picks: [] }, schedule, currentDate: '2026-07-31', matchHistory: [] };
  const sim = simulateThroughDate(league, '2026-08-15', { isHost: true });

  const topScorers = getTopScorers(sim.league, 10);
  assert.ok(Array.isArray(topScorers));
  if (topScorers.length > 1) {
    assert.ok(topScorers[0].goals >= topScorers[1].goals);
  }

  const topAssisters = getTopAssisters(sim.league, 10);
  assert.ok(Array.isArray(topAssisters));

  const topRated = getTopRatedPlayers(sim.league, 10, 1);
  assert.ok(Array.isArray(topRated));
  if (topRated.length > 1) {
    assert.ok(topRated[0].averageRating >= topRated[1].averageRating);
  }
});



