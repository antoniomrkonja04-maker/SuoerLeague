import { rankTeamsFromResults } from './transfer-core.mjs';
import { teamStrength } from './calendar-core.mjs';

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return hash >>> 0 || 1;
}

function randomFrom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isLeaguePhaseComplete(league) {
  if (!league) return false;
  const schedule = Array.isArray(league.schedule) ? league.schedule : [];
  if (schedule.length === 0) return false;
  const history = Array.isArray(league.matchHistory) ? league.matchHistory : [];
  return history.length >= schedule.length;
}

export function getLeaguePhaseProgress(league) {
  const total = Array.isArray(league?.schedule) && league.schedule.length > 0 ? league.schedule.length : 870;
  const completed = Array.isArray(league?.matchHistory) ? league.matchHistory.length : 0;
  const currentRound = Math.min(58, completed > 0 ? Math.floor(completed / 15) + (completed % 15 !== 0 ? 1 : 0) : 1);
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const isComplete = total > 0 && completed >= total;
  return { completed, total, currentRound, maxRounds: 58, percent, isComplete };
}

// UEFA 2024+ Knockout Phase Play-offs:
// Teams 9–24 contest 8 play-off ties. Seeds 9–16 (seeded) face Seeds 17–24 (unseeded).
// Winners advance to the Round of 16 against direct qualifiers (Seeds 1–8).
export const PLAYOFF_SEED_PAIRS = [
  { id: 'po-1', label: 'Play-off 1', side: 'east', slot: 3, homeSeed: 9, awaySeed: 24, nextMatchId: 'r16-e4', nextSlot: 'away' },
  { id: 'po-2', label: 'Play-off 2', side: 'east', slot: 2, homeSeed: 10, awaySeed: 23, nextMatchId: 'r16-e3', nextSlot: 'away' },
  { id: 'po-3', label: 'Play-off 3', side: 'west', slot: 3, homeSeed: 11, awaySeed: 22, nextMatchId: 'r16-w4', nextSlot: 'away' },
  { id: 'po-4', label: 'Play-off 4', side: 'east', slot: 1, homeSeed: 12, awaySeed: 21, nextMatchId: 'r16-e2', nextSlot: 'away' },
  { id: 'po-5', label: 'Play-off 5', side: 'west', slot: 1, homeSeed: 13, awaySeed: 20, nextMatchId: 'r16-w2', nextSlot: 'away' },
  { id: 'po-6', label: 'Play-off 6', side: 'west', slot: 2, homeSeed: 14, awaySeed: 19, nextMatchId: 'r16-w3', nextSlot: 'away' },
  { id: 'po-7', label: 'Play-off 7', side: 'east', slot: 0, homeSeed: 15, awaySeed: 18, nextMatchId: 'r16-e1', nextSlot: 'away' },
  { id: 'po-8', label: 'Play-off 8', side: 'west', slot: 0, homeSeed: 16, awaySeed: 17, nextMatchId: 'r16-w1', nextSlot: 'away' },
];

// UEFA 2024+ Round of 16 (Achtelfinale):
// Direct qualifiers (Seeds 1–8) are seeded at home, paired with the 8 Play-off winners.
export const R16_TEMPLATE = [
  // West Wing (Left)
  { id: 'r16-w1', side: 'west', slot: 0, homeSeed: 1, playoffSourceId: 'po-8', nextMatchId: 'qf-w1', nextSlot: 'home' },
  { id: 'r16-w2', side: 'west', slot: 1, homeSeed: 4, playoffSourceId: 'po-5', nextMatchId: 'qf-w1', nextSlot: 'away' },
  { id: 'r16-w3', side: 'west', slot: 2, homeSeed: 3, playoffSourceId: 'po-6', nextMatchId: 'qf-w2', nextSlot: 'home' },
  { id: 'r16-w4', side: 'west', slot: 3, homeSeed: 6, playoffSourceId: 'po-3', nextMatchId: 'qf-w2', nextSlot: 'away' },
  // East Wing (Right)
  { id: 'r16-e1', side: 'east', slot: 0, homeSeed: 2, playoffSourceId: 'po-7', nextMatchId: 'qf-e1', nextSlot: 'home' },
  { id: 'r16-e2', side: 'east', slot: 1, homeSeed: 5, playoffSourceId: 'po-4', nextMatchId: 'qf-e1', nextSlot: 'away' },
  { id: 'r16-e3', side: 'east', slot: 2, homeSeed: 7, playoffSourceId: 'po-2', nextMatchId: 'qf-e2', nextSlot: 'home' },
  { id: 'r16-e4', side: 'east', slot: 3, homeSeed: 8, playoffSourceId: 'po-1', nextMatchId: 'qf-e2', nextSlot: 'away' },
];

