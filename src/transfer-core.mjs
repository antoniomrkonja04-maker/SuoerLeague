const clone = (value) => structuredClone(value);
const fail = (league, error) => ({ league, error });
const teamFor = (league, teamId) => league.teams?.find((team) => team.id === teamId);
const isParticipant = (call, teamId) => call.callerTeamId === teamId || call.targetTeamId === teamId;

function findCall(league, callId) {
  return league.calls?.find((call) => call.id === callId);
}

export function createCall(league, callerTeamId, targetTeamId, { now = new Date().toISOString(), callId = globalThis.crypto?.randomUUID?.() ?? `call-${Date.now()}-${Math.random()}` } = {}) {
  if (!league || !teamFor(league, callerTeamId) || !teamFor(league, targetTeamId)) return fail(league, 'Unbekanntes Manager-Team.');
  if (callerTeamId === targetTeamId) return fail(league, 'Du kannst dein eigenes Team nicht anrufen.');
  const calls = league.calls ?? [];
  if (calls.some((call) => isParticipant(call, callerTeamId) && isParticipant(call, targetTeamId) && ['ringing', 'negotiating'].includes(call.status))) {
    return fail(league, 'Zwischen diesen Teams läuft bereits ein Anruf.');
  }
  const next = clone(league);
  const caller = teamFor(next, callerTeamId);
  const target = teamFor(next, targetTeamId);
  next.calls ??= [];
  next.calls.push({
    id: callId,
    callerTeamId,
    callerTeamName: caller.name,
    callerManagerName: caller.managerName || caller.name,
    targetTeamId,
    targetTeamName: target.name,
    targetManagerName: target.managerName || target.name,
    status: 'ringing',
    createdAt: now,
    offers: [],
  });
  return { league: next, call: next.calls.at(-1) };
}

export function respondToCall(league, callId, managerTeamId, decision, now = new Date().toISOString()) {
  const call = findCall(league, callId);
  if (!call || (decision === 'hangup' ? !['ringing', 'negotiating'].includes(call.status) : call.status !== 'ringing')) return fail(league, 'Dieser Anruf ist nicht mehr aktiv.');
  if (decision === 'accept' || decision === 'decline') {
    if (managerTeamId !== call.targetTeamId) return fail(league, 'Nur der angerufene Manager kann antworten.');
  } else if (decision === 'hangup') {
    if (!isParticipant(call, managerTeamId)) return fail(league, 'Du bist an diesem Anruf nicht beteiligt.');
  } else return fail(league, 'Unbekannte Anrufaktion.');
  const next = clone(league);
  const nextCall = findCall(next, callId);
  nextCall.status = decision === 'accept' ? 'negotiating' : decision === 'decline' ? 'declined' : 'ended';
  if (decision === 'accept') nextCall.acceptedAt = now;
  nextCall.updatedAt = now;
  return { league: next, call: nextCall };
}

export function submitOffer(league, callId, managerTeamId, { playerId, fee }, now = new Date().toISOString()) {
  const call = findCall(league, callId);
  if (!call || call.status !== 'negotiating') return fail(league, 'Es gibt keinen aktiven Verhandlungsraum.');
  if (!isParticipant(call, managerTeamId)) return fail(league, 'Du bist an dieser Verhandlung nicht beteiligt.');
  if (!Number.isFinite(fee) || fee < 0) return fail(league, 'Die Ablöse muss eine positive Zahl oder null sein.');
  const picks = league.draft?.picks ?? [];
  const pick = picks.find((entry) => entry.playerId === playerId);
  if (!pick) return fail(league, 'Dieser Spieler ist nicht im Kaderpool.');
  const otherTeamId = managerTeamId === call.callerTeamId ? call.targetTeamId : call.callerTeamId;
  if (pick.teamId !== managerTeamId && pick.teamId !== otherTeamId) return fail(league, 'Der Spieler gehört keinem der beiden Verhandlungsteams.');
  const priorIndex = (call.offers?.length ?? 0) - 1;
  const prior = priorIndex >= 0 ? call.offers[priorIndex] : null;
  if (prior?.status === 'pending' && prior.fromTeamId === managerTeamId) return fail(league, 'Warte auf die Antwort auf dein offenes Angebot.');

  const next = clone(league);
  const nextCall = findCall(next, callId);
  const nextPick = next.draft.picks.find((entry) => entry.playerId === playerId);
  const sellerTeamId = nextPick.teamId;
  const buyerTeamId = sellerTeamId === call.callerTeamId ? call.targetTeamId : call.callerTeamId;
  const seller = teamFor(next, sellerTeamId);
  const buyer = teamFor(next, buyerTeamId);
  if (Number.isFinite(buyer?.budget) && buyer.budget < fee) return fail(league, 'Das Budget des kaufenden Teams reicht für dieses Angebot nicht aus.');
  if (prior?.status === 'pending') nextCall.offers[priorIndex].status = 'countered';
  nextCall.offers ??= [];
  nextCall.offers.push({
    id: `${callId}-offer-${nextCall.offers.length + 1}`,
    fromTeamId: managerTeamId,
    fromManagerName: teamFor(next, managerTeamId)?.managerName || teamFor(next, managerTeamId)?.name,
    sellerTeamId,
    buyerTeamId,
    playerId,
    playerName: nextPick.playerName || nextPick.name,
    fee,
    status: 'pending',
    createdAt: now,
  });
  nextCall.updatedAt = now;
  return { league: next, call: nextCall, offer: nextCall.offers.at(-1), sellerName: seller?.name, buyerName: buyer?.name };
}

export function declineOffer(league, callId, managerTeamId, now = new Date().toISOString()) {
  const call = findCall(league, callId);
  const offer = call?.offers?.at(-1);
  if (!call || call.status !== 'negotiating' || !offer || offer.status !== 'pending') return fail(league, 'Es gibt kein offenes Angebot.');
  if (!isParticipant(call, managerTeamId) || offer.fromTeamId === managerTeamId) return fail(league, 'Nur die Gegenseite kann dieses Angebot ablehnen.');
  const next = clone(league);
  const nextCall = findCall(next, callId);
  nextCall.offers.at(-1).status = 'rejected';
  nextCall.status = 'ended';
  nextCall.updatedAt = now;
  return { league: next, call: nextCall };
}

