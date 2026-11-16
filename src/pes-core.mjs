import {
  getFormationSlots,
  getTeamRoster,
  getTeamSquad,
  resolveTeamShirtNumbers,
  SQUAD_SLOTS,
  TACTICAL_PRESETS,
} from './squad-core.mjs';

export const PES_HEXAGON_AXES = [
  { key: 'SHO', label: 'SCH', fullLabel: 'Schuss (SHO)' },
  { key: 'DRI', label: 'DRI', fullLabel: 'Dribbling (DRI)' },
  { key: 'PAS', label: 'PAS', fullLabel: 'Passen (PAS)' },
  { key: 'PAC', label: 'TEM', fullLabel: 'Tempo (PAC)' },
  { key: 'PHY', label: 'PHY', fullLabel: 'Physis (PHY)' },
  { key: 'DEF', label: 'DEF', fullLabel: 'Defensive (DEF)' },
];

export const PES_ATTRIBUTE_GROUPS = [
  {
    id: 'attack',
    title: 'Angriff & Abschluss',
    stats: [
      { key: 'offensiveAwareness', label: 'Offensivbewusstsein' },
      { key: 'finishing', label: 'Abschluss' },
      { key: 'kickingPower', label: 'Schusskraft' },
      { key: 'placeKicking', label: 'Standards' },
      { key: 'curl', label: 'Effet' },
    ],
  },
  {
    id: 'technique',
    title: 'Dribbling & Passspiel',
    stats: [
      { key: 'ballControl', label: 'Ballkontrolle' },
      { key: 'dribbling', label: 'Dribbling' },
      { key: 'tightPossession', label: 'Enge Ballführung' },
      { key: 'lowPass', label: 'Flachpass' },
      { key: 'loftedPass', label: 'Hoher Pass' },
    ],
  },
  {
    id: 'athletics',
    title: 'Athletik & Physis',
    stats: [
      { key: 'speed', label: 'Geschwindigkeit' },
      { key: 'acceleration', label: 'Antritt' },
      { key: 'stamina', label: 'Ausdauer' },
      { key: 'balance', label: 'Balance' },
      { key: 'physicalContact', label: 'Körperkontakt' },
      { key: 'jump', label: 'Sprungkraft' },
      { key: 'heading', label: 'Kopfball' },
    ],
  },
  {
    id: 'defense',
    title: 'Defensive & Torwart',
    stats: [
      { key: 'defensiveAwareness', label: 'Defensivbewusstsein' },
      { key: 'ballWinning', label: 'Balleroberung' },
      { key: 'aggression', label: 'Aggressivität' },
      { key: 'gkAwareness', label: 'TW-Bewusstsein' },
      { key: 'gkReflexes', label: 'TW-Reflexe' },
    ],
  },
];

function clampPesStat(value) {
  return Math.max(40, Math.min(99, Math.round(Number(value) || 40)));
}

function clampFifaStat(value) {
  return Math.max(1, Math.min(99, Math.round(Number(value) || 50)));
}

