import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSquadView } from '../src/squad-view.mjs';
import { SQUAD_SLOTS } from '../src/squad-core.mjs';

function makeView(canEdit = true) {
  return renderSquadView({
    team: { id: 'team-a', name: 'Alpha FC' },
    roster: [
      { id: 'p1', name: 'Keeper One', position: 'GK', rating: 80 },
      { id: 'p2', name: 'Forward Two', position: 'ST', rating: 88 },
      { id: 'p3', name: 'Bench Three', position: 'CM', rating: 75 },
    ],
    squad: { formation: '4-3-3', starters: { GK: 'p1', ST: 'p2' } },
    slots: SQUAD_SLOTS,
    canEdit,
  });
}

test('renders all 11 labeled pitch slots and the unassigned bench', () => {
  const html = makeView();
  assert.equal((html.match(/class="squad-slot /g) ?? []).length, 11);
  assert.match(html, /Alpha FC/);
  assert.match(html, /Keeper One/);
  assert.match(html, /Forward Two/);
  assert.match(html, /Bench Three/);
  assert.match(html, /BANK \(1\)/);
  assert.match(html, /data-slot-id="GK"/);
});

test('shows unavailable assignment controls when the current manager cannot edit', () => {
  const html = makeView(false);
  assert.match(html, /NUR ANSEHEN/);
  assert.doesNotMatch(html, /data-action="select-squad-player"/);
  assert.doesNotMatch(html, /data-action="assign-squad-slot"/);
});

test('escapes team and player names in rendered markup', () => {
  const html = renderSquadView({
    team: { id: 'team-a', name: '<img src=x onerror=alert(1)>' },
    roster: [{ id: 'p1', name: '<script>alert(1)</script>', position: 'GK', rating: 80 }],
    squad: { formation: '4-3-3', starters: {} }, slots: SQUAD_SLOTS, canEdit: true,
  });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('renders keyboard-selectable and drag targets only for editable squads', () => {
  const html = makeView();
  assert.match(html, /data-action="select-squad-player"/);
  assert.match(html, /data-action="assign-squad-slot"/);
  assert.match(html, /draggable="true"/);
  const starterCard = html.match(/<button[^>]+data-slot-id="GK"[^>]*>/)?.[0] ?? '';
  assert.match(starterCard, /data-action="select-squad-slot-player"/);
  assert.match(starterCard, /draggable="true"/);
  const readOnly = makeView(false);
  assert.doesNotMatch(readOnly, /data-action="select-squad-player"/);
  assert.doesNotMatch(readOnly, /data-action="assign-squad-slot"/);
  assert.doesNotMatch(readOnly, /draggable="true"/);
  const readOnlyStarter = readOnly.match(/<button[^>]+data-slot-id="GK"[^>]*>/)?.[0] ?? '';
  assert.doesNotMatch(readOnlyStarter, /draggable="true"/);
});
import { readFile } from 'node:fs/promises';

 test('defines responsive pitch, keyboard focus, empty slots, and reduced-motion styling', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.squad-layout\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s+\d+px/s);
  assert.match(css, /\.squad-slot\.is-empty/);
  assert.match(css, /\.squad-player-card:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*\d+px\)[\s\S]*?\.squad-layout\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.squad-/s);
});

test('renders clickable OVR badges on pitch slots and bench cards to open detailed PES stats', () => {
  const html = makeView();
  assert.match(html, /class="squad-slot-ovr-btn"[^>]*data-action="open-pes-player"[^>]*data-player-id="p1"/);
  assert.match(html, /class="squad-player-rating"[^>]*data-action="open-pes-player"[^>]*data-player-id="p3"/);
});