export function isTransferWindowOpen(dateValue) {
  if (!dateValue) return true;
  const iso = String(dateValue).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  if (day < 1 || day > 31) return false;
  return month === 1 || month === 7 || month === 8;
}

export function acceptOffer(league, callId, managerTeamId, now = new Date().toISOString(), signatureMeta = null) {
  const call = findCall(league, callId);
  const offer = call?.offers?.at(-1);
  if (!call || call.status !== 'negotiating' || !offer || offer.status !== 'pending') return fail(league, 'Es gibt kein offenes Angebot.');
  if (!isParticipant(call, managerTeamId) || offer.fromTeamId === managerTeamId) return fail(league, 'Nur die Gegenseite kann dieses Angebot annehmen.');
  if (league?.currentDate && !isTransferWindowOpen(league.currentDate)) {
    return fail(league, 'Transfers können nur innerhalb eines offenen Transferfensters (1. Juli–31. August oder 1.–31. Januar) abgeschlossen werden.');
  }
  const pick = league.draft?.picks?.find((entry) => entry.playerId === offer.playerId);
  if (!pick || pick.teamId !== offer.sellerTeamId) return fail(league, 'Der Spieler gehört nicht mehr dem verkaufenden Team.');
  const seller = teamFor(league, offer.sellerTeamId);
  const buyer = teamFor(league, offer.buyerTeamId);
  if (!seller || !buyer || (Number.isFinite(buyer.budget) && buyer.budget < offer.fee)) return fail(league, 'Das Budget reicht nicht mehr für diesen Transfer.');

  const next = clone(league);
  const nextCall = findCall(next, callId);
  const nextOffer = nextCall.offers.at(-1);
  const nextPick = next.draft.picks.find((entry) => entry.playerId === offer.playerId);
  const nextSeller = teamFor(next, offer.sellerTeamId);
  const nextBuyer = teamFor(next, offer.buyerTeamId);
  nextPick.previousTeamId = nextPick.teamId;
  nextPick.teamId = nextBuyer.id;
  nextPick.teamName = nextBuyer.name;
  nextPick.managerName = nextBuyer.managerName || nextBuyer.name;
  if (next.squads?.[nextSeller.id]?.starters) {
    for (const [slotId, starterId] of Object.entries(next.squads[nextSeller.id].starters)) {
      if (starterId === nextPick.playerId) next.squads[nextSeller.id].starters[slotId] = null;
    }
  }
  if (Number.isFinite(nextBuyer.budget)) nextBuyer.budget -= offer.fee;
  if (Number.isFinite(nextSeller.budget)) nextSeller.budget += offer.fee;
  nextOffer.status = 'accepted';
  nextCall.status = 'completed';
  nextCall.updatedAt = now;
  const savedSignatures = nextCall.customSignatures ?? {};
  if (signatureMeta && typeof signatureMeta === 'object') {
    savedSignatures[managerTeamId] = {
      ...(savedSignatures[managerTeamId] || {}),
      ...signatureMeta,
    };
  }
  next.transfers ??= [];
  next.transfers.push({
    callId,
    playerId: nextPick.playerId,
    playerName: nextPick.playerName || nextPick.name,
    position: nextPick.position || offer.position || 'CM',
    rating: nextPick.rating || offer.rating || 80,
    sellerTeamId: nextSeller.id,
    sellerTeamName: nextSeller.name,
    buyerTeamId: nextBuyer.id,
    buyerTeamName: nextBuyer.name,
    fee: offer.fee,
    reason: offer.reason || nextCall.reason || '',
    signedAt: now,
    signatures: [nextSeller, nextBuyer].map((team) => {
      const custom = savedSignatures[team.id];
      return {
        managerTeamId: team.id,
        managerName: team.managerName || team.name,
        signedAt: now,
        ...(custom?.pathData ? { pathData: custom.pathData } : {}),
        ...(Array.isArray(custom?.strokes) ? { strokes: custom.strokes } : {}),
        ...(Number.isFinite(custom?.durationMs) ? { durationMs: custom.durationMs } : {}),
      };
    }),
    at: now,
  });
  return { league: next, call: nextCall, transfer: next.transfers.at(-1) };
}

export function recordCallSignature(league, callId, managerTeamId, signatureData = {}) {
  const call = findCall(league, callId);
  if (!call) return fail(league, 'Anruf nicht gefunden.');
  const next = clone(league);
  const nextCall = findCall(next, callId);
  const svgPath = String(signatureData.svgPath || signatureData.pathData || '');
  nextCall.customSignatures ??= {};
  nextCall.customSignatures[managerTeamId] = {
    svgPath,
    pathData: svgPath,
    strokes: Array.isArray(signatureData.strokes) ? signatureData.strokes : [],
    durationMs: Number(signatureData.durationMs) || 1200,
    recordedAt: signatureData.signedAt || signatureData.recordedAt || new Date().toISOString(),
  };
  return { league: next, call: nextCall };
}

