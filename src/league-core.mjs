export const MAX_DRAFT_POOL = 1800;
export const MAX_PICKS_PER_TEAM = 30;

export function getDraftTargetPicks(teamCount = 30, playerCount = 0) {
  return Math.min(Math.max(0, Number(playerCount) || 0), Math.max(1, Number(teamCount) || 30) * MAX_PICKS_PER_TEAM);
}

export function canManagerPick(team, activeManager) {
  return Boolean(team && activeManager && team.managerType === 'human' && team.id === activeManager.id);
}

export function canManagerSimulateCpu(team, activeManager, adminName) {
  return Boolean(team && activeManager && team.managerType === 'cpu' && activeManager.managerName === adminName);
}

export function buildSnakeOrder(teamIds, rounds) {
  if (!Array.isArray(teamIds) || teamIds.length === 0 || !Number.isInteger(rounds) || rounds < 0) {
    return [];
  }
  const order = [];
  for (let round = 0; round < rounds; round += 1) {
    const row = round % 2 === 0 ? teamIds : [...teamIds].reverse();
    order.push(...row);
  }
  return order;
}

export function chooseCpuPick(players, draftedIds = []) {
  const drafted = new Set(draftedIds);
  return players
    .filter((player) => !drafted.has(player.id))
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || a.name.localeCompare(b.name))[0] ?? null;
}

