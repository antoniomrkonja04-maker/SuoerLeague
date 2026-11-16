export const SEASON_START = '2026-08-01';

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isDraftComplete(league, players = []) {
  if (!players.length) return false;
  const picks = league?.draft?.picks ?? [];
  const teamCount = league?.teams?.length || league?.draft?.order?.length || 30;
  const targetPicks = Math.min(players.length, Math.max(1, teamCount) * 30);
  const draftedIds = new Set(picks.map((pick) => pick.playerId));
  const validDraftedCount = players.filter((player) => draftedIds.has(player.id)).length;
  return validDraftedCount >= targetPicks;
}

export function buildSchedule(teams, startDate = SEASON_START, season = '2026/27') {
  if (!Array.isArray(teams) || teams.length !== 30 || new Set(teams.map((team) => team.id)).size !== 30) return [];
  if (!isValidIsoDate(startDate)) return [];
  const rotation = teams.map((team) => team.id);
  const firstLeg = [];
  for (let round = 0; round < rotation.length - 1; round += 1) {
    const date = addDays(startDate, round * 4);
    for (let pair = 0; pair < rotation.length / 2; pair += 1) {
      let homeId = rotation[pair];
      let awayId = rotation[rotation.length - 1 - pair];
      if ((round + pair) % 2) [homeId, awayId] = [awayId, homeId];
      firstLeg.push({ id: `${season}-r${round + 1}-${homeId}-${awayId}`, round: round + 1, date, homeId, awayId, status: 'scheduled' });
    }
    rotation.splice(1, 0, rotation.pop());
  }
  const secondLeg = firstLeg.map((fixture) => {
    const round = fixture.round + 29;
    const homeId = fixture.awayId;
    const awayId = fixture.homeId;
    return { id: `${season}-r${round}-${homeId}-${awayId}`, round, date: addDays(startDate, (round - 1) * 4), homeId, awayId, status: 'scheduled' };
  });
  return [...firstLeg, ...secondLeg];
}