export function recordManagerSignature(league, callId, managerTeamId, signatureData = {}) {
  const next = clone(league);
  const transfer = (next.transfers ?? []).find((t) => t.callId === callId);
  const nextCall = findCall(next, callId);
  if (!transfer && !nextCall) return fail(league, 'Transfer oder Anruf nicht gefunden.');
  const svgPath = String(signatureData.svgPath || signatureData.pathData || '');
  const strokes = Array.isArray(signatureData.strokes) ? signatureData.strokes : [];
  const signedAt = signatureData.signedAt || signatureData.recordedAt || new Date().toISOString();

  if (nextCall) {
    nextCall.customSignatures ??= {};
    nextCall.customSignatures[managerTeamId] = {
      svgPath,
      pathData: svgPath,
      strokes,
      durationMs: Number(signatureData.durationMs) || 1200,
      recordedAt: signedAt,
    };
  }

  if (transfer) {
    transfer.signatures ??= [];
    const existing = transfer.signatures.find((s) => s.managerTeamId === managerTeamId);
    if (existing) {
      existing.svgPath = svgPath;
      existing.pathData = svgPath;
      existing.strokes = strokes;
      existing.signedAt = signedAt;
    } else {
      const team = (next.teams ?? []).find((t) => t.id === managerTeamId);
      transfer.signatures.push({
        managerTeamId,
        managerName: team?.managerName || team?.name || managerTeamId,
        svgPath,
        pathData: svgPath,
        strokes,
        signedAt,
      });
    }
  }

  return { league: next, transfer, call: nextCall };
}

export function rankTeamsFromResults(teams, results = []) {
  const table = new Map(teams.map((team) => [team.id, {
    teamId: team.id,
    teamName: team.name,
    managerName: team.managerName || team.name,
    managerType: team.managerType || 'cpu',
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
  }]));
  for (const result of results) {
    const home = table.get(result.homeId);
    const away = table.get(result.awayId);
    const homeScore = Number(result.homeScore ?? result.result?.home);
    const awayScore = Number(result.awayScore ?? result.result?.away);
    if (!home || !away || home === away || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) continue;
    home.played += 1; away.played += 1;
    home.goalsFor += homeScore; home.goalsAgainst += awayScore;
    away.goalsFor += awayScore; away.goalsAgainst += homeScore;
    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
    if (homeScore > awayScore) {
      home.wins += 1; away.losses += 1; home.points += 3;
      home.form.push('S'); away.form.push('N');
    } else if (homeScore < awayScore) {
      away.wins += 1; home.losses += 1; away.points += 3;
      home.form.push('N'); away.form.push('S');
    } else {
      home.draws += 1; away.draws += 1; home.points += 1; away.points += 1;
      home.form.push('U'); away.form.push('U');
    }
  }
  return [...table.values()]
    .map((row) => ({ ...row, form: row.form.slice(-5) }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId))
    .map((row, index) => {
      const rank = index + 1;
      const qualification = rank <= 8 ? 'direct-knockout' : rank <= 24 ? 'playoff' : 'eliminated';
      return { ...row, rank, qualification };
    });
}

export function rosterNeedForTeam(league, teamId, targetSize = 18) {
  const count = (league.draft?.picks ?? []).filter((pick) => pick.teamId === teamId).length;
  return Math.max(0, Math.min(1, (targetSize - count) / targetSize));
}

export function cpuAnswersCall({ rank, teamCount, rosterNeed, budget, teamStrength, randomValue }) {
  if (!Number.isInteger(rank) || !Number.isInteger(teamCount) || teamCount < 1 || rank < 1 || rank > teamCount) return false;
  const urgency = teamCount === 1 ? 0 : (rank - 1) / (teamCount - 1);
  const need = Math.max(0, Math.min(1, Number(rosterNeed) || 0));
  const budgetFactor = Number.isFinite(budget) ? Math.max(-0.15, Math.min(0.15, (budget - 50) / 500)) : 0;
  const strengthFactor = Number.isFinite(teamStrength) && teamStrength > 0 ? Math.max(-0.15, Math.min(0.15, (82 - teamStrength) / 80)) : 0;
  const chance = Math.max(0.05, Math.min(0.95, 0.15 + 0.5 * urgency + 0.25 * need + budgetFactor + strengthFactor));
  return Number(randomValue) >= 0 && Number(randomValue) < chance;
}

export function normalizeCanonicalPosition(rawPosition = 'CM') {
  const raw = String(rawPosition || 'CM').toUpperCase().trim();
  const firstToken = raw.split(/[,/]/)[0].trim();
  if (firstToken === 'GK' || firstToken === 'TW') return 'GK';
  if (['CB', 'DC', 'IV', 'D (C)', 'D (LC)', 'D (RC)', 'D (RLC)'].includes(firstToken)) return 'CB';
  if (['LB', 'DL', 'LWB', 'LV', 'D (L)', 'WB (L)', 'D/WB (L)'].includes(firstToken)) return 'LB';
  if (['RB', 'DR', 'RWB', 'RV', 'D (R)', 'WB (R)', 'D/WB (R)', 'D (RL)'].includes(firstToken)) return 'RB';
  if (['DM', 'DMC', 'CDM', 'ZDM'].includes(firstToken) || firstToken.startsWith('DM')) return 'DM';
  if (['LW', 'AML', 'LM', 'LF', 'AM (L)', 'M (L)', 'AM (RL)'].includes(firstToken)) return 'LW';
  if (['RW', 'AMR', 'RM', 'RF', 'AM (R)', 'M (R)'].includes(firstToken)) return 'RW';
  if (['ST', 'CF', 'MS', 'ST (C)'].includes(firstToken) || raw.includes('ST')) return 'ST';
  return 'CM';
}

export const POSITION_TARGETS = {
  GK: 2,
  CB: 4,
  LB: 2,
  RB: 2,
  DM: 2,
  CM: 4,
  LW: 2,
  RW: 2,
  ST: 2,
};

export function calculatePlayerMarketValue({
  rating = 80,
  position = 'CM',
  sellerRosterCount = 15,
  sellerPositionCount = 2,
} = {}) {
  const clamped = Math.max(60, Math.min(99, Number(rating) || 80));
  const baseValuation = Math.max(8, Math.round((clamped - 62) * 1.6));
  // Elite tier bonus so top stars (85+) are sold at significantly higher fees
  const eliteBonus = clamped >= 85 ? Math.round(Math.pow(clamped - 83, 1.48) * 1.8) : 0;
  const posGroup = normalizeCanonicalPosition(position);
  const attackerBonus = ['ST', 'RW', 'LW'].includes(posGroup) && clamped >= 82 ? 4 : 0;
  const scarcityMultiplier = (sellerRosterCount < 8 || sellerPositionCount <= 1) ? 1.15 : 1;
  return Math.max(8, Math.round((baseValuation + eliteBonus + attackerBonus) * scarcityMultiplier));
}

