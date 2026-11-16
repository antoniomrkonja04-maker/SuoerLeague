import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLeagueHost,
  SQUAD_SLOTS,
  getTeamRoster,
  getTeamSquad,
  setStartingPlayer,
  evaluateSlotFit,
  autoFillStartingEleven,
} from '../src/squad-core.mjs';

function makeLeague() {
  return {
    adminName: 'Host',
    teams: [
      { id: 'a', name: 'Alpha', managerType: 'human', managerName: 'Host' },
      { id: 'b', name: 'Beta', managerType: 'human', managerName: 'Alex' },
      { id: 'cpu', name: 'CPU FC', managerType: 'cpu', managerName: 'CPU 1' },
    ],
    draft: { picks: [
      { playerId: 'p1', playerName: 'Keeper One', rating: 80, teamId: 'a' },
      { playerId: 'p2', playerName: 'Forward Two', rating: 88, teamId: 'a' },
      { playerId: 'p3', playerName: 'Midfielder Three', rating: 75, teamId: 'a' },
      { playerId: 'p4', playerName: 'Transferred Four', rating: 70, teamId: 'b' },
      { playerId: 'p5', playerName: 'CPU Five', rating: 68, teamId: 'cpu' },
    ] },
  };
}
const playerPool = [
  { id: 'p1', name: 'Keeper One', position: 'GK', rating: 80 },
  { id: 'p2', name: 'Forward Two', position: 'ST', rating: 88 },
  { id: 'p3', name: 'Midfielder Three', position: 'CM', rating: 75 },
  { id: 'p4', name: 'Transferred Four', position: 'CB', rating: 70 },
  { id: 'p5', name: 'CPU Five', position: 'LW', rating: 68 },
];