export function ensureCalendar(league, startDate = SEASON_START) {
  if (!league || league.teams?.length !== 30) return { error: 'Für den Kalender werden genau 30 Teams benötigt.' };
  if (Array.isArray(league.schedule) && league.schedule.length) return { league };
  const season = league.season || '2026/27';
  const schedule = buildSchedule(league.teams, startDate, season);
  if (!schedule.length) return { error: 'Der Spielplan konnte nicht erstellt werden.' };
  return { league: {
    ...league,
    schedule,
    currentDate: league.currentDate || addDays(schedule[0].date, -1),
    matchHistory: league.matchHistory ?? [],
  } };
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
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

export function teamStrength(league, teamId) {
  const ratings = (league.draft?.picks ?? []).filter((pick) => pick.teamId === teamId).map((pick) => Number(pick.rating)).filter((rating) => Number.isFinite(rating) && rating > 0);
  return ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 70;
}

const EXACT_FRACTION_SCALE = 1048576; // 2^20 exact fraction rounding

function exactValue(value) {
  return Math.round(Number(value || 0) * EXACT_FRACTION_SCALE) / EXACT_FRACTION_SCALE;
}

function calcPassSharePossession(ownCompleted, otherCompleted) {
  const total = ownCompleted + otherCompleted;
  if (total <= 0) return 50;
  return Math.max(32, Math.min(68, Math.floor((100.0 * ownCompleted) / total + 0.5)));
}

export function simulateFixture(league, fixture, playerPool = [], customSeedSuffix = '') {
  const homeTeam = league.teams?.find((team) => team.id === fixture.homeId);
  const awayTeam = league.teams?.find((team) => team.id === fixture.awayId);
  const seedStr = `${league.season || '2026/27'}|${fixture.id}|${homeTeam?.id}|${awayTeam?.id}${customSeedSuffix ? `|seed:${customSeedSuffix}` : ''}`;
  const random = randomFrom(hashSeed(seedStr));

  const hStrength = teamStrength(league, fixture.homeId);
  const aStrength = teamStrength(league, fixture.awayId);

  const hTactics = league.squads?.[fixture.homeId]?.tacticalPreset || 'possession';
  const aTactics = league.squads?.[fixture.awayId]?.tacticalPreset || 'compact';

  // Tactical modifiers (Mentality, Tempo, Directness, Counter-Press)
  const getTacticalModifiers = (preset) => {
    switch (preset) {
      case 'gegenpressing':
        return { mentality: 16, tempo: 16, passMod: 1.05, pressMod: 1.32, xgMod: 1.12, sprintMod: 1.22 };
      case 'possession':
        return { mentality: 13, tempo: 10, passMod: 1.24, pressMod: 1.08, xgMod: 1.05, sprintMod: 0.96 };
      case 'counter':
        return { mentality: 12, tempo: 17, passMod: 0.84, pressMod: 0.88, xgMod: 1.08, sprintMod: 1.15 };
      case 'compact':
      default:
        return { mentality: 8, tempo: 9, passMod: 0.90, pressMod: 0.82, xgMod: 0.92, sprintMod: 0.92 };
    }
  };

  const hTac = getTacticalModifiers(hTactics);
  const aTac = getTacticalModifiers(aTactics);

  // Home advantage + relative strength difference
  const homeAdvantage = 0.22;
  const ratingDiff = (hStrength - aStrength) / 26;
  const homeEdge = Math.max(-0.6, Math.min(0.9, ratingDiff + homeAdvantage));

  // Rosters & Starting Players
  const homeRoster = (league.draft?.picks ?? []).filter((p) => p.teamId === fixture.homeId);
  const awayRoster = (league.draft?.picks ?? []).filter((p) => p.teamId === fixture.awayId);
  const homeSquad = league.squads?.[fixture.homeId] || {};
  const awaySquad = league.squads?.[fixture.awayId] || {};

  const resolveLineup = (roster, squad, teamId) => {
    const starterIds = new Set(Object.values(squad.starters || {}).filter(Boolean));
    const startingPicks = roster.filter((p) => starterIds.has(p.playerId || p.id));
    if (startingPicks.length < 11) {
      const remaining = roster
        .filter((p) => !startingPicks.some((sp) => (sp.playerId || sp.id) === (p.playerId || p.id)))
        .sort((a, b) => (Number(b.rating) || 75) - (Number(a.rating) || 75));
      for (const p of remaining) {
        if (startingPicks.length >= 11) break;
        startingPicks.push(p);
      }
    }
    while (startingPicks.length < 11) {
      const idx = startingPicks.length;
      startingPicks.push({
        id: `${teamId}-sub-${idx + 1}`,
        name: `Kaderspieler ${idx + 1}`,
        playerName: `Kaderspieler ${idx + 1}`,
        position: idx === 0 ? 'GK' : idx < 5 ? 'CB' : idx < 8 ? 'CM' : idx < 10 ? 'LW' : 'ST',
        rating: 74,
      });
    }
    return startingPicks.map((p, idx) => ({
      id: p.playerId || p.id || `${teamId}-p${idx + 1}`,
      name: p.playerName || p.name || 'Spieler',
      playerName: p.playerName || p.name || 'Spieler',
      position: p.position || (idx === 0 ? 'GK' : idx < 5 ? 'CB' : idx < 8 ? 'CM' : 'ST'),
      rating: Number(p.rating) || 75,
      shirtNumber: squad.shirtNumbers?.[p.playerId || p.id] || (idx + 1),
    }));
  };

  const homeLineup = resolveLineup(homeRoster, homeSquad, fixture.homeId);
  const awayLineup = resolveLineup(awayRoster, awaySquad, fixture.awayId);

  // Per-player pass generation to derive authentic pass-share possession
  const simulatePlayerPasses = (lineup, tac, strengthEdge) => {
    return lineup.map((p) => {
      const pos = String(p.position || 'CM').toUpperCase();
      const isGK = ['GK', 'TW'].some((t) => pos.includes(t));
      const isCB = ['CB', 'IV'].some((t) => pos.includes(t));
      const isFB = ['LB', 'RB', 'LWB', 'RWB'].some((t) => pos.includes(t));
      const isMid = ['DM', 'CDM', 'CM', 'ZM', 'CAM', 'AM', 'ZOM'].some((t) => pos.includes(t));

      const baseAtt = isGK ? 26 : isCB ? 54 : isFB ? 46 : isMid ? 58 : 31;
      const edgeFactor = 1 + strengthEdge * 0.18;
      const attempted = Math.max(8, Math.round(baseAtt * tac.passMod * edgeFactor * (0.86 + random() * 0.28)));
      const accRate = Math.min(0.95, Math.max(0.68, 0.78 + ((p.rating || 75) - 75) * 0.005 + (isCB || isMid ? 0.05 : -0.03) + (random() * 0.06 - 0.03)));
      const completed = Math.min(attempted, Math.max(4, Math.round(attempted * accRate)));
      const progressive = Math.max(0, Math.round(completed * (isMid || isFB ? 0.16 : isCB ? 0.11 : 0.08) * (0.8 + random() * 0.4)));
      return { playerId: p.id, attempted, completed, progressive };
    });
  };

  const homePassList = simulatePlayerPasses(homeLineup, hTac, homeEdge);
  const awayPassList = simulatePlayerPasses(awayLineup, aTac, -homeEdge);

  const homePassesAttempted = homePassList.reduce((s, x) => s + x.attempted, 0);
  const homePasses = homePassList.reduce((s, x) => s + x.completed, 0);
  const homeProgressivePasses = homePassList.reduce((s, x) => s + x.progressive, 0);

  const awayPassesAttempted = awayPassList.reduce((s, x) => s + x.attempted, 0);
  const awayPasses = awayPassList.reduce((s, x) => s + x.completed, 0);
  const awayProgressivePasses = awayPassList.reduce((s, x) => s + x.progressive, 0);

  // Pass-share possession (completed passes ratio)
  const homePossession = calcPassSharePossession(homePasses, awayPasses);
  const awayPossession = 100 - homePossession;

  const homePassAcc = Math.min(95, Math.max(70, Math.round((homePasses / Math.max(1, homePassesAttempted)) * 100)));
  const awayPassAcc = Math.min(95, Math.max(70, Math.round((awayPasses / Math.max(1, awayPassesAttempted)) * 100)));

  // Expected Goals (xG) based on tactical style, pass dominance, and team strength
  const homeXgRaw = Math.max(0.22, (1.42 + homeEdge * 1.08 + (homePossession - 50) * 0.014) * hTac.xgMod + (random() * 0.36 - 0.18));
  const awayXgRaw = Math.max(0.16, (1.14 - homeEdge * 0.88 - (homePossession - 50) * 0.014) * aTac.xgMod + (random() * 0.36 - 0.18));
  const homeXg = Number(exactValue(homeXgRaw).toFixed(2));
  const awayXg = Number(exactValue(awayXgRaw).toFixed(2));

  // Realistic goal distribution from xG and clear-cut chances
  const calcGoals = (expected) => {
    let goals = 0;
    const r1 = random();
    const r2 = random();
    const r3 = random();
    if (r1 < expected * 0.45) goals += 1;
    if (r2 < expected * 0.35) goals += 1;
    if (r3 < expected * 0.22) goals += 1;
    if (goals >= 2 && random() < expected * 0.18) goals += 1;
    if (goals >= 3 && random() < expected * 0.08) goals += 1;
    return Math.min(6, goals);
  };

  const homeScore = calcGoals(homeXg);
  const awayScore = calcGoals(awayXg);

  // Detailed shot breakdown: Shots, On Target, Blocked, Long Shots, Clear-Cut Chances, Half Chances
  const homeShots = Math.max(homeScore, Math.floor(random() * 8) + 5 + (homeScore * 2));
  const awayShots = Math.max(awayScore, Math.floor(random() * 7) + 4 + (awayScore * 2));
  const homeShotsOnTarget = Math.max(homeScore, Math.min(homeShots, Math.round(homeShots * (0.42 + random() * 0.1))));
  const awayShotsOnTarget = Math.max(awayScore, Math.min(awayShots, Math.round(awayShots * (0.40 + random() * 0.1))));
  const homeBlockedShots = Math.max(0, Math.min(homeShots - homeShotsOnTarget, Math.round(homeShots * 0.24)));
  const awayBlockedShots = Math.max(0, Math.min(awayShots - awayShotsOnTarget, Math.round(awayShots * 0.24)));
  const homeLongShots = Math.max(1, Math.round(homeShots * (0.28 + random() * 0.1)));
  const awayLongShots = Math.max(1, Math.round(awayShots * (0.28 + random() * 0.1)));
  const homeBigChances = Math.max(Math.floor(homeScore / 2), Math.round(homeXg * 1.15));
  const awayBigChances = Math.max(Math.floor(awayScore / 2), Math.round(awayXg * 1.15));
  const homeHalfChances = Math.max(1, Math.round(homeShots * 0.32));
  const awayHalfChances = Math.max(1, Math.round(awayShots * 0.32));

  const homeCorners = Math.max(1, Math.min(13, Math.round(homeShots * 0.42 + random() * 2.5)));
  const awayCorners = Math.max(1, Math.min(13, Math.round(awayShots * 0.42 + random() * 2.5)));
  const homeFouls = Math.max(4, Math.min(19, Math.round(10 * hTac.pressMod + (random() * 5 - 2.5))));
  const awayFouls = Math.max(4, Math.min(19, Math.round(11 * aTac.pressMod + (random() * 5 - 2.5))));
  const homeYellow = Math.min(5, Math.floor(homeFouls / 4.2 + random() * 1.1));
  const awayYellow = Math.min(5, Math.floor(awayFouls / 4.2 + random() * 1.1));

  // Goal Scorer & Assist Selection: Strikers high probability, wingers next, midfielders medium, defenders realistic lower chance
  const pickGoalEvent = (lineup) => {
    if (!lineup.length) {
      return { scorer: { name: 'Stürmer', id: 'p-default', position: 'ST' }, assist: null, goalType: 'Flachschuss' };
    }
    const scorerWeights = lineup.map((p) => {
      const pos = String(p.position || 'CM').toUpperCase();
      let posWeight = 2;
      if (['ST', 'CF', 'MS'].some((t) => pos.includes(t))) posWeight = 55;
      else if (['LW', 'RW', 'LM', 'RM'].some((t) => pos.includes(t))) posWeight = 26;
      else if (['CAM', 'AM', 'ZOM'].some((t) => pos.includes(t))) posWeight = 13;
      else if (['CM', 'ZM'].some((t) => pos.includes(t))) posWeight = 6.5;
      else if (['DM', 'CDM', 'ZDM'].some((t) => pos.includes(t))) posWeight = 3;
      else if (['CB', 'IV', 'LB', 'RB', 'LWB', 'RWB'].some((t) => pos.includes(t))) posWeight = 2.6; // Defenders can score headers/volleys/rebounds
      else if (['GK', 'TW'].some((t) => pos.includes(t))) posWeight = 0;

      const ratingMultiplier = Math.pow((p.rating || 75) / 78, 1.35);
      return { player: p, weight: posWeight * ratingMultiplier };
    });

    const totalWeight = scorerWeights.reduce((acc, curr) => acc + curr.weight, 0) || 1;
    let chosenVal = random() * totalWeight;
    let scorer = scorerWeights[0].player;
    for (const item of scorerWeights) {
      chosenVal -= item.weight;
      if (chosenVal <= 0) {
        scorer = item.player;
        break;
      }
    }

    const sPos = String(scorer.position || 'CM').toUpperCase();
    const isDefender = ['CB', 'IV', 'LB', 'RB', 'LWB', 'RWB'].some((t) => sPos.includes(t));
    const isStriker = ['ST', 'CF', 'MS'].some((t) => sPos.includes(t));
    const isWinger = ['LW', 'RW', 'LM', 'RM'].some((t) => sPos.includes(t));

    let goalType = 'Flachschuss ins Eck';
    if (isDefender) {
      const dRoll = random();
      if (dRoll < 0.65) goalType = 'Kopfball nach Ecke';
      else if (dRoll < 0.85) goalType = 'Fernschuss';
      else goalType = 'Abstauber im Strafraum';
    } else if (isStriker) {
      const sRoll = random();
      if (sRoll < 0.35) goalType = 'Flachschuss ins Eck';
      else if (sRoll < 0.60) goalType = 'Volley-Abnahme';
      else if (sRoll < 0.78) goalType = 'Wuchtiger Kopfball';
      else if (sRoll < 0.90) goalType = 'Foulelfmeter';
      else goalType = 'Konter-Abschluss';
    } else if (isWinger) {
      const wRoll = random();
      if (wRoll < 0.40) goalType = 'Schlenzer ins lange Eck';
      else if (wRoll < 0.70) goalType = 'Konter-Abschluss';
      else if (wRoll < 0.88) goalType = 'Direktabnahme';
      else goalType = 'Flachschuss';
    } else {
      const mRoll = random();
      if (mRoll < 0.45) goalType = 'Distanzschuss aus 20m';
      else if (mRoll < 0.75) goalType = 'Präziser Flachschuss';
      else goalType = 'Nachschuss';
    }

    let assist = null;
    if (goalType !== 'Foulelfmeter' && random() < 0.78) {
      const eligibleAssisters = lineup.filter((p) => p.id !== scorer.id);
      if (eligibleAssisters.length) {
        const assistWeights = eligibleAssisters.map((p) => {
          const pos = String(p.position || 'CM').toUpperCase();
          let weight = 10;
          if (['LW', 'RW', 'LM', 'RM', 'CAM', 'AM', 'ZOM'].some((t) => pos.includes(t))) weight = 38;
          else if (['CM', 'ZM'].some((t) => pos.includes(t))) weight = 25;
          else if (['ST', 'CF'].some((t) => pos.includes(t))) weight = 16;
          else if (['LB', 'RB', 'LWB', 'RWB'].some((t) => pos.includes(t))) weight = 15;
          else if (['CB', 'IV', 'DM'].some((t) => pos.includes(t))) weight = 4;
          else if (['GK'].some((t) => pos.includes(t))) weight = 0;
          return { player: p, weight: weight * ((p.rating || 75) / 78) };
        });
        const totalAWeight = assistWeights.reduce((a, b) => a + b.weight, 0) || 1;
        let aVal = random() * totalAWeight;
        for (const item of assistWeights) {
          aVal -= item.weight;
          if (aVal <= 0) {
            assist = item.player;
            break;
          }
        }
      }
    }

    return {
      scorer: { name: scorer.name || scorer.playerName, id: scorer.id, position: scorer.position },
      assist: assist ? { name: assist.name || assist.playerName, id: assist.id, position: assist.position } : null,
      goalType,
    };
  };

  const events = [];
  const playerGoalCounts = new Map();
  const playerAssistCounts = new Map();

  for (let g = 0; g < homeScore; g += 1) {
    const min = Math.floor(random() * 88) + 2;
    const { scorer, assist, goalType } = pickGoalEvent(homeLineup);
    playerGoalCounts.set(scorer.id, (playerGoalCounts.get(scorer.id) || 0) + 1);
    if (assist) playerAssistCounts.set(assist.id, (playerAssistCounts.get(assist.id) || 0) + 1);

    events.push({
      minute: min,
      teamId: fixture.homeId,
      teamName: homeTeam?.name || 'Heim',
      player: scorer.name,
      playerId: scorer.id,
      position: scorer.position,
      type: 'goal',
      goalType,
      assist: assist?.name || null,
      assistId: assist?.id || null,
    });
  }

  for (let g = 0; g < awayScore; g += 1) {
    const min = Math.floor(random() * 88) + 2;
    const { scorer, assist, goalType } = pickGoalEvent(awayLineup);
    playerGoalCounts.set(scorer.id, (playerGoalCounts.get(scorer.id) || 0) + 1);
    if (assist) playerAssistCounts.set(assist.id, (playerAssistCounts.get(assist.id) || 0) + 1);

    events.push({
      minute: min,
      teamId: fixture.awayId,
      teamName: awayTeam?.name || 'Gast',
      player: scorer.name,
      playerId: scorer.id,
      position: scorer.position,
      type: 'goal',
      goalType,
      assist: assist?.name || null,
      assistId: assist?.id || null,
    });
  }
  events.sort((a, b) => a.minute - b.minute);

  // Full per-player telemetry & ratings (matching the 46 player values & minutes-weighted rating engine)
  const buildDetailedLineupTelemetry = (lineup, passList, teamScore, oppScore, isHome, tac, teamXg, oppShotsOnTarget) => {
    const passMap = new Map(passList.map((item) => [item.playerId, item]));
    return lineup.map((p, idx) => {
      const pos = String(p.position || 'CM').toUpperCase();
      const isGK = ['GK', 'TW'].some((t) => pos.includes(t));
      const isDef = ['CB', 'IV', 'LB', 'RB', 'LWB', 'RWB'].some((t) => pos.includes(t));
      const isMid = ['DM', 'CDM', 'CM', 'ZM', 'CAM', 'AM', 'ZOM'].some((t) => pos.includes(t));
      const isAtt = ['ST', 'CF', 'MS', 'LW', 'RW', 'LM', 'RM'].some((t) => pos.includes(t));

      const goals = playerGoalCounts.get(p.id) || 0;
      const assists = playerAssistCounts.get(p.id) || 0;
      const pPasses = passMap.get(p.id) || { attempted: 32, completed: 27, progressive: 3 };

      // Minutes played (some outfield players get subbed around 65-84' if no multiple goals)
      const subbedOff = !isGK && goals === 0 && idx >= 7 && random() < 0.28;
      const minutesPlayed = subbedOff ? Math.floor(64 + random() * 20) : 90;

      // Individual xG & xA
      const posXgShare = isAtt ? 0.24 : isMid ? 0.09 : isDef ? 0.03 : 0;
      const playerXg = Number(exactValue(Math.max(goals * 0.32, teamXg * posXgShare * (0.7 + random() * 0.6) + goals * 0.28)).toFixed(2));
      const posXaShare = isMid || isAtt ? 0.16 : isDef ? 0.05 : 0.01;
      const playerXa = Number(exactValue(Math.max(assists * 0.25, teamXg * posXaShare * (0.6 + random() * 0.7) + assists * 0.22)).toFixed(2));

      const shots = isGK ? 0 : Math.max(goals, Math.round((isAtt ? 2.4 : isMid ? 1.2 : 0.4) * (0.6 + random() * 0.8) + goals * 0.8));
      const shotsOnTarget = Math.max(goals, Math.min(shots, Math.round(shots * 0.48)));
      const keyPasses = isGK ? 0 : Math.max(assists, Math.round((isMid ? 1.8 : isAtt ? 1.4 : 0.5) * (0.5 + random() * 0.9) + assists));
      const dribbles = isGK ? 0 : Math.max(0, Math.round((isAtt ? 2.6 : isMid ? 1.5 : 0.6) * (0.5 + random() * 1.1)));
      const tacklesWon = isGK ? 0 : Math.max(0, Math.round((isDef ? 2.6 : isMid ? 2.2 : 0.8) * tac.pressMod * (0.6 + random() * 0.8)));
      const interceptions = isGK ? 0 : Math.max(0, Math.round((isDef ? 2.1 : isMid ? 1.7 : 0.5) * (0.6 + random() * 0.8)));
      const clearances = isGK ? 0 : Math.max(0, Math.round((isDef ? 3.5 : isMid ? 1.1 : 0.3) * (0.6 + random() * 0.8)));
      const pressuresCompleted = isGK ? 1 : Math.max(2, Math.round((isMid ? 6.5 : isAtt ? 5.2 : 3.8) * tac.pressMod * (0.75 + random() * 0.5)));
      const headersWon = isGK ? 1 : Math.max(0, Math.round((isDef ? 2.8 : isAtt ? 1.6 : 1.1) * (0.6 + random() * 0.8)));

      // Goalkeeper saves breakdown (held, parried, tipped)
      const totalTeamSaves = Math.max(0, oppShotsOnTarget - oppScore);
      const savesHeld = isGK ? Math.ceil(totalTeamSaves * 0.45) : 0;
      const savesParried = isGK ? Math.floor(totalTeamSaves * 0.35) : 0;
      const savesTipped = isGK ? Math.max(0, totalTeamSaves - savesHeld - savesParried) : 0;

      // Physical telemetry: distance_km & high_intensity_sprints
      const baseKm = isGK ? 5.4 : isMid ? 11.4 : isAtt ? 10.3 : 10.1;
      const distanceKm = Number(exactValue((baseKm * (minutesPlayed / 90) * (0.94 + random() * 0.12))).toFixed(2));
      const highIntensitySprints = isGK ? 2 : Math.round((isAtt ? 19 : isMid ? 16 : 14) * tac.sprintMod * (minutesPlayed / 90) * (0.85 + random() * 0.3));

      // Match Rating (1.0 - 10.0)
      let rating = 6.45 + ((p.rating || 75) - 78) * 0.032;
      rating += goals * 1.22;
      rating += assists * 0.68;
      rating += keyPasses * 0.08;
      rating += (tacklesWon + interceptions) * 0.05;

      if (teamScore > oppScore) rating += 0.50;
      else if (teamScore < oppScore) rating -= 0.42;

      if (isGK || isDef) {
        if (oppScore === 0) rating += 0.72;
        else if (oppScore === 2) rating -= 0.32;
        else if (oppScore >= 3) rating -= 0.78;
      }
      if (isGK) {
        rating += Math.min(1.25, totalTeamSaves * 0.17);
      }

      rating += (random() * 0.36 - 0.18);
      const clamped = Math.max(4.8, Math.min(10.0, Math.round(rating * 10) / 10));

      return {
        id: p.id,
        name: p.name || p.playerName,
        position: p.position,
        rating: p.rating,
        shirtNumber: p.shirtNumber,
        minutesPlayed,
        matchRating: clamped,
        goals,
        assists,
        xG: playerXg,
        xA: playerXa,
        shots,
        shotsOnTarget,
        keyPasses,
        passesAttempted: pPasses.attempted,
        passesCompleted: pPasses.completed,
        progressivePasses: pPasses.progressive,
        dribbles,
        tacklesWon,
        interceptions,
        clearances,
        pressuresCompleted,
        headersWon,
        saves: savesHeld + savesParried + savesTipped,
        savesHeld,
        savesParried,
        savesTipped,
        distanceKm,
        highIntensitySprints,
      };
    });
  };

  const homeRatedLineup = buildDetailedLineupTelemetry(homeLineup, homePassList, homeScore, awayScore, true, hTac, homeXg, awayShotsOnTarget);
  const awayRatedLineup = buildDetailedLineupTelemetry(awayLineup, awayPassList, awayScore, homeScore, false, aTac, awayXg, homeShotsOnTarget);

  // Minutes-weighted team average rating (exact hundredths truncation)
  const calcMinutesWeightedTeamRating = (ratedLineup) => {
    let ratingMinutes = 0;
    let totalMinutes = 0;
    for (const p of ratedLineup) {
      const mins = p.minutesPlayed || 90;
      ratingMinutes += Math.round(p.matchRating * 100) * mins;
      totalMinutes += mins;
    }
    const hundredths = totalMinutes > 0 ? Math.trunc(ratingMinutes / totalMinutes) : 650;
    return Number((hundredths / 100).toFixed(2));
  };

  const homeAvgRating = calcMinutesWeightedTeamRating(homeRatedLineup);
  const awayAvgRating = calcMinutesWeightedTeamRating(awayRatedLineup);

  const sumLineupStat = (list, key) => list.reduce((sum, p) => sum + (Number(p[key]) || 0), 0);

  const allRated = [
    ...homeRatedLineup.map((p) => ({ ...p, teamId: fixture.homeId, teamName: homeTeam?.name })),
    ...awayRatedLineup.map((p) => ({ ...p, teamId: fixture.awayId, teamName: awayTeam?.name })),
  ].sort((a, b) => b.matchRating - a.matchRating || b.goals - a.goals || b.assists - a.assists || b.rating - a.rating);
  const motm = allRated[0] || null;

  return {
    homeScore,
    awayScore,
    events,
    stats: {
      possession: { home: homePossession, away: awayPossession },
      xG: { home: homeXg, away: awayXg },
      xA: {
        home: Number(sumLineupStat(homeRatedLineup, 'xA').toFixed(2)),
        away: Number(sumLineupStat(awayRatedLineup, 'xA').toFixed(2)),
      },
      averageRating: { home: homeAvgRating, away: awayAvgRating },
      shots: { home: homeShots, away: awayShots },
      shotsOnTarget: { home: homeShotsOnTarget, away: awayShotsOnTarget },
      blockedShots: { home: homeBlockedShots, away: awayBlockedShots },
      longShots: { home: homeLongShots, away: awayLongShots },
      bigChances: { home: homeBigChances, away: awayBigChances },
      clearCutChances: { home: homeBigChances, away: awayBigChances },
      halfChances: { home: homeHalfChances, away: awayHalfChances },
      keyPasses: {
        home: sumLineupStat(homeRatedLineup, 'keyPasses'),
        away: sumLineupStat(awayRatedLineup, 'keyPasses'),
      },
      passes: { home: homePasses, away: awayPasses },
      passesAttempted: { home: homePassesAttempted, away: awayPassesAttempted },
      passAccuracy: { home: homePassAcc, away: awayPassAcc },
      progressivePasses: { home: homeProgressivePasses, away: awayProgressivePasses },
      dribbles: {
        home: sumLineupStat(homeRatedLineup, 'dribbles'),
        away: sumLineupStat(awayRatedLineup, 'dribbles'),
      },
      tacklesWon: {
        home: sumLineupStat(homeRatedLineup, 'tacklesWon'),
        away: sumLineupStat(awayRatedLineup, 'tacklesWon'),
      },
      interceptions: {
        home: sumLineupStat(homeRatedLineup, 'interceptions'),
        away: sumLineupStat(awayRatedLineup, 'interceptions'),
      },
      clearances: {
        home: sumLineupStat(homeRatedLineup, 'clearances'),
        away: sumLineupStat(awayRatedLineup, 'clearances'),
      },
      pressuresCompleted: {
        home: sumLineupStat(homeRatedLineup, 'pressuresCompleted'),
        away: sumLineupStat(awayRatedLineup, 'pressuresCompleted'),
      },
      headersWon: {
        home: sumLineupStat(homeRatedLineup, 'headersWon'),
        away: sumLineupStat(awayRatedLineup, 'headersWon'),
      },
      saves: {
        home: sumLineupStat(homeRatedLineup, 'saves'),
        away: sumLineupStat(awayRatedLineup, 'saves'),
      },
      distanceKm: {
        home: Number(sumLineupStat(homeRatedLineup, 'distanceKm').toFixed(1)),
        away: Number(sumLineupStat(awayRatedLineup, 'distanceKm').toFixed(1)),
      },
      highIntensitySprints: {
        home: sumLineupStat(homeRatedLineup, 'highIntensitySprints'),
        away: sumLineupStat(awayRatedLineup, 'highIntensitySprints'),
      },
      corners: { home: homeCorners, away: awayCorners },
      fouls: { home: homeFouls, away: awayFouls },
      yellowCards: { home: homeYellow, away: awayYellow },
    },
    lineups: {
      home: homeRatedLineup,
      away: awayRatedLineup,
    },
    manOfTheMatch: motm,
  };
}

export function simulateFixtureMultiSeed(league, fixture, seedCount = 50) {
  const runs = Math.max(1, Math.min(200, Number(seedCount) || 50));
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let homeGoalsSum = 0;
  let awayGoalsSum = 0;
  let homeXgSum = 0;
  let awayXgSum = 0;
  let homePossSum = 0;
  const scorerTotals = new Map();

  for (let s = 1; s <= runs; s += 1) {
    const sim = simulateFixture(league, fixture, [], `mc-${s}`);
    if (sim.homeScore > sim.awayScore) homeWins += 1;
    else if (sim.homeScore === sim.awayScore) draws += 1;
    else awayWins += 1;

    homeGoalsSum += sim.homeScore;
    awayGoalsSum += sim.awayScore;
    homeXgSum += sim.stats.xG.home;
    awayXgSum += sim.stats.xG.away;
    homePossSum += sim.stats.possession.home;

    for (const ev of sim.events) {
      if (ev.type === 'goal' && ev.player) {
        const key = `${ev.teamId}:${ev.player}`;
        const prev = scorerTotals.get(key) || { player: ev.player, teamId: ev.teamId, teamName: ev.teamName, position: ev.position, goals: 0 };
        prev.goals += 1;
        scorerTotals.set(key, prev);
      }
    }
  }

  const topScorers = [...scorerTotals.values()]
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      goalsPerMatch: Number((item.goals / runs).toFixed(2)),
    }));

  return {
    runs,
    homeWins,
    draws,
    awayWins,
    homeWinPct: Math.round((homeWins / runs) * 100),
    drawPct: Math.round((draws / runs) * 100),
    awayWinPct: Math.round((awayWins / runs) * 100),
    avgHomeGoals: Number((homeGoalsSum / runs).toFixed(2)),
    avgAwayGoals: Number((awayGoalsSum / runs).toFixed(2)),
    avgHomeXg: Number((homeXgSum / runs).toFixed(2)),
    avgAwayXg: Number((awayXgSum / runs).toFixed(2)),
    avgHomePossession: Math.round(homePossSum / runs),
    avgAwayPossession: 100 - Math.round(homePossSum / runs),
    topScorers,
  };
}