export function evaluateCpuOfferResponse({
  playerRating = 80,
  position = 'CM',
  fee = 0,
  sellerRosterCount = 10,
  sellerPositionCount = 2,
  offerRound = 1,
  requireMultiRound = false,
} = {}) {
  if (sellerRosterCount <= 3) {
    return { decision: 'decline', reason: 'Kader zu klein für einen Verkauf' };
  }
  const askingPrice = calculatePlayerMarketValue({
    rating: playerRating,
    position,
    sellerRosterCount,
    sellerPositionCount,
  });

  if (requireMultiRound && offerRound === 1) {
    const blowoutPrice = Math.round(askingPrice * 1.25);
    if (fee >= blowoutPrice) {
      return {
        decision: 'accept',
        askingPrice,
        stageLabel: 'Sofort-Freigabe durch Ausstiegsklausel-Gebot',
      };
    }
    const targetCounter = Math.max(askingPrice + 3, Math.round(askingPrice * 1.1), Math.round((askingPrice + Number(fee || 0)) * 0.6));
    return {
      decision: 'counter',
      counterFee: targetCounter,
      askingPrice,
      stageLabel: 'Runde 1/3 · Verein fordert höhere Ablöse & Weiterverkaufsbonus (Hijack-Fenster offen)',
    };
  }

  if (requireMultiRound && offerRound === 2 && fee < askingPrice) {
    if (fee < askingPrice * 0.5) {
      return { decision: 'decline', askingPrice, reason: 'Angebot deutlich unter Marktwert' };
    }
    const round2Counter = Math.max(askingPrice, Math.round((askingPrice + Number(fee || 0)) / 2));
    return {
      decision: 'counter',
      counterFee: round2Counter,
      askingPrice,
      stageLabel: 'Runde 2/3 · Letztes Gegenangebot vor Vorvertrag',
    };
  }

  if (fee >= askingPrice) {
    return { decision: 'accept', askingPrice };
  }
  if (fee < askingPrice * 0.45 && offerRound >= 2) {
    return { decision: 'decline', askingPrice };
  }
  const counterFee = Math.max(askingPrice, Math.round((askingPrice + Number(fee || 0)) / 2));
  return { decision: 'counter', counterFee: Math.max(askingPrice, counterFee), askingPrice };
}

export function analyzeTeamPositionNeeds(league, teamId, players = []) {
  const playerMap = new Map((players ?? []).map((p) => [p.id, p]));
  const teamPicks = (league?.draft?.picks ?? []).filter((pick) => pick.teamId === teamId);
  const counts = Object.fromEntries(Object.keys(POSITION_TARGETS).map((pos) => [pos, 0]));
  const bestRatingByPos = Object.fromEntries(Object.keys(POSITION_TARGETS).map((pos) => [pos, 0]));
  const playersByPos = Object.fromEntries(Object.keys(POSITION_TARGETS).map((pos) => [pos, []]));

  for (const pick of teamPicks) {
    const rawPos = pick.position || playerMap.get(pick.playerId)?.position || 'CM';
    const pos = normalizeCanonicalPosition(rawPos);
    const rating = Number(pick.rating ?? playerMap.get(pick.playerId)?.rating ?? 75);
    counts[pos] = (counts[pos] || 0) + 1;
    if (rating > (bestRatingByPos[pos] || 0)) bestRatingByPos[pos] = rating;
    playersByPos[pos].push({ ...pick, canonicalPosition: pos, rating });
  }

  for (const pos of Object.keys(playersByPos)) {
    playersByPos[pos].sort((a, b) => b.rating - a.rating);
  }

  const missingPositions = Object.entries(POSITION_TARGETS)
    .map(([pos, target]) => {
      const count = counts[pos] || 0;
      const deficit = Math.max(0, target - count);
      const bestOvr = bestRatingByPos[pos] || 0;
      // Highest urgency when a position has 0 players (especially GK), then when below target depth, then weakest starter OVR
      const gkCritical = pos === 'GK' && count === 0 ? 50 : 0;
      const urgencyScore = (count === 0 ? 100 : 0) + gkCritical + deficit * 25 + Math.max(0, 88 - bestOvr);
      return { position: pos, count, target, deficit, bestOvr, urgencyScore };
    })
    .filter((entry) => entry.deficit > 0 || entry.bestOvr < 86)
    .sort((a, b) => b.urgencyScore - a.urgencyScore || a.position.localeCompare(b.position));

  const surplusPositions = Object.entries(POSITION_TARGETS)
    .map(([pos, target]) => ({
      position: pos,
      count: counts[pos] || 0,
      target,
      surplus: (counts[pos] || 0) - target,
      players: playersByPos[pos] || [],
    }))
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.surplus - a.surplus || b.count - a.count);

  return {
    rosterSize: teamPicks.length,
    counts,
    bestRatingByPos,
    playersByPos,
    missingPositions,
    surplusPositions,
  };
}

function deterministicHash(seedText = '') {
  let hash = 2166136261;
  for (const ch of String(seedText)) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return hash >>> 0 || 1;
}

