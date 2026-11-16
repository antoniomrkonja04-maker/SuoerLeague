import test from 'node:test';
import assert from 'node:assert/strict';
import { assignManagersToTeams, autoDraftAllPicks, buildSnakeOrder, canManagerAutoDraft, canManagerPick, canManagerSimulateCpu, chooseCpuPick, mergeRosterPools, parseRosterCsv, simulateCpuPicksUntilHumanTurn } from '../src/league-core.mjs';

test('Snake Draft reverses team order every other round', () => {
  assert.deepEqual(buildSnakeOrder(['A', 'B', 'C'], 3), [
    'A', 'B', 'C', 'C', 'B', 'A', 'A', 'B', 'C',
  ]);
});

test('CPU chooses the highest-rated undrafted player', () => {
  const players = [
    { id: 'p1', name: 'Alex', rating: 82 },
    { id: 'p2', name: 'Sam', rating: 94 },
    { id: 'p3', name: 'Jo', rating: 88 },
  ];
  assert.equal(chooseCpuPick(players, ['p2'])?.id, 'p3');
});

test('CSV import normalizes player headers and quoted values', () => {
  const players = parseRosterCsv('player_name,club,position,overall,coach\n"Alex, Jr.",Arsenal,CM,86,"Mikel Arteta"');
  assert.deepEqual(players, [{
    id: 'alex-jr-arsenal-1', name: 'Alex, Jr.', club: 'Arsenal', position: 'CM', coach: 'Mikel Arteta', rating: 86,
  }]);
});

test('FM Blog shortlist imports ABI as a labeled rating and keeps source identity', () => {
  const players = parseRosterCsv('source_player_id,player_name,position,club,fmb_abi\n85139014,Kylian Mbappé,"AML, ST",R. Madrid,97');
  assert.deepEqual(players, [{
    id: 'fm26-85139014', name: 'Kylian Mbappé', club: 'R. Madrid', position: 'AML, ST', coach: '', rating: 97,
    ratingSource: 'FMB ABI', sourcePlayerId: '85139014',
  }]);
});

test('CSV import rejects a file without player names', () => {
  assert.throws(() => parseRosterCsv('club,position,overall\nArsenal,CM,86'), /player_name/i);
});

test('CSV import accepts a UTF-8 BOM before the header', () => {
  assert.equal(parseRosterCsv('\uFEFFplayer_name,club\nAlex,Arsenal')[0].name, 'Alex');
});

test('CSV import accepts semicolon delimiters and decimal-comma ratings', () => {
  const players = parseRosterCsv('player_name;club;position;rating\nAlex;Arsenal;CM;88,5');
  assert.equal(players[0].club, 'Arsenal');
  assert.equal(players[0].rating, 88.5);
});

test('CSV import keeps the 1800 highest-rated male players for a full 30-team draft pool', () => {
  const rows = ['player_name,club,position,current ability,gender'];
  for (let rating = 1; rating <= 1805; rating += 1) rows.push(`Player ${rating},Club,CM,${rating},Male`);
  rows.push('Women Player,Club,FW,200,Female');
  const players = parseRosterCsv(rows.join('\n'));

  assert.equal(players.length, 1800);
  assert.equal(players[0].name, 'Player 1805');
  assert.equal(players.at(-1).name, 'Player 6');
  assert.ok(players.every((player) => player.name !== 'Women Player'));
});

test('CSV with more than 1800 players requires ratings to identify the best pool', () => {
  const rows = ['player_name,club'];
  for (let index = 1; index <= 1801; index += 1) rows.push(`Player ${index},Club`);
  assert.throws(() => parseRosterCsv(rows.join('\n')), /rating|bewert/i);
});

test('pool expansion appends new players without replacing picked players or adding duplicates', async () => {
  const { mergeRosterPools } = await import('../src/league-core.mjs');
  const existing = [{ id: 'fm26-1', name: 'Étoile', club: 'Club A' }];
  const merged = mergeRosterPools(existing, [
    { id: 'fm26-1', name: 'Étoile', club: 'Club A' },
    { id: 'custom-1', name: 'Etoile', club: 'Club A' },
    { id: 'custom-2', name: 'New Player', club: 'Club B' },
  ]);
  assert.deepEqual(merged.map((player) => player.id), ['fm26-1', 'custom-2']);
  assert.equal(existing.length, 1);
});

test('CPU batch simulation advances through snake order and stops at the next human turn', () => {
  const teams = [
    { id: 'A', name: 'Human A', managerType: 'human', managerName: 'Host' },
    { id: 'B', name: 'CPU B', managerType: 'cpu', managerName: 'CPU B' },
    { id: 'C', name: 'Human C', managerType: 'human', managerName: 'Alex' },
  ];
  const players = Array.from({ length: 8 }, (_, index) => ({ id: `p${index}`, name: `Player ${index}`, rating: 99 - index }));
  const picks = [{ playerId: 'p0', playerName: 'Player 0', teamId: 'A' }];
  const result = simulateCpuPicksUntilHumanTurn(teams, ['A', 'B', 'C'], picks, players);

  assert.deepEqual(result.map((pick) => [pick.teamId, pick.playerId]), [['A', 'p0'], ['B', 'p1']]);
});

