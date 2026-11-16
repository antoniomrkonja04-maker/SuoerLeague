import { evaluateSlotFit, FORMATION_PRESETS, getFormationSlots, TACTICAL_PRESETS } from './squad-core.mjs';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function renderSquadView({
  team,
  roster,
  squad,
  slots,
  canEdit,
  selectedPlayerId = '',
  shirtNumbers = {},
}) {
  const starterIds = new Set(Object.values(squad.starters).filter(Boolean));
  const playersById = new Map(roster.map((player) => [player.id, player]));
  const startersCount = starterIds.size;
  const activeFormation = squad.formation || '4-3-3';
  const activePreset = squad.tacticalPreset || 'gegenpressing';
  const effectiveSlots = slots && activeFormation === '4-3-3' ? slots : getFormationSlots(activeFormation);

  const pitchSlots = effectiveSlots.map((slot) => {
    const playerId = squad.starters[slot.id] || '';
    const player = playersById.get(playerId);
    const action = !canEdit ? '' : (selectedPlayerId || !player ? 'assign-squad-slot' : 'select-squad-slot-player');
    const title = player ? `${player.name}, ${slot.label}` : `${slot.label}: Platz frei`;
    const selected = playerId && playerId === selectedPlayerId ? ' is-selected' : '';
    const shirtNo = player ? (shirtNumbers[player.id] || player.shirtNumber || '') : '';
    const slotFit = player ? evaluateSlotFit(player.position, slot.id) : null;
    const fitBadge = slotFit ? `<span class="squad-slot-fit is-${slotFit.status}" title="${escapeHtml(slotFit.roleLabel)} (${slotFit.fit}% Passung)">${slotFit.fit}% Fit</span>` : '';
    return `<button type="button" class="squad-slot ${player ? 'is-filled' : 'is-empty'}${selected}" style="--slot-x:${Number(slot.x)}%;--slot-y:${Number(slot.y)}%" data-slot-id="${escapeHtml(slot.id)}" ${playerId ? `data-player-id="${escapeHtml(playerId)}"` : ''} ${action ? `data-action="${action}"` : ''} ${canEdit ? 'data-drop-target="true"' : ''} aria-label="${escapeHtml(title)}" ${canEdit ? 'aria-dropeffect="move"' : (!player ? 'disabled' : '')} ${player && canEdit ? 'draggable="true"' : ''}><span class="squad-slot-role">${escapeHtml(slot.label)}${shirtNo ? ` · #${shirtNo}` : ''}</span><span class="squad-player-name">${player ? escapeHtml(player.name) : (canEdit ? 'Spieler wählen' : 'Offen')}</span>${player ? `<span class="squad-player-meta">${escapeHtml(player.position || '—')} ${fitBadge} · <span class="squad-slot-ovr-btn" role="button" tabindex="0" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}" title="Auf OVR klicken für detaillierte FIFA 17 Attribute (40–99)">OVR ${Number(player.rating) || '—'}</span></span>` : ''}</button>`;
  }).join('');

  const bench = roster.filter((player) => !starterIds.has(player.id));
  const benchCards = bench.length ? bench.map((player) => {
    const shirtNo = shirtNumbers[player.id] || player.shirtNumber || '';
    const posLabel = `${shirtNo ? `#${shirtNo} · ` : ''}${player.position || 'Position offen'}`;
    return canEdit
      ? `<button type="button" class="squad-player-card${player.id === selectedPlayerId ? ' is-selected' : ''}" data-action="select-squad-player" data-player-id="${escapeHtml(player.id)}" draggable="true" aria-pressed="${player.id === selectedPlayerId}"><span class="squad-player-rating" role="button" tabindex="0" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}" title="Auf OVR klicken für detaillierte FIFA 17 Attribute (40–99)"><small>OVR</small>${Number(player.rating) || '—'}</span><span class="squad-player-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(posLabel)}</small></span><span class="squad-player-grip" aria-hidden="true">⋮⋮</span></button>`
      : `<div class="squad-player-card is-readonly"><button type="button" class="squad-player-rating" data-action="open-pes-player" data-player-id="${escapeHtml(player.id)}" title="Auf OVR klicken für detaillierte FIFA 17 Attribute (40–99)"><small>OVR</small>${Number(player.rating) || '—'}</button><span class="squad-player-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(posLabel)}</small></span></div>`;
  }).join('')
    : '<div class="squad-empty-bench">Noch keine Bankspieler.</div>';

  const formationButtons = Object.keys(FORMATION_PRESETS).map((fmt) => `
    <button type="button" class="pes-mode-pill ${activeFormation === fmt ? 'is-active' : ''}" ${canEdit ? `data-action="set-squad-formation" data-formation="${escapeHtml(fmt)}"` : 'disabled'}>${escapeHtml(fmt)}</button>
  `).join('');

  const presetOptions = TACTICAL_PRESETS.map((preset) => `
    <option value="${escapeHtml(preset.id)}" ${activePreset === preset.id ? 'selected' : ''}>${escapeHtml(preset.label)} (Tempo ${preset.tempo} · Pressing ${preset.pressure})</option>
  `).join('');

  const selectedPlayer = playersById.get(selectedPlayerId) || roster[0] || null;
  const selectedPlayerShirt = selectedPlayer ? (shirtNumbers[selectedPlayer.id] || 10) : 10;

  const tacticsToolbarHtml = canEdit ? `
    <div class="squad-tactics-toolbar" aria-label="Formation, Taktik und Rückennummern">
      <div class="squad-tactics-group">
        <span class="squad-toolbar-label">FORMATION</span>
        <div class="pes-mode-pills">${formationButtons}</div>
      </div>
      <div class="squad-tactics-group">
        <label class="squad-toolbar-label" for="squad-preset-select">TAKTIK-STIL (FIFA 17)</label>
        <select id="squad-preset-select" data-squad-preset-select>${presetOptions}</select>
      </div>
      ${selectedPlayer ? `
        <div class="squad-tactics-group">
          <label class="squad-toolbar-label" for="squad-shirt-number">TRIKOT-NR. (${escapeHtml(selectedPlayer.name.split(' ').at(-1))})</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input id="squad-shirt-number" type="number" min="1" max="99" value="${Number(selectedPlayerShirt)}" data-squad-shirt-player="${escapeHtml(selectedPlayer.id)}" style="width:68px">
            <button type="button" class="button light small" data-action="save-shirt-number" data-player-id="${escapeHtml(selectedPlayer.id)}">Nr. speichern</button>
          </div>
        </div>
      ` : ''}
      <div class="squad-tactics-group" style="margin-left:auto">
        <button type="button" class="button primary small" data-action="auto-fill-squad">Beste 11 automatisch aufstellen</button>
      </div>
    </div>
  ` : '';

  return `<section class="squad-hub"><header class="squad-heading"><div><div class="eyebrow">KADER · AUFSTELLUNG · FIFA 17 ONLINE-SYNC</div><h2>${escapeHtml(team.name)}</h2><p>${roster.length} Spieler im Kader · ${startersCount}/11 Startplätze besetzt · ${escapeHtml(activeFormation)}</p></div>${canEdit ? '<span class="squad-edit-status">AUFSTELLUNG BEARBEITEN</span>' : '<span class="squad-edit-status is-readonly">NUR ANSEHEN</span>'}</header>${tacticsToolbarHtml}<div class="squad-layout"><section class="squad-pitch-panel" aria-label="Aufstellung"><div class="squad-formation-label">${escapeHtml(activeFormation)} <span>FORMATION</span></div><div class="squad-pitch" role="group" aria-label="Fußballfeld mit elf Aufstellungsplätzen"><div class="pitch-line pitch-halfway"></div><div class="pitch-circle"></div><div class="pitch-box pitch-box-top"></div><div class="pitch-box pitch-box-bottom"></div>${pitchSlots}</div></section><aside class="squad-bench" aria-label="Bankspieler"><header><div><span class="bench-kicker">KADER</span><h3>BANK (${bench.length})</h3></div><span class="bench-roster-count">${roster.length} Spieler</span></header>${canEdit ? '<p class="squad-instruction">Spieler auf einen Platz ziehen oder antippen. Tipp auf <strong>OVR</strong> öffnet detaillierte FIFA 17 Attribute.</p>' : '<p class="squad-instruction">Aufstellung des Teams. Tipp auf <strong>OVR</strong> öffnet detaillierte FIFA 17 Attribute.</p>'}<div class="squad-bench-list">${benchCards}</div></aside></div></section>`;
}