export function simulateCpuTransferMarketStep(league, {
  players = [],
  seed = '',
  maxCpuToCpuDeals = 2,
  targetHumanTeamId = '',
  allowOutsideWindow = false,
  now = new Date().toISOString(),
} = {}) {
  if (!league || !Array.isArray(league.teams) || !(league.draft?.picks?.length)) {
    return { league, cpuTransfers: [], incomingCall: null };
  }
  const next = clone(league);
  next.calls ??= [];
  next.transfers ??= [];
  const windowOpen = isTransferWindowOpen(next.currentDate || '2026-08-01');
  const stepSeed = deterministicHash(`${seed}|${next.currentDate || '2026-08-01'}|${next.transfers.length}|${next.calls.length}`);

  const cpuTeams = next.teams.filter((t) => t.managerType === 'cpu');
  const cpuTransfers = [];

  // 1. Realistic CPU-to-CPU Transfers (finalized inside an open transfer window or manual test trigger)
  if ((windowOpen || allowOutsideWindow) && cpuTeams.length >= 2 && maxCpuToCpuDeals > 0) {
    const analysisByTeam = new Map(cpuTeams.map((team) => [team.id, analyzeTeamPositionNeeds(next, team.id, players)]));
    const buyers = [...cpuTeams]
      .filter((team) => (team.budget ?? 150) >= 18)
      .sort((a, b) => {
        const needA = analysisByTeam.get(a.id)?.missingPositions[0]?.urgencyScore ?? 0;
        const needB = analysisByTeam.get(b.id)?.missingPositions[0]?.urgencyScore ?? 0;
        return needB - needA || a.id.localeCompare(b.id);
      });

    const rotatedOffset = stepSeed % Math.max(1, buyers.length);
    const orderedBuyers = [...buyers.slice(rotatedOffset), ...buyers.slice(0, rotatedOffset)];
    const movedPlayerIds = new Set();

    for (const buyer of orderedBuyers) {
      if (cpuTransfers.length >= maxCpuToCpuDeals) break;
      const buyerNeeds = analyzeTeamPositionNeeds(next, buyer.id, players);
      let bestCandidate = null;
      let matchedNeed = null;

      for (const need of buyerNeeds.missingPositions) {
        const neededPos = need.position;
        for (const seller of cpuTeams) {
          if (seller.id === buyer.id) continue;
          const sellerAnalysis = analyzeTeamPositionNeeds(next, seller.id, players);
          if (sellerAnalysis.rosterSize <= 11) continue;
          const posGroupPlayers = sellerAnalysis.playersByPos[neededPos] || [];
          if (posGroupPlayers.length < 2 && sellerAnalysis.rosterSize < 20) continue;
          const candidates = posGroupPlayers.length >= 2 ? posGroupPlayers.slice(1) : posGroupPlayers;
          for (const candidate of candidates) {
            if (movedPlayerIds.has(candidate.playerId)) continue;
            if (need.deficit === 0 && candidate.rating < need.bestOvr) continue;
            const fee = calculatePlayerMarketValue({
              rating: candidate.rating,
              position: neededPos,
              sellerRosterCount: sellerAnalysis.rosterSize,
              sellerPositionCount: posGroupPlayers.length,
            });
            if ((buyer.budget ?? 150) < fee) continue;
            if (!bestCandidate || candidate.rating > bestCandidate.candidate.rating) {
              bestCandidate = { seller, sellerAnalysis, candidate, fee, neededPos, posCount: posGroupPlayers.length };
              matchedNeed = need;
            }
          }
        }
        if (bestCandidate) break;
      }

      if (bestCandidate && matchedNeed) {
        const topNeed = matchedNeed;
        const { seller, candidate, fee, neededPos } = bestCandidate;
        const pickInDraft = next.draft.picks.find((p) => p.playerId === candidate.playerId);
        if (!pickInDraft) continue;
        pickInDraft.previousTeamId = seller.id;
        pickInDraft.teamId = buyer.id;
        pickInDraft.teamName = buyer.name;
        pickInDraft.managerName = buyer.managerName || buyer.name;
        pickInDraft.position = pickInDraft.position || neededPos;

        if (next.squads?.[seller.id]?.starters) {
          for (const [slotId, starterId] of Object.entries(next.squads[seller.id].starters)) {
            if (starterId === pickInDraft.playerId) next.squads[seller.id].starters[slotId] = null;
          }
        }

        buyer.budget = Number(buyer.budget ?? 150) - fee;
        seller.budget = Number(seller.budget ?? 150) + fee;
        movedPlayerIds.add(pickInDraft.playerId);

        const reason = topNeed.count === 0
          ? `Vakante Position ${neededPos} geschlossen (OVR ${candidate.rating})`
          : `Kader-Upgrade auf ${neededPos} (OVR ${candidate.rating} · Marktwert ${fee} Mio.)`;

        const transferRecord = {
          callId: `cpu-deal-${next.currentDate || '2026'}-${pickInDraft.playerId}-${next.transfers.length + 1}`,
          playerId: pickInDraft.playerId,
          playerName: pickInDraft.playerName || pickInDraft.name,
          position: neededPos,
          rating: candidate.rating,
          sellerTeamId: seller.id,
          sellerTeamName: seller.name,
          buyerTeamId: buyer.id,
          buyerTeamName: buyer.name,
          fee,
          isCpuToCpu: true,
          reason,
          signedAt: now,
          signatures: [seller, buyer].map((team) => ({
            managerTeamId: team.id,
            managerName: team.managerName || team.name,
            signedAt: now,
          })),
          at: now,
        };
        next.transfers.push(transferRecord);
        cpuTransfers.push(transferRecord);
      }
    }
  }

  // 2. Realistic CPU-to-Human Incoming Call & Offer (so the phone vibrates, pops open, and shows the Call Screen)
  const humanTeam = (targetHumanTeamId && next.teams.find((t) => t.id === targetHumanTeamId))
    || next.teams.find((t) => t.managerType === 'human');
  let incomingCall = null;

  if (humanTeam && cpuTeams.length > 0) {
    const existingRinging = next.calls.find(
      (c) => c.targetTeamId === humanTeam.id && c.status === 'ringing',
    );
    if (existingRinging) {
      incomingCall = existingRinging;
    } else {
      const hasActiveNegotiating = next.calls.some(
        (c) => isParticipant(c, humanTeam.id) && c.status === 'negotiating',
      );
      if (!hasActiveNegotiating || allowOutsideWindow) {
        if (allowOutsideWindow && hasActiveNegotiating) {
          for (const c of next.calls) {
            if (isParticipant(c, humanTeam.id) && c.status === 'negotiating') {
              c.status = 'ended';
              c.updatedAt = now;
            }
          }
        }
        const humanNeeds = analyzeTeamPositionNeeds(next, humanTeam.id, players);
        const cpuIndex = stepSeed % cpuTeams.length;
        const orderedCpu = [...cpuTeams.slice(cpuIndex), ...cpuTeams.slice(0, cpuIndex)];

        for (const cpuTeam of orderedCpu) {
          if ((cpuTeam.budget ?? 150) < 15) continue;
          const cpuNeeds = analyzeTeamPositionNeeds(next, cpuTeam.id, players);
          const wantedPos = cpuNeeds.missingPositions[0]?.position || 'ST';
          // Look for a player on the human team matching CPU's missing position, or human's top tradable player
          const humanCandidates = (humanNeeds.playersByPos[wantedPos]?.length
            ? humanNeeds.playersByPos[wantedPos]
            : Object.values(humanNeeds.playersByPos).flat()
          ).sort((a, b) => b.rating - a.rating);

          const targetPick = humanCandidates[0];
          if (!targetPick) continue;
          const posCount = (humanNeeds.playersByPos[targetPick.canonicalPosition] || []).length;
          const fairFee = calculatePlayerMarketValue({
            rating: targetPick.rating,
            position: targetPick.canonicalPosition,
            sellerRosterCount: humanNeeds.rosterSize,
            sellerPositionCount: posCount,
          });
          const offerFee = Math.min(Number(cpuTeam.budget ?? 150), Math.max(10, fairFee));
          const callId = `cpu-call-${Date.now()}-${cpuTeam.id}-${humanTeam.id}`;
          const reason = cpuNeeds.counts[targetPick.canonicalPosition] === 0
            ? `${cpuTeam.name} sucht dringend Verstärkung auf ${targetPick.canonicalPosition} (OVR ${targetPick.rating})`
            : `${cpuTeam.name} bietet ${offerFee} Mio. € für Top-Spieler ${targetPick.playerName} (${targetPick.canonicalPosition} · OVR ${targetPick.rating})`;

          const newCall = {
            id: callId,
            callerTeamId: cpuTeam.id,
            callerTeamName: cpuTeam.name,
            callerManagerName: cpuTeam.managerName || cpuTeam.name,
            targetTeamId: humanTeam.id,
            targetTeamName: humanTeam.name,
            targetManagerName: humanTeam.managerName || humanTeam.name,
            status: 'ringing',
            initiatedByCpu: true,
            negotiationRound: 1,
            maxRounds: 3,
            reason,
            createdAt: now,
            offers: [
              {
                id: `${callId}-offer-1`,
                fromTeamId: cpuTeam.id,
                fromManagerName: cpuTeam.managerName || cpuTeam.name,
                sellerTeamId: humanTeam.id,
                buyerTeamId: cpuTeam.id,
                playerId: targetPick.playerId,
                playerName: targetPick.playerName || targetPick.name,
                position: targetPick.canonicalPosition,
                rating: targetPick.rating,
                fee: offerFee,
                reason,
                status: 'pending',
                createdAt: now,
              },
            ],
          };
          next.calls.push(newCall);
          incomingCall = newCall;
          break;
        }
      }
    }
  }

  const withHijacks = ensureHijackableDeals(next, players, { seed: `${seed}-hijack`, now });
  return { league: withHijacks.league, cpuTransfers, incomingCall, hijackableDeals: withHijacks.league.pendingDeals ?? [] };
}

