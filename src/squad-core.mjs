export const SQUAD_SLOTS = [
  { id: 'GK', label: 'Torwart', x: 50, y: 88 },
  { id: 'LB', label: 'Linksverteidiger', x: 18, y: 70 },
  { id: 'LCB', label: 'Innenverteidiger', x: 39, y: 70 },
  { id: 'RCB', label: 'Innenverteidiger', x: 61, y: 70 },
  { id: 'RB', label: 'Rechtsverteidiger', x: 82, y: 70 },
  { id: 'LCM', label: 'Zentrales Mittelfeld', x: 34, y: 51 },
  { id: 'DM', label: 'Defensives Mittelfeld', x: 50, y: 60 },
  { id: 'RCM', label: 'Zentrales Mittelfeld', x: 66, y: 51 },
  { id: 'LW', label: 'Linksaußen', x: 20, y: 27 },
  { id: 'ST', label: 'Stürmer', x: 50, y: 21 },
  { id: 'RW', label: 'Rechtsaußen', x: 80, y: 27 },
];

export const FORMATION_PRESETS = {
  '4-3-3': SQUAD_SLOTS,
  '4-2-3-1': [
    { id: 'GK', label: 'Torwart', x: 50, y: 88 },
    { id: 'LB', label: 'Linksverteidiger', x: 18, y: 72 },
    { id: 'LCB', label: 'Innenverteidiger', x: 39, y: 73 },
    { id: 'RCB', label: 'Innenverteidiger', x: 61, y: 73 },
    { id: 'RB', label: 'Rechtsverteidiger', x: 82, y: 72 },
    { id: 'LCM', label: 'Doppelsechs Links', x: 37, y: 58 },
    { id: 'DM', label: 'Zehner (ZOM)', x: 50, y: 40 },
    { id: 'RCM', label: 'Doppelsechs Rechts', x: 63, y: 58 },
    { id: 'LW', label: 'Flügel Links', x: 20, y: 34 },
    { id: 'ST', label: ' Mittelstürmer', x: 50, y: 19 },
    { id: 'RW', label: 'Flügel Rechts', x: 80, y: 34 },
  ],
  '4-4-2': [
    { id: 'GK', label: 'Torwart', x: 50, y: 88 },
    { id: 'LB', label: 'Linksverteidiger', x: 18, y: 71 },
    { id: 'LCB', label: 'Innenverteidiger', x: 39, y: 72 },
    { id: 'RCB', label: 'Innenverteidiger', x: 61, y: 72 },
    { id: 'RB', label: 'Rechtsverteidiger', x: 82, y: 71 },
    { id: 'LW', label: 'Linkes Mittelfeld', x: 18, y: 46 },
    { id: 'LCM', label: 'Zentrales Mittelfeld', x: 39, y: 50 },
    { id: 'RCM', label: 'Zentrales Mittelfeld', x: 61, y: 50 },
    { id: 'RW', label: 'Rechtes Mittelfeld', x: 82, y: 46 },
    { id: 'DM', label: 'Hängende Spitze', x: 38, y: 24 },
    { id: 'ST', label: 'Stürmer', x: 62, y: 22 },
  ],
  '3-5-2': [
    { id: 'GK', label: 'Torwart', x: 50, y: 88 },
    { id: 'LB', label: 'Halblinker IV', x: 26, y: 72 },
    { id: 'LCB', label: 'Zentraler IV', x: 50, y: 74 },
    { id: 'RCB', label: 'Halbrechter IV', x: 74, y: 72 },
    { id: 'LW', label: 'Schienenspieler Links', x: 15, y: 48 },
    { id: 'LCM', label: 'Zentrales Mittelfeld', x: 36, y: 53 },
    { id: 'DM', label: 'Spielmacher (ZOM)', x: 50, y: 39 },
    { id: 'RCM', label: 'Zentrales Mittelfeld', x: 64, y: 53 },
    { id: 'RB', label: 'Schienenspieler Rechts', x: 85, y: 48 },
    { id: 'RW', label: 'Stürmer Links', x: 37, y: 21 },
    { id: 'ST', label: 'Stürmer Rechts', x: 63, y: 21 },
  ],
};

export const TACTICAL_PRESETS = [
  { id: 'gegenpressing', label: 'Gegenpressing', tempo: 78, pressure: 82, width: 58 },
  { id: 'possession', label: 'Ballbesitz-Dominanz', tempo: 54, pressure: 65, width: 68 },
  { id: 'counter', label: 'Schnelles Umschalten', tempo: 85, pressure: 48, width: 52 },
  { id: 'compact', label: 'Kompakter Block', tempo: 60, pressure: 38, width: 42 },
];

