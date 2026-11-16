import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseRosterCsv } from '../src/league-core.mjs';

test('bundled FM26 database has 1800 unique, ABI-rated real players for 30-man squads across 30 teams', async () => {
  const csv = await readFile(new URL('../data/fm26-top-players.csv', import.meta.url), 'utf8');
  const players = parseRosterCsv(csv);

  assert.equal(players.length, 1800);
  assert.equal(new Set(players.map((player) => player.sourcePlayerId)).size, 1800);
  assert.ok(players.every((player) => player.ratingSource === 'FMB ABI' && player.rating >= 70));
  assert.ok(players.some((player) => player.name === 'Kylian Mbappé' && player.rating === 97));
  assert.ok(players.length >= 30 * 30);
});