const HIJACK_STAGES = [
  { round: 1, label: 'Runde 1/3 · Sondierung & Erstgebot' },
  { round: 2, label: 'Runde 2/3 · Ablöse-Poker & Klauseln' },
  { round: 3, label: 'Runde 3/3 · Medizincheck & Vorvertrag (Letzte Hijack-Chance)' },
];

export function ensureHijackableDeals(league, players = [], { seed = '', now = new Date().toISOString(), advanceExisting = false } = {}) {
  if (!league || !Array.isArray(league.teams) || !(league.draft?.picks?.length)) {
    return { league, deals: [] };
  }
  const next = clone(league);
  next.pendingDeals ??= [];

  const picksByPlayer = new Map((next.draft.picks ?? []).map((p) => [p.playerId, p]));
  const teamsById = new Map((next.teams ?? []).map((t) => [t.id, t]));

  // Keep only valid deals where the player still belongs to sellerTeamId
  const validExisting = [];
  for (const deal of next.pendingDeals) {
    const currentPick = picksByPlayer.get(deal.playerId);
    if (!currentPick || currentPick.teamId !== deal.sellerTeamId) continue;
    if (advanceExisting) {
      const nextRound = Math.min(3, (Number(deal.round) || 1) + 1);
      const stageMeta = HIJACK_STAGES.find((s) => s.round === nextRound) || HIJACK_STAGES[1];
      validExisting.push({
        ...deal,
        round: nextRound,
        stageLabel: stageMeta.label,
        updatedAt: now,
      });
    } else {
      validExisting.push(deal);
    }
  }

  next.pendingDeals = validExisting;

  const targetDealCount = 5;
  if (next.pendingDeals.length >= targetDealCount) {
    return { league: next, deals: next.pendingDeals };
  }

  const hSeed = deterministicHash(`${seed}|${next.currentDate || '2026-08-01'}|${next.pendingDeals.length}|${next.transfers?.length || 0}`);
  const usedPlayerIds = new Set(next.pendingDeals.map((d) => d.playerId));
  const topPicks = [...(next.draft.picks ?? [])]
    .filter((p) => (Number(p.rating) || 75) >= 79 && !usedPlayerIds.has(p.playerId))
    .sort((a, b) => (b.rating || 78) - (a.rating || 78));

  const allTeams = next.teams ?? [];
  let cursor = 0;

  while (next.pendingDeals.length < targetDealCount && cursor < topPicks.length && allTeams.length >= 2) {
    const idx = (hSeed + cursor * 7) % topPicks.length;
    cursor += 1;
    const pick = topPicks[idx];
    if (!pick || usedPlayerIds.has(pick.playerId)) continue;
    const seller = teamsById.get(pick.teamId);
    if (!seller) continue;
    const possibleBuyers = allTeams.filter((t) => t.id !== seller.id && (Number(t.budget ?? 150) >= 25));
    if (!possibleBuyers.length) continue;
    const buyer = possibleBuyers[(hSeed + cursor * 3) % possibleBuyers.length];
    const pos = normalizeCanonicalPosition(pick.position || 'CM');
    const marketValue = calculatePlayerMarketValue({ rating: pick.rating || 82, position: pos });
    const currentFee = Math.max(12, Math.round(marketValue * (0.94 + ((cursor % 3) * 0.04))));
    const hijackFee = Math.max(currentFee + 3, Math.round(currentFee * 1.1));
    const round = 1 + ((hSeed + cursor) % 3); // 1, 2, or 3
    const stageMeta = HIJACK_STAGES.find((s) => s.round === round) || HIJACK_STAGES[1];

    usedPlayerIds.add(pick.playerId);
    next.pendingDeals.push({
      id: `hijack-deal-${pick.playerId}-${round}`,
      playerId: pick.playerId,
      playerName: pick.playerName || pick.name,
      position: pos,
      rating: Number(pick.rating) || 82,
      sellerTeamId: seller.id,
      sellerTeamName: seller.name,
      buyerTeamId: buyer.id,
      buyerTeamName: buyer.name,
      currentFee,
      hijackFee,
      minHijackFee: hijackFee,
      marketValue,
      round,
      maxRounds: 3,
      stageLabel: stageMeta.label,
      status: 'open',
      createdAt: now,
    });
  }

  return { league: next, deals: next.pendingDeals };
}