const slotIds = new Set(SQUAD_SLOTS.map(({ id }) => id));
const emptyStarters = () => Object.fromEntries(SQUAD_SLOTS.map(({ id }) => [id, '']));
const clone = (value) => structuredClone(value);
const fail = (league, error) => ({ league, error });

export function isLeagueHost(league, managerTeamId) {
  return league?.teams?.find((team) => team.managerType === 'human')?.id === managerTeamId;
}

export function canManagerEditTeamSquad(league, teamId, managerTeamId) {
  if (!league || !Array.isArray(league.teams)) return false;
  const team = league.teams.find((entry) => entry.id === teamId);
  const manager = league.teams.find((entry) => entry.id === managerTeamId);
  if (!team || !manager) return false;
  const ownsTeam = team.id === manager.id && manager.managerType === 'human';
  const hostEditsCpu = team.managerType === 'cpu' && manager.managerType === 'human' && isLeagueHost(league, managerTeamId);
  return ownsTeam || hostEditsCpu;
}

export function getTeamRoster(league, teamId, playerPool = []) {
  const pool = new Map(playerPool.map((player) => [player.id, player]));
  return (league?.draft?.picks ?? []).filter((pick) => pick.teamId === teamId).map((pick) => {
    const source = pool.get(pick.playerId) ?? {};
    return {
      ...source,
      ...pick,
      id: pick.playerId,
      name: pick.playerName || pick.name || source.name || 'Spieler',
      position: pick.position || source.position || '',
      rating: pick.rating ?? source.rating ?? 0,
      ratingSource: pick.ratingSource || source.ratingSource || '',
    };
  });
}

export function getFormationSlots(formation = '4-3-3') {
  return FORMATION_PRESETS[formation] || SQUAD_SLOTS;
}

export function getTeamSquad(league, teamId) {
  const saved = league?.squads?.[teamId];
  const allowed = new Set(getTeamRoster(league, teamId).map((player) => player.id));
  const starters = emptyStarters();
  for (const slot of SQUAD_SLOTS) {
    const playerId = saved?.starters?.[slot.id];
    if (playerId && allowed.has(playerId) && !Object.values(starters).includes(playerId)) starters[slot.id] = playerId;
  }
  const result = { formation: saved?.formation || '4-3-3', starters };
  if (saved?.tacticalPreset) result.tacticalPreset = saved.tacticalPreset;
  if (saved?.shirtNumbers && typeof saved.shirtNumbers === 'object') {
    result.shirtNumbers = { ...saved.shirtNumbers };
  }
  return result;
}

export function resolveTeamShirtNumbers(league, teamId, roster = []) {
  const teamRoster = roster.length ? roster : getTeamRoster(league, teamId);
  const saved = league?.squads?.[teamId]?.shirtNumbers ?? {};
  const squad = getTeamSquad(league, teamId);
  const usedNumbers = new Set();
  const assignments = {};

  for (const player of teamRoster) {
    const num = Number(saved[player.id]);
    if (Number.isInteger(num) && num >= 1 && num <= 99 && !usedNumbers.has(num)) {
      assignments[player.id] = num;
      usedNumbers.add(num);
    }
  }

  const slotDefaultNumber = {
    GK: 1,
    RB: 2,
    LB: 3,
    LCB: 4,
    RCB: 5,
    DM: 6,
    RW: 7,
    LCM: 8,
    ST: 9,
    RCM: 10,
    LW: 11,
  };

  for (const [slotId, playerId] of Object.entries(squad.starters)) {
    if (!playerId || assignments[playerId]) continue;
    const preferred = slotDefaultNumber[slotId] || 12;
    if (!usedNumbers.has(preferred)) {
      assignments[playerId] = preferred;
      usedNumbers.add(preferred);
    }
  }

  let nextCandidate = 1;
  for (const player of teamRoster) {
    if (assignments[player.id]) continue;
    const pos = String(player.position || 'CM').toUpperCase();
    const posPreferred = pos.includes('GK') ? [1, 12, 23]
      : pos.includes('ST') || pos.includes('CF') ? [9, 19, 11, 20]
      : pos.includes('AM') ? [10, 8, 14, 21]
      : pos.includes('LW') || pos.includes('RW') ? [7, 11, 17, 22]
      : pos.includes('CB') ? [4, 5, 15, 24]
      : pos.includes('LB') || pos.includes('RB') ? [2, 3, 16, 25]
      : [6, 8, 13, 18];
    const freePref = posPreferred.find((n) => !usedNumbers.has(n));
    if (freePref) {
      assignments[player.id] = freePref;
      usedNumbers.add(freePref);
      continue;
    }
    while (usedNumbers.has(nextCandidate) && nextCandidate < 99) nextCandidate += 1;
    assignments[player.id] = nextCandidate;
    usedNumbers.add(nextCandidate);
  }

  return assignments;
}