export function isHumanVsHumanFixture(league, fixture) {
  if (!league || !fixture) return false;
  const home = league.teams?.find((team) => team.id === fixture.homeId);
  const away = league.teams?.find((team) => team.id === fixture.awayId);
  return home?.managerType === 'human' && away?.managerType === 'human';
}

export function hasDualHumanConsent(fixture) {
  if (!fixture) return false;
  if (fixture.humanConsentGranted) return true;
  const approvals = fixture.humanApprovals ?? {};
  return Boolean(approvals[fixture.homeId] && approvals[fixture.awayId]);
}

export function getBlockingHumanFixtures(league, upToDate = league?.currentDate) {
  if (!league?.schedule?.length || !upToDate) return [];
  return league.schedule.filter((fixture) => (
    fixture.date <= upToDate
    && fixture.status !== 'completed'
    && isHumanVsHumanFixture(league, fixture)
    && !hasDualHumanConsent(fixture)
  ));
}

export function approveHumanFixture(league, fixtureId, managerTeamId, { approveBoth = false, now = new Date().toISOString() } = {}) {
  if (!league?.schedule?.length) return { league, error: 'Kein Spielplan vorhanden.' };
  const fixture = league.schedule.find((entry) => entry.id === fixtureId);
  if (!fixture) return { league, error: 'Dieses Spiel wurde im Spielplan nicht gefunden.' };
  if (!isHumanVsHumanFixture(league, fixture)) {
    return { league, error: 'Nur Mensch-gegen-Mensch-Spiele benötigen eine Spieltags-Zustimmung.' };
  }
  const hostId = league.teams?.find((team) => team.managerType === 'human')?.id;
  const isParticipant = managerTeamId === fixture.homeId || managerTeamId === fixture.awayId;
  const isHost = Boolean(hostId && managerTeamId === hostId);
  if (!isParticipant && !isHost && !approveBoth) {
    return { league, error: 'Nur beteiligte Manager oder der Host können diesem Duell zustimmen.' };
  }

  const next = structuredClone(league);
  const nextFixture = next.schedule.find((entry) => entry.id === fixtureId);
  nextFixture.humanApprovals = { ...(nextFixture.humanApprovals ?? {}) };

  if (approveBoth) {
    nextFixture.humanApprovals[nextFixture.homeId] = { approvedAt: now, by: managerTeamId || hostId || nextFixture.homeId };
    nextFixture.humanApprovals[nextFixture.awayId] = { approvedAt: now, by: managerTeamId || hostId || nextFixture.awayId };
  } else if (isParticipant) {
    if (nextFixture.humanApprovals[managerTeamId]) {
      delete nextFixture.humanApprovals[managerTeamId];
    } else {
      nextFixture.humanApprovals[managerTeamId] = { approvedAt: now, by: managerTeamId };
    }
  } else if (isHost) {
    if (!nextFixture.humanApprovals[nextFixture.homeId]) {
      nextFixture.humanApprovals[nextFixture.homeId] = { approvedAt: now, by: managerTeamId };
    } else if (!nextFixture.humanApprovals[nextFixture.awayId]) {
      nextFixture.humanApprovals[nextFixture.awayId] = { approvedAt: now, by: managerTeamId };
    }
  }

  nextFixture.humanConsentGranted = Boolean(
    nextFixture.humanApprovals[nextFixture.homeId] && nextFixture.humanApprovals[nextFixture.awayId]
  );
  return {
    league: next,
    fixture: nextFixture,
    humanConsentGranted: nextFixture.humanConsentGranted,
  };
}