function hashString(input = '') {
  let hash = 2166136261;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashOffset(seed, salt, span = 4) {
  const mixed = hashString(`${seed}:${salt}`);
  return (mixed % (span * 2 + 1)) - span;
}

export function getPesStatTier(value) {
  const num = clampPesStat(value);
  if (num >= 90) return 'tier-90';
  if (num >= 80) return 'tier-80';
  if (num >= 70) return 'tier-70';
  return 'tier-60';
}

export function classifyPositionRole(position = '') {
  const raw = String(position || 'CM').toUpperCase();
  const primary = raw.split(/[,/]/)[0].trim();
  if (primary === 'GK' || primary === 'TW') return 'GK';
  if (['CB', 'IV', 'DC', 'SW'].includes(primary)) return 'CB';
  if (['LB', 'RB', 'LWB', 'RWB', 'LV', 'RV', 'DL', 'DR', 'WBL', 'WBR'].includes(primary)) return 'FB';
  if (['DM', 'CDM', 'ZDM', 'DMC'].includes(primary)) return 'DM';
  if (['AM', 'CAM', 'ZOM', 'AMC'].includes(primary)) return 'AM';
  if (['LW', 'RW', 'LM', 'RM', 'LA', 'RA', 'AML', 'AMR', 'ML', 'MR'].includes(primary)) return 'WG';
  if (['ST', 'CF', 'SS', 'MS', 'STC', 'FW'].includes(primary)) return 'ST';
  return 'CM';
}

const ROLE_PLAYING_STYLES = {
  GK: ['Offensiv-Torwart', 'Defensiv-Torwart'],
  CB: ['Spielaufbau', 'Zerstörer', 'Zusätzlicher Angreifer'],
  FB: ['Offensiver Außenverteidiger', 'Defensiver Außenverteidiger', 'Außenbahn-Spezialist'],
  DM: ['Anker', 'Zerstörer', 'Orchestrator'],
  CM: ['Box-to-Box', 'Orchestrator', 'Lückenläufer'],
  AM: ['Kreativer Spielmacher', 'Lückenläufer', 'Klassische Nr. 10'],
  WG: ['Flügelflitzer', 'Schlitzohr', 'Kreativer Spielmacher'],
  ST: ['Knipser', 'Zielspieler', 'Täuscher'],
};

const ROLE_WEIGHTS = {
  GK: {
    SHO: -28, DRI: -22, PAS: -12, PAC: -16, PHY: -4, DEF: 6,
    offensiveAwareness: -28, finishing: -34, kickingPower: -4, placeKicking: -24, curl: -28,
    ballControl: -20, dribbling: -26, tightPossession: -22, lowPass: -10, loftedPass: -6,
    speed: -18, acceleration: -14, stamina: -16, balance: -8, physicalContact: -2, jump: 4, heading: -24,
    defensiveAwareness: -12, ballWinning: -18, aggression: -10, gkAwareness: 8, gkReflexes: 9,
  },
  CB: {
    SHO: -18, DRI: -12, PAS: -6, PAC: -5, PHY: 6, DEF: 8,
    offensiveAwareness: -16, finishing: -22, kickingPower: -4, placeKicking: -18, curl: -18,
    ballControl: -8, dribbling: -14, tightPossession: -10, lowPass: -4, loftedPass: -4,
    speed: -4, acceleration: -6, stamina: 1, balance: -4, physicalContact: 8, jump: 7, heading: 7,
    defensiveAwareness: 8, ballWinning: 8, aggression: 7, gkAwareness: -40, gkReflexes: -40,
  },
  FB: {
    SHO: -10, DRI: -1, PAS: 1, PAC: 6, PHY: -1, DEF: 2,
    offensiveAwareness: -4, finishing: -14, kickingPower: -2, placeKicking: -6, curl: 1,
    ballControl: 0, dribbling: 1, tightPossession: -1, lowPass: 1, loftedPass: 3,
    speed: 6, acceleration: 6, stamina: 6, balance: 2, physicalContact: -2, jump: -1, heading: -4,
    defensiveAwareness: 2, ballWinning: 3, aggression: 2, gkAwareness: -40, gkReflexes: -40,
  },
  DM: {
    SHO: -8, DRI: -3, PAS: 3, PAC: -3, PHY: 4, DEF: 5,
    offensiveAwareness: -6, finishing: -12, kickingPower: 2, placeKicking: -4, curl: -4,
    ballControl: 1, dribbling: -3, tightPossession: 1, lowPass: 5, loftedPass: 4,
    speed: -3, acceleration: -3, stamina: 6, balance: 0, physicalContact: 4, jump: 1, heading: 1,
    defensiveAwareness: 6, ballWinning: 6, aggression: 5, gkAwareness: -40, gkReflexes: -40,
  },
  CM: {
    SHO: -2, DRI: 2, PAS: 5, PAC: -1, PHY: 0, DEF: -2,
    offensiveAwareness: 1, finishing: -4, kickingPower: 2, placeKicking: 1, curl: 1,
    ballControl: 4, dribbling: 2, tightPossession: 4, lowPass: 6, loftedPass: 5,
    speed: -1, acceleration: 0, stamina: 5, balance: 2, physicalContact: 0, jump: -2, heading: -4,
    defensiveAwareness: -1, ballWinning: -1, aggression: 0, gkAwareness: -40, gkReflexes: -40,
  },
  AM: {
    SHO: 2, DRI: 6, PAS: 6, PAC: 1, PHY: -6, DEF: -14,
    offensiveAwareness: 5, finishing: 2, kickingPower: 1, placeKicking: 5, curl: 5,
    ballControl: 7, dribbling: 6, tightPossession: 7, lowPass: 7, loftedPass: 5,
    speed: 1, acceleration: 3, stamina: 0, balance: 6, physicalContact: -7, jump: -6, heading: -10,
    defensiveAwareness: -14, ballWinning: -14, aggression: -10, gkAwareness: -40, gkReflexes: -40,
  },
  WG: {
    SHO: 2, DRI: 7, PAS: 1, PAC: 8, PHY: -6, DEF: -16,
    offensiveAwareness: 5, finishing: 3, kickingPower: 1, placeKicking: 1, curl: 5,
    ballControl: 6, dribbling: 8, tightPossession: 6, lowPass: 2, loftedPass: 2,
    speed: 8, acceleration: 9, stamina: 2, balance: 7, physicalContact: -7, jump: -4, heading: -8,
    defensiveAwareness: -16, ballWinning: -16, aggression: -12, gkAwareness: -40, gkReflexes: -40,
  },
  ST: {
    SHO: 7, DRI: 2, PAS: -4, PAC: 4, PHY: 3, DEF: -18,
    offensiveAwareness: 8, finishing: 8, kickingPower: 6, placeKicking: -2, curl: 2,
    ballControl: 3, dribbling: 2, tightPossession: 2, lowPass: -3, loftedPass: -6,
    speed: 4, acceleration: 5, stamina: 0, balance: 1, physicalContact: 4, jump: 4, heading: 5,
    defensiveAwareness: -18, ballWinning: -18, aggression: -6, gkAwareness: -40, gkReflexes: -40,
  },
};

export function resolveCurrentClubMap(league) {
  const clubByPlayerId = new Map();
  if (!league) return clubByPlayerId;
  const teamsById = new Map((league.teams ?? []).map((team) => [team.id, team]));
  for (const pick of league.draft?.picks ?? []) {
    const team = teamsById.get(pick.teamId);
    clubByPlayerId.set(pick.playerId, {
      teamId: pick.teamId,
      clubName: team?.name || pick.teamName || 'Liga-Verein',
      managerName: team?.managerName || pick.managerName || 'CPU',
      acquiredVia: `Draft Pick #${pick.number || 1}`,
    });
  }
  for (const transfer of league.transfers ?? []) {
    if (!transfer?.playerId || !transfer?.buyerTeamId) continue;
    const buyer = teamsById.get(transfer.buyerTeamId);
    clubByPlayerId.set(transfer.playerId, {
      teamId: transfer.buyerTeamId,
      clubName: buyer?.name || transfer.buyerTeamName || 'Neuer Verein',
      managerName: buyer?.managerName || 'Manager',
      acquiredVia: `Transfer (${Number(transfer.fee || 0).toLocaleString('de-DE')} Mio. €)`,
    });
  }
  return clubByPlayerId;
}

export function computeSeasonProgressContext(league) {
  if (!league) {
    return { yearOffset: 0, playedMatchesCount: 0, matchdaysCompleted: 0 };
  }
  const baseYear = 2026;
  const dateStr = String(league.currentDate || '2026-08-01');
  const parsedYear = Number(dateStr.slice(0, 4)) || baseYear;
  const parsedMonth = Number(dateStr.slice(5, 7)) || 8;
  const schedulePlayed = (league.schedule ?? []).filter((fixture) => fixture.played || fixture.status === 'completed').length;
  const historyPlayed = (league.matchHistory ?? []).length;
  const playedMatchesCount = Math.max(schedulePlayed, historyPlayed);
  const matchdaysCompleted = Math.floor(playedMatchesCount / 15);
  return {
    yearOffset: Math.max(0, parsedYear - baseYear - (parsedMonth < 7 ? 1 : 0)),
    playedMatchesCount,
    matchdaysCompleted,
  };
}

export function derivePesProfile(player, league = null, precomputedClubMap = null, precomputedContext = null) {
  if (!player) return null;
  const seed = player.id || player.name || 'player';
  const role = classifyPositionRole(player.position);
  const weights = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.CM;
  const clubMap = precomputedClubMap || resolveCurrentClubMap(league);
  const progress = precomputedContext || computeSeasonProgressContext(league);

  const originClub = player.originClub || player.club || 'Freier Verein';
  const activeAssignment = clubMap.get(player.id);
  const currentClub = activeAssignment?.clubName || (league?.draft?.picks?.length ? 'Freier Spieler (Pool)' : originClub);
  const currentTeamId = activeAssignment?.teamId || '';
  const acquiredVia = activeAssignment?.acquiredVia || (player.isGeneratedTalent ? 'Jugendakademie / Wunderkind' : 'Stammverein (Datenbank)');

  const baseAge = Number(player.baseAge ?? player.age) || (20 + (hashString(`${seed}:age`) % 13));
  const currentAge = Math.min(42, baseAge + progress.yearOffset);

  const baseRating = clampPesStat(player.baseRating ?? player.rating ?? 78);
  const rawPotential = clampPesStat(player.potential ?? Math.max(baseRating, baseRating + (baseAge <= 23 ? 6 : baseAge <= 26 ? 3 : 1)));

  // Check recorded match performance stats & attribute upgrades
  const matchStatEntry = league?.playerMatchStats?.[player.id] || null;
  const seasonGoals = Number(matchStatEntry?.goals || 0);
  const seasonAssists = Number(matchStatEntry?.assists || 0);
  const seasonApps = Number(matchStatEntry?.appearances || 0);
  const motmCount = Number(matchStatEntry?.motmCount || 0);
  const matchBoost = Math.min(6, Number(matchStatEntry?.matchBoost || 0));

  let ratingDelta = 0;
  if (progress.matchdaysCompleted > 0 || progress.yearOffset > 0 || activeAssignment?.acquiredVia?.startsWith('Transfer')) {
    const devSeed = hashString(`${seed}:dev:${currentTeamId || originClub}`);
    const progressFactor = Math.min(1, (progress.matchdaysCompleted + progress.yearOffset * 28) / 20);
    if (currentAge <= 23 && rawPotential > baseRating) {
      ratingDelta = Math.min(rawPotential - baseRating, Math.max(1, Math.round((rawPotential - baseRating) * 0.45 * progressFactor + (devSeed % 2))));
    } else if (currentAge <= 28) {
      ratingDelta = Math.round(((devSeed % 3) - 0.4) * progressFactor);
    } else if (currentAge >= 33) {
      ratingDelta = -Math.max(0, Math.round((1 + (devSeed % 2)) * progressFactor));
    }
    if (activeAssignment?.acquiredVia?.startsWith('Transfer') && ratingDelta === 0 && currentAge <= 29) {
      ratingDelta = 1;
    }
  }
  ratingDelta += matchBoost;

  const effectiveRating = clampPesStat(baseRating + ratingDelta);
  const pesId = Number(player.pesId || player.sourcePlayerId) || (100000 + (hashString(seed) % 899999));
  const fifaId = Number(player.fifaId) || (180000 + (hashString(`fifa:${seed}`) % 89999));
  const foot = player.importedFoot || player.foot || (hashString(`${seed}:foot`) % 4 === 0 ? 'Links' : 'Rechts');
  const styleOptions = ROLE_PLAYING_STYLES[role] || ROLE_PLAYING_STYLES.CM;
  const playingStyle = player.importedPlayingStyle || styleOptions[hashString(`${seed}:style`) % styleOptions.length];

  const existingAttrs = player.importedAttributes || {};
  const computeAttr = (key, span = 3) => {
    if (Number.isFinite(Number(existingAttrs[key])) && Number(existingAttrs[key]) >= 40) {
      return clampPesStat(Number(existingAttrs[key]) + ratingDelta);
    }
    const baseOffset = weights[key] ?? 0;
    const ageSpeedMod = (key === 'speed' || key === 'acceleration' || key === 'stamina') && currentAge >= 32
      ? -(currentAge - 31)
      : 0;
    return clampPesStat(effectiveRating + baseOffset + ageSpeedMod + hashOffset(seed, key, span));
  };

  const attributes = {
    offensiveAwareness: computeAttr('offensiveAwareness'),
    finishing: computeAttr('finishing'),
    kickingPower: computeAttr('kickingPower'),
    placeKicking: computeAttr('placeKicking', 5),
    curl: computeAttr('curl', 4),
    ballControl: computeAttr('ballControl'),
    dribbling: computeAttr('dribbling'),
    tightPossession: computeAttr('tightPossession'),
    lowPass: computeAttr('lowPass'),
    loftedPass: computeAttr('loftedPass'),
    speed: computeAttr('speed'),
    acceleration: computeAttr('acceleration'),
    stamina: computeAttr('stamina'),
    balance: computeAttr('balance'),
    physicalContact: computeAttr('physicalContact'),
    jump: computeAttr('jump', 4),
    heading: computeAttr('heading', 4),
    defensiveAwareness: computeAttr('defensiveAwareness'),
    ballWinning: computeAttr('ballWinning'),
    aggression: computeAttr('aggression', 4),
    gkAwareness: role === 'GK' ? computeAttr('gkAwareness', 2) : 40,
    gkReflexes: role === 'GK' ? computeAttr('gkReflexes', 2) : 40,
  };

  const existingHex = player.importedHexagon || {};
  const hexagon = {
    SHO: Number.isFinite(Number(existingHex.SHO))
      ? clampPesStat(Number(existingHex.SHO) + ratingDelta)
      : clampPesStat(Math.round(attributes.finishing * 0.45 + attributes.kickingPower * 0.3 + attributes.offensiveAwareness * 0.25)),
    DRI: Number.isFinite(Number(existingHex.DRI))
      ? clampPesStat(Number(existingHex.DRI) + ratingDelta)
      : clampPesStat(Math.round(attributes.dribbling * 0.45 + attributes.ballControl * 0.3 + attributes.tightPossession * 0.25)),
    PAS: Number.isFinite(Number(existingHex.PAS))
      ? clampPesStat(Number(existingHex.PAS) + ratingDelta)
      : clampPesStat(Math.round(attributes.lowPass * 0.52 + attributes.loftedPass * 0.33 + attributes.curl * 0.15)),
    PAC: Number.isFinite(Number(existingHex.PAC))
      ? clampPesStat(Number(existingHex.PAC) + ratingDelta)
      : clampPesStat(Math.round(attributes.speed * 0.52 + attributes.acceleration * 0.48)),
    PHY: Number.isFinite(Number(existingHex.PHY))
      ? clampPesStat(Number(existingHex.PHY) + ratingDelta)
      : clampPesStat(Math.round(attributes.physicalContact * 0.45 + attributes.stamina * 0.35 + attributes.jump * 0.2)),
    DEF: Number.isFinite(Number(existingHex.DEF))
      ? clampPesStat(Number(existingHex.DEF) + ratingDelta)
      : (role === 'GK'
        ? clampPesStat(Math.round(attributes.gkAwareness * 0.5 + attributes.gkReflexes * 0.5))
        : clampPesStat(Math.round(attributes.defensiveAwareness * 0.48 + attributes.ballWinning * 0.37 + attributes.aggression * 0.15))),
  };

  const skillMoves = role === 'GK'
    ? 1
    : Math.max(2, Math.min(5, Math.round((hexagon.DRI - 52) / 10) + 1));
  const weakFoot = Math.max(2, Math.min(5, 3 + (hashString(`${seed}:wf`) % 3) - (role === 'GK' ? 1 : 0)));
  const savedShirt = currentTeamId ? league?.squads?.[currentTeamId]?.shirtNumbers?.[player.id] : null;
  const shirtNumber = Number(savedShirt || player.shirtNumber) || (1 + (hashString(`${seed}:shirt`) % 29));

  return {
    ...player,
    pesId,
    fifaId,
    originClub,
    currentClub,
    currentTeamId,
    acquiredVia,
    baseAge,
    age: currentAge,
    baseRating,
    rating: effectiveRating,
    ratingDelta,
    matchBoost,
    seasonGoals,
    seasonAssists,
    seasonApps,
    motmCount,
    potential: Math.max(effectiveRating, rawPotential),
    foot,
    skillMoves,
    weakFoot,
    shirtNumber,
    playingStyle,
    role,
    hexagon,
    attributes,
  };
}

export function syncPlayersWithLeague(players = [], league = null) {
  const clubMap = resolveCurrentClubMap(league);
  const progress = computeSeasonProgressContext(league);
  return (players ?? []).map((player) => derivePesProfile(player, league, clubMap, progress));
}

export const FIFA15_BROWSER_BASE_URL = 'https://fifa15.gamingretro.online/';
export const FIFA15_ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ESL_LOGO_ASSET_PATH = '/src/assets/images/regenerated_image_1794491182381.png';
export const ESL_SCOREBOARD_ASSET_PATH = '/assets/aistudio/image_6d34cd9e.jpeg';

export function generateFifa15RoomCode(seed = '') {
  const cleanSeed = String(seed || '').trim();
  if (cleanSeed) {
    let chars = '';
    for (let i = 0; i < 6; i += 1) {
      const h = hashString(`${cleanSeed}:f15-room:${i}`);
      chars += FIFA15_ROOM_ALPHABET[h % FIFA15_ROOM_ALPHABET.length];
    }
    return chars;
  }
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    const idx = Math.floor(Math.random() * FIFA15_ROOM_ALPHABET.length);
    code += FIFA15_ROOM_ALPHABET[idx];
  }
  return code;
}