export function setStartingPlayer(league, teamId, slotId, playerId, managerTeamId) {
  if (!league || !Array.isArray(league.teams)) return fail(league, 'Liga nicht gefunden.');
  if (!slotIds.has(slotId)) return fail(league, 'Unbekannte Position.');
  const team = league.teams.find((entry) => entry.id === teamId);
  const manager = league.teams.find((entry) => entry.id === managerTeamId);
  if (!team || !manager) return fail(league, 'Manager-Team nicht gefunden.');
  if (!canManagerEditTeamSquad(league, teamId, managerTeamId)) {
    return fail(league, 'Du bist für diese Aufstellung nicht berechtigt.');
  }

  const roster = getTeamRoster(league, teamId);
  if (playerId && !roster.some((player) => player.id === playerId)) return fail(league, 'Dieser Spieler ist nicht im Kader dieses Teams.');
  const squad = getTeamSquad(league, teamId);
  const starters = { ...squad.starters };
  const sourceSlot = playerId ? Object.keys(starters).find((id) => starters[id] === playerId) : undefined;
  const targetPlayer = starters[slotId];

  if (!playerId) {
    starters[slotId] = '';
  } else if (sourceSlot && sourceSlot !== slotId) {
    starters[slotId] = playerId;
    starters[sourceSlot] = targetPlayer || '';
  } else {
    starters[slotId] = playerId;
  }

  const next = clone(league);
  next.squads ??= {};
  const nextEntry = { formation: squad.formation, starters };
  if (squad.tacticalPreset) nextEntry.tacticalPreset = squad.tacticalPreset;
  if (squad.shirtNumbers) nextEntry.shirtNumbers = squad.shirtNumbers;
  next.squads[teamId] = nextEntry;
  return { league: next };
}

export function setSquadFormation(league, teamId, formation, managerTeamId) {
  if (!league || !Array.isArray(league.teams)) return fail(league, 'Liga nicht gefunden.');
  if (!FORMATION_PRESETS[formation]) return fail(league, 'Unbekannte Formation.');
  if (!canManagerEditTeamSquad(league, teamId, managerTeamId)) {
    return fail(league, 'Du bist für diese Aufstellung nicht berechtigt.');
  }
  const squad = getTeamSquad(league, teamId);
  const next = clone(league);
  next.squads ??= {};
  next.squads[teamId] = {
    ...next.squads[teamId],
    formation,
    starters: squad.starters,
  };
  return { league: next, formation };
}

export function setSquadTacticalPreset(league, teamId, tacticalPreset, managerTeamId) {
  if (!league || !Array.isArray(league.teams)) return fail(league, 'Liga nicht gefunden.');
  if (!TACTICAL_PRESETS.some((p) => p.id === tacticalPreset)) return fail(league, 'Unbekannte Taktik-Vorgabe.');
  if (!canManagerEditTeamSquad(league, teamId, managerTeamId)) {
    return fail(league, 'Du bist für diese Aufstellung nicht berechtigt.');
  }
  const squad = getTeamSquad(league, teamId);
  const next = clone(league);
  next.squads ??= {};
  next.squads[teamId] = {
    ...next.squads[teamId],
    formation: squad.formation,
    starters: squad.starters,
    tacticalPreset,
  };
  return { league: next, tacticalPreset };
}