export function hijackTransferDeal(league, hijackerTeamId, dealId, { customFee = 0, now = new Date().toISOString() } = {}) {
  if (!league || !hijackerTeamId || !dealId) return fail(league, 'Ungültige Hijack-Anfrage.');
  const deal = (league.pendingDeals ?? []).find((d) => d.id === dealId || d.playerId === dealId);
  if (!deal) return fail(league, 'Diese Transferverhandlung ist bereits abgeschlossen oder nicht mehr verfügbar.');
  if (deal.sellerTeamId === hijackerTeamId) {
    return fail(league, 'Dieser Spieler steht bereits bei deinem eigenen Verein unter Vertrag.');
  }
  if (deal.buyerTeamId === hijackerTeamId) {
    return fail(league, 'Dein Verein führt diese Verhandlung bereits an.');
  }

  const hijacker = teamFor(league, hijackerTeamId);
  const seller = teamFor(league, deal.sellerTeamId);
  if (!hijacker || !seller) return fail(league, 'Verhandlungsteam nicht gefunden.');

  const requiredFee = Math.max(deal.hijackFee || (deal.currentFee + 3), Number(customFee) || 0);
  if (Number.isFinite(hijacker.budget) && hijacker.budget < requiredFee) {
    return fail(league, `Dein Budget (${hijacker.budget} Mio. €) reicht nicht für das Hijack-Gebot von ${requiredFee} Mio. €.`);
  }

  const next = clone(league);
  next.pendingDeals = (next.pendingDeals ?? []).filter((d) => d.id !== deal.id);
  next.calls ??= [];

  // Close or reuse any existing call between hijacker and seller
  let activeCall = next.calls.find(
    (c) => isParticipant(c, hijackerTeamId) && isParticipant(c, seller.id) && ['ringing', 'negotiating'].includes(c.status),
  );

  const callId = activeCall?.id || `hijack-call-${Date.now()}-${hijackerTeamId}-${seller.id}`;
  const hijackReason = `TRANSFER-HIJACK: ${hijacker.name} überbietet ${deal.buyerTeamName} (${deal.currentFee} Mio. €) mit ${requiredFee} Mio. € für ${deal.playerName}!`;

  if (!activeCall) {
    activeCall = {
      id: callId,
      callerTeamId: hijacker.id,
      callerTeamName: hijacker.name,
      callerManagerName: hijacker.managerName || hijacker.name,
      targetTeamId: seller.id,
      targetTeamName: seller.name,
      targetManagerName: seller.managerName || seller.name,
      status: 'negotiating',
      acceptedAt: now,
      updatedAt: now,
      createdAt: now,
      isHijack: true,
      hijackedFromTeamId: deal.buyerTeamId,
      hijackedFromTeamName: deal.buyerTeamName,
      previousBidFee: deal.currentFee,
      negotiationRound: 2,
      maxRounds: 3,
      reason: hijackReason,
      offers: [],
    };
    next.calls.push(activeCall);
  } else {
    activeCall.status = 'negotiating';
    activeCall.acceptedAt ||= now;
    activeCall.updatedAt = now;
    activeCall.isHijack = true;
    activeCall.hijackedFromTeamId = deal.buyerTeamId;
    activeCall.hijackedFromTeamName = deal.buyerTeamName;
    activeCall.previousBidFee = deal.currentFee;
    activeCall.negotiationRound = Math.max(2, (activeCall.offers?.length || 1) + 1);
    activeCall.reason = hijackReason;
  }

  activeCall.offers.push({
    id: `${callId}-offer-${activeCall.offers.length + 1}`,
    fromTeamId: hijacker.id,
    fromManagerName: hijacker.managerName || hijacker.name,
    sellerTeamId: seller.id,
    buyerTeamId: hijacker.id,
    playerId: deal.playerId,
    playerName: deal.playerName,
    position: deal.position,
    rating: deal.rating,
    fee: requiredFee,
    isHijackOffer: true,
    hijackedFromTeamName: deal.buyerTeamName,
    reason: hijackReason,
    status: 'pending',
    createdAt: now,
  });

  return {
    league: next,
    call: activeCall,
    offer: activeCall.offers.at(-1),
    hijackedDeal: deal,
    hijackFee: requiredFee,
  };
}