test('exposes eleven stable 4-3-3 slots', () => {
  assert.deepEqual(SQUAD_SLOTS.map(({ id }) => id), ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LCM', 'DM', 'RCM', 'LW', 'ST', 'RW']);
});

test('derives only players currently owned by the team', () => {
  const league = makeLeague();
  const roster = getTeamRoster(league, 'a', playerPool);
  assert.deepEqual(roster.map(({ id, position }) => [id, position]), [['p1', 'GK'], ['p2', 'ST'], ['p3', 'CM']]);
  league.draft.picks.find((pick) => pick.playerId === 'p4').teamId = 'a';
  assert.deepEqual(getTeamRoster(league, 'a', playerPool).map(({ id }) => id), ['p1', 'p2', 'p3', 'p4']);
});

test('uses empty 4-3-3 slots for a missing lineup', () => {
  const squad = getTeamSquad(makeLeague(), 'a');
  assert.equal(squad.formation, '4-3-3');
  assert.equal(Object.keys(squad.starters).length, 11);
  assert.ok(Object.values(squad.starters).every((playerId) => playerId === ''));
});

test('moves an existing starter without duplicating the player', () => {
  const league = makeLeague();
  league.squads = { a: { formation: '4-3-3', starters: { GK: 'p1', ST: 'p2' } } };
  const result = setStartingPlayer(league, 'a', 'LW', 'p2', 'a');
  assert.equal(result.error, undefined);
  assert.equal(result.league.squads.a.starters.GK, 'p1');
  assert.equal(result.league.squads.a.starters.ST, '');
  assert.equal(result.league.squads.a.starters.LW, 'p2');
  assert.equal(Object.values(result.league.squads.a.starters).filter((id) => id === 'p2').length, 1);
});

test('replaces a starter with a bench player and returns the displaced player to the bench', () => {
  const league = makeLeague();
  league.squads = { a: { formation: '4-3-3', starters: { ST: 'p2' } } };
  const result = setStartingPlayer(league, 'a', 'ST', 'p3', 'a');
  assert.equal(result.league.squads.a.starters.ST, 'p3');
  const starters = Object.values(result.league.squads.a.starters);
  assert.ok(!starters.includes('p2'));
  assert.deepEqual(getTeamRoster(result.league, 'a', playerPool).filter((player) => !starters.includes(player.id)).map(({ id }) => id), ['p1', 'p2']);
});

test('rejects unknown players without changing the league', () => {
  const league = makeLeague();
  const before = structuredClone(league);
  const result = setStartingPlayer(league, 'a', 'ST', 'missing', 'a');
  assert.match(result.error, /kader|spieler/i);
  assert.deepEqual(result.league, before);
});

test('allows human managers to edit only their own team while the host can edit CPU teams', () => {
  const league = makeLeague();
  const own = setStartingPlayer(league, 'b', 'ST', 'p4', 'b');
  assert.equal(own.error, undefined);
  const unauthorized = setStartingPlayer(league, 'b', 'ST', 'p4', 'a');
  assert.match(unauthorized.error, /manager|berechtigt/i);
  const hostCpu = setStartingPlayer(league, 'cpu', 'LW', 'p5', 'a');
  assert.equal(hostCpu.error, undefined);
  const nonHostCpu = setStartingPlayer(league, 'cpu', 'LW', 'p5', 'b');
  assert.match(nonHostCpu.error, /host|berechtigt/i);
});

test('duplicate manager names do not grant host controls', () => {
  const league = makeLeague();
  league.teams[1].managerName = 'Host';
  assert.equal(isLeagueHost(league, 'a'), true);
  assert.equal(isLeagueHost(league, 'b'), false);
  const result = setStartingPlayer(league, 'cpu', 'LW', 'p5', 'b');
  assert.match(result.error, /host|berechtigt/i);
});

test('evaluateSlotFit and autoFillStartingEleven assign specialized positions with side awareness', () => {
  assert.equal(evaluateSlotFit('GK', 'GK').fit, 100);
  assert.equal(evaluateSlotFit('GK', 'ST').status, 'poor');
  assert.equal(evaluateSlotFit('LB', 'LB').fit, 100);
  assert.ok(evaluateSlotFit('LB', 'LB').fit > evaluateSlotFit('LB', 'RB').fit);
  assert.equal(evaluateSlotFit('LW', 'LW').fit, 100);
  assert.ok(evaluateSlotFit('LW', 'LW').fit > evaluateSlotFit('LW', 'RW').fit);

  const fullPool = [
    { id: 'gk1', name: 'Neuer', position: 'GK', rating: 88 },
    { id: 'lb1', name: 'Davies', position: 'LB', rating: 84 },
    { id: 'cb1', name: 'Upamecano', position: 'CB', rating: 83 },
    { id: 'cb2', name: 'Kim', position: 'CB', rating: 84 },
    { id: 'rb1', name: 'Frimpong', position: 'RB', rating: 85 },
    { id: 'dm1', name: 'Kimmich', position: 'CDM', rating: 87 },
    { id: 'cm1', name: 'Musiala', position: 'CAM', rating: 89 },
    { id: 'cm2', name: 'Barella', position: 'CM', rating: 86 },
    { id: 'lw1', name: 'Vinicius', position: 'LW', rating: 91 },
    { id: 'rw1', name: 'Saka', position: 'RW', rating: 88 },
    { id: 'st1', name: 'Kane', position: 'ST', rating: 90 },
  ];
  const league = {
    adminName: 'Host',
    teams: [{ id: 'a', name: 'Alpha', managerType: 'human', managerName: 'Host' }],
    draft: {
      picks: fullPool.map((p) => ({
        playerId: p.id,
        playerName: p.name,
        position: p.position,
        rating: p.rating,
        teamId: 'a',
      })),
    },
  };

  const filled = autoFillStartingEleven(league, 'a', fullPool, 'a');
  assert.equal(filled.error, undefined);
  assert.equal(filled.starters.GK, 'gk1');
  assert.equal(filled.starters.LB, 'lb1');
  assert.equal(filled.starters.RB, 'rb1');
  assert.equal(filled.starters.LW, 'lw1');
  assert.equal(filled.starters.RW, 'rw1');
  assert.equal(filled.starters.ST, 'st1');
  assert.equal(filled.starters.DM, 'dm1');
  assert.equal(filled.analysis.perfectCount, 11);
  assert.match(filled.analysis.summaryText, /Startelf optimiert/);
});