export function getNextCalendarStepDate(league, targetDate) {
  if (!league?.currentDate) return targetDate;
  if (!isValidIsoDate(targetDate) || targetDate <= league.currentDate) return league.currentDate;
  const uncompletedToday = (league.schedule ?? []).some((f) => f.date === league.currentDate && f.status !== 'completed');
  if (uncompletedToday) return league.currentDate;
  const nextFixture = (league.schedule ?? []).find((f) => f.date > league.currentDate && f.date <= targetDate && f.status !== 'completed');
  if (nextFixture) return nextFixture.date;
  return addDays(league.currentDate, 1);
}

export function simulateThroughDate(league, targetDate, { bypassHumanLock = false, isHost = false } = {}) {
  if (!isValidIsoDate(targetDate)) {
    return { error: 'Bitte wähle ein gültiges Kalenderdatum.' };
  }
  if (league?.currentDate && targetDate < league.currentDate) return { error: 'Das Zieldatum liegt vor dem aktuellen Kalenderstand.' };
  if (!Array.isArray(league?.schedule)) return { error: 'Für diese Liga wurde noch kein Spielplan erstellt.' };
  const finalDate = league.schedule.reduce((last, fixture) => fixture.date > last ? fixture.date : last, '0000-00-00');
  if (targetDate > finalDate) return { error: 'Das Zieldatum liegt außerhalb der Saison.' };

  const canBypass = Boolean(bypassHumanLock || isHost);

  // Check if already blocked on or before currentDate when trying to advance beyond currentDate
  if (!canBypass && league?.currentDate && targetDate > league.currentDate) {
    const existingBlockers = getBlockingHumanFixtures(league, league.currentDate);
    if (existingBlockers.length > 0) {
      const firstBlocker = existingBlockers[0];
      const home = league.teams.find((t) => t.id === firstBlocker.homeId)?.name || firstBlocker.homeId;
      const away = league.teams.find((t) => t.id === firstBlocker.awayId)?.name || firstBlocker.awayId;
      return {
        error: `Simulations-Sperre am ${firstBlocker.date}: Das Mensch-gegen-Mensch-Duell ${home} vs ${away} (Spieltag ${firstBlocker.round}) muss zuerst gespielt oder von beiden Managern bestätigt werden.`,
        blockedByHumanMatch: true,
        stoppedAtDate: firstBlocker.date,
        blockingFixtures: existingBlockers,
      };
    }
  }

  // Find the earliest date <= targetDate that contains an uncompleted, unconsented human-vs-human match
  let effectiveTargetDate = targetDate;
  let stoppedEarlyAtHumanGate = false;
  if (!canBypass) {
    const candidateDates = [...new Set(
      league.schedule
        .filter((f) => f.date <= targetDate && (!league.currentDate || f.date >= league.currentDate))
        .map((f) => f.date)
    )].sort();

    for (const dateKey of candidateDates) {
      const hasBlockingHumanOnDate = league.schedule.some((fixture) => (
        fixture.date === dateKey
        && fixture.status !== 'completed'
        && isHumanVsHumanFixture(league, fixture)
        && !hasDualHumanConsent(fixture)
      ));
      if (hasBlockingHumanOnDate) {
        effectiveTargetDate = dateKey;
        if (dateKey < targetDate) {
          stoppedEarlyAtHumanGate = true;
        }
        break;
      }
    }
  }

  const next = structuredClone(league);
  next.matchHistory ??= [];
  const savedById = new Map(next.matchHistory.map((match) => [match.matchId ?? match.fixtureId, match]));
  let simulatedCount = 0;
  let humanPendingCount = 0;
  next.schedule = next.schedule.map((fixture) => {
    if (fixture.date > effectiveTargetDate || fixture.status === 'completed') return fixture;
    if (savedById.has(fixture.id)) {
      const saved = savedById.get(fixture.id);
      return { ...fixture, status: 'completed', homeScore: saved.homeScore, awayScore: saved.awayScore };
    }
    const home = next.teams.find((team) => team.id === fixture.homeId);
    const away = next.teams.find((team) => team.id === fixture.awayId);
    if (!canBypass && home?.managerType === 'human' && away?.managerType === 'human' && !hasDualHumanConsent(fixture)) {
      if (fixture.status !== 'awaiting-human') humanPendingCount += 1;
      return { ...fixture, status: 'awaiting-human' };
    }
    const sim = simulateFixture(next, fixture);
    const homeScore = sim.homeScore;
    const awayScore = sim.awayScore;
    const result = {
      matchId: fixture.id,
      fixtureId: fixture.id,
      round: fixture.round,
      date: fixture.date,
      homeId: fixture.homeId,
      awayId: fixture.awayId,
      homeScore,
      awayScore,
      events: sim.events,
      stats: sim.stats,
      lineups: sim.lineups,
      manOfTheMatch: sim.manOfTheMatch,
      at: new Date(`${fixture.date}T12:00:00Z`).toISOString(),
      source: 'calendar-simulation',
    };
    recordMatchToPlayerStats(next, sim, fixture);
    next.matchHistory.push(result);
    savedById.set(fixture.id, result);
    simulatedCount += 1;
    return {
      ...fixture,
      status: 'completed',
      homeScore,
      awayScore,
      events: sim.events,
      stats: sim.stats,
      lineups: sim.lineups,
      manOfTheMatch: sim.manOfTheMatch,
    };
  });
  next.currentDate = effectiveTargetDate;
  const blockingFixtures = canBypass ? [] : getBlockingHumanFixtures(next, effectiveTargetDate);
  return {
    league: next,
    summary: {
      simulatedCount,
      humanPendingCount,
      currentDate: effectiveTargetDate,
      requestedTargetDate: targetDate,
      blockedByHumanMatch: blockingFixtures.length > 0,
      stoppedEarlyAtHumanGate,
      stoppedAtDate: blockingFixtures.length > 0 ? blockingFixtures[0].date : null,
      blockingFixtures,
    },
  };
}