export const QF_TEMPLATE = [
  { id: 'qf-w1', side: 'west', slot: 0, nextMatchId: 'sf-w1', nextSlot: 'home' },
  { id: 'qf-w2', side: 'west', slot: 1, nextMatchId: 'sf-w1', nextSlot: 'away' },
  { id: 'qf-e1', side: 'east', slot: 0, nextMatchId: 'sf-e1', nextSlot: 'home' },
  { id: 'qf-e2', side: 'east', slot: 1, nextMatchId: 'sf-e1', nextSlot: 'away' },
];

export const SF_TEMPLATE = [
  { id: 'sf-w1', side: 'west', slot: 0, nextMatchId: 'final-1', nextSlot: 'home' },
  { id: 'sf-e1', side: 'east', slot: 0, nextMatchId: 'final-1', nextSlot: 'away' },
];

function buildTeamEntry(standingsRow, fallbackTeam, seedNumber) {
  const teamId = standingsRow?.teamId || fallbackTeam?.id || `seed-${seedNumber}`;
  const teamName = standingsRow?.teamName || fallbackTeam?.name || `Team #${seedNumber}`;
  const qualification = seedNumber <= 8 ? 'direct-knockout' : seedNumber <= 24 ? 'playoff' : 'eliminated';
  return {
    teamId,
    teamName,
    seed: seedNumber,
    qualification,
    points: standingsRow?.points ?? 0,
    goalDifference: standingsRow?.goalDifference ?? 0,
  };
}

export function createKnockoutBracket(league, { allowIncomplete = false } = {}) {
  if (!league || !Array.isArray(league.teams) || league.teams.length < 24) {
    return { error: 'Für das UEFA Champions System werden mindestens 24 Teams benötigt.' };
  }
  if (!allowIncomplete && !isLeaguePhaseComplete(league)) {
    return {
      error: 'Die K.-o.-Phase und Playoffs sind erst nach Abschluss der gesamten Ligaphase (58 Spieltage) verfügbar.',
      locked: true,
      league,
    };
  }

  const standings = rankTeamsFromResults(league.teams, league.matchHistory ?? []);
  const top24 = Array.from({ length: 24 }, (_, idx) => {
    const seed = idx + 1;
    const row = standings[idx];
    const team = league.teams.find((t) => t.id === row?.teamId) || league.teams[idx];
    return buildTeamEntry(row, team, seed);
  });
  const bySeed = new Map(top24.map((entry) => [entry.seed, entry]));

  // 1. Play-offs (8 Ties: Seeds 9–16 vs Seeds 17–24)
  const playoffs = PLAYOFF_SEED_PAIRS.map((pair) => {
    const home = bySeed.get(pair.homeSeed);
    const away = bySeed.get(pair.awaySeed);
    return {
      id: pair.id,
      round: 'playoffs',
      roundLabel: 'PLAY-OFFS',
      label: pair.label,
      side: pair.side,
      slot: pair.slot,
      nextMatchId: pair.nextMatchId,
      nextSlot: pair.nextSlot,
      home: { ...home },
      away: { ...away },
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      status: 'scheduled',
    };
  });

  // 2. Round of 16 (8 Ties: Seeds 1–8 direct, waiting for Play-off winners)
  const r16 = R16_TEMPLATE.map((tpl) => {
    const home = bySeed.get(tpl.homeSeed);
    return {
      id: tpl.id,
      round: 'r16',
      roundLabel: 'ACHTELFINALE',
      side: tpl.side,
      slot: tpl.slot,
      playoffSourceId: tpl.playoffSourceId,
      nextMatchId: tpl.nextMatchId,
      nextSlot: tpl.nextSlot,
      home: { ...home },
      away: null, // Populated as play-off matches complete
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      status: 'pending',
    };
  });

  // 3. Quarter-finals (4 Ties)
  const qf = QF_TEMPLATE.map((item) => ({
    id: item.id,
    round: 'qf',
    roundLabel: 'VIERTELFINALE',
    side: item.side,
    slot: item.slot,
    nextMatchId: item.nextMatchId,
    nextSlot: item.nextSlot,
    home: null,
    away: null,
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    status: 'pending',
  }));

  // 4. Semi-finals (2 Ties)
  const sf = SF_TEMPLATE.map((item) => ({
    id: item.id,
    round: 'sf',
    roundLabel: 'HALBFINALE',
    side: item.side,
    slot: item.slot,
    nextMatchId: item.nextMatchId,
    nextSlot: item.nextSlot,
    home: null,
    away: null,
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    status: 'pending',
  }));

  // 5. Grand Final
  const final = {
    id: 'final-1',
    round: 'final',
    roundLabel: 'FINALE',
    side: 'center',
    slot: 0,
    home: null,
    away: null,
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    status: 'pending',
  };

  const next = structuredClone(league);
  next.knockout = {
    season: league.season || '2026/27',
    format: 'uefa-2024',
    createdAt: new Date().toISOString(),
    seeds: top24,
    rounds: {
      playoffs,
      r16,
      qf,
      sf,
      final: [final],
    },
    champion: null,
  };

  return { league: next, knockout: next.knockout };
}