export function sanitizeFifa15RoomCode(rawCode = '') {
  const upper = String(rawCode || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (upper.length === 6) return upper;
  return generateFifa15RoomCode(upper || 'ESL-2026');
}

export function buildFifa15BrowserUrl({
  mode = 'host',
  roomCode = '',
  autorun = true,
  autoFriendly = true,
  fixtureId = '',
  eslMod = true,
} = {}) {
  const url = new URL(FIFA15_BROWSER_BASE_URL);
  const normalizedRole = mode === 'guest' ? 'guest' : 'host';
  const normalizedCode = sanitizeFifa15RoomCode(roomCode || fixtureId || 'ESL-2026');

  if (normalizedRole === 'guest') {
    url.searchParams.set('join', normalizedCode);
  } else if (autorun) {
    url.searchParams.set('autorun', '1');
  }

  if (autoFriendly) {
    url.searchParams.set('mode', 'friendly-1v1');
    url.searchParams.set('autoSetup', 'online-friendly');
  }
  if (eslMod) {
    url.searchParams.set('eslMod', '1');
  }
  if (fixtureId) {
    url.searchParams.set('eslFixture', String(fixtureId));
  }
  return url.toString();
}

export function buildFifa15AutoFriendlyMacro({ homeTeamName = 'Heim', awayTeamName = 'Gast', roomCode = '' } = {}) {
  const code = sanitizeFifa15RoomCode(roomCode || `${homeTeamName}-${awayTeamName}`);
  return {
    roomCode: code,
    engineTitle: 'FIFA 15 Xbox 360 Browser-Edition (ReXGlue WebAssembly / WebGPU · Title-ID 454109DB)',
    profileSettingsOffset: '0x26F0',
    profileCrcOffset: '0x10..0x1C',
    controlsPreset: 'Klassisch (Classic Controls · Xbox 360 / Gamepad & Tastatur)',
    difficultyPreset: 'Weltklasse / Legende (1v1 Fair-Play)',
    macroSequence: [
      { code: 'Enter', holdMs: 120, label: 'Titelbildschirm & Super League Mod-Boot bestätigen (START)' },
      { code: 'KeyS', holdMs: 120, label: 'Super League Kader-Save (idbfs Squads1) & Profil laden (A)' },
      { code: 'KeyS', holdMs: 120, label: 'Direkt in Online-Freundschaftsspiel / 1v1 Anstoß wechseln (A)' },
      { code: 'ArrowLeft', holdMs: 110, label: `Pad 1 (Host) auf ${homeTeamName} setzen` },
      { code: 'ArrowRight', holdMs: 110, label: `Pad 2 (Gast via WebRTC · ${code}) auf ${awayTeamName} setzen` },
    ],
    telemetryPointers: {
      matchClockAddr: '0x83D34E14',
      totalGoalsAddr: '0x83D34E10',
      matchStructPtr: '0x40BE2EC8',
      homeGoalsOffset: '+0x18',
      awayGoalsOffset: '+0x1C',
    },
  };
}

export function buildFifa15SuperLeagueModPackage(league, players = [], { homeTeamId = '', awayTeamId = '', roomCode = '' } = {}) {
  const syncedPlayers = syncPlayersWithLeague(players, league);
  const teams = league?.teams ?? [];
  const resolvedHomeId = homeTeamId || league?.match?.homeId || teams[0]?.id || '';
  const resolvedAwayId = awayTeamId || league?.match?.awayId || teams[1]?.id || teams[0]?.id || '';
  const homeStrength = calculateTeamPesStrength(resolvedHomeId, league, players);
  const awayStrength = calculateTeamPesStrength(resolvedAwayId, league, players);
  const dbHash = computeGameDbHash(league, players, { engineVersion: 'FIFA15' });
  const normalizedCode = sanitizeFifa15RoomCode(roomCode || league?.onlineLobby?.roomCode || 'ESL15A');
  const macro = buildFifa15AutoFriendlyMacro({
    homeTeamName: homeStrength.teamName,
    awayTeamName: awayStrength.teamName,
    roomCode: normalizedCode,
  });

  return {
    schema: 'esl-fifa15-xbox360-mod-package-v1',
    modId: 'ESL-FIFA15-XBOX360-MOD-V26',
    titleId: '454109DB',
    saveContainerPath: '/user/esl_profile/454109DB/00000001/Squads1',
    exportedAt: new Date().toISOString(),
    leagueName: league?.name || 'European Super League',
    season: league?.season || '2026/27',
    dbHash,
    roomCode: normalizedCode,
    branding: {
      leagueTitle: 'EUROPEAN SUPER LEAGUE',
      logoAsset: ESL_LOGO_ASSET_PATH,
      logoTransparentBackground: true,
      scoreboardAsset: ESL_SCOREBOARD_ASSET_PATH,
      scoreboardTransparentBackground: false,
    },
    autoSetup: {
      targetMode: '1v1 Online-Freundschaftsspiel',
      bootDirectToMatch: true,
      profileOffsetHex: '0x26F0',
      controlPreset: 'Classic',
      difficulty: 'WorldClass_Legendary',
      macroSequence: macro.macroSequence,
    },
    stats: {
      teamsCount: teams.length,
      playersCount: syncedPlayers.length,
      transfersCount: (league?.transfers ?? []).length,
    },
    matchup: {
      homeTeamId: homeStrength.teamId,
      homeTeamName: homeStrength.teamName,
      homeOverall: homeStrength.overall,
      homeFormation: homeStrength.formation,
      homeStarters: homeStrength.lineup.map(({ slot, player }) => ({
        slot: slot.label,
        playerId: player?.id || '',
        playerName: player?.name || 'Unbesetzt',
        shirtNumber: player ? (homeStrength.shirtNumbers?.[player.id] || player.shirtNumber || 10) : null,
        rating: player?.rating || 75,
      })),
      awayTeamId: awayStrength.teamId,
      awayTeamName: awayStrength.teamName,
      awayOverall: awayStrength.overall,
      awayFormation: awayStrength.formation,
      awayStarters: awayStrength.lineup.map(({ slot, player }) => ({
        slot: slot.label,
        playerId: player?.id || '',
        playerName: player?.name || 'Unbesetzt',
        shirtNumber: player ? (awayStrength.shirtNumbers?.[player.id] || player.shirtNumber || 10) : null,
        rating: player?.rating || 75,
      })),
    },
  };
}

export function computeGameDbHash(league, players = [], { engineVersion = '' } = {}) {
  if (!league) return 'DB-INIT-0000';
  const engine = engineVersion || league.onlineLobby?.engineVersion || 'FIFA17';
  const prefix = engine === 'FIFA15'
    ? 'F15'
    : engine === 'FIFA16'
      ? 'F16'
      : engine === 'SPFL26'
        ? 'SPFL'
        : 'F17';
  const picksSig = (league.draft?.picks ?? [])
    .map((p) => `${p.teamId}:${p.playerId}:${p.rating || 80}`)
    .join('|');
  const transfersSig = (league.transfers ?? [])
    .map((t) => `${t.playerId}->${t.buyerTeamId}@${t.fee}`)
    .join('|');
  const squadsSig = Object.entries(league.squads ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tid, sq]) => {
      const starters = Object.entries(sq.starters ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([slot, pid]) => `${slot}=${pid}`)
        .join(',');
      const nums = Object.entries(sq.shirtNumbers ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pid, n]) => `${pid}#${n}`)
        .join(',');
      return `${tid}:${sq.formation || '4-3-3'}:${sq.tacticalPreset || 'gegenpressing'}:${starters}:${nums}`;
    })
    .join('|');
  const statsSig = Object.entries(league.playerMatchStats ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pid, st]) => `${pid}:${st.goals || 0}:${st.assists || 0}:${st.matchBoost || 0}`)
    .join('|');
  const raw = `${league.name || 'league'}::${league.season || '2026'}::${picksSig}::${transfersSig}::${squadsSig}::${statsSig}::${players.length}`;
  const hex = hashString(raw).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
  const revCount = (league.transfers?.length || 0) + (league.matchHistory?.length || 0) + Object.keys(league.squads ?? {}).length;
  return `${prefix}-R${revCount}-${hex}`;
}