function detectDelimiter(text) {
  const firstLine = String(text).split(/\r?\n/, 1)[0] ?? '';
  let quoted = false;
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (let index = 0; index < firstLine.length; index += 1) {
    if (firstLine[index] === '"') quoted = !quoted;
    else if (!quoted && Object.hasOwn(counts, firstLine[index])) counts[firstLine[index]] += 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const slug = (value) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseRosterCsv(text, limit = MAX_DRAFT_POOL) {
  const csvText = String(text ?? '').replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(csvText);
  const [headers = [], ...rows] = parseRows(csvText, delimiter);
  const normalized = headers.map((header) => header.toLowerCase().trim().replace(/[\s-]+/g, '_'));
  const nameIndex = ['player_name', 'name', 'player'].map((key) => normalized.indexOf(key)).find((index) => index >= 0);
  if (nameIndex === undefined) throw new Error('CSV needs a player_name or name column.');
  const getIndex = (...keys) => keys.map((key) => normalized.indexOf(key)).find((index) => index >= 0);
  const clubIndex = getIndex('club', 'currentclub', 'current_club', 'team', 'club_name');
  const originClubIndex = getIndex('originclub', 'origin_club');
  const positionIndex = getIndex('position', 'pos');
  const ratingIndex = getIndex('overall', 'ovr', 'rating', 'ca', 'current_ability', 'ability', 'fmb_abi', 'abi');
  const ratingSource = ['fmb_abi', 'abi'].some((key) => normalized.includes(key)) ? 'FMB ABI' : '';
  const sourcePlayerIdIndex = getIndex('source_player_id', 'pes_id', 'player_id', 'external_id');
  const potentialIndex = getIndex('fmb_potential', 'potential', 'pa');
  const nationalityIndex = getIndex('nationality', 'nation', 'country');
  const ageIndex = getIndex('age');
  const coachIndex = getIndex('coach', 'manager', 'head_coach');
  const footIndex = getIndex('foot', 'strong_foot');
  const styleIndex = getIndex('playingstyle', 'playing_style');
  const hexIdx = {
    SHO: getIndex('sho'),
    DRI: getIndex('dri'),
    PAS: getIndex('pas'),
    PAC: getIndex('pac'),
    PHY: getIndex('phy'),
    DEF: getIndex('def'),
  };
  const attrIdx = {
    finishing: getIndex('finishing'),
    dribbling: getIndex('dribbling'),
    ballControl: getIndex('ballcontrol', 'ball_control'),
    tightPossession: getIndex('tightpossession', 'tight_possession'),
    lowPass: getIndex('lowpass', 'low_pass'),
    loftedPass: getIndex('loftedpass', 'lofted_pass'),
    speed: getIndex('speed'),
    acceleration: getIndex('acceleration'),
    kickingPower: getIndex('kickingpower', 'kicking_power'),
    physicalContact: getIndex('physicalcontact', 'physical_contact'),
    stamina: getIndex('stamina'),
    defensiveAwareness: getIndex('defensiveawareness', 'defensive_awareness'),
    ballWinning: getIndex('ballwinning', 'ball_winning'),
  };
  const genderIndex = getIndex('gender', 'sex', 'geschlecht');
  const maleValues = new Set(['m', 'male', 'man', 'men', 'männlich', 'maennlich', 'männer', 'maenner']);
  const players = rows.map((row, index) => {
    const name = row[nameIndex]?.trim();
    const club = clubIndex === undefined ? '' : row[clubIndex]?.trim() ?? '';
    const originClub = originClubIndex === undefined ? '' : row[originClubIndex]?.trim() ?? '';
    const sourcePlayerId = sourcePlayerIdIndex === undefined ? '' : row[sourcePlayerIdIndex]?.trim() ?? '';
    const ratingText = ratingIndex === undefined ? '' : row[ratingIndex]?.trim() ?? '';
    const ratingMatch = ratingText.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
    const rating = ratingMatch ? Number(ratingMatch[0]) : 0;
    const gender = genderIndex === undefined ? '' : row[genderIndex]?.trim().toLowerCase() ?? '';
    const hexagon = {};
    for (const [key, idx] of Object.entries(hexIdx)) {
      if (idx !== undefined && Number(row[idx])) hexagon[key] = Number(row[idx]);
    }
    const attributes = {};
    for (const [key, idx] of Object.entries(attrIdx)) {
      if (idx !== undefined && Number(row[idx])) attributes[key] = Number(row[idx]);
    }
    return {
      id: sourcePlayerId ? `fm26-${slug(sourcePlayerId)}` : `${slug(name || `player-${index + 1}`)}-${slug(club || 'club')}-${index + 1}`,
      name,
      club,
      ...(originClub ? { originClub } : {}),
      position: positionIndex === undefined ? '' : row[positionIndex]?.trim() ?? '',
      coach: coachIndex === undefined ? '' : row[coachIndex]?.trim() ?? '',
      rating,
      ...(ratingSource ? { ratingSource } : {}),
      ...(sourcePlayerId ? { sourcePlayerId } : {}),
      ...(potentialIndex === undefined || !row[potentialIndex]?.trim() ? {} : { potential: Number(row[potentialIndex].trim()) || 0 }),
      ...(nationalityIndex === undefined || !row[nationalityIndex]?.trim() ? {} : { nationality: row[nationalityIndex].trim() }),
      ...(ageIndex === undefined || !row[ageIndex]?.trim() ? {} : { age: Number(row[ageIndex].trim()) || 0 }),
      ...(footIndex === undefined || !row[footIndex]?.trim() ? {} : { foot: row[footIndex].trim(), importedFoot: row[footIndex].trim() }),
      ...(styleIndex === undefined || !row[styleIndex]?.trim() ? {} : { playingStyle: row[styleIndex].trim(), importedPlayingStyle: row[styleIndex].trim() }),
      ...(Object.keys(hexagon).length ? { hexagon, importedHexagon: hexagon } : {}),
      ...(Object.keys(attributes).length ? { attributes, importedAttributes: attributes } : {}),
      gender,
    };
  }).filter((player) => player.name && (genderIndex === undefined || !player.gender || maleValues.has(player.gender)));

  if (players.length > limit && !players.some((player) => player.rating > 0)) {
    throw new Error(`CSV enthält mehr als ${limit} Spieler, aber keine verwertbaren Bewertungen zum Auswählen der besten Spieler.`);
  }
  if (players.length > limit && ratingIndex === undefined) {
    throw new Error(`CSV enthält mehr als ${limit} Spieler und keine Bewertungs-Spalte (overall, rating oder current ability).`);
  }
  return (ratingIndex === undefined ? players : players.sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)))
    .slice(0, limit).map(({ gender: _gender, ...player }) => player);
}

export function mergeRosterPools(existingPlayers = [], addedPlayers = [], limit = MAX_DRAFT_POOL) {
  const merged = [...existingPlayers];
  const knownIds = new Set(existingPlayers.map((player) => player.id));
  const normalize = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const knownNames = new Set(existingPlayers.map((player) => `${normalize(player.name)}|${normalize(player.club)}`));
  for (const player of addedPlayers) {
    if (merged.length >= limit) break;
    const key = `${normalize(player.name)}|${normalize(player.club)}`;
    if (!player.id || knownIds.has(player.id) || knownNames.has(key)) continue;
    merged.push(player);
    knownIds.add(player.id);
    knownNames.add(key);
  }
  return merged;
}

