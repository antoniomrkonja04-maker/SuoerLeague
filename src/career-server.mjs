import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSharedStateStore } from './shared-state.mjs';
import {
  applyPesLiveMatchSync,
  confirmManagerDbSync,
  exportPesSiderJson,
  generatePesSiderLuaScript,
  updateOnlineLobbySettings,
} from './pes-core.mjs';
import { appendNewsEvent, detectSimulationNewsEvents } from './news-core.mjs';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wav': 'audio/wav', '.mp4': 'video/mp4', '.json': 'application/json; charset=utf-8',
};
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const PRESENCE_TTL_MS = 15_000;

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON body.'), { status: 400 }); }
}

export function createCareerServer({ root = defaultRoot, statePath = path.join(root, 'runtime-data', 'shared-state.json'), now = Date.now } = {}) {
  const absoluteRoot = path.resolve(root);
  const runtimePath = path.resolve(absoluteRoot, 'runtime-data');
  const store = createSharedStateStore(statePath);
  const presence = new Map();

  function activePresence() {
    const threshold = now() - PRESENCE_TTL_MS;
    const managerIds = new Set();
    for (const [sessionId, value] of presence) {
      if (value.seenAt < threshold) presence.delete(sessionId);
      else managerIds.add(value.managerId);
    }
    return [...managerIds];
  }

  return http.createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch { response.writeHead(400).end('Bad request'); return; }

    if (pathname === '/api/state' && request.method === 'GET') {
      try { return sendJson(response, 200, await store.read()); }
      catch { return sendJson(response, 500, { error: 'Shared state could not be read.' }); }
    }
    if (pathname === '/api/state' && request.method === 'PUT') {
      try {
        const body = await readJson(request);
        if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0 || !body.state || typeof body.state !== 'object' || Array.isArray(body.state)) {
          return sendJson(response, 400, { error: 'Expected a state object and nonnegative expectedRevision.' });
        }
        const result = await store.write(body.state, body.expectedRevision);
        return sendJson(response, result.conflict ? 409 : 200, result.conflict ? { error: 'revision_conflict', ...result.current } : result);
      } catch (error) {
        return sendJson(response, error.status ?? 500, { error: error.status ? error.message : 'Shared state could not be written.' });
      }
    }
    if (pathname === '/api/career/export-package' && request.method === 'GET') {
      try {
        const current = await store.read();
        const exportPackage = {
          exportVersion: '1.0',
          exportedAt: new Date().toISOString(),
          state: current.state || {},
          revision: current.revision || 0,
        };
        response.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': 'attachment; filename="fifa_career_save.json"',
          'cache-control': 'no-store',
        });
        response.end(JSON.stringify(exportPackage, null, 2));
        return;
      } catch (err) {
        return sendJson(response, 500, { error: 'Karriere-Export fehlgeschlagen.' });
      }
    }
    if (pathname === '/api/pes-bridge/manifest' && request.method === 'GET') {
      try {
        const current = await store.read();
        if (!current.state?.league) {
          return sendJson(response, 400, { error: 'Noch keine aktive Liga im Career-Server vorhanden.' });
        }
        const manifestJson = exportPesSiderJson(current.state.league, current.state.players ?? []);
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        response.end(manifestJson);
        return;
      } catch (error) {
        return sendJson(response, 500, { error: error.message || 'Manifest konnte nicht erstellt werden.' });
      }
    }
    if (pathname === '/api/pes-bridge/sider-lua' && request.method === 'GET') {
      try {
        const current = await store.read();
        const hostHeader = request.headers.host ? `http://${request.headers.host}` : 'http://localhost:3000';
        const lua = generatePesSiderLuaScript(current.state?.league || null, {
          serverUrl: hostHeader,
          players: current.state?.players ?? [],
        });
        response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        response.end(lua);
        return;
      } catch (error) {
        return sendJson(response, 500, { error: error.message || 'Lua-Skript konnte nicht erstellt werden.' });
      }
    }
    if (pathname === '/api/pes-bridge/lobby' && request.method === 'POST') {
      try {
        const body = await readJson(request);
        const current = await store.read();
        if (!current.state?.league) {
          return sendJson(response, 400, { error: 'Noch keine aktive Liga vorhanden.' });
        }
        let nextLeague = current.state.league;
        if (body.confirmSync) {
          const synced = confirmManagerDbSync(nextLeague, current.state.players ?? [], body.managerTeamId || '', {
            syncAll: Boolean(body.syncAll),
          });
          nextLeague = synced.league;
        } else {
          const updated = updateOnlineLobbySettings(nextLeague, current.state.players ?? [], body);
          nextLeague = updated.league;
        }
        const nextState = { ...current.state, league: nextLeague };
        const saved = await store.write(nextState, current.revision);
        if (saved.conflict) return sendJson(response, 409, { error: 'revision_conflict' });
        return sendJson(response, 200, { ok: true, revision: saved.revision, onlineLobby: nextLeague.onlineLobby });
      } catch (error) {
        return sendJson(response, error.status ?? 500, { error: error.message || 'Online-Lobby-Update fehlgeschlagen.' });
      }
    }
    if (pathname === '/api/pes-sync' && request.method === 'POST') {
      try {
        const body = await readJson(request);
        const current = await store.read();
        if (!current.state?.league) {
          return sendJson(response, 400, { error: 'Noch keine aktive Liga im Career-Server vorhanden.' });
        }
        const previousLeague = structuredClone(current.state.league);
        const synced = applyPesLiveMatchSync(current.state.league, body, { players: current.state.players ?? [] });
        if (synced.error) return sendJson(response, 400, { error: synced.error });
        let nextLeague = detectSimulationNewsEvents(previousLeague, synced.league);
        nextLeague = appendNewsEvent(nextLeague, {
          id: `pes-sync-${synced.syncRecord.fixtureId}-${synced.syncRecord.homeScore}-${synced.syncRecord.awayScore}`,
          type: 'human-match-result',
          homeTeamId: synced.homeTeam.id,
          homeTeamName: synced.homeTeam.name,
          awayTeamId: synced.awayTeam.id,
          awayTeamName: synced.awayTeam.name,
          homeScore: synced.syncRecord.homeScore,
          awayScore: synced.syncRecord.awayScore,
          round: synced.syncRecord.round,
          createdAt: synced.syncRecord.syncedAt,
        });
        const scorerSummary = (synced.syncRecord.scorers ?? []).map((s) => `${s.playerName} (${s.minute}.')`).join(', ');
        const nextState = {
          ...current.state,
          league: nextLeague,
          log: [
            {
              action: 'Online-Match & DB synchronisiert',
              detail: `${synced.homeTeam.name} ${synced.syncRecord.homeScore}:${synced.syncRecord.awayScore} ${synced.awayTeam.name}${scorerSummary ? ` · Tore: ${scorerSummary}` : ''} (Hash ${synced.dbHash})`,
              at: synced.syncRecord.syncedAt,
              actor: 'Online-Bridge',
            },
            ...(current.state.log ?? []),
          ].slice(0, 200),
        };
        const saved = await store.write(nextState, current.revision);
        if (saved.conflict) return sendJson(response, 409, { error: 'revision_conflict' });
        return sendJson(response, 200, { ok: true, revision: saved.revision, syncRecord: synced.syncRecord, dbHash: synced.dbHash });
      } catch (error) {
        return sendJson(response, error.status ?? 500, { error: error.message || 'PES Live-Sync fehlgeschlagen.' });
      }
    }
    if (pathname === '/api/presence' && request.method === 'GET') {
      return sendJson(response, 200, { managerIds: activePresence() });
    }
    if (pathname === '/api/presence' && request.method === 'POST') {
      try {
        const body = await readJson(request);
        if (typeof body.sessionId !== 'string' || body.sessionId.length > 120 || typeof body.managerId !== 'string' || body.managerId.length > 120) {
          return sendJson(response, 400, { error: 'sessionId and managerId are required.' });
        }
        presence.set(body.sessionId, { managerId: body.managerId, seenAt: now() });
        return sendJson(response, 200, { ok: true });
      } catch (error) {
        return sendJson(response, error.status ?? 400, { error: error.message });
      }
    }
    if (pathname === '/api/presence' && request.method === 'DELETE') {
      const sessionId = new URL(request.url, 'http://127.0.0.1').searchParams.get('sessionId');
      if (sessionId) presence.delete(sessionId);
      return sendJson(response, 200, { ok: true });
    }

    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const target = path.resolve(absoluteRoot, relative);
    if (target === runtimePath || target.startsWith(`${runtimePath}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (!target.startsWith(`${absoluteRoot}${path.sep}`) && target !== absoluteRoot) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      let fileTarget = target;
      let body;
      try {
        body = await readFile(fileTarget);
      } catch {
        const publicTarget = path.resolve(absoluteRoot, 'public', relative);
        if (!publicTarget.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error('Forbidden');
        fileTarget = publicTarget;
        body = await readFile(fileTarget);
      }
      response.writeHead(200, { 'content-type': mime[path.extname(fileTarget)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });
}