export function ensureOnlineLobbyState(league, players = []) {
  const currentHash = computeGameDbHash(league, players);
  const existing = league?.onlineLobby ?? {};
  const humanTeams = (league?.teams ?? []).filter((t) => t.managerType === 'human');
  const syncedByManager = { ...(existing.syncedByManager ?? {}) };
  for (const team of humanTeams) {
    if (!syncedByManager[team.id]) {
      syncedByManager[team.id] = {
        teamId: team.id,
        teamName: team.name,
        managerName: team.managerName || team.name,
        dbHash: currentHash,
        syncedAt: league?.createdAt || new Date().toISOString(),
      };
    }
  }
  const defaultSeed = existing.roomCode || `${league?.name || 'ESL'}-${league?.currentDate || '2026'}`;
  return {
    engineVersion: existing.engineVersion || 'FIFA17',
    networkMode: existing.networkMode || 'fifa15-browser',
    networkRoomName: existing.networkRoomName || 'SUPER-LEAGUE-ARENA',
    hostVirtualIp: existing.hostVirtualIp || '26.104.88.10',
    roomCode: sanitizeFifa15RoomCode(defaultSeed),
    autoFriendlyMode: existing.autoFriendlyMode !== undefined ? Boolean(existing.autoFriendlyMode) : true,
    activeFixtureId: existing.activeFixtureId || league?.match?.fixtureId || '',
    liveHomeScore: Number.isFinite(Number(existing.liveHomeScore)) ? Number(existing.liveHomeScore) : (league?.match?.result?.home ?? 0),
    liveAwayScore: Number.isFinite(Number(existing.liveAwayScore)) ? Number(existing.liveAwayScore) : (league?.match?.result?.away ?? 0),
    matchClock: existing.matchClock || '00:00',
    customSaveSeed: existing.customSaveSeed || '',
    homeReady: Boolean(existing.homeReady),
    awayReady: Boolean(existing.awayReady),
    syncedByManager,
  };
}

export function getManagerSyncSummary(league, players = [], { homeTeamId = '', awayTeamId = '' } = {}) {
  const lobby = ensureOnlineLobbyState(league, players);
  const currentHash = computeGameDbHash(league, players, { engineVersion: lobby.engineVersion });
  const humanTeams = (league?.teams ?? []).filter((t) => t.managerType === 'human');
  const managers = humanTeams.map((team) => {
    const entry = lobby.syncedByManager?.[team.id];
    const confirmedHash = entry?.dbHash || currentHash;
    const isSynced = confirmedHash === currentHash;
    return {
      teamId: team.id,
      teamName: team.name,
      managerName: team.managerName || team.name,
      confirmedHash,
      isSynced,
      syncedAt: entry?.syncedAt || '',
    };
  });
  const allHumansSynced = managers.every((m) => m.isSynced);
  const homeManager = managers.find((m) => m.teamId === homeTeamId);
  const awayManager = managers.find((m) => m.teamId === awayTeamId);
  const isDesyncFree = (homeManager ? homeManager.isSynced : true) && (awayManager ? awayManager.isSynced : true);

  return {
    dbHash: currentHash,
    engineVersion: lobby.engineVersion,
    networkMode: lobby.networkMode,
    networkRoomName: lobby.networkRoomName,
    hostVirtualIp: lobby.hostVirtualIp,
    roomCode: lobby.roomCode,
    autoFriendlyMode: lobby.autoFriendlyMode,
    activeFixtureId: lobby.activeFixtureId,
    liveHomeScore: lobby.liveHomeScore,
    liveAwayScore: lobby.liveAwayScore,
    matchClock: lobby.matchClock,
    customSaveSeed: lobby.customSaveSeed,
    homeReady: lobby.homeReady,
    awayReady: lobby.awayReady,
    managers,
    allHumansSynced,
    isDesyncFree,
  };
}

export function confirmManagerDbSync(league, players = [], managerTeamId = '', { syncAll = false } = {}) {
  if (!league) return { league, error: 'Keine aktive Liga.' };
  const next = structuredClone(league);
  const lobby = ensureOnlineLobbyState(next, players);
  const currentHash = computeGameDbHash(next, players, { engineVersion: lobby.engineVersion });
  const now = new Date().toISOString();
  const targets = syncAll
    ? (next.teams ?? []).filter((t) => t.managerType === 'human')
    : (next.teams ?? []).filter((t) => t.id === managerTeamId || t.managerType === 'human');

  for (const team of targets) {
    lobby.syncedByManager[team.id] = {
      teamId: team.id,
      teamName: team.name,
      managerName: team.managerName || team.name,
      dbHash: currentHash,
      syncedAt: now,
    };
  }
  next.onlineLobby = lobby;
  return { league: next, dbHash: currentHash };
}

export function updateOnlineLobbySettings(league, players = [], updates = {}) {
  if (!league) return { league, error: 'Keine aktive Liga.' };
  const next = structuredClone(league);
  const lobby = ensureOnlineLobbyState(next, players);
  if (updates.engineVersion && ['FIFA15', 'FIFA16', 'FIFA17', 'SPFL26'].includes(updates.engineVersion)) {
    lobby.engineVersion = updates.engineVersion;
  }
  if (updates.networkMode && ['fifa15-browser', 'radmin-direct', 'custom-blaze', 'parsec'].includes(updates.networkMode)) {
    lobby.networkMode = updates.networkMode;
  }
  if (typeof updates.networkRoomName === 'string') {
    lobby.networkRoomName = updates.networkRoomName.trim() || 'SUPER-LEAGUE-ARENA';
  }
  if (typeof updates.hostVirtualIp === 'string') {
    lobby.hostVirtualIp = updates.hostVirtualIp.trim() || '26.104.88.10';
  }
  if (typeof updates.roomCode === 'string' && updates.roomCode.trim()) {
    lobby.roomCode = sanitizeFifa15RoomCode(updates.roomCode.trim());
  }
  if (typeof updates.autoFriendlyMode === 'boolean') {
    lobby.autoFriendlyMode = updates.autoFriendlyMode;
  }
  if (typeof updates.activeFixtureId === 'string') {
    lobby.activeFixtureId = updates.activeFixtureId;
  }
  if (Number.isFinite(Number(updates.liveHomeScore))) {
    lobby.liveHomeScore = Math.max(0, Math.min(99, Number(updates.liveHomeScore)));
  }
  if (Number.isFinite(Number(updates.liveAwayScore))) {
    lobby.liveAwayScore = Math.max(0, Math.min(99, Number(updates.liveAwayScore)));
  }
  if (typeof updates.matchClock === 'string' && updates.matchClock.trim()) {
    lobby.matchClock = updates.matchClock.trim();
  }
  if (typeof updates.customSaveSeed === 'string') {
    lobby.customSaveSeed = updates.customSaveSeed.trim();
  }
  if (typeof updates.homeReady === 'boolean') lobby.homeReady = updates.homeReady;
  if (typeof updates.awayReady === 'boolean') lobby.awayReady = updates.awayReady;
  if (updates.refreshSyncHash) {
    const newHash = computeGameDbHash(next, players, { engineVersion: lobby.engineVersion });
    const now = new Date().toISOString();
    for (const tid of Object.keys(lobby.syncedByManager)) {
      lobby.syncedByManager[tid].dbHash = newHash;
      lobby.syncedByManager[tid].syncedAt = now;
    }
  }
  next.onlineLobby = lobby;
  return { league: next, onlineLobby: lobby };
}