export function simulateCpuPicksUntilHumanTurn(teams, order, existingPicks, players) {
  const picks = [...existingPicks];
  if (!Array.isArray(order) || order.length === 0) return picks;
  const drafted = new Set(picks.map((pick) => pick.playerId));
  const targetPicks = getDraftTargetPicks(order.length, players.length);
  while (picks.length < targetPicks) {
    const round = Math.floor(picks.length / order.length);
    const offset = picks.length % order.length;
    const teamId = order[round % 2 === 0 ? offset : order.length - 1 - offset];
    const team = teams.find((entry) => entry.id === teamId);
    if (!team || team.managerType !== 'cpu') break;
    const player = chooseCpuPick(players, [...drafted]);
    if (!player) break;
    picks.push({
      playerId: player.id,
      playerName: player.name,
      ...(player.position ? { position: player.position } : {}),
      rating: player.rating,
      teamId: team.id,
      teamName: team.name,
      managerName: team.managerName,
      number: picks.length + 1,
      round: round + 1,
    });
    drafted.add(player.id);
  }
  return picks;
}

export function canManagerAutoDraft(activeManager, adminName) {
  return Boolean(activeManager && activeManager.managerName === adminName);
}

export function autoDraftAllPicks(teams, order, existingPicks = [], players = [], now = () => new Date().toISOString()) {
  const picks = [...existingPicks];
  if (!Array.isArray(order) || order.length === 0 || !Array.isArray(players) || players.length === 0) {
    return picks;
  }
  const drafted = new Set(picks.map((pick) => pick.playerId));
  const remaining = players
    .filter((player) => !drafted.has(player.id))
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || a.name.localeCompare(b.name));
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const timestamp = now();
  const targetPicks = getDraftTargetPicks(order.length, players.length);

  for (const player of remaining) {
    if (picks.length >= targetPicks) break;
    const round = Math.floor(picks.length / order.length);
    const offset = picks.length % order.length;
    const teamId = order[round % 2 === 0 ? offset : order.length - 1 - offset];
    const team = teamById.get(teamId);
    if (!team) break;
    picks.push({
      playerId: player.id,
      playerName: player.name,
      ...(player.position ? { position: player.position } : {}),
      rating: player.rating,
      teamId: team.id,
      teamName: team.name,
      managerName: team.managerName,
      number: picks.length + 1,
      round: round + 1,
      at: timestamp,
    });
    drafted.add(player.id);
  }
  return picks;
}

export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function assignManagersToTeams(selectedIds = [], setupManagers = [], allTeams = [], startingBudget = 150) {
  const validManagers = (setupManagers || []).map((m, idx) => ({
    id: m.id || `mgr-${idx + 1}`,
    name: (m.name || '').trim() || (idx === 0 ? 'Admin' : `Manager ${idx + 1}`),
    teamId: m.teamId,
  }));

  const managerByTeamId = new Map();
  const assignedTeamIds = new Set();
  for (const mgr of validManagers) {
    if (selectedIds.includes(mgr.teamId) && !assignedTeamIds.has(mgr.teamId)) {
      managerByTeamId.set(mgr.teamId, mgr);
      assignedTeamIds.add(mgr.teamId);
    } else {
      const fallbackTeamId = selectedIds.find((id) => !assignedTeamIds.has(id));
      if (fallbackTeamId) {
        managerByTeamId.set(fallbackTeamId, mgr);
        assignedTeamIds.add(fallbackTeamId);
      }
    }
  }

  let cpuCounter = 1;
  const teams = selectedIds.map((id) => {
    const team = allTeams.find((entry) => entry.id === id) || { id, name: id, league: 'Custom' };
    const humanMgr = managerByTeamId.get(id);
    if (humanMgr) {
      return {
        ...team,
        managerType: 'human',
        managerName: humanMgr.name,
        budget: startingBudget,
      };
    }
    const cpuName = `CPU ${cpuCounter++}`;
    return {
      ...team,
      managerType: 'cpu',
      managerName: cpuName,
      budget: startingBudget,
    };
  });

  return {
    teams,
    humanCount: managerByTeamId.size,
    adminName: validManagers[0]?.name || 'Admin',
  };
}


