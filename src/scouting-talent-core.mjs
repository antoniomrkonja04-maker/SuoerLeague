import { calculatePlayerMarketValue, normalizeCanonicalPosition } from './transfer-core.mjs';
import { derivePesProfile } from './pes-core.mjs';

const clone = (value) => structuredClone(value);
const fail = (league, error) => ({ league, error });

function hashSeed(input = '') {
  const str = String(input);
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FIRST_NAMES = [
  'Matteo', 'Lukas', 'Kilian', 'Enzo', 'Thiago', 'Noah', 'Lamine', 'Kenan',
  'Arda', 'Xavi', 'Gabriel', 'Santi', 'Diogo', 'Gonçalo', 'Mikel', 'Jorrel',
  'Warren', 'Désiré', 'Nico', 'Aleksandar', 'Benjamin', 'Rayan', 'Savinho', 'Endrick',
  'Leny', 'Pau', 'Kobbie', 'Ethan', 'Geovany', 'Assane', 'Samu', 'Vitor',
  'Rodrigo', 'Valentin', 'Claudio', 'Franco', 'flipped', 'Luka', 'Martin', 'Oscar',
].filter((n) => n !== 'flipped');

const LAST_NAMES = [
  'Brenner', 'Moreira', 'Velázquez', 'Lindqvist', 'Kovač', 'Dubois', 'Santana', 'De Vries',
  'Almeida', 'Bianchi', 'Ribeiro', 'van den Berg', 'Hofer', 'Steiner', 'Yılmaz', 'Fernández',
  'Mastantuono', 'Echeverri', 'Quenda', 'Nwaneri', 'Baturina', 'Vušković', 'Bergvall', 'Ouédraogo',
  'Wanner', 'Bischof', 'Mora', 'Bouaddi', 'Doué', 'Bardghji', 'Hato', 'Moscardo',
];

const NATIONALITIES = [
  { code: 'DE', label: 'Deutschland', flag: 'DE' },
  { code: 'AT', label: 'Österreich', flag: 'AT' },
  { code: 'BR', label: 'Brasilien', flag: 'BR' },
  { code: 'FR', label: 'Frankreich', flag: 'FR' },
  { code: 'ES', label: 'Spanien', flag: 'ES' },
  { code: 'AR', label: 'Argentinien', flag: 'AR' },
  { code: 'PT', label: 'Portugal', flag: 'PT' },
  { code: 'NL', label: 'Niederlande', flag: 'NL' },
  { code: 'EN', label: 'England', flag: 'EN' },
  { code: 'HR', label: 'Kroatien', flag: 'HR' },
  { code: 'IT', label: 'Italien', flag: 'IT' },
  { code: 'TR', label: 'Türkei', flag: 'TR' },
];

const POSITIONS = ['ST', 'LW', 'RW', 'CM', 'DM', 'CB', 'LB', 'RB', 'GK'];

const TALENT_ARCHETYPES = {
  ST: ['Knipser-Wunderkind', 'Kompletter Mittelstürmer', 'Tiefenläufer'],
  LW: ['Inverser Edeltechniker', 'Explosiver Flügelstürmer', '1-gegen-1 Dribbler'],
  RW: ['Kreativer Rechtsaußen', 'Tempo-Dribbler', 'Raumdeuter'],
  CM: ['Box-to-Box Motor', 'Tiefen-Spielmacher', 'Kreativer Achter'],
  DM: ['Moderner Sechser', 'Balleroberer', 'Regista-Talent'],
  CB: ['Ballspielender IV', 'Athletischer Abwehrchef', 'Zweikampf-Monster'],
  LB: ['Offensiver Außenverteidiger', 'Moderner Schienenspieler'],
  RB: ['Dynamischer Rechtsverteidiger', 'Inverser Außenverteidiger'],
  GK: ['Mitspielender Torwart', 'Reflex-Talent'],
};

/**
 * Generates deterministic or seeded random young talents / regens (aged 16-20)
 * compatible with the PES 40-99 attribute engine and Free Agency pool.
 */
export function generateRandomTalents(count = 16, { seed = 'career-2026-talents', existingIds = new Set() } = {}) {
  const talents = [];
  const usedIds = new Set(existingIds);
  let cursor = 0;

  while (talents.length < count && cursor < count * 8) {
    cursor += 1;
    const h = hashSeed(`${seed}:talent:${cursor}`);
    const first = FIRST_NAMES[h % FIRST_NAMES.length];
    const last = LAST_NAMES[(h >>> 5) % LAST_NAMES.length];
    const nat = NATIONALITIES[(h >>> 10) % NATIONALITIES.length];
    const position = POSITIONS[(h >>> 14) % POSITIONS.length];
    const age = 16 + ((h >>> 18) % 5); // 16..20
    const baseRating = 68 + ((h >>> 21) % 13); // 68..80
    const potential = Math.min(96, Math.max(baseRating + 7, 83 + ((h >>> 25) % 13))); // 83..95
    const id = `talent-${seed.replace(/[^a-z0-9]/gi, '').slice(-8).toLowerCase()}-${cursor}`;
    if (usedIds.has(id)) continue;
    usedIds.add(id);

    const archetypes = TALENT_ARCHETYPES[position] || TALENT_ARCHETYPES.CM;
    const archetype = archetypes[(h >>> 7) % archetypes.length];
    const tierBadge = potential >= 91 ? 'Wunderkind' : potential >= 87 ? 'Top-Talent' : 'Rohdiamant';

    talents.push({
      id,
      name: `${first} ${last}`,
      club: 'Free Agent · Youth Academy',
      originClub: `${nat.label} U21 (${nat.code})`,
      nationality: nat.label,
      nationalityFlag: nat.code,
      position,
      age,
      rating: baseRating,
      potential,
      playingStyle: archetype,
      talentTier: tierBadge,
      isGeneratedTalent: true,
      ratingSource: 'FM Scout Regen',
    });
  }

  return talents;
}

/**
 * Computes or retrieves a player's contract details (salary, expiry year, release clause).
 */
export function getPlayerContract(league, player) {
  const playerId = typeof player === 'string' ? player : player?.id;
  const rawPlayer = typeof player === 'object' && player ? player : { id: playerId, rating: 78, position: 'CM' };
  const pick = (league?.draft?.picks ?? []).find((entry) => entry.playerId === playerId);
  const stored = league?.contracts?.[playerId];

  const currentYear = Number(String(league?.currentDate || '2026-08-01').slice(0, 4)) || 2026;
  const rating = Number(rawPlayer.rating ?? pick?.rating) || 78;
  const position = rawPlayer.position || pick?.position || 'CM';
  const marketValue = calculatePlayerMarketValue({ rating, position });

  if (!pick && !stored?.teamId) {
    const demandedSalary = Math.max(0.8, Number(((marketValue * 0.09) + (rawPlayer.isGeneratedTalent ? 0.4 : 0)).toFixed(1)));
    const signingBonus = Math.max(1, Math.round(marketValue * 0.22));
    return {
      playerId,
      teamId: null,
      teamName: 'Vereinslos (Free Agent)',
      isFreeAgent: true,
      salary: demandedSalary,
      signingBonus,
      contractUntil: null,
      yearsRemaining: 0,
      releaseClause: Math.round(marketValue * 1.45),
      marketValue,
      statusLabel: 'Ablösefrei verfügbar',
      isExpiring: false,
    };
  }

  const h = hashSeed(`${playerId}:${pick?.teamId || stored?.teamId || 'club'}`);
  const defaultUntil = currentYear + 1 + (h % 4); // 1 to 4 years left
  const contractUntil = stored?.contractUntil ?? defaultUntil;
  const yearsRemaining = Math.max(0, contractUntil - currentYear);
  const salary = stored?.salary ?? Math.max(1.0, Number((marketValue * 0.11).toFixed(1)));
  const releaseClause = stored?.releaseClause ?? Math.max(marketValue + 5, Math.round(marketValue * 1.45));
  const isExpiring = yearsRemaining <= 1;

  return {
    playerId,
    teamId: pick?.teamId || stored?.teamId,
    teamName: pick?.teamName || stored?.teamName || '',
    isFreeAgent: false,
    salary,
    signingBonus: 0,
    contractUntil,
    yearsRemaining,
    releaseClause,
    marketValue,
    statusLabel: isExpiring ? `Läuft ${contractUntil} aus` : `Vertrag bis ${contractUntil}`,
    isExpiring,
  };
}

/**
 * Football Manager style scouting report & fog-of-war calculation.
 * - Own team players: always 100% scouted (level 2).
 * - Other players: level 0 (Unbekannt · 0%), level 1 (Vorbericht · 50%), or level 2 (Vollständig · 100%).
 */
export function getPlayerScoutingReport(league, managerTeamId, rawPlayer) {
  const pes = derivePesProfile(rawPlayer, league);
  const contract = getPlayerContract(league, pes);
  const pick = (league?.draft?.picks ?? []).find((entry) => entry.playerId === pes.id);
  const ownerTeamId = pick?.teamId || null;

  const isOwnPlayer = Boolean(managerTeamId && ownerTeamId && ownerTeamId === managerTeamId);
  const reportKey = `${managerTeamId || 'host'}:${pes.id}`;
  const storedReport = league?.scouting?.reports?.[reportKey] ?? league?.scouting?.reports?.[pes.id] ?? null;

  const level = isOwnPlayer ? 2 : (storedReport?.level ?? 0);
  const progress = isOwnPlayer ? 100 : level === 2 ? 100 : level === 1 ? 50 : 0;

  const h = hashSeed(`scout:${pes.id}`);
  const potential = rawPlayer?.potential
    ? Number(rawPlayer.potential)
    : Math.min(97, Math.max(pes.rating, pes.rating + (pes.age <= 21 ? 7 + (h % 6) : pes.age <= 25 ? 3 + (h % 4) : (h % 2))));

  // Grade calculation (A+, A, B+, B, C)
  const scoreVal = Math.round(pes.rating * 0.65 + potential * 0.35);
  const grade = scoreVal >= 88 ? 'A+' : scoreVal >= 84 ? 'A' : scoreVal >= 80 ? 'B+' : scoreVal >= 75 ? 'B' : 'C+';

  const recommendation = scoreVal >= 88
    ? 'Weltklasse-Verstärkung · Sofort verpflichten'
    : scoreVal >= 84
      ? 'Stammspieler-Qualität für die K.-o.-Phase'
      : pes.age <= 20 && potential >= 86
        ? 'Hochkarätiges Zukunftstalent mit enormem Wertsteigerungspotenzial'
        : 'Solide Kaderoption für die Rotation';

  if (level >= 2) {
    return {
      playerId: pes.id,
      level: 2,
      progress: 100,
      statusLabel: isOwnPlayer ? 'Eigener Kader (100%)' : 'Vollständig gescoutet (100%)',
      isFullyScouted: true,
      isPartiallyScouted: true,
      isOwnPlayer,
      displayedOvr: `${pes.rating}`,
      exactOvr: pes.rating,
      displayedPotential: `${potential}`,
      exactPotential: potential,
      grade,
      recommendation,
      hexagonDisplay: {
        SHO: `${pes.hexagon.SHO}`,
        PAS: `${pes.hexagon.PAS}`,
        DRI: `${pes.hexagon.DRI}`,
        PAC: `${pes.hexagon.PAC}`,
        PHY: `${pes.hexagon.PHY}`,
        DEF: `${pes.hexagon.DEF}`,
      },
      contract,
      pesProfile: pes,
    };
  }

  if (level === 1) {
    const minOvr = Math.max(40, pes.rating - 2);
    const maxOvr = Math.min(99, pes.rating + 2);
    const minPot = Math.max(minOvr, potential - 3);
    const maxPot = Math.min(99, potential + 2);
    return {
      playerId: pes.id,
      level: 1,
      progress: 50,
      statusLabel: 'Vorbericht (50%)',
      isFullyScouted: false,
      isPartiallyScouted: true,
      isOwnPlayer: false,
      displayedOvr: `${minOvr}–${maxOvr}`,
      exactOvr: pes.rating,
      displayedPotential: `${minPot}–${maxPot}`,
      exactPotential: potential,
      grade: `${grade[0]}?`,
      recommendation: 'Vorbericht liegt vor · Für exakte 40–99 Einzelwerte & Potenzial Abschlussbericht anfordern.',
      hexagonDisplay: {
        SHO: `${pes.hexagon.SHO}`,
        PAS: `${Math.max(40, pes.hexagon.PAS - 3)}–${Math.min(99, pes.hexagon.PAS + 3)}`,
        DRI: `${pes.hexagon.DRI}`,
        PAC: `${pes.hexagon.PAC}`,
        PHY: `${Math.max(40, pes.hexagon.PHY - 4)}–${Math.min(99, pes.hexagon.PHY + 3)}`,
        DEF: `${Math.max(40, pes.hexagon.DEF - 4)}–${Math.min(99, pes.hexagon.DEF + 3)}`,
      },
      contract,
      pesProfile: pes,
    };
  }

  // Level 0: Unbekannt (0% Fog of War)
  const spreadLow = 4 + (h % 3);
  const spreadHigh = 4 + ((h >>> 3) % 4);
  const minOvr = Math.max(45, pes.rating - spreadLow);
  const maxOvr = Math.min(99, pes.rating + spreadHigh);
  const minPot = Math.max(minOvr, potential - 6);
  const maxPot = Math.min(99, potential + 5);

  const fogRange = (val) => `${Math.max(40, val - 6)}–${Math.min(99, val + 6)}`;

  return {
    playerId: pes.id,
    level: 0,
    progress: 0,
    statusLabel: 'Ungescoutet (0%)',
    isFullyScouted: false,
    isPartiallyScouted: false,
    isOwnPlayer: false,
    displayedOvr: `${minOvr}–${maxOvr}`,
    exactOvr: pes.rating,
    displayedPotential: `${minPot}–${maxPot}`,
    exactPotential: potential,
    grade: '??',
    recommendation: 'Noch kein Scout-Bericht vorhanden · Entsende einen Scout, um OVR, Potenzial und alle FIFA 17 Werte aufzudecken.',
    hexagonDisplay: {
      SHO: fogRange(pes.hexagon.SHO),
      PAS: '??',
      DRI: fogRange(pes.hexagon.DRI),
      PAC: fogRange(pes.hexagon.PAC),
      PHY: '??',
      DEF: '??',
    },
    contract,
    pesProfile: pes,
  };
}

/**
 * Assigns a scout to a player, advancing scouting knowledge (0 -> 1 -> 2, or directly to 2 if full = true).
 */
export function scoutPlayer(league, managerTeamId, rawPlayer, { full = false, now = new Date().toISOString() } = {}) {
  if (!league) return fail(league, 'Keine aktive Liga vorhanden.');
  const playerId = typeof rawPlayer === 'string' ? rawPlayer : rawPlayer?.id;
  if (!playerId) return fail(league, 'Ungültiger Spieler für das Scouting.');

  const teamId = managerTeamId || league.teams?.[0]?.id || 'host';
  const next = clone(league);
  next.scouting ??= { reports: {}, shortlist: [] };
  next.scouting.reports ??= {};

  const reportKey = `${teamId}:${playerId}`;
  const currentLevel = next.scouting.reports[reportKey]?.level ?? next.scouting.reports[playerId]?.level ?? 0;
  if (currentLevel >= 2) {
    return {
      league: next,
      report: getPlayerScoutingReport(next, teamId, typeof rawPlayer === 'object' ? rawPlayer : { id: playerId }),
      alreadyComplete: true,
    };
  }

  const nextLevel = full ? 2 : Math.min(2, currentLevel + 1);
  const cost = full ? (currentLevel === 0 ? 1.0 : 0.5) : 0.5;
  const team = next.teams?.find((t) => t.id === teamId);
  if (team && Number.isFinite(team.budget) && team.budget >= cost) {
    team.budget = Number((team.budget - cost).toFixed(1));
  }

  const entry = {
    playerId,
    teamId,
    level: nextLevel,
    progress: nextLevel === 2 ? 100 : 50,
    updatedAt: now,
  };
  next.scouting.reports[reportKey] = entry;
  next.scouting.reports[playerId] = entry;

  const report = getPlayerScoutingReport(next, teamId, typeof rawPlayer === 'object' ? rawPlayer : { id: playerId });
  return { league: next, report, cost };
}

/**
 * Toggles a player on the manager's Scouting Shortlist.
 */
export function toggleShortlistPlayer(league, managerTeamId, playerId) {
  if (!league || !playerId) return fail(league, 'Spieler konnte nicht zur Shortlist hinzugefügt werden.');
  const next = clone(league);
  next.scouting ??= { reports: {}, shortlist: [] };
  next.scouting.shortlist ??= [];
  const key = `${managerTeamId || 'host'}:${playerId}`;
  const idx = next.scouting.shortlist.indexOf(key);
  let added = false;
  if (idx >= 0) {
    next.scouting.shortlist.splice(idx, 1);
  } else {
    next.scouting.shortlist.push(key);
    added = true;
  }
  return { league: next, added };
}

export function isPlayerShortlisted(league, managerTeamId, playerId) {
  const list = league?.scouting?.shortlist ?? [];
  return list.includes(`${managerTeamId || 'host'}:${playerId}`);
}

/**
 * Extends a contract for a player currently owned by managerTeamId.
 */
export function extendPlayerContract(league, managerTeamId, rawPlayer, { additionalYears = 2, now = new Date().toISOString() } = {}) {
  if (!league) return fail(league, 'Keine aktive Liga.');
  const playerId = typeof rawPlayer === 'string' ? rawPlayer : rawPlayer?.id;
  const pick = (league.draft?.picks ?? []).find((entry) => entry.playerId === playerId);
  if (!pick || pick.teamId !== managerTeamId) {
    return fail(league, 'Du kannst nur Verträge von Spielern deines eigenen Vereins verlängern.');
  }

  const yearsToAdd = Math.max(1, Math.min(5, Number(additionalYears) || 2));
  const currentContract = getPlayerContract(league, typeof rawPlayer === 'object' ? rawPlayer : { id: playerId, rating: pick.rating, position: pick.position });
  const bonusCost = Math.max(1, Math.round(currentContract.salary * 0.6 * yearsToAdd));
  const next = clone(league);
  const team = next.teams?.find((t) => t.id === managerTeamId);
  if (!team) return fail(league, 'Team nicht gefunden.');
  if (Number.isFinite(team.budget) && team.budget < bonusCost) {
    return fail(league, `Nicht genügend Budget für das Handgeld der Vertragsverlängerung (${bonusCost} Mio. € benötigt).`);
  }

  if (Number.isFinite(team.budget)) {
    team.budget = Number((team.budget - bonusCost).toFixed(1));
  }
  next.contracts ??= {};
  const newUntil = Math.min(2033, (currentContract.contractUntil || 2027) + yearsToAdd);
  const newSalary = Number((currentContract.salary * 1.12).toFixed(1));
  const newClause = Math.round(currentContract.releaseClause * 1.15);

  next.contracts[playerId] = {
    playerId,
    teamId: managerTeamId,
    teamName: team.name,
    salary: newSalary,
    contractUntil: newUntil,
    releaseClause: newClause,
    extendedAt: now,
  };

  return {
    league: next,
    contract: getPlayerContract(next, typeof rawPlayer === 'object' ? rawPlayer : { id: playerId, rating: pick.rating, position: pick.position }),
    bonusCost,
  };
}

/**
 * Signs a Free Agent or generated Wonderkid directly to managerTeamId.
 */
export function signFreeAgent(league, managerTeamId, rawPlayer, { contractYears = 3, now = new Date().toISOString() } = {}) {
  if (!league || !rawPlayer?.id) return fail(league, 'Spieler konnte nicht verpflichtet werden.');
  const existingPick = (league.draft?.picks ?? []).find((entry) => entry.playerId === rawPlayer.id);
  if (existingPick) {
    return fail(league, `${rawPlayer.name} steht bereits bei ${existingPick.teamName} unter Vertrag.`);
  }

  const next = clone(league);
  const buyer = next.teams?.find((t) => t.id === managerTeamId);
  if (!buyer) return fail(league, 'Bitte wähle ein gültiges Manager-Team.');

  const contractInfo = getPlayerContract(next, rawPlayer);
  const signingFee = contractInfo.signingBonus;
  if (Number.isFinite(buyer.budget) && buyer.budget < signingFee) {
    return fail(league, `Das Budget von ${buyer.name} reicht nicht für das Handgeld (${signingFee} Mio. €).`);
  }

  if (Number.isFinite(buyer.budget)) {
    buyer.budget = Number((buyer.budget - signingFee).toFixed(1));
  }

  const currentYear = Number(String(next.currentDate || '2026-08-01').slice(0, 4)) || 2026;
  const years = Math.max(1, Math.min(5, Number(contractYears) || 3));
  const contractUntil = currentYear + years;

  next.draft ??= { order: [], picks: [] };
  next.draft.picks ??= [];
  next.draft.picks.push({
    playerId: rawPlayer.id,
    playerName: rawPlayer.name,
    position: normalizeCanonicalPosition(rawPlayer.position || 'CM'),
    rating: Number(rawPlayer.rating) || 75,
    teamId: buyer.id,
    teamName: buyer.name,
    managerName: buyer.managerName || buyer.name,
    number: next.draft.picks.length + 1,
    round: 0,
    signedViaFreeAgency: true,
    at: now,
  });

  next.contracts ??= {};
  next.contracts[rawPlayer.id] = {
    playerId: rawPlayer.id,
    teamId: buyer.id,
    teamName: buyer.name,
    salary: contractInfo.salary,
    contractUntil,
    releaseClause: contractInfo.releaseClause,
    signedAt: now,
  };

  // Automatically unlock 100% scouting report for the new signing
  next.scouting ??= { reports: {}, shortlist: [] };
  next.scouting.reports ??= {};
  next.scouting.reports[`${buyer.id}:${rawPlayer.id}`] = {
    playerId: rawPlayer.id,
    teamId: buyer.id,
    level: 2,
    progress: 100,
    updatedAt: now,
  };

  next.transfers ??= [];
  const transfer = {
    callId: `free-agent-${rawPlayer.id}-${Date.now()}`,
    playerId: rawPlayer.id,
    playerName: rawPlayer.name,
    position: rawPlayer.position || 'CM',
    rating: Number(rawPlayer.rating) || 75,
    sellerTeamId: 'free-agency',
    sellerTeamName: rawPlayer.isGeneratedTalent ? 'Free Agency · Jugendakademie' : 'Free Agency (Vereinslos)',
    buyerTeamId: buyer.id,
    buyerTeamName: buyer.name,
    fee: signingFee,
    reason: `Vertrag bis ${contractUntil} (${contractInfo.salary} Mio. €/Jahr · Handgeld ${signingFee} Mio. €)`,
    signedAt: now,
    signatures: [
      {
        managerTeamId: buyer.id,
        managerName: buyer.managerName || buyer.name,
        signedAt: now,
      },
    ],
    at: now,
  };
  next.transfers.push(transfer);

  return {
    league: next,
    transfer,
    contract: next.contracts[rawPlayer.id],
  };
}

/**
 * Releases a player from managerTeamId's roster into Free Agency.
 */
export function releasePlayerToFreeAgency(league, managerTeamId, playerId, now = new Date().toISOString()) {
  if (!league || !playerId) return fail(league, 'Ungültiger Spieler.');
  const idx = (league.draft?.picks ?? []).findIndex((entry) => entry.playerId === playerId && entry.teamId === managerTeamId);
  if (idx < 0) return fail(league, 'Dieser Spieler steht nicht im Kader deines Vereins.');

  const next = clone(league);
  const removedPick = next.draft.picks[idx];
  next.draft.picks.splice(idx, 1);

  if (next.squads?.[managerTeamId]?.starters) {
    for (const [slotId, starterId] of Object.entries(next.squads[managerTeamId].starters)) {
      if (starterId === playerId) next.squads[managerTeamId].starters[slotId] = null;
    }
  }
  if (next.contracts?.[playerId]) {
    delete next.contracts[playerId];
  }

  return {
    league: next,
    releasedPlayerName: removedPick.playerName || removedPick.name || playerId,
    at: now,
  };
}