export function setPlayerShirtNumber(league, teamId, playerId, shirtNumber, managerTeamId) {
  if (!league || !Array.isArray(league.teams)) return fail(league, 'Liga nicht gefunden.');
  if (!canManagerEditTeamSquad(league, teamId, managerTeamId)) {
    return fail(league, 'Du bist für diese Rückennummern nicht berechtigt.');
  }
  const num = Number(shirtNumber);
  if (!Number.isInteger(num) || num < 1 || num > 99) {
    return fail(league, 'Rückennummer muss zwischen 1 und 99 liegen.');
  }
  const roster = getTeamRoster(league, teamId);
  if (!roster.some((p) => p.id === playerId)) {
    return fail(league, 'Spieler gehört nicht zu diesem Kader.');
  }
  const currentNumbers = resolveTeamShirtNumbers(league, teamId, roster);
  const previousNumber = currentNumbers[playerId];
  const occupantId = Object.keys(currentNumbers).find((id) => id !== playerId && currentNumbers[id] === num);
  currentNumbers[playerId] = num;
  if (occupantId && previousNumber) {
    currentNumbers[occupantId] = previousNumber;
  }

  const squad = getTeamSquad(league, teamId);
  const next = clone(league);
  next.squads ??= {};
  next.squads[teamId] = {
    ...next.squads[teamId],
    formation: squad.formation,
    starters: squad.starters,
    ...(squad.tacticalPreset ? { tacticalPreset: squad.tacticalPreset } : {}),
    shirtNumbers: currentNumbers,
  };
  return { league: next, shirtNumber: num };
}