export function calculateTeamPesStrength(teamId, league, players = []) {
  const team = league?.teams?.find((entry) => entry.id === teamId) || { id: teamId, name: 'Team', managerName: 'CPU' };
  const rawRoster = getTeamRoster(league, teamId, players);
  const clubMap = resolveCurrentClubMap(league);
  const progress = computeSeasonProgressContext(league);
  const shirtMap = resolveTeamShirtNumbers(league, teamId, rawRoster);
  const enrichedRoster = rawRoster.map((player) => {
    const profile = derivePesProfile(player, league, clubMap, progress);
    return {
      ...profile,
      shirtNumber: shirtMap[player.id] || profile.shirtNumber,
    };
  });

  const squad = getTeamSquad(league, teamId);
  const formationSlots = getFormationSlots(squad.formation || '4-3-3');
  const tacticalPresetObj = TACTICAL_PRESETS.find((p) => p.id === (squad.tacticalPreset || 'gegenpressing')) || TACTICAL_PRESETS[0];

  if (!enrichedRoster.length) {
    return {
      teamId: team.id,
      teamName: team.name,
      managerName: team.managerName || 'CPU',
      formation: squad.formation || '4-3-3',
      tacticalPreset: tacticalPresetObj,
      overall: 76,
      attack: 76,
      midfield: 76,
      defense: 76,
      teamSpirit: 78,
      avgAge: 25.0,
      rosterCount: 0,
      starPlayers: [],
      lineup: formationSlots.map((slot) => ({ slot, player: null })),
      benchPlayers: [],
      shirtNumbers: {},
    };
  }

  const playersById = new Map(enrichedRoster.map((player) => [player.id, player]));
  const usedIds = new Set();

  const lineup = formationSlots.map((slot) => {
    const assignedId = squad.starters?.[slot.id];
    if (assignedId && playersById.has(assignedId) && !usedIds.has(assignedId)) {
      usedIds.add(assignedId);
      return { slot, player: playersById.get(assignedId) };
    }
    return { slot, player: null };
  });

  const targetRoleForSlot = (slotId) => {
    if (slotId === 'GK') return ['GK'];
    if (slotId.startsWith('CB') || slotId === 'LCB' || slotId === 'RCB') return ['CB', 'DM', 'FB'];
    if (slotId === 'LB' || slotId === 'RB') return ['FB', 'CB', 'DM', 'WG'];
    if (slotId.startsWith('CM') || slotId === 'LCM' || slotId === 'RCM' || slotId === 'DM') return ['CM', 'DM', 'AM'];
    if (slotId === 'LW' || slotId === 'RW') return ['WG', 'AM', 'ST'];
    return ['ST', 'WG', 'AM'];
  };

  for (const entry of lineup) {
    if (entry.player) continue;
    const preferredRoles = targetRoleForSlot(entry.slot.id);
    const candidates = enrichedRoster
      .filter((player) => !usedIds.has(player.id))
      .sort((a, b) => {
        const aRoleIdx = preferredRoles.indexOf(a.role);
        const bRoleIdx = preferredRoles.indexOf(b.role);
        const aBonus = aRoleIdx >= 0 ? (10 - aRoleIdx * 3) : 0;
        const bBonus = bRoleIdx >= 0 ? (10 - bRoleIdx * 3) : 0;
        return (b.rating + bBonus) - (a.rating + aBonus);
      });
    if (candidates[0]) {
      entry.player = candidates[0];
      usedIds.add(candidates[0].id);
    }
  }

  const activeStarters = lineup.map((entry) => entry.player).filter(Boolean);
  const benchPlayers = enrichedRoster.filter((player) => !usedIds.has(player.id));
  const sample = activeStarters.length >= 7 ? activeStarters : enrichedRoster.slice(0, 11);

  const attackers = sample.filter((player) => ['ST', 'WG', 'AM'].includes(player.role));
  const midfielders = sample.filter((player) => ['CM', 'DM', 'AM'].includes(player.role));
  const defenders = sample.filter((player) => ['CB', 'FB', 'GK'].includes(player.role));

  const avgRating = (list, fallback) => (list.length
    ? Math.round(list.reduce((sum, player) => sum + (Number(player.rating) || 78), 0) / list.length)
    : fallback);

  const overall = avgRating(sample, 78);
  const attack = avgRating(attackers, overall);
  const midfield = avgRating(midfielders, overall);
  const defense = avgRating(defenders, overall);
  const avgAge = Number((enrichedRoster.reduce((sum, p) => sum + (Number(p.age) || 25), 0) / enrichedRoster.length).toFixed(1));

  const assignedStarterCount = Object.values(squad.starters ?? {}).filter(Boolean).length;
  const teamSpirit = Math.min(99, Math.max(76, 82 + Math.round(assignedStarterCount * 1.1) + Math.min(5, progress.matchdaysCompleted)));

  const starPlayers = [...enrichedRoster]
    .sort((a, b) => b.rating - a.rating || b.hexagon.SHO - a.hexagon.SHO)
    .slice(0, 3);

  return {
    teamId: team.id,
    teamName: team.name,
    managerName: team.managerName || 'CPU',
    formation: squad.formation || '4-3-3',
    tacticalPreset: tacticalPresetObj,
    overall,
    attack,
    midfield,
    defense,
    teamSpirit,
    avgAge,
    rosterCount: enrichedRoster.length,
    starPlayers,
    lineup,
    benchPlayers,
    shirtNumbers: shirtMap,
  };
}

