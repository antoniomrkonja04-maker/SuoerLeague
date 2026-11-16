import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

async function getStoreFactory() {
  const mod = await import('../src/shared-state.mjs').catch(() => null);
  assert.equal(typeof mod?.createSharedStateStore, 'function', 'createSharedStateStore must be exported');
  return mod.createSharedStateStore;
}

test('shared store persists revisions and rejects stale writes without replacing current state', async () => {
  const createStore = await getStoreFactory();
  const dir = await mkdtemp(path.join(process.cwd(), '.tmp-career-shared-'));
  try {
    const store = createStore(path.join(dir, 'state.json'));
    assert.deepEqual(await store.read(), { revision: 0, state: null });
    assert.deepEqual(await store.write({ league: { name: 'Friends League' } }, 0), {
      revision: 1, state: { league: { name: 'Friends League' } },
    });
    const conflict = await store.write({ league: { name: 'Stale overwrite' } }, 0);
    assert.equal(conflict.conflict, true);
    assert.deepEqual(conflict.current, { revision: 1, state: { league: { name: 'Friends League' } } });
    assert.deepEqual(await store.read(), { revision: 1, state: { league: { name: 'Friends League' } } });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('shared API persists state, tracks browser managers, and blocks runtime file downloads', async () => {
  const mod = await import('../src/career-server.mjs').catch(() => null);
  assert.equal(typeof mod?.createCareerServer, 'function', 'createCareerServer must be exported');
  const dir = await mkdtemp(path.join(process.cwd(), '.tmp-career-server-'));
  const server = mod.createCareerServer({ statePath: path.join(dir, 'state.json') });
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const initial = await fetch(`${base}/api/state`).then((response) => response.json());
    assert.deepEqual(initial, { revision: 0, state: null });
    const write = await fetch(`${base}/api/state`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 0, state: { league: { name: 'Shared' } } }),
    });
    assert.equal(write.status, 200);
    await fetch(`${base}/api/presence`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId: 'tab-1', managerId: 'team-1' }),
    });
    const presence = await fetch(`${base}/api/presence`).then((response) => response.json());
    assert.deepEqual(presence.managerIds, ['team-1']);
    const privateFile = await fetch(`${base}/runtime-data/state.json`);
    assert.equal(privateFile.status, 403);

    // Test POST /api/pes-sync Sider-Lua live webhook
    const leagueState = {
      players: [],
      log: [],
      league: {
        name: 'Career Premier',
        season: '2026/27',
        currentDate: '2026-08-01',
        teams: [
          { id: 't1', name: 'Arsenal', managerName: 'Admin', managerType: 'human' },
          { id: 't2', name: 'Chelsea', managerName: 'Alex', managerType: 'human' },
        ],
        schedule: [
          { id: '2026/27-r1-t1-t2', round: 1, date: '2026-08-01', homeId: 't1', awayId: 't2', status: 'awaiting-human' },
        ],
        matchHistory: [],
        news: [],
      },
    };
    const seeded = await fetch(`${base}/api/state`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1, state: leagueState }),
    });
    assert.equal(seeded.status, 200);

    const pesSyncResp = await fetch(`${base}/api/pes-sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'sider-lua-bridge',
        fixtureId: '2026/27-r1-t1-t2',
        homeTeamId: 't1',
        awayTeamId: 't2',
        homeScore: 4,
        awayScore: 2,
      }),
    });
    assert.equal(pesSyncResp.status, 200);
    const pesSyncJson = await pesSyncResp.json();
    assert.equal(pesSyncJson.ok, true);
    assert.equal(pesSyncJson.syncRecord.homeScore, 4);
    assert.equal(pesSyncJson.syncRecord.awayScore, 2);

    const updatedState = await fetch(`${base}/api/state`).then((r) => r.json());
    assert.equal(updatedState.state.league.schedule[0].status, 'completed');
    assert.equal(updatedState.state.league.schedule[0].homeScore, 4);
    assert.equal(updatedState.state.league.matchHistory.length, 1);
    assert.ok(updatedState.state.league.news.length >= 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});