export function ensureKnockoutBracket(league, { allowIncomplete = false } = {}) {
  if (!league) return { error: 'Keine aktive Liga.' };
  if (!allowIncomplete && !isLeaguePhaseComplete(league)) {
    return {
      error: 'Die K.-o.-Phase und Playoffs sind erst nach Abschluss der gesamten Ligaphase (58 Spieltage) verfügbar.',
      locked: true,
      league,
    };
  }
  if (league.knockout && Array.isArray(league.knockout.rounds?.playoffs) && league.knockout.rounds.playoffs.length === 8) {
    return { league, knockout: league.knockout };
  }
  return createKnockoutBracket(league, { allowIncomplete: true });
}

function simulateKnockoutMatchScore(league, match) {
  const homeId = match.home?.teamId;
  const awayId = match.away?.teamId;
  const homeStr = teamStrength(league, homeId);
  const awayStr = teamStrength(league, awayId);
  const seedBonus = ((match.away?.seed ?? 12) - (match.home?.seed ?? 12)) * 0.035;
  const edge = Math.max(-0.55, Math.min(0.75, (homeStr - awayStr) / 20 + seedBonus));
  const rng = randomFrom(hashSeed(`${league.season || '2026/27'}|ko|${match.id}|${homeId}|${awayId}`));
  let homeScore = Math.min(6, Math.max(0, Math.floor(rng() * 2.4 + rng() * 1.6 + Math.max(0, edge))));
  let awayScore = Math.min(6, Math.max(0, Math.floor(rng() * 2.2 + rng() * 1.5 + Math.max(0, -edge))));
  if (homeScore === awayScore) {
    // Knockout tiebreaker (extra time / penalty shootout)
    if (rng() + edge * 0.25 >= 0.48) homeScore += 1;
    else awayScore += 1;
  }
  return { homeScore, awayScore };
}

function advanceWinner(knockout, match) {
  if (!match.winnerTeamId) return;
  const winnerEntry = match.winnerTeamId === match.home?.teamId ? match.home : match.away;
  if (!winnerEntry) return;

  if (match.round === 'final') {
    knockout.champion = {
      teamId: winnerEntry.teamId,
      teamName: winnerEntry.teamName,
      seed: winnerEntry.seed,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      runnerUpTeamId: match.winnerTeamId === match.home?.teamId ? match.away?.teamId : match.home?.teamId,
      runnerUpTeamName: match.winnerTeamId === match.home?.teamId ? match.away?.teamName : match.home?.teamName,
    };
    return;
  }

  if (!match.nextMatchId || !match.nextSlot) return;
  const allNextMatches = [
    ...(knockout.rounds.r16 ?? []),
    ...(knockout.rounds.qf ?? []),
    ...(knockout.rounds.sf ?? []),
    ...(knockout.rounds.final ?? []),
  ];
  const targetMatch = allNextMatches.find((m) => m.id === match.nextMatchId);
  if (!targetMatch) return;
  targetMatch[match.nextSlot] = { ...winnerEntry };
  if (targetMatch.home && targetMatch.away && targetMatch.status === 'pending') {
    targetMatch.status = 'scheduled';
  }
}