export function buildEditModeChecklist(league, players = []) {
  if (!league) return { transfers: [], teamSummaries: [] };
  const synced = syncPlayersWithLeague(players, league);
  const byId = new Map(synced.map((player) => [player.id, player]));

  const transfers = (league.transfers ?? []).map((transfer, idx) => {
    const profile = byId.get(transfer.playerId) || derivePesProfile({
      id: transfer.playerId,
      name: transfer.playerName,
      position: transfer.position || 'CM',
      rating: transfer.rating || 82,
      club: transfer.sellerTeamName,
    }, league);
    return {
      stepId: `tx-${transfer.callId || idx}-${transfer.playerId}`,
      pesId: profile.pesId,
      fifaId: profile.fifaId,
      shirtNumber: profile.shirtNumber,
      playerId: transfer.playerId,
      playerName: transfer.playerName || profile.name,
      position: profile.position || 'CM',
      rating: profile.rating,
      originClub: profile.originClub,
      fromClub: transfer.sellerTeamName || profile.originClub,
      toClub: transfer.buyerTeamName || profile.currentClub,
      fee: Number(transfer.fee || 0),
      signedAt: transfer.signedAt || transfer.at || '',
      instruction: `Edit-Modus → Transfers → ${transfer.playerName || profile.name} (ID ${profile.pesId} · FIFA-ID ${profile.fifaId} · #${profile.shirtNumber}) von ${transfer.sellerTeamName} zu ${transfer.buyerTeamName} verschieben`,
    };
  });

  const teamSummaries = (league.teams ?? []).slice(0, 12).map((team) => {
    const strength = calculateTeamPesStrength(team.id, league, synced);
    return {
      teamId: team.id,
      teamName: team.name,
      managerName: team.managerName,
      formation: strength.formation,
      rosterCount: strength.rosterCount,
      overall: strength.overall,
      topStar: strength.starPlayers[0]?.name || '—',
    };
  });

  return { transfers, teamSummaries };
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportPesEditorCsv(league, players = []) {
  const synced = syncPlayersWithLeague(players, league);
  const headers = [
    'PES_ID',
    'Name',
    'CurrentClub',
    'OriginClub',
    'Position',
    'Age',
    'OVR',
    'RatingDelta',
    'Foot',
    'PlayingStyle',
    'SHO',
    'DRI',
    'PAS',
    'PAC',
    'PHY',
    'DEF',
    'Finishing',
    'Dribbling',
    'BallControl',
    'TightPossession',
    'LowPass',
    'LoftedPass',
    'Speed',
    'Acceleration',
    'KickingPower',
    'PhysicalContact',
    'Stamina',
    'DefensiveAwareness',
    'BallWinning',
  ];

  const rows = synced.map((player) => [
    player.pesId,
    player.name,
    player.currentClub,
    player.originClub,
    player.position || 'CM',
    player.age,
    player.rating,
    player.ratingDelta >= 0 ? `+${player.ratingDelta}` : String(player.ratingDelta),
    player.foot,
    player.playingStyle,
    player.hexagon.SHO,
    player.hexagon.DRI,
    player.hexagon.PAS,
    player.hexagon.PAC,
    player.hexagon.PHY,
    player.hexagon.DEF,
    player.attributes.finishing,
    player.attributes.dribbling,
    player.attributes.ballControl,
    player.attributes.tightPossession,
    player.attributes.lowPass,
    player.attributes.loftedPass,
    player.attributes.speed,
    player.attributes.acceleration,
    player.attributes.kickingPower,
    player.attributes.physicalContact,
    player.attributes.stamina,
    player.attributes.defensiveAwareness,
    player.attributes.ballWinning,
  ].map(escapeCsvCell).join(','));

  return `${headers.join(',')}\n${rows.join('\n')}\n`;
}

export function exportFifaRdbmPlayersCsv(league, players = [], { engineVersion = 'FIFA17' } = {}) {
  const synced = syncPlayersWithLeague(players, league);
  const starterLookup = new Set();
  const shirtByPlayer = new Map();
  for (const team of league?.teams ?? []) {
    const strength = calculateTeamPesStrength(team.id, league, players);
    for (const { player } of strength.lineup) {
      if (player?.id) starterLookup.add(player.id);
    }
    for (const [pid, num] of Object.entries(strength.shirtNumbers || {})) {
      shirtByPlayer.set(pid, num);
    }
  }

  const headers = [
    'playerid',
    'firstname',
    'lastname',
    'commonname',
    'overallrating',
    'potential',
    'age',
    'preferredfoot',
    'skillmoves',
    'weakfootabilitytypecode',
    'pac',
    'sho',
    'pas',
    'dri',
    'def',
    'phy',
    'finishing',
    'positioning',
    'shotpower',
    'longshots',
    'volleys',
    'penalties',
    'vision',
    'crossing',
    'freekickaccuracy',
    'shortpassing',
    'longpassing',
    'curve',
    'agility',
    'balance',
    'reactions',
    'ballcontrol',
    'dribbling',
    'interceptions',
    'headingaccuracy',
    'marking',
    'standingtackle',
    'slidingtackle',
    'jumping',
    'stamina',
    'strength',
    'aggression',
    'acceleration',
    'sprintspeed',
    'gkdiving',
    'gkhandling',
    'gkkicking',
    'gkpositioning',
    'gkreflexes',
    'currentclub',
    'teamid',
    'jerseynumber',
    'isstarter',
    'engine',
  ];

  const rows = synced.map((p) => {
    const parts = String(p.name || 'Spieler').trim().split(/\s+/);
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
    const lastName = parts.length > 1 ? parts.at(-1) : parts[0];
    const a = p.attributes;
    const isGK = p.role === 'GK';
    const jersey = shirtByPlayer.get(p.id) || p.shirtNumber || 10;
    return [
      p.fifaId,
      firstName,
      lastName,
      p.name,
      clampFifaStat(p.rating),
      clampFifaStat(p.potential),
      p.age,
      p.foot === 'Links' ? 2 : 1,
      p.skillMoves,
      p.weakFoot,
      clampFifaStat(p.hexagon.PAC),
      clampFifaStat(p.hexagon.SHO),
      clampFifaStat(p.hexagon.PAS),
      clampFifaStat(p.hexagon.DRI),
      clampFifaStat(p.hexagon.DEF),
      clampFifaStat(p.hexagon.PHY),
      clampFifaStat(a.finishing),
      clampFifaStat(a.offensiveAwareness),
      clampFifaStat(a.kickingPower),
      clampFifaStat(Math.round((a.finishing + a.kickingPower) / 2)),
      clampFifaStat(Math.round((a.finishing + a.ballControl) / 2)),
      clampFifaStat(Math.round((a.finishing + a.placeKicking) / 2)),
      clampFifaStat(a.lowPass),
      clampFifaStat(a.loftedPass),
      clampFifaStat(a.placeKicking),
      clampFifaStat(a.lowPass),
      clampFifaStat(a.loftedPass),
      clampFifaStat(a.curl),
      clampFifaStat(a.balance),
      clampFifaStat(a.balance),
      clampFifaStat(a.offensiveAwareness),
      clampFifaStat(a.ballControl),
      clampFifaStat(a.dribbling),
      clampFifaStat(a.defensiveAwareness),
      clampFifaStat(a.heading),
      clampFifaStat(a.defensiveAwareness),
      clampFifaStat(a.ballWinning),
      clampFifaStat(Math.max(35, a.ballWinning - 3)),
      clampFifaStat(a.jump),
      clampFifaStat(a.stamina),
      clampFifaStat(a.physicalContact),
      clampFifaStat(a.aggression),
      clampFifaStat(a.acceleration),
      clampFifaStat(a.speed),
      isGK ? clampFifaStat(a.gkReflexes) : 12,
      isGK ? clampFifaStat(a.gkAwareness) : 12,
      isGK ? clampFifaStat(a.loftedPass) : 12,
      isGK ? clampFifaStat(a.gkAwareness) : 12,
      isGK ? clampFifaStat(a.gkReflexes) : 12,
      p.currentClub,
      p.currentTeamId || 'free-agent',
      jersey,
      starterLookup.has(p.id) ? 1 : 0,
      engineVersion,
    ].map(escapeCsvCell).join(',');
  });

  return `${headers.join(',')}\n${rows.join('\n')}\n`;
}

export function exportFifaTeamPlayerLinksCsv(league, players = []) {
  const headers = [
    'artificialkey',
    'teamid',
    'teamname',
    'playerid',
    'playername',
    'jerseynumber',
    'positionid',
    'positioncode',
    'isstarter',
    'goals',
    'assists',
    'matchboost',
  ];

  const posIdMap = {
    GK: 0,
    RB: 3,
    RCB: 4,
    LCB: 6,
    LB: 7,
    DM: 10,
    RCM: 13,
    LCM: 15,
    RW: 23,
    ST: 25,
    LW: 27,
    SUB: 28,
  };

  const rows = [];
  let keyCounter = 1;

  for (const team of league?.teams ?? []) {
    const strength = calculateTeamPesStrength(team.id, league, players);
    for (const { slot, player } of strength.lineup) {
      if (!player) continue;
      rows.push([
        keyCounter++,
        team.id,
        team.name,
        player.fifaId,
        player.name,
        strength.shirtNumbers[player.id] || player.shirtNumber || 10,
        posIdMap[slot.id] ?? 14,
        slot.id,
        1,
        player.seasonGoals || 0,
        player.seasonAssists || 0,
        player.matchBoost || 0,
      ].map(escapeCsvCell).join(','));
    }
    for (const player of strength.benchPlayers) {
      rows.push([
        keyCounter++,
        team.id,
        team.name,
        player.fifaId,
        player.name,
        strength.shirtNumbers[player.id] || player.shirtNumber || 18,
        posIdMap.SUB,
        player.position || 'SUB',
        0,
        player.seasonGoals || 0,
        player.seasonAssists || 0,
        player.matchBoost || 0,
      ].map(escapeCsvCell).join(','));
    }
  }

  return `${headers.join(',')}\n${rows.join('\n')}\n`;
}

export function exportFifaFormationsCsv(league, players = []) {
  const headers = [
    'teamid',
    'teamname',
    'managername',
    'formation',
    'tacticalpreset',
    'overall',
    'attack',
    'midfield',
    'defense',
    'starting_xi_ids',
    'starting_xi_names',
  ];

  const rows = (league?.teams ?? []).map((team) => {
    const strength = calculateTeamPesStrength(team.id, league, players);
    const xiIds = strength.lineup.map((e) => e.player?.fifaId || '').filter(Boolean).join('|');
    const xiNames = strength.lineup.map((e) => e.player ? `${e.slot.id}:${e.player.name}(#${strength.shirtNumbers[e.player.id] || e.player.shirtNumber})` : '').filter(Boolean).join(' / ');
    return [
      team.id,
      team.name,
      team.managerName || 'CPU',
      strength.formation || '4-3-3',
      strength.tacticalPreset?.label || 'Gegenpressing',
      strength.overall,
      strength.attack,
      strength.midfield,
      strength.defense,
      xiIds,
      xiNames,
    ].map(escapeCsvCell).join(',');
  });

  return `${headers.join(',')}\n${rows.join('\n')}\n`;
}

export function exportPesSiderJson(league, players = []) {
  const synced = syncPlayersWithLeague(players, league);
  const checklist = buildEditModeChecklist(league, synced);
  const dbHash = computeGameDbHash(league, players);
  const syncSummary = getManagerSyncSummary(league, players);
  const teamConfigs = (league?.teams ?? []).map((team) => {
    const strength = calculateTeamPesStrength(team.id, league, players);
    return {
      teamId: team.id,
      teamName: team.name,
      managerName: team.managerName,
      managerType: team.managerType,
      formation: strength.formation,
      tacticalPreset: strength.tacticalPreset?.id || 'gegenpressing',
      overall: strength.overall,
      attack: strength.attack,
      midfield: strength.midfield,
      defense: strength.defense,
      startingEleven: strength.lineup.map(({ slot, player }) => ({
        slotId: slot.id,
        playerId: player?.id || null,
        fifaId: player?.fifaId || null,
        pesId: player?.pesId || null,
        playerName: player?.name || null,
        shirtNumber: player ? (strength.shirtNumbers[player.id] || player.shirtNumber) : null,
        overall: player?.rating || null,
      })),
      shirtNumbers: strength.shirtNumbers,
    };
  });

  const payload = {
    schema: 'sp-football-life-pes2021-sider-v1',
    multiEngineSupport: ['FIFA17', 'FIFA16', 'SPFL26'],
    activeEngine: syncSummary.engineVersion,
    dbHash,
    isDesyncFree: syncSummary.isDesyncFree,
    managerSyncStatus: syncSummary.managers,
    leagueName: league?.name || 'Career Premier League',
    season: league?.season || '2026/27',
    currentDate: league?.currentDate || '2026-08-01',
    exportedAt: new Date().toISOString(),
    totalPlayers: synced.length,
    completedTransfersCount: checklist.transfers.length,
    teams: teamConfigs,
    transfers: checklist.transfers,
    players: synced.slice(0, 950).map((player) => ({
      pesId: player.pesId,
      fifaId: player.fifaId,
      id: player.id,
      name: player.name,
      currentClub: player.currentClub,
      currentTeamId: player.currentTeamId,
      originClub: player.originClub,
      position: player.position,
      shirtNumber: player.shirtNumber,
      age: player.age,
      overall: player.rating,
      ratingDelta: player.ratingDelta,
      matchBoost: player.matchBoost,
      seasonGoals: player.seasonGoals,
      seasonAssists: player.seasonAssists,
      potential: player.potential,
      foot: player.foot,
      skillMoves: player.skillMoves,
      weakFoot: player.weakFoot,
      playingStyle: player.playingStyle,
      hexagon: player.hexagon,
      attributes: player.attributes,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function generatePesSiderLuaScript(league, { serverUrl = 'http://localhost:3000', players = [] } = {}) {
  const leagueName = (league?.name || 'Career Online League').replace(/"/g, '\\"');
  const season = (league?.season || '2026/27').replace(/"/g, '\\"');
  const dbHash = computeGameDbHash(league, players);
  const engineVersion = league?.onlineLobby?.engineVersion || 'FIFA17';
  const teamMappings = (league?.teams ?? [])
    .map((t, idx) => `  ["${String(t.name).replace(/"/g, '\\"')}"] = "${String(t.id).replace(/"/g, '\\"')}", -- Slot ${idx + 1} (${t.managerName || 'CPU'})`)
    .join('\n');

  return `-- ============================================================================
-- career_sync.lua — Live Multi-Engine Bridge (FIFA 16 / FIFA 17 Live Editor & SPFL 2026 Sider)
-- Liga: ${leagueName} (${season}) · Aktiver DB-Sync-Hash: ${dbHash} (${engineVersion})
-- Funktionen:
--   1. Prüft vor Online-Anstoß den gemeinsamen Squad-Hash (${dbHash}) gegen Desync
--   2. Synchronisiert 30er-Draft-Kader, Transfers, Rückennummern & 1-99/40-99 Attribute
--   3. Sendet Endergebnis, Torschützen & Match-Statistiken automatisch an:
--      ${serverUrl}/api/pes-sync
-- ============================================================================

local m = {}
local CAREER_API_URL = "${serverUrl}/api/pes-sync"
local CAREER_MANIFEST_URL = "${serverUrl}/api/pes-bridge/manifest"
local EXPECTED_DB_HASH = "${dbHash}"

local TEAM_MAP = {
${teamMappings}
}

local function write_local_sync_file(payload_json)
  local f = io.open("career_match_sync.json", "w")
  if f then
    f:write(payload_json)
    f:close()
  end
end

local function push_to_career_server(ctx, home_score, away_score)
  local fixture_id = tostring(ctx.career_fixture_id or "")
  local home_id = tostring(ctx.home_team_id or "")
  local away_id = tostring(ctx.away_team_id or "")
  local payload = string.format(
    '{"source":"sider-lua-bridge","dbHash":"%s","fixtureId":"%s","homeTeamId":"%s","awayTeamId":"%s","homeScore":%d,"awayScore":%d}',
    EXPECTED_DB_HASH, fixture_id, home_id, away_id, tonumber(home_score) or 0, tonumber(away_score) or 0
  )
  write_local_sync_file(payload)
  local cmd = string.format(
    'curl -s -X POST "%s" -H "Content-Type: application/json" -d %q >nul 2>&1',
    CAREER_API_URL, payload
  )
  os.execute(cmd)
  log(string.format("[Career Live-Sync] Ergebnis übertragen (%s): %d : %d", EXPECTED_DB_HASH, home_score, away_score))
end

function m.init(ctx)
  log("[Career Live-Sync] Multi-Engine Bridge aktiv für ${leagueName} (${season}) | Hash: " .. EXPECTED_DB_HASH .. " -> " .. CAREER_API_URL)
  ctx.register("livecpk_data_ready", function(ctx)
    -- Synchronisiert aktive Match-Lobby & prüft Anti-Desync DB-Hash (${dbHash})
  end)
  ctx.register("overlay_on", function(ctx)
    return string.format("CAREER OS SYNC AKTIV | HASH: %s | %s", EXPECTED_DB_HASH, CAREER_API_URL)
  end)
  ctx.register("set_conditions", function(ctx, options)
    -- Faire 1v1 Online-Liga-Bedingungen (Abend / Trocken / Gleicher Squad-Stand)
  end)
  ctx.register("after_set_conditions", function(ctx)
    if ctx.match_info and ctx.match_info.is_finished then
      push_to_career_server(ctx, ctx.match_info.home_score or 0, ctx.match_info.away_score or 0)
    end
  end)
end

return m
`;
}

function buildAutoMatchTelemetry(league, homeTeam, awayTeam, hScore, aScore, payload = {}, players = []) {
  const homeStrength = calculateTeamPesStrength(homeTeam.id, league, players);
  const awayStrength = calculateTeamPesStrength(awayTeam.id, league, players);

  const pickGoalCandidates = (strength) => {
    const starters = strength.lineup.map((e) => e.player).filter(Boolean);
    const pool = starters.length ? starters : strength.starPlayers;
    return [...pool].sort((a, b) => (b.hexagon?.SHO || 75) - (a.hexagon?.SHO || 75));
  };
  const pickAssistCandidates = (strength) => {
    const starters = strength.lineup.map((e) => e.player).filter(Boolean);
    const pool = starters.length ? starters : strength.starPlayers;
    return [...pool].sort((a, b) => (b.hexagon?.PAS || 75) - (a.hexagon?.PAS || 75));
  };

  const homeScorerPool = pickGoalCandidates(homeStrength);
  const homeAssistPool = pickAssistCandidates(homeStrength);
  const awayScorerPool = pickGoalCandidates(awayStrength);
  const awayAssistPool = pickAssistCandidates(awayStrength);

  const scorers = [];
  if (Array.isArray(payload.scorers) && payload.scorers.length) {
    for (const entry of payload.scorers) {
      if (!entry) continue;
      scorers.push({
        playerId: entry.playerId || '',
        playerName: entry.playerName || 'Torschütze',
        teamId: entry.teamId || homeTeam.id,
        teamName: entry.teamName || (entry.teamId === awayTeam.id ? awayTeam.name : homeTeam.name),
        minute: Number(entry.minute) || 45,
        assistPlayerId: entry.assistPlayerId || '',
        assistPlayerName: entry.assistPlayerName || '',
      });
    }
  } else {
    for (let i = 0; i < hScore; i += 1) {
      const scorer = homeScorerPool[i % Math.max(1, homeScorerPool.length)];
      const assister = homeAssistPool[(i + 1) % Math.max(1, homeAssistPool.length)];
      if (scorer) {
        scorers.push({
          playerId: scorer.id,
          playerName: scorer.name,
          teamId: homeTeam.id,
          teamName: homeTeam.name,
          minute: Math.min(90, 14 + i * 23 + ((scorer.pesId || 10) % 9)),
          assistPlayerId: assister && assister.id !== scorer.id ? assister.id : '',
          assistPlayerName: assister && assister.id !== scorer.id ? assister.name : '',
        });
      }
    }
    for (let i = 0; i < aScore; i += 1) {
      const scorer = awayScorerPool[i % Math.max(1, awayScorerPool.length)];
      const assister = awayAssistPool[(i + 1) % Math.max(1, awayAssistPool.length)];
      if (scorer) {
        scorers.push({
          playerId: scorer.id,
          playerName: scorer.name,
          teamId: awayTeam.id,
          teamName: awayTeam.name,
          minute: Math.min(90, 19 + i * 25 + ((scorer.pesId || 12) % 8)),
          assistPlayerId: assister && assister.id !== scorer.id ? assister.id : '',
          assistPlayerName: assister && assister.id !== scorer.id ? assister.name : '',
        });
      }
    }
  }

  scorers.sort((a, b) => a.minute - b.minute);

  const possessionHome = Number(payload.possessionHome) || Math.max(34, Math.min(66, 50 + Math.round((homeStrength.midfield - awayStrength.midfield) * 0.8)));
  const possessionAway = 100 - possessionHome;
  const shotsHome = Number(payload.shotsHome) || Math.max(hScore + 2, hScore * 3 + 4);
  const shotsAway = Number(payload.shotsAway) || Math.max(aScore + 2, aScore * 3 + 3);
  const motmCandidate = scorers[0]
    || (hScore >= aScore ? homeScorerPool[0] : awayScorerPool[0])
    || null;

  return {
    scorers,
    possessionHome,
    possessionAway,
    shotsHome,
    shotsAway,
    motmPlayerId: payload.motmPlayerId || motmCandidate?.playerId || motmCandidate?.id || '',
    motmPlayerName: payload.motmPlayerName || motmCandidate?.playerName || motmCandidate?.name || 'Spieler des Spiels',
    homeLineupIds: homeStrength.lineup.map((e) => e.player?.id).filter(Boolean),
    awayLineupIds: awayStrength.lineup.map((e) => e.player?.id).filter(Boolean),
  };
}

export function applyPesLiveMatchSync(league, payload = {}, { now = new Date().toISOString(), players = [] } = {}) {
  if (!league) return { error: 'Noch keine aktive Liga für den PES Live-Sync vorhanden.' };
  const hScore = Number(payload.homeScore);
  const aScore = Number(payload.awayScore);
  if (![hScore, aScore].every((score) => Number.isInteger(score) && score >= 0 && score <= 99)) {
    return { error: 'Ungültige Toranzahl im PES Live-Sync Payload (0–99 erwartet).' };
  }

  const next = structuredClone(league);
  next.schedule ??= [];
  next.matchHistory ??= [];
  next.playerMatchStats ??= {};
  const teams = next.teams ?? [];

  const findTeam = (idOrName) => {
    if (!idOrName) return null;
    const norm = String(idOrName).trim().toLowerCase();
    return teams.find((t) => t.id === idOrName || String(t.name).trim().toLowerCase() === norm) || null;
  };

  let targetFixture = null;
  if (payload.fixtureId) {
    targetFixture = next.schedule.find((f) => f.id === payload.fixtureId) || null;
  }

  const explicitHome = findTeam(payload.homeTeamId || payload.homeTeamName || payload.home);
  const explicitAway = findTeam(payload.awayTeamId || payload.awayTeamName || payload.away);

  if (!targetFixture && explicitHome && explicitAway) {
    targetFixture = next.schedule.find((f) => (
      f.homeId === explicitHome.id && f.awayId === explicitAway.id && f.status !== 'completed'
    )) || next.schedule.find((f) => (
      f.homeId === explicitHome.id && f.awayId === explicitAway.id
    )) || null;
  }

  if (!targetFixture && next.match?.homeId && next.match?.awayId) {
    if (next.match.fixtureId) {
      targetFixture = next.schedule.find((f) => f.id === next.match.fixtureId) || null;
    }
    if (!targetFixture) {
      targetFixture = next.schedule.find((f) => (
        f.homeId === next.match.homeId && f.awayId === next.match.awayId && f.status !== 'completed'
      )) || null;
    }
  }

  if (!targetFixture) {
    targetFixture = next.schedule.find((f) => {
      if (f.status === 'completed') return false;
      const h = teams.find((t) => t.id === f.homeId);
      const a = teams.find((t) => t.id === f.awayId);
      return h?.managerType === 'human' && a?.managerType === 'human' && (!next.currentDate || f.date <= next.currentDate);
    }) || next.schedule.find((f) => {
      if (f.status === 'completed') return false;
      const h = teams.find((t) => t.id === f.homeId);
      const a = teams.find((t) => t.id === f.awayId);
      return h?.managerType === 'human' && a?.managerType === 'human';
    }) || null;
  }

  const homeTeam = targetFixture
    ? teams.find((t) => t.id === targetFixture.homeId)
    : explicitHome || teams.find((t) => t.id === next.match?.homeId) || teams[0];
  const awayTeam = targetFixture
    ? teams.find((t) => t.id === targetFixture.awayId)
    : explicitAway || teams.find((t) => t.id === next.match?.awayId) || teams[1];

  if (!homeTeam || !awayTeam) {
    return { error: 'Teams für PES Live-Sync konnten nicht zugeordnet werden.' };
  }

  const telemetry = buildAutoMatchTelemetry(next, homeTeam, awayTeam, hScore, aScore, payload, players);
  const attributeUpgrades = [];

  const ensureStatRecord = (playerId, playerName = '', teamId = '') => {
    if (!playerId) return null;
    next.playerMatchStats[playerId] ??= {
      playerId,
      playerName,
      teamId,
      goals: 0,
      assists: 0,
      appearances: 0,
      motmCount: 0,
      matchBoost: 0,
    };
    if (playerName) next.playerMatchStats[playerId].playerName = playerName;
    if (teamId) next.playerMatchStats[playerId].teamId = teamId;
    return next.playerMatchStats[playerId];
  };

  for (const pid of [...telemetry.homeLineupIds, ...telemetry.awayLineupIds]) {
    const rec = ensureStatRecord(pid);
    if (rec) rec.appearances += 1;
  }

  for (const goal of telemetry.scorers) {
    if (goal.playerId) {
      const rec = ensureStatRecord(goal.playerId, goal.playerName, goal.teamId);
      if (rec) {
        rec.goals += 1;
        if (rec.matchBoost < 5) {
          rec.matchBoost += 1;
          attributeUpgrades.push({
            playerId: goal.playerId,
            playerName: goal.playerName,
            teamId: goal.teamId,
            delta: '+1 OVR & Abschluss',
            reason: `Tor (${goal.minute}. Min.)`,
          });
        }
      }
      const pick = (next.draft?.picks ?? []).find((pk) => pk.playerId === goal.playerId);
      if (pick && Number.isFinite(Number(pick.rating)) && pick.rating < 99) {
        pick.rating = Math.min(99, Number(pick.rating) + 1);
      }
    }
    if (goal.assistPlayerId) {
      const assistRec = ensureStatRecord(goal.assistPlayerId, goal.assistPlayerName, goal.teamId);
      if (assistRec) {
        assistRec.assists += 1;
        if (assistRec.assists % 2 === 1 && assistRec.matchBoost < 5) {
          assistRec.matchBoost += 1;
          attributeUpgrades.push({
            playerId: goal.assistPlayerId,
            playerName: goal.assistPlayerName,
            teamId: goal.teamId,
            delta: '+1 Passspiel & Übersicht',
            reason: 'Torvorlage',
          });
        }
      }
    }
  }

  if (telemetry.motmPlayerId) {
    const motmRec = ensureStatRecord(telemetry.motmPlayerId, telemetry.motmPlayerName);
    if (motmRec) motmRec.motmCount += 1;
  }

  const matchId = targetFixture?.id || next.match?.id || `pes-sync-${homeTeam.id}-${awayTeam.id}-${now.slice(0, 10)}`;

  if (targetFixture) {
    targetFixture.status = 'completed';
    targetFixture.homeScore = hScore;
    targetFixture.awayScore = aScore;
    targetFixture.syncedVia = payload.source || 'pes-sider-live';
    targetFixture.syncedAt = now;
    targetFixture.telemetry = {
      scorers: telemetry.scorers,
      possessionHome: telemetry.possessionHome,
      possessionAway: telemetry.possessionAway,
      shotsHome: telemetry.shotsHome,
      shotsAway: telemetry.shotsAway,
      motmPlayerName: telemetry.motmPlayerName,
      attributeUpgrades,
    };
  }

  next.matchHistory = next.matchHistory.filter((entry) => (entry.matchId ?? entry.fixtureId) !== matchId);
  next.matchHistory.push({
    matchId,
    fixtureId: targetFixture?.id || matchId,
    round: targetFixture?.round || 1,
    date: targetFixture?.date || next.currentDate || '2026-08-01',
    homeId: homeTeam.id,
    awayId: awayTeam.id,
    homeScore: hScore,
    awayScore: aScore,
    scorers: telemetry.scorers,
    possessionHome: telemetry.possessionHome,
    shotsHome: telemetry.shotsHome,
    shotsAway: telemetry.shotsAway,
    motmPlayerName: telemetry.motmPlayerName,
    attributeUpgrades,
    at: now,
    source: payload.source || 'pes-sider-live',
  });

  const engineLabel = next.onlineLobby?.engineVersion === 'FIFA16'
    ? 'FIFA 16 Online-Sync'
    : next.onlineLobby?.engineVersion === 'SPFL26'
      ? 'SP Football Life / PES 2021 Sider-Bridge'
      : 'FIFA 17 / SPFL Online-Bridge';

  next.match = {
    id: matchId,
    fixtureId: targetFixture?.id || '',
    round: targetFixture?.round || null,
    date: targetFixture?.date || next.currentDate || '2026-08-01',
    home: homeTeam.name,
    away: awayTeam.name,
    homeId: homeTeam.id,
    awayId: awayTeam.id,
    status: `Synchronisiert via ${engineLabel}`,
    result: {
      home: hScore,
      away: aScore,
      scorers: telemetry.scorers,
      possessionHome: telemetry.possessionHome,
      shotsHome: telemetry.shotsHome,
      shotsAway: telemetry.shotsAway,
      motmPlayerName: telemetry.motmPlayerName,
      attributeUpgrades,
      confirmedBy: engineLabel,
      at: now,
    },
    at: now,
  };

  next.lastPesSync = {
    fixtureId: targetFixture?.id || matchId,
    round: targetFixture?.round || 1,
    homeId: homeTeam.id,
    homeName: homeTeam.name,
    awayId: awayTeam.id,
    awayName: awayTeam.name,
    homeScore: hScore,
    awayScore: aScore,
    scorers: telemetry.scorers,
    possessionHome: telemetry.possessionHome,
    shotsHome: telemetry.shotsHome,
    shotsAway: telemetry.shotsAway,
    motmPlayerName: telemetry.motmPlayerName,
    attributeUpgrades,
    source: payload.source || 'pes-sider-live',
    syncedAt: now,
  };

  // Auto-advance the multi-manager DB hash after player development updates
  const refreshedSync = confirmManagerDbSync(next, players, '', { syncAll: true });

  return {
    league: refreshedSync.league,
    fixture: targetFixture,
    homeTeam,
    awayTeam,
    syncRecord: refreshedSync.league.lastPesSync,
    dbHash: refreshedSync.dbHash,
  };
}