export function simulateEntireSeason(league, { bypassHumanLock = true, isHost = true } = {}) {
  if (!Array.isArray(league?.schedule) || !league.schedule.length) {
    return { error: 'Für diese Liga wurde noch kein Spielplan erstellt.' };
  }
  const finalDate = league.schedule.reduce((last, fixture) => (fixture.date > last ? fixture.date : last), '0000-00-00');
  return simulateThroughDate(league, finalDate, { bypassHumanLock, isHost });
}

export function recordHumanFixtureResult(league, fixtureId, homeScore, awayScore, { managerTeamId, allowOverwrite = false, bypassHostCheck = false, source = 'manual-human-match', now = new Date().toISOString() } = {}) {
  const hostId = league?.teams?.find((team) => team.managerType === 'human')?.id;
  if (!bypassHostCheck && (!hostId || managerTeamId !== hostId)) return { league, error: 'Nur der Host darf Ergebnisse im Kalender eintragen.' };
  const fixture = league?.schedule?.find((entry) => entry.id === fixtureId);
  if (!fixture) return { league, error: 'Dieses Spiel wurde im Spielplan nicht gefunden.' };
  if (fixture.date > league.currentDate) return { league, error: 'Simuliere zuerst bis zu diesem Spieltag, bevor du das Ergebnis einträgst.' };
  const home = league.teams.find((team) => team.id === fixture.homeId);
  const away = league.teams.find((team) => team.id === fixture.awayId);
  if (home?.managerType !== 'human' || away?.managerType !== 'human') return { league, error: 'Nur Mensch-gegen-Mensch-Spiele werden hier manuell eingetragen.' };
  if (fixture.status === 'completed' && !allowOverwrite) {
    return { league, error: 'Dieses Ergebnis wurde bereits gespeichert. Nutze „Ergebnis bearbeiten“, um es ausdrücklich zu ändern.' };
  }
  const hScore = Number(homeScore);
  const aScore = Number(awayScore);
  if (![hScore, aScore].every((score) => Number.isInteger(score) && score >= 0 && score <= 99)) {
    return { league, error: 'Bitte gültige Tore zwischen 0 und 99 eintragen.' };
  }
  const wasCompleted = fixture.status === 'completed';
  const next = structuredClone(league);
  const nextFixture = next.schedule.find((entry) => entry.id === fixtureId);
  nextFixture.status = 'completed';
  nextFixture.homeScore = hScore;
  nextFixture.awayScore = aScore;
  nextFixture.syncedVia = source;
  if (wasCompleted) nextFixture.editedAt = now;
  next.matchHistory ??= [];
  next.matchHistory = next.matchHistory.filter((match) => (match.matchId ?? match.fixtureId) !== fixture.id);
  next.matchHistory.push({
    matchId: fixture.id,
    fixtureId: fixture.id,
    round: fixture.round,
    date: fixture.date,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
    homeScore: hScore,
    awayScore: aScore,
    at: now,
    source: wasCompleted ? `${source}-edited` : source,
  });
  return { league: next, fixture: nextFixture, edited: wasCompleted };
}