export function evaluateSlotFit(pos = '', slotId = 'ST') {
  const raw = String(pos || '').toUpperCase().trim();
  const tokens = raw.split(/[/,\s-]+/).filter(Boolean);
  const primary = tokens[0] || 'CM';

  const isGK = (p) => ['GK', 'TW', 'TORWART', 'GOALKEEPER'].some((t) => p.includes(t));
  const isLB = (p) => ['LB', 'LWB', 'LV', 'LINKSVERTEIDIGER'].some((t) => p === t || p.startsWith('LB'));
  const isRB = (p) => ['RB', 'RWB', 'RV', 'RECHTSVERTEIDIGER'].some((t) => p === t || p.startsWith('RB'));
  const isCB = (p) => ['CB', 'IV', 'DC', 'SW', 'INNENVERTEIDIGER'].some((t) => p === t || p.startsWith('CB'));
  const isDM = (p) => ['DM', 'CDM', 'ZDM'].some((t) => p === t || p.startsWith('DM') || p.startsWith('CDM'));
  const isCM = (p) => ['CM', 'ZM', 'ZENTRALES'].some((t) => p === t || p.startsWith('CM') || p.startsWith('ZM'));
  const isAM = (p) => ['AM', 'CAM', 'ZOM', 'OFFENSIVES'].some((t) => p === t || p.startsWith('CAM') || p.startsWith('AM') || p.startsWith('ZOM'));
  const isLW = (p) => ['LW', 'LM', 'LA', 'LINKES', 'LINKSAUSSEN'].some((t) => p === t || p.startsWith('LW') || p.startsWith('LM'));
  const isRW = (p) => ['RW', 'RM', 'RA', 'RECHTES', 'RECHTSAUSSEN'].some((t) => p === t || p.startsWith('RW') || p.startsWith('RM'));
  const isST = (p) => ['ST', 'CF', 'MS', 'HS', 'STUERMER', 'STRIKER'].some((t) => p === t || p.startsWith('ST') || p.startsWith('CF'));

  if (slotId === 'GK') {
    if (tokens.some(isGK)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Torwart' };
    return { fit: 10, penalty: -45, status: 'poor', roleLabel: 'Notlösung im Tor' };
  }
  if (tokens.some(isGK)) {
    return { fit: 10, penalty: -45, status: 'poor', roleLabel: 'Torwart im Feld' };
  }

  switch (slotId) {
    case 'LB':
      if (tokens.some(isLB)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Linksverteidiger' };
      if (tokens.some(isCB)) return { fit: 80, penalty: -8, status: 'good', roleLabel: 'Innenverteidiger als LV' };
      if (tokens.some(isRB)) return { fit: 76, penalty: -10, status: 'fair', roleLabel: 'Rechtsverteidiger auf links' };
      if (tokens.some(isDM)) return { fit: 70, penalty: -12, status: 'fair', roleLabel: 'Sechser als LV' };
      if (tokens.some(isLW)) return { fit: 65, penalty: -15, status: 'fair', roleLabel: 'Flügelspieler als LV' };
      return { fit: 50, penalty: -22, status: 'poor', roleLabel: 'Ausweich-Position' };

    case 'RB':
      if (tokens.some(isRB)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Rechtsverteidiger' };
      if (tokens.some(isCB)) return { fit: 80, penalty: -8, status: 'good', roleLabel: 'Innenverteidiger als RV' };
      if (tokens.some(isLB)) return { fit: 76, penalty: -10, status: 'fair', roleLabel: 'Linksverteidiger auf rechts' };
      if (tokens.some(isDM)) return { fit: 70, penalty: -12, status: 'fair', roleLabel: 'Sechser als RV' };
      if (tokens.some(isRW)) return { fit: 65, penalty: -15, status: 'fair', roleLabel: 'Flügelspieler als RV' };
      return { fit: 50, penalty: -22, status: 'poor', roleLabel: 'Ausweich-Position' };

    case 'LCB':
    case 'RCB':
      if (tokens.some(isCB)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Innenverteidiger' };
      if (tokens.some(isDM)) return { fit: 85, penalty: -6, status: 'good', roleLabel: 'Sechser in der IV' };
      if (tokens.some(isLB) || tokens.some(isRB)) return { fit: 78, penalty: -9, status: 'fair', roleLabel: 'Außenverteidiger als IV' };
      return { fit: 45, penalty: -22, status: 'poor', roleLabel: 'Ausweich-Position' };

    case 'DM':
      if (tokens.some(isDM)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Sechser (ZDM)' };
      if (tokens.some(isCM)) return { fit: 88, penalty: -4, status: 'good', roleLabel: 'Achter als Sechser' };
      if (tokens.some(isCB)) return { fit: 80, penalty: -8, status: 'good', roleLabel: 'Innenverteidiger auf der Sechs' };
      if (tokens.some(isAM)) return { fit: 72, penalty: -11, status: 'fair', roleLabel: 'Spielmacher defensiv' };
      return { fit: 50, penalty: -20, status: 'poor', roleLabel: 'Ausweich-Position' };

    case 'LCM':
    case 'RCM':
      if (tokens.some(isCM)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Achter (ZM)' };
      if (tokens.some(isAM)) return { fit: 95, penalty: -1, status: 'perfect', roleLabel: 'Zehner im zentralen Mittelfeld' };
      if (tokens.some(isDM)) return { fit: 88, penalty: -4, status: 'good', roleLabel: 'Sechser im zentralen Mittelfeld' };
      if (slotId === 'LCM' && tokens.some(isLW)) return { fit: 78, penalty: -9, status: 'good', roleLabel: 'Linker Flügel im Zentrum' };
      if (slotId === 'RCM' && tokens.some(isRW)) return { fit: 78, penalty: -9, status: 'good', roleLabel: 'Rechter Flügel im Zentrum' };
      return { fit: 50, penalty: -20, status: 'poor', roleLabel: 'Ausweich-Position' };

    case 'LW':
      if (tokens.some(isLW)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Linksaußen' };
      if (tokens.some(isRW)) return { fit: 86, penalty: -5, status: 'good', roleLabel: 'Rechtsaußen auf Linksaußen' };
      if (tokens.some(isAM)) return { fit: 84, penalty: -6, status: 'good', roleLabel: 'Zehner auf dem Flügel' };
      if (tokens.some(isST)) return { fit: 82, penalty: -7, status: 'good', roleLabel: 'Stürmer auf dem Flügel' };
      if (tokens.some(isCM)) return { fit: 70, penalty: -12, status: 'fair', roleLabel: 'Zentraler Mittelfeldspieler auf Außen' };
      return { fit: 45, penalty: -22, status: 'poor', roleLabel: 'Ausweich-Position' };

    case 'RW':
      if (tokens.some(isRW)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Rechtsaußen' };
      if (tokens.some(isLW)) return { fit: 86, penalty: -5, status: 'good', roleLabel: 'Linksaußen auf Rechtsaußen' };
      if (tokens.some(isAM)) return { fit: 84, penalty: -6, status: 'good', roleLabel: 'Zehner auf dem Flügel' };
      if (tokens.some(isST)) return { fit: 82, penalty: -7, status: 'good', roleLabel: 'Stürmer auf dem Flügel' };
      if (tokens.some(isCM)) return { fit: 70, penalty: -12, status: 'fair', roleLabel: 'Zentraler Mittelfeldspieler auf Außen' };
      return { fit: 45, penalty: -22, status: 'poor', roleLabel: 'Ausweich-Position' };

    case 'ST':
      if (tokens.some(isST)) return { fit: 100, penalty: 0, status: 'perfect', roleLabel: 'Stamm-Mittelstürmer' };
      if (tokens.some(isLW) || tokens.some(isRW)) return { fit: 84, penalty: -6, status: 'good', roleLabel: 'Flügelspieler im Sturmzentrum' };
      if (tokens.some(isAM)) return { fit: 80, penalty: -8, status: 'good', roleLabel: 'Hängende Spitze / Zehner' };
      return { fit: 40, penalty: -24, status: 'poor', roleLabel: 'Ausweich-Position' };

    default:
      return { fit: 70, penalty: -8, status: 'fair', roleLabel: 'Allrounder' };
  }
}

export function autoFillStartingEleven(league, teamId, playerPool = [], managerTeamId = '') {
  if (!league || !Array.isArray(league.teams)) return fail(league, 'Liga nicht gefunden.');
  if (managerTeamId && !canManagerEditTeamSquad(league, teamId, managerTeamId)) {
    return fail(league, 'Du bist für diese Aufstellung nicht berechtigt.');
  }
  const roster = getTeamRoster(league, teamId, playerPool);
  if (!roster.length) return fail(league, 'Noch keine Spieler im Kader.');
  const squad = getTeamSquad(league, teamId);
  const usedIds = new Set();
  const starters = emptyStarters();

  // Pass 1: Assign natural role specialists (fit >= 90) in strict priority order
  const slotPriorityOrder = ['GK', 'ST', 'LW', 'RW', 'LB', 'RB', 'LCB', 'RCB', 'DM', 'LCM', 'RCM'];

  for (const slotId of slotPriorityOrder) {
    const naturalCandidates = roster
      .filter((p) => !usedIds.has(p.id) && evaluateSlotFit(p.position, slotId).fit >= 90)
      .sort((a, b) => {
        const aFit = evaluateSlotFit(a.position, slotId).fit;
        const bFit = evaluateSlotFit(b.position, slotId).fit;
        if (bFit !== aFit) return bFit - aFit;
        return (Number(b.rating) || 75) - (Number(a.rating) || 75);
      });

    if (naturalCandidates.length > 0) {
      starters[slotId] = naturalCandidates[0].id;
      usedIds.add(naturalCandidates[0].id);
    }
  }

  // Pass 2: Fill any remaining open slots using tactical fit + rating fallback
  for (const slotId of slotPriorityOrder) {
    if (starters[slotId]) continue;
    const candidates = roster.filter((p) => !usedIds.has(p.id));
    if (!candidates.length) break;

    const sorted = [...candidates].sort((a, b) => {
      const aFit = evaluateSlotFit(a.position, slotId);
      const bFit = evaluateSlotFit(b.position, slotId);
      const aEffective = (Number(a.rating) || 75) + aFit.penalty;
      const bEffective = (Number(b.rating) || 75) + bFit.penalty;
      if (bEffective !== aEffective) return bEffective - aEffective;
      return (Number(b.rating) || 75) - (Number(a.rating) || 75);
    });

    const chosen = sorted[0];
    if (chosen) {
      starters[slotId] = chosen.id;
      usedIds.add(chosen.id);
    }
  }

  // Calculate detailed squad analysis for complete transparency
  const starterDetails = {};
  let totalRating = 0;
  let perfectCount = 0;
  for (const [slotId, pid] of Object.entries(starters)) {
    const pl = roster.find((p) => p.id === pid);
    if (pl) {
      const fit = evaluateSlotFit(pl.position, slotId);
      starterDetails[slotId] = {
        playerId: pid,
        playerName: pl.name,
        position: pl.position,
        rating: pl.rating,
        fit: fit.fit,
        status: fit.status,
        roleLabel: fit.roleLabel,
      };
      totalRating += (Number(pl.rating) || 75);
      if (fit.fit >= 90) perfectCount += 1;
    }
  }
  const avgRating = (totalRating / 11).toFixed(1);
  const analysis = {
    avgRating: Number(avgRating),
    perfectCount,
    summaryText: `Startelf optimiert: ${perfectCount}/11 auf Ideal-Position · Ø ${avgRating} OVR`,
    starters: starterDetails,
  };

  const next = clone(league);
  next.squads ??= {};
  next.squads[teamId] = {
    ...next.squads[teamId],
    formation: squad.formation,
    starters,
    analysis,
    ...(squad.tacticalPreset ? { tacticalPreset: squad.tacticalPreset } : {}),
    shirtNumbers: resolveTeamShirtNumbers(league, teamId, roster),
  };
  return { league: next, starters, analysis };
}