test('only the assigned human manager may make their team pick', () => {
  const hostTeam = { id: 'A', managerType: 'human' };
  const alexTeam = { id: 'B', managerType: 'human' };
  assert.equal(canManagerPick(hostTeam, hostTeam), true);
  assert.equal(canManagerPick(hostTeam, alexTeam), false);
  assert.equal(canManagerPick({ id: 'CPU', managerType: 'cpu' }, hostTeam), false);
});

test('only the host can simulate a CPU pick', () => {
  const host = { managerName: 'Host' };
  const alex = { managerName: 'Alex' };
  assert.equal(canManagerSimulateCpu({ id: 'CPU', managerType: 'cpu' }, host, 'Host'), true);
  assert.equal(canManagerSimulateCpu({ id: 'CPU', managerType: 'cpu' }, alex, 'Host'), false);
  assert.equal(canManagerSimulateCpu({ id: 'Alex', managerType: 'human' }, host, 'Host'), false);
});

test('autoDraftAllPicks drafts all remaining human and CPU turns in snake order without overwriting existing picks', () => {
  const teams = [
    { id: 'A', name: 'Human A', managerType: 'human', managerName: 'Host' },
    { id: 'B', name: 'CPU B', managerType: 'cpu', managerName: 'CPU B' },
    { id: 'C', name: 'Human C', managerType: 'human', managerName: 'Alex' },
  ];
  const players = Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, name: `Player ${index}`, rating: 95 - index }));
  const existing = [{ playerId: 'p3', playerName: 'Player 3', rating: 92, teamId: 'A', teamName: 'Human A', managerName: 'Host', number: 1, round: 1 }];
  const result = autoDraftAllPicks(teams, ['A', 'B', 'C'], existing, players, () => '2026-08-01T12:00:00Z');

  assert.equal(result.length, 6);
  assert.deepEqual(
    result.map((pick) => [pick.number, pick.round, pick.teamId, pick.playerId]),
    [
      [1, 1, 'A', 'p3'],
      [2, 1, 'B', 'p0'],
      [3, 1, 'C', 'p1'],
      [4, 2, 'C', 'p2'],
      [5, 2, 'B', 'p4'],
      [6, 2, 'A', 'p5'],
    ],
  );
  assert.equal(canManagerAutoDraft({ managerName: 'Host' }, 'Host'), true);
  assert.equal(canManagerAutoDraft({ managerName: 'Alex' }, 'Host'), false);
});

test('30-team Auto-Draft over 1800 players assigns exactly 30 players to each team (900 total picks)', () => {
  const teams = Array.from({ length: 30 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Club ${index + 1}`,
    managerType: index === 0 ? 'human' : 'cpu',
    managerName: `Manager ${index + 1}`,
  }));
  const order = teams.map((t) => t.id);
  const players = Array.from({ length: 1800 }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
    position: ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'][index % 10],
    rating: Math.max(70, 97 - Math.floor(index / 65)),
  }));
  const picks = autoDraftAllPicks(teams, order, [], players, () => '2026-08-01T12:00:00Z');
  assert.equal(picks.length, 900);
  for (const team of teams) {
    const teamPicks = picks.filter((pick) => pick.teamId === team.id);
    assert.equal(teamPicks.length, 30);
  }
});

test('assignManagersToTeams assigns human managers to designated teams and remaining to CPU', () => {
  const seedTeams = [
    { id: 'club-1', name: 'Arsenal', league: 'Premier League' },
    { id: 'club-7', name: 'Real Madrid', league: 'La Liga' },
    { id: 'club-13', name: 'FC Bayern München', league: 'Bundesliga' },
    { id: 'club-14', name: 'Borussia Dortmund', league: 'Bundesliga' },
  ];
  const selectedIds = ['club-1', 'club-7', 'club-13', 'club-14'];
  const setupManagers = [
    { id: 'mgr-1', name: 'Antonio (Admin)', teamId: 'club-7' },
    { id: 'mgr-2', name: 'Stefan', teamId: 'club-13' },
  ];

  const result = assignManagersToTeams(selectedIds, setupManagers, seedTeams, 150);

  assert.equal(result.humanCount, 2);
  assert.equal(result.adminName, 'Antonio (Admin)');
  assert.equal(result.teams.length, 4);

  const realMadrid = result.teams.find((t) => t.id === 'club-7');
  assert.equal(realMadrid.managerType, 'human');
  assert.equal(realMadrid.managerName, 'Antonio (Admin)');
  assert.equal(realMadrid.budget, 150);

  const bayern = result.teams.find((t) => t.id === 'club-13');
  assert.equal(bayern.managerType, 'human');
  assert.equal(bayern.managerName, 'Stefan');

  const arsenal = result.teams.find((t) => t.id === 'club-1');
  assert.equal(arsenal.managerType, 'cpu');
  assert.match(arsenal.managerName, /^CPU \d+$/);

  const bvb = result.teams.find((t) => t.id === 'club-14');
  assert.equal(bvb.managerType, 'cpu');
});