export function recordMatchToPlayerStats(league, sim, fixture) {
  if (!league || !sim) return;
  league.playerStats ??= {};

  const processLineup = (lineup, teamId, oppScore) => {
    for (const player of (lineup || [])) {
      const pid = player.id || player.playerId;
      if (!pid) continue;
      const existing = league.playerStats[pid] || {
        playerId: pid,
        playerName: player.name || player.playerName || 'Spieler',
        teamId,
        position: player.position || 'CM',
        rating: Number(player.rating) || 75,
        shirtNumber: player.shirtNumber || 10,
        matches: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        motmCount: 0,
        totalRating: 0,
        averageRating: 0,
      };

      existing.matches += 1;
      existing.goals += (player.goals || 0);
      existing.assists += (player.assists || 0);
      existing.totalRating = Number((existing.totalRating + (player.matchRating || 6.5)).toFixed(2));
      existing.averageRating = Number((existing.totalRating / existing.matches).toFixed(2));

      const pos = String(player.position || '').toUpperCase();
      const isDefOrGK = ['GK', 'TW', 'CB', 'IV', 'LB', 'RB', 'LWB', 'RWB'].some((t) => pos.includes(t));
      if (isDefOrGK && oppScore === 0) {
        existing.cleanSheets += 1;
      }
      if (sim.manOfTheMatch?.id === pid) {
        existing.motmCount += 1;
      }

      league.playerStats[pid] = existing;
    }
  };

  processLineup(sim.lineups?.home, fixture.homeId, sim.awayScore);
  processLineup(sim.lineups?.away, fixture.awayId, sim.homeScore);
}

export function getPlayerSeasonStats(league, playerId) {
  return league?.playerStats?.[playerId] || {
    playerId,
    matches: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    motmCount: 0,
    averageRating: 0,
  };
}

export function getTopScorers(league, limit = 20) {
  const stats = Object.values(league?.playerStats ?? {});
  return stats
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.averageRating - a.averageRating)
    .slice(0, limit);
}

export function getTopAssisters(league, limit = 20) {
  const stats = Object.values(league?.playerStats ?? {});
  return stats
    .filter((p) => p.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals || b.averageRating - a.averageRating)
    .slice(0, limit);
}

export function getTopRatedPlayers(league, limit = 20, minMatches = 2) {
  const stats = Object.values(league?.playerStats ?? {});
  return stats
    .filter((p) => p.matches >= minMatches)
    .sort((a, b) => b.averageRating - a.averageRating || b.goals - a.goals)
    .slice(0, limit);
}