export function getNextKnockoutRoundKey(knockout) {
  if (!knockout?.rounds) return null;
  for (const key of ['playoffs', 'r16', 'qf', 'sf', 'final']) {
    const list = knockout.rounds[key] ?? [];
    if (list.length > 0 && list.some((m) => m.status !== 'completed')) return key;
  }
  return null;
}

export function simulateKnockoutRound(league, requestedRoundKey = '', { allowIncomplete = false } = {}) {
  const ensured = ensureKnockoutBracket(league, { allowIncomplete: allowIncomplete || !league.schedule?.length });
  if (ensured.error && ensured.locked) return ensured;
  if (ensured.error) return ensured;
  const next = structuredClone(ensured.league);
  const ko = next.knockout;
  const roundKey = requestedRoundKey || getNextKnockoutRoundKey(ko);
  if (!roundKey) {
    return { league: next, knockout: ko, simulatedCount: 0, roundKey: null };
  }

  const matches = ko.rounds[roundKey] ?? [];
  let simulatedCount = 0;
  for (const match of matches) {
    if (match.status === 'completed' || !match.home || !match.away) continue;
    const { homeScore, awayScore } = simulateKnockoutMatchScore(next, match);
    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.winnerTeamId = homeScore > awayScore ? match.home.teamId : match.away.teamId;
    match.status = 'completed';
    advanceWinner(ko, match);
    simulatedCount += 1;
  }

  return { league: next, knockout: ko, simulatedCount, roundKey };
}

export function simulateEntireKnockout(league, { allowIncomplete = false } = {}) {
  let current = ensureKnockoutBracket(league, { allowIncomplete: allowIncomplete || !league.schedule?.length });
  if (current.error && current.locked) return current;
  if (current.error) return current;
  let totalSimulated = 0;
  for (const roundKey of ['playoffs', 'r16', 'qf', 'sf', 'final']) {
    const step = simulateKnockoutRound(current.league, roundKey, { allowIncomplete: true });
    if (step.error) return step;
    current = step;
    totalSimulated += step.simulatedCount;
  }
  return { league: current.league, knockout: current.knockout, simulatedCount: totalSimulated };
}

export function recordKnockoutMatchScore(league, matchId, homeScore, awayScore) {
  const ensured = ensureKnockoutBracket(league, { allowIncomplete: true });
  if (ensured.error && ensured.locked) return ensured;
  if (ensured.error) return ensured;
  const h = Number(homeScore);
  const a = Number(awayScore);
  if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0 || h > 99 || a > 99) {
    return { error: 'Bitte gültige Tore zwischen 0 und 99 eingeben.' };
  }
  if (h === a) {
    return { error: 'In der K.-o.-Phase muss es einen Sieger geben (kein Unentschieden).' };
  }
  const next = structuredClone(ensured.league);
  const ko = next.knockout;
  const allMatches = [
    ...(ko.rounds.playoffs ?? []),
    ...(ko.rounds.r16 ?? []),
    ...(ko.rounds.qf ?? []),
    ...(ko.rounds.sf ?? []),
    ...(ko.rounds.final ?? []),
  ];
  const match = allMatches.find((m) => m.id === matchId);
  if (!match) return { error: 'K.-o.-Spiel nicht gefunden.' };
  if (!match.home || !match.away) return { error: 'Beide Teilnehmer müssen zuerst feststehen.' };

  match.homeScore = h;
  match.awayScore = a;
  match.winnerTeamId = h > a ? match.home.teamId : match.away.teamId;
  match.status = 'completed';
  advanceWinner(ko, match);

  return { league: next, knockout: ko, match };
}