export function triggerRivalHijackOnCall(league, callId, { seed = '', now = new Date().toISOString() } = {}) {
  const call = findCall(league, callId);
  const lastOffer = call?.offers?.at(-1);
  if (!call || call.status !== 'negotiating' || !lastOffer) return { league, competingBid: null };

  const next = clone(league);
  const nextCall = findCall(next, callId);
  const offer = nextCall.offers.at(-1);
  const h = deterministicHash(`${seed}|${callId}|${offer.playerId}|${offer.fee}`);

  const rivalCandidates = (next.teams ?? []).filter(
    (t) => t.id !== offer.sellerTeamId && t.id !== offer.buyerTeamId && (Number(t.budget ?? 150) >= offer.fee + 8),
  );
  if (!rivalCandidates.length) return { league: next, competingBid: null };

  const rival = rivalCandidates[h % rivalCandidates.length];
  const rivalBidFee = Math.min(Number(rival.budget ?? 150), Math.max(offer.fee + 4, Math.round(offer.fee * 1.1)));

  const competingBid = {
    id: `competing-${callId}-${Date.now()}`,
    rivalTeamId: rival.id,
    rivalTeamName: rival.name,
    rivalManagerName: rival.managerName || rival.name,
    playerId: offer.playerId,
    playerName: offer.playerName,
    fee: rivalBidFee,
    outbidFee: rivalBidFee + 3,
    createdAt: now,
    status: 'active',
  };

  nextCall.competingBid = competingBid;
  nextCall.updatedAt = now;
  return { league: next, call: nextCall, competingBid };
}

export function resolveCompetingHijack(league, callId, managerTeamId, decision = 'outbid', now = new Date().toISOString()) {
  const call = findCall(league, callId);
  if (!call || !call.competingBid) return fail(league, 'Kein aktives Konkurrenz-Gebot vorhanden.');
  const competing = call.competingBid;
  const lastOffer = call.offers?.at(-1);
  if (!lastOffer) return fail(league, 'Kein Basisangebot vorhanden.');

  const next = clone(league);
  const nextCall = findCall(next, callId);

  if (decision === 'concede') {
    // Rival completes the hijack transfer
    const pick = next.draft?.picks?.find((p) => p.playerId === competing.playerId);
    const seller = teamFor(next, lastOffer.sellerTeamId);
    const rivalBuyer = teamFor(next, competing.rivalTeamId);
    if (pick && seller && rivalBuyer && (Number(rivalBuyer.budget ?? 150) >= competing.fee)) {
      pick.previousTeamId = seller.id;
      pick.teamId = rivalBuyer.id;
      pick.teamName = rivalBuyer.name;
      pick.managerName = rivalBuyer.managerName || rivalBuyer.name;
      rivalBuyer.budget = Number(rivalBuyer.budget ?? 150) - competing.fee;
      seller.budget = Number(seller.budget ?? 150) + competing.fee;
      next.transfers ??= [];
      next.transfers.push({
        callId: `${callId}-hijacked-by-${rivalBuyer.id}`,
        playerId: pick.playerId,
        playerName: pick.playerName || pick.name,
        position: pick.position || 'CM',
        rating: pick.rating || 82,
        sellerTeamId: seller.id,
        sellerTeamName: seller.name,
        buyerTeamId: rivalBuyer.id,
        buyerTeamName: rivalBuyer.name,
        fee: competing.fee,
        isHijack: true,
        hijackedFromTeamName: teamFor(next, lastOffer.buyerTeamId)?.name || '',
        reason: `TRANSFER-HIJACK: ${rivalBuyer.name} sticht ${teamFor(next, lastOffer.buyerTeamId)?.name || 'Konkurrent'} mit ${competing.fee} Mio. € aus!`,
        signedAt: now,
        signatures: [seller, rivalBuyer].map((t) => ({ managerTeamId: t.id, managerName: t.managerName || t.name, signedAt: now })),
        at: now,
      });
    }
    nextCall.competingBid.status = 'won-by-rival';
    nextCall.status = 'ended';
    nextCall.updatedAt = now;
    return { league: next, call: nextCall, hijackedByRival: true, rivalTransfer: next.transfers?.at(-1) };
  }

  // Manager outbids the rival hijack attempt!
  const buyer = teamFor(next, lastOffer.buyerTeamId);
  const outbidFee = competing.outbidFee || (competing.fee + 3);
  if (Number.isFinite(buyer?.budget) && buyer.budget < outbidFee) {
    return fail(league, `Dein Budget reicht nicht aus, um das Hijack-Gebot von ${competing.rivalTeamName} (${outbidFee} Mio. €) zu überbieten.`);
  }

  nextCall.competingBid = null;
  if (nextCall.offers.length) {
    nextCall.offers.at(-1).status = 'countered';
  }
  nextCall.offers.push({
    id: `${callId}-offer-${nextCall.offers.length + 1}`,
    fromTeamId: managerTeamId,
    fromManagerName: teamFor(next, managerTeamId)?.managerName || teamFor(next, managerTeamId)?.name,
    sellerTeamId: lastOffer.sellerTeamId,
    buyerTeamId: lastOffer.buyerTeamId,
    playerId: lastOffer.playerId,
    playerName: lastOffer.playerName,
    position: lastOffer.position || 'CM',
    rating: lastOffer.rating || 82,
    fee: outbidFee,
    reason: `Konkurrenz-Hijack von ${competing.rivalTeamName} (${competing.fee} Mio. €) erfolgreich mit ${outbidFee} Mio. € abgewehrt!`,
    status: 'pending',
    createdAt: now,
  });
  nextCall.updatedAt = now;
  return { league: next, call: nextCall, offer: nextCall.offers.at(-1), outbidFee, hijackedByRival: false };
}



