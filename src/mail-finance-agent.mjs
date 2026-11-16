// Mail App (Postfach), 2-Stage Player & Agent Negotiations, Static Signature Display, and FIFA 17 Finance Tab
import { calculatePlayerMarketValue, evaluateCpuOfferResponse } from './transfer-core.mjs';
import { getPlayerContract } from './scouting-talent-core.mjs';

const clone = (v) => structuredClone(v);
const fail = (league, error) => ({ league, error });

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function hashStr(str = '') {
  const s = String(str);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const AGENT_NAMES = [
  'Jorge Mendes-Silva',
  'Mino Raiola-Rossi',
  'Pini Zahavi-Stein',
  'Volker Struth-Berg',
  'Jonathan Barnett-Cole',
  'Rafaela Pimenta-Luz',
  'Fali Ramadani-Vuk',
  'Kia Joorabchian-Vane',
  'Pere Guardiola-Sol',
  'Ali Barat-Moreau',
];

const AGENT_STYLES = [
  { id: 'tough', label: 'Hartnaeckig', agency: 'Gestifute Elite', margin: 1.12, patienceDrop: 34 },
  { id: 'balanced', label: 'Ausgewogen', agency: 'Stellar Sports Group', margin: 1.04, patienceDrop: 25 },
  { id: 'loyal', label: 'Kooperativ', agency: 'ROOF International', margin: 0.98, patienceDrop: 18 },
];

export const SQUAD_ROLES = [
  { id: 'crucial', label: 'Schluesselspieler', minOvr: 86, wageMult: 1.0 },
  { id: 'important', label: 'Stammspieler', minOvr: 81, wageMult: 1.04 },
  { id: 'rotation', label: 'Rotationsspieler', minOvr: 75, wageMult: 1.1 },
  { id: 'prospect', label: 'Perspektivspieler', minOvr: 60, wageMult: 1.15 },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function attachLeagueProp(leagueObj) {
  if (leagueObj && typeof leagueObj === 'object') {
    Object.defineProperty(leagueObj, 'league', {
      value: leagueObj,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return leagueObj;
}

export function getPlayerAgentProfile(player, league) {
  const playerId = typeof player === 'string' ? player : player?.id || 'p-1';
  const contract = getPlayerContract(league, typeof player === 'object' && player ? player : { id: playerId });
  const pick = (league?.draft?.picks ?? []).find((p) => p.playerId === playerId);
  const rating = Number(player?.rating ?? pick?.rating ?? 80) || 80;
  const h = hashStr(`agent:${playerId}`);
  const agentName = AGENT_NAMES[h % AGENT_NAMES.length];
  const style = AGENT_STYLES[(h >>> 4) % AGENT_STYLES.length];
  const preferredRole = rating >= 86
    ? 'Schluesselspieler'
    : rating >= 81
      ? 'Stammspieler'
      : rating >= 76
        ? 'Rotationsspieler'
        : 'Perspektivspieler';

  const baseSalary = Math.max(1.2, Number((contract.salary || (contract.marketValue * 0.11) || 4.0).toFixed(1)));
  const targetSalary = Number((baseSalary * style.margin).toFixed(1));
  const targetBonus = Math.max(1.0, Number((targetSalary * 0.65).toFixed(1)));
  const targetYears = rating >= 87 ? 4 : 3;

  return {
    agentName,
    agency: style.agency,
    styleId: style.id,
    styleLabel: style.label,
    patienceDrop: style.patienceDrop,
    preferredRole,
    currentSalary: baseSalary,
    targetSalary,
    minAcceptableSalary: Number((targetSalary * 0.91).toFixed(1)),
    targetBonus,
    targetYears,
    marketValue: contract.marketValue || 25,
    yearsRemaining: contract.yearsRemaining ?? 2,
    contractUntil: contract.contractUntil || 2028,
  };
}

/**
 * Computes a club's FIFA 17 style Transfer Budget & Wage Budget state.
 */
export function getTeamFinanceSummary(league, teamId, players = []) {
  const team = (league?.teams ?? []).find((t) => t.id === teamId) || league?.teams?.[0];
  if (!team) {
    return {
      teamId: '',
      teamName: 'Verein',
      managerName: 'Manager',
      transferBudget: 150,
      committedWages: 0,
      freeWageBudget: 45,
      totalWageBudget: 45,
      totalDisposablePool: 195,
      AllocatablePool: 195,
      totalPool: 195,
      splitRatio: 77,
      rosterCount: 0,
      expiringCount: 0,
    };
  }

  const picks = (league?.draft?.picks ?? []).filter((p) => p.teamId === team.id);
  let committedWages = 0;
  let expiringCount = 0;

  for (const pick of picks) {
    const raw = (players ?? []).find((p) => p.id === pick.playerId) || {
      id: pick.playerId,
      name: pick.playerName,
      rating: pick.rating,
      position: pick.position,
    };
    const c = getPlayerContract(league, raw);
    committedWages += Number(c.salary) || 0;
    if (c.isExpiring) expiringCount += 1;
  }

  committedWages = Number(committedWages.toFixed(1));
  const transferBudget = Number(Number(team.budget ?? 150).toFixed(1));
  const freeWageBudget = Number(
    (Number.isFinite(team.freeWageBudget) ? team.freeWageBudget : Math.max(22, Math.round(transferBudget * 0.28))).toFixed(1),
  );
  const totalWageBudget = Number((committedWages + freeWageBudget).toFixed(1));
  const totalDisposablePool = Number((transferBudget + freeWageBudget).toFixed(1));
  const splitRatio = totalDisposablePool > 0
    ? Math.round((transferBudget / totalDisposablePool) * 100)
    : 75;

  return {
    teamId: team.id,
    teamName: team.name,
    managerName: team.managerName || team.name,
    transferBudget,
    committedWages,
    freeWageBudget,
    totalWageBudget,
    totalDisposablePool,
    AllocatablePool: totalDisposablePool,
    totalPool: totalDisposablePool,
    splitRatio: clamp(splitRatio, 5, 95),
    rosterCount: picks.length,
    expiringCount,
  };
}

/**
 * FIFA 17 Budget Slider adjustment: shifts disposable funds between Transfer Budget and Free Wage Budget.
 */
export function adjustTeamBudgetSplit(league, teamId, newTransferRatioPercent, players = []) {
  if (!league || !teamId) return fail(league, 'Kein gueltiges Team ausgewaehlt.');
  const next = clone(league);
  const team = (next.teams ?? []).find((t) => t.id === teamId);
  if (!team) return fail(league, 'Verein nicht gefunden.');

  const summaryBefore = getTeamFinanceSummary(next, teamId, players);
  const ratio = clamp(Number(newTransferRatioPercent) || 75, 10, 95) / 100;
  const pool = summaryBefore.totalDisposablePool;

  const nextTransferBudget = Number((pool * ratio).toFixed(1));
  const nextFreeWageBudget = Number(Math.max(2.0, pool - nextTransferBudget).toFixed(1));

  team.budget = nextTransferBudget;
  team.freeWageBudget = nextFreeWageBudget;
  team.budgetSplitRatio = Math.round(ratio * 100);

  const updatedSummary = getTeamFinanceSummary(next, teamId, players);
  return {
    league: next,
    finance: updatedSummary,
    summary: updatedSummary,
  };
}

/**
 * Marks a mail item as read when selected in the Postfach.
 */
export function markMailRead(league, mailId) {
  if (!league || !mailId) return league;
  const next = clone(league);
  for (const item of next.mailItems ?? []) {
    if (item.id === mailId) {
      item.unread = false;
      item.read = true;
    }
  }
  return next;
}

/**
 * Ensures initial Mail items exist for the active league so the Inbox is immediately rich and usable.
 */
export function ensureMailInboxInitialized(league, players = [], managerIdOrNow = '') {
  if (!league || !Array.isArray(league.teams) || !(league.draft?.picks?.length)) {
    return attachLeagueProp(league);
  }
  if (Array.isArray(league.mailItems) && league.mailItems.length > 0) {
    return attachLeagueProp(league);
  }

  const next = clone(league);
  next.mailItems = [];
  next.agentNegotiations ??= [];

  const isIsoTimestamp = String(managerIdOrNow).includes('T') && String(managerIdOrNow).includes(':');
  const now = isIsoTimestamp ? managerIdOrNow : new Date().toISOString();
  const preferredTeamId = !isIsoTimestamp && managerIdOrNow ? String(managerIdOrNow) : '';

  const humanTeams = next.teams.filter((t) => t.managerType === 'human');
  const cpuTeams = next.teams.filter((t) => t.managerType === 'cpu');
  const targetHuman = (preferredTeamId && next.teams.find((t) => t.id === preferredTeamId))
    || humanTeams[0]
    || next.teams[0];
  if (!targetHuman) return attachLeagueProp(next);

  const humanPicks = (next.draft?.picks ?? [])
    .filter((p) => p.teamId === targetHuman.id)
    .sort((a, b) => (b.rating || 80) - (a.rating || 80));

  for (let i = 0; i < Math.min(2, humanPicks.length, cpuTeams.length); i += 1) {
    const pick = humanPicks[i];
    const buyerCpu = cpuTeams[(i * 3) % cpuTeams.length];
    const mkt = calculatePlayerMarketValue({ rating: pick.rating || 82, position: pick.position || 'CM' });
    const fee = Math.max(15, Math.round(mkt * (i === 0 ? 1.05 : 0.96)));
    next.mailItems.push({
      id: `mail-init-${i + 1}-${pick.playerId}`,
      type: 'TRANSFER_OFFER',
      stage: 'CLUB_OFFER',
      senderTeamId: buyerCpu.id,
      senderTeamName: buyerCpu.name,
      senderManagerName: `${buyerCpu.name} Sportdirektion (CPU)`,
      fromTeamId: buyerCpu.id,
      fromTeamName: buyerCpu.name,
      recipientTeamId: targetHuman.id,
      recipientTeamName: targetHuman.name,
      toTeamId: targetHuman.id,
      toTeamName: targetHuman.name,
      sellerTeamId: targetHuman.id,
      sellerTeamName: targetHuman.name,
      buyerTeamId: buyerCpu.id,
      buyerTeamName: buyerCpu.name,
      playerId: pick.playerId,
      playerName: pick.playerName || pick.name,
      position: pick.position || 'CM',
      rating: pick.rating || 82,
      fee,
      marketValue: mkt,
      subject: `Offizielles Transferangebot: ${fee} Mio. € für ${pick.playerName}`,
      body: `Die Vereinsführung von ${buyerCpu.name} unterbreitet ${targetHuman.name} ein verbindliches schriftliches Angebot über ${fee} Mio. € für ${pick.playerName} (${pick.position || 'CM'} · OVR ${pick.rating || 82}). Bitte teilt uns eure Entscheidung direkt im Postfach mit.`,
      status: 'PENDING',
      unread: true,
      read: false,
      createdAt: now,
    });
  }

  return attachLeagueProp(next);
}

/**
 * Sends a written transfer offer via the Mail App (to CPU or Human manager).
 * Supports both:
 *  - sendMailTransferOffer(league, senderTeamId, { playerId, fee, message }, now)
 *  - sendMailTransferOffer(league, { fromTeamId, toTeamId, playerId, fee, note, players }, now)
 */
export function sendMailTransferOffer(league, senderOrOpts, maybeOpts = {}, now = new Date().toISOString()) {
  if (!league) return fail(league, 'Keine aktive Liga.');

  let senderTeamId = '';
  let playerId = '';
  let fee = 0;
  let message = '';
  let players = [];

  if (typeof senderOrOpts === 'object' && senderOrOpts !== null) {
    senderTeamId = senderOrOpts.fromTeamId || senderOrOpts.senderTeamId || '';
    playerId = senderOrOpts.playerId || '';
    fee = senderOrOpts.fee;
    message = senderOrOpts.note || senderOrOpts.message || '';
    players = senderOrOpts.players || [];
    if (typeof maybeOpts === 'string') now = maybeOpts;
  } else {
    senderTeamId = String(senderOrOpts || '');
    playerId = maybeOpts?.playerId || '';
    fee = maybeOpts?.fee;
    message = maybeOpts?.message || maybeOpts?.note || '';
    players = maybeOpts?.players || [];
  }

  const pick = (league.draft?.picks ?? []).find((p) => p.playerId === playerId);
  if (!pick) return fail(league, 'Spieler steht bei keinem Liga-Verein unter Vertrag.');
  if (pick.teamId === senderTeamId) return fail(league, 'Dieser Spieler steht bereits in deinem eigenen Kader.');

  const cleanFee = Math.max(1, Math.round(Number(fee) || 0));
  const buyer = (league.teams ?? []).find((t) => t.id === senderTeamId);
  const seller = (league.teams ?? []).find((t) => t.id === pick.teamId);
  if (!buyer || !seller) return fail(league, 'Verhandlungspartner nicht gefunden.');
  if (Number(buyer.budget ?? 150) < cleanFee) {
    return fail(league, `Dein Transferbudget (${buyer.budget} Mio. €) reicht für dieses schriftliche Gebot (${cleanFee} Mio. €) nicht aus.`);
  }

  const next = clone(league);
  next.mailItems ??= [];
  const mkt = calculatePlayerMarketValue({ rating: pick.rating || 80, position: pick.position || 'CM' });
  const mailId = `mail-offer-${Date.now()}-${playerId}`;

  // If seller is CPU, evaluate immediately and either accept (moving to Stage 2: Agent Negotiation) or send a counter-mail!
  if (seller.managerType === 'cpu') {
    const sellerRosterCount = (next.draft?.picks ?? []).filter((p) => p.teamId === seller.id).length;
    const cpuEval = evaluateCpuOfferResponse({
      playerRating: pick.rating || 80,
      position: pick.position || 'CM',
      fee: cleanFee,
      sellerRosterCount,
      offerRound: 2,
      requireMultiRound: false,
    });

    if (cpuEval.decision === 'accept' || cleanFee >= mkt) {
      const agreedFee = cleanFee;
      const agentSession = createAgentNegotiationSession(next, {
        buyerTeamId: buyer.id,
        sellerTeamId: seller.id,
        playerId: pick.playerId,
        agreedFee,
        mode: 'TRANSFER',
        players,
        now,
      });
      next.agentNegotiations ??= [];
      if (!next.agentNegotiations.some((s) => s.id === agentSession.id)) {
        next.agentNegotiations.unshift(agentSession);
      }

      const mailItem = {
        id: mailId,
        type: 'AGENT_READY',
        stage: 'AGENT_NEGOTIATION',
        senderTeamId: seller.id,
        senderTeamName: seller.name,
        senderManagerName: `${seller.name} Vorstand (CPU)`,
        fromTeamId: seller.id,
        fromTeamName: seller.name,
        recipientTeamId: buyer.id,
        recipientTeamName: buyer.name,
        toTeamId: seller.id,
        toTeamName: seller.name,
        sellerTeamId: seller.id,
        sellerTeamName: seller.name,
        buyerTeamId: buyer.id,
        buyerTeamName: buyer.name,
        playerId: pick.playerId,
        playerName: pick.playerName || pick.name,
        position: pick.position || 'CM',
        rating: pick.rating || 80,
        fee: agreedFee,
        agreedFee,
        marketValue: mkt,
        agentSessionId: agentSession.id,
        subject: `Ablöse akzeptiert (${agreedFee} Mio. €): ${pick.playerName} bereit für Agenten-Verhandlung`,
        body: `${seller.name} akzeptiert euer schriftliches Angebot über ${agreedFee} Mio. € für ${pick.playerName}. Stufe 2 ist jetzt freigeschaltet: Verhandle mit Berater ${agentSession.agentName} über Gehalt, Laufzeit und Vertragsunterschrift.`,
        status: 'AGENT_STAGE',
        unread: true,
        read: false,
        createdAt: now,
      };
      next.mailItems.unshift(mailItem);
      return {
        league: next,
        mailItem,
        cpuReplyMail: mailItem,
        decision: 'accepted_to_agent',
        agentSession,
        stage2Session: agentSession,
      };
    }

    const counterFee = Math.max(cleanFee + 2, cpuEval.counterFee || Math.round(mkt * 1.08));
    const mailItem = {
      id: mailId,
      type: 'COUNTER_OFFER',
      stage: 'CLUB_OFFER',
      senderTeamId: seller.id,
      senderTeamName: seller.name,
      senderManagerName: `${seller.name} Sportdirektion (CPU)`,
      fromTeamId: seller.id,
      fromTeamName: seller.name,
      recipientTeamId: buyer.id,
      recipientTeamName: buyer.name,
      toTeamId: seller.id,
      toTeamName: seller.name,
      sellerTeamId: seller.id,
      sellerTeamName: seller.name,
      buyerTeamId: buyer.id,
      buyerTeamName: buyer.name,
      playerId: pick.playerId,
      playerName: pick.playerName || pick.name,
      position: pick.position || 'CM',
      rating: pick.rating || 80,
      fee: counterFee,
      previousFee: cleanFee,
      marketValue: mkt,
      subject: `Gegenangebot von ${seller.name}: ${counterFee} Mio. € für ${pick.playerName}`,
      body: `${seller.name} hat euer schriftliches Gebot von ${cleanFee} Mio. € geprüft und fordert ${counterFee} Mio. € als fixe Ablösesumme für ${pick.playerName}. Bei Annahme startet sofort die Vertragsverhandlung mit dem Spielerberater.`,
      status: 'PENDING',
      unread: true,
      read: false,
      createdAt: now,
    };
    next.mailItems.unshift(mailItem);
    return {
      league: next,
      mailItem,
      cpuReplyMail: mailItem,
      decision: 'counter',
      counterFee,
    };
  }

  // Human-to-Human written mail offer
  const mailItem = {
    id: mailId,
    type: 'TRANSFER_OFFER',
    stage: 'CLUB_OFFER',
    senderTeamId: buyer.id,
    senderTeamName: buyer.name,
    senderManagerName: buyer.managerName || buyer.name,
    fromTeamId: buyer.id,
    fromTeamName: buyer.name,
    recipientTeamId: seller.id,
    recipientTeamName: seller.name,
    toTeamId: seller.id,
    toTeamName: seller.name,
    sellerTeamId: seller.id,
    sellerTeamName: seller.name,
    buyerTeamId: buyer.id,
    buyerTeamName: buyer.name,
    playerId: pick.playerId,
    playerName: pick.playerName || pick.name,
    position: pick.position || 'CM',
    rating: pick.rating || 80,
    fee: cleanFee,
    marketValue: mkt,
    subject: `Schriftliches Angebot von ${buyer.name}: ${cleanFee} Mio. € für ${pick.playerName}`,
    body: message
      ? `${buyer.managerName || buyer.name} (${buyer.name}) bietet ${cleanFee} Mio. € für ${pick.playerName}: "${message}"`
      : `${buyer.managerName || buyer.name} (${buyer.name}) hat ein offizielles schriftliches Transferangebot über ${cleanFee} Mio. € für ${pick.playerName} (${pick.position || 'CM'} · OVR ${pick.rating || 80}) eingereicht.`,
    status: 'PENDING',
    unread: true,
    read: false,
    createdAt: now,
  };
  next.mailItems.unshift(mailItem);
  return { league: next, mailItem, decision: 'sent_to_human' };
}

/**
 * Responds to a Mail Transfer Offer (accept, counter, or decline).
 */
export function respondToMailOffer(league, mailId, actorTeamId, { decision, counterFee = 0, players = [] } = {}, now = new Date().toISOString()) {
  if (!league) return fail(league, 'Keine aktive Liga.');
  const next = clone(league);
  next.mailItems ??= [];
  next.agentNegotiations ??= [];
  const item = next.mailItems.find((m) => m.id === mailId);
  if (!item) return fail(league, 'Nachricht im Postfach nicht gefunden.');

  item.unread = false;
  item.read = true;

  if (decision === 'decline') {
    item.status = 'DECLINED';
    item.resolvedAt = now;
    return { league: next, mailItem: item, decision: 'declined' };
  }

  if (decision === 'counter') {
    const newFee = Math.max(1, Math.round(Number(counterFee) || item.fee + 5));
    const otherTeamId = actorTeamId === item.sellerTeamId ? item.buyerTeamId : item.sellerTeamId;
    const otherTeam = (next.teams ?? []).find((t) => t.id === otherTeamId);
    const actorTeam = (next.teams ?? []).find((t) => t.id === actorTeamId);

    if (otherTeam?.managerType === 'cpu') {
      const mkt = item.marketValue || calculatePlayerMarketValue({ rating: item.rating || 82, position: item.position || 'CM' });
      if (newFee <= Math.round(mkt * 1.18)) {
        item.fee = newFee;
        // Fall through to accept at countered fee
      } else {
        item.status = 'DECLINED';
        item.body += ` — Update: ${otherTeam.name} hat die Gegenforderung von ${newFee} Mio. € als zu hoch abgelehnt.`;
        return { league: next, mailItem: item, decision: 'cpu_declined_counter' };
      }
    } else {
      item.previousFee = item.fee;
      item.fee = newFee;
      item.senderTeamId = actorTeamId;
      item.senderTeamName = actorTeam?.name || '';
      item.senderManagerName = actorTeam?.managerName || actorTeam?.name || '';
      item.fromTeamId = actorTeamId;
      item.fromTeamName = actorTeam?.name || '';
      item.recipientTeamId = otherTeamId;
      item.recipientTeamName = otherTeam?.name || '';
      item.toTeamId = otherTeamId;
      item.toTeamName = otherTeam?.name || '';
      item.subject = `Gegenangebot (${newFee} Mio. €): ${item.playerName}`;
      item.body = `${actorTeam?.name || 'Verein'} sendet im Postfach ein Gegenangebot über ${newFee} Mio. € für ${item.playerName}.`;
      item.status = 'PENDING';
      item.unread = true;
      item.read = false;
      return { league: next, mailItem: item, decision: 'counter_sent' };
    }
  }

  // Decision === 'accept' (Stage 1 Club Fee Agreed!)
  const seller = (next.teams ?? []).find((t) => t.id === item.sellerTeamId);
  const buyer = (next.teams ?? []).find((t) => t.id === item.buyerTeamId);
  const pick = (next.draft?.picks ?? []).find((p) => p.playerId === item.playerId && p.teamId === item.sellerTeamId);
  if (!seller || !buyer || !pick) {
    item.status = 'EXPIRED';
    return fail(league, 'Spieler gehört nicht mehr dem abgebenden Verein.');
  }

  // If the BUYER is a human manager, Stage 2 (Agent Negotiation + Drawn Signature) is unlocked!
  if (buyer.managerType === 'human') {
    const agentSession = createAgentNegotiationSession(next, {
      buyerTeamId: buyer.id,
      sellerTeamId: seller.id,
      playerId: pick.playerId,
      agreedFee: item.fee,
      mode: 'TRANSFER',
      players,
      now,
    });
    if (!next.agentNegotiations.some((s) => s.id === agentSession.id)) {
      next.agentNegotiations.unshift(agentSession);
    }
    item.status = 'AGENT_STAGE';
    item.stage = 'AGENT_NEGOTIATION';
    item.agreedFee = item.fee;
    item.agentSessionId = agentSession.id;
    item.subject = `Stufe 1 perfekt (${item.fee} Mio. €) — Jetzt mit Agent von ${item.playerName} verhandeln`;
    item.body = `Die Vereine ${seller.name} und ${buyer.name} haben sich auf ${item.fee} Mio. € Ablöse geeinigt. Führe jetzt Stufe 2 (Gehalt, Laufzeit & Unterschrift) mit Berater ${agentSession.agentName} durch!`;
    return {
      league: next,
      mailItem: item,
      decision: 'stage2_agent_ready',
      stage2Ready: true,
      agentSession,
    };
  }

  // If the BUYER is a CPU club and the SELLER is human, unlock signature pad session to sign the release!
  const agentSession = createAgentNegotiationSession(next, {
    buyerTeamId: buyer.id,
    sellerTeamId: seller.id,
    playerId: pick.playerId,
    agreedFee: item.fee,
    mode: 'CPU_BUY_RELEASE',
    players,
    now,
  });
  agentSession.status = 'AWAITING_SIGNATURE';
  if (!next.agentNegotiations.some((s) => s.id === agentSession.id)) {
    next.agentNegotiations.unshift(agentSession);
  }
  item.status = 'AGENT_STAGE';
  item.stage = 'AWAITING_SIGNATURE';
  item.agreedFee = item.fee;
  item.agentSessionId = agentSession.id;
  return {
    league: next,
    mailItem: item,
    decision: 'awaiting_seller_signature',
    stage2Ready: true,
    agentSession,
  };
}

/**
 * Creates a Stage 2 Player & Agent Negotiation Session (for a new transfer or a contract extension).
 * Returns a session object that ALSO carries non-enumerable .league and .session references so both
 * direct callers (`const s = createAgentNegotiationSession(...)`) and `{ league, session }` callers work!
 */
export function createAgentNegotiationSession(league, {
  buyerTeamId,
  sellerTeamId,
  playerId,
  agreedFee = 0,
  mode = 'TRANSFER',
  mailId = '',
  players = [],
  now = new Date().toISOString(),
} = {}) {
  if (!league) return fail(league, 'Keine aktive Liga.');
  const normalizedMode = String(mode || 'TRANSFER').toUpperCase() === 'EXTENSION'
    ? 'EXTENSION'
    : String(mode || 'TRANSFER').toUpperCase() === 'CPU_BUY_RELEASE'
      ? 'CPU_BUY_RELEASE'
      : 'TRANSFER';

  const pick = (league?.draft?.picks ?? []).find((p) => p.playerId === playerId);
  const fromPool = (players ?? []).find((p) => p.id === playerId);
  const rawPlayer = {
    id: playerId,
    name: pick?.playerName || pick?.name || fromPool?.name || 'Spieler',
    position: pick?.position || fromPool?.position || 'CM',
    rating: Number(pick?.rating ?? fromPool?.rating) || 82,
  };
  const agent = getPlayerAgentProfile(rawPlayer, league);
  const buyer = (league?.teams ?? []).find((t) => t.id === buyerTeamId);
  const seller = (league?.teams ?? []).find((t) => t.id === sellerTeamId);

  const session = {
    id: `agent-neg-${Date.now()}-${playerId}`,
    mode: normalizedMode,
    mailId,
    playerId,
    playerName: rawPlayer.name,
    position: rawPlayer.position,
    rating: rawPlayer.rating,
    buyerTeamId,
    buyerTeamName: buyer?.name || '',
    sellerTeamId,
    sellerTeamName: seller?.name || '',
    agreedFee: Number(agreedFee) || 0,
    agent,
    agentName: agent.agentName,
    agentStyle: agent.styleLabel,
    patience: 100,
    patienceDrop: agent.patienceDrop,
    demandedSalary: agent.targetSalary,
    minAcceptableSalary: agent.minAcceptableSalary,
    demandedYears: agent.targetYears,
    demandedBonus: agent.targetBonus,
    demandedRole: agent.preferredRole,
    offeredSalary: agent.targetSalary,
    offeredYears: agent.targetYears,
    offeredBonus: agent.targetBonus,
    offeredRole: agent.preferredRole,
    status: normalizedMode === 'CPU_BUY_RELEASE' ? 'AWAITING_SIGNATURE' : 'NEGOTIATING',
    agentFeedback: normalizedMode === 'CPU_BUY_RELEASE'
      ? `Verkauf an ${buyer?.name || 'CPU-Verein'} (${Number(agreedFee) || 0} Mio. EUR Abloese): Zeichne unten deine rechtskraeftige Unterschrift auf das Freigabe-Dokument.`
      : `Berater ${agent.agentName} (${agent.styleLabel} · ${agent.agency}): „Mein Klient ${rawPlayer.name} stellt sich ${agent.targetSalary} Mio. EUR Jahresgehalt, ${agent.targetYears} Jahre Laufzeit, ${agent.targetBonus} Mio. EUR Handgeld und die Rolle als ${agent.preferredRole} vor.“`,
    createdAt: now,
  };

  const next = clone(league);
  next.agentNegotiations ??= [];
  next.agentNegotiations.unshift(clone(session));

  Object.defineProperty(session, 'league', {
    value: next,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(session, 'session', {
    value: session,
    enumerable: false,
    configurable: true,
  });

  return session;
}

/**
 * Evaluates a manager's contract proposal to the player's agent in Stage 2.
 */
export function submitAgentContractOffer(league, sessionId, {
  salary,
  years,
  signingBonus,
  squadRole,
  role,
  players = [],
} = {}, now = new Date().toISOString()) {
  if (!league) return fail(league, 'Keine aktive Liga.');
  const next = clone(league);
  next.agentNegotiations ??= [];
  const session = next.agentNegotiations.find((s) => s.id === sessionId);
  if (!session) return fail(league, 'Agenten-Verhandlung nicht gefunden.');
  if (session.status === 'WALKED_AWAY') return fail(league, 'Der Spielerberater hat die Verhandlungen bereits abgebrochen.');

  session.agent ??= getPlayerAgentProfile({ id: session.playerId, rating: session.rating, position: session.position }, next);

  const offeredSalary = Number(Number(salary || session.demandedSalary).toFixed(1));
  const offeredYears = clamp(Number(years) || 3, 1, 5);
  const offeredBonus = Number(Number(signingBonus ?? session.demandedBonus).toFixed(1));
  const offeredRole = String(squadRole || role || session.demandedRole || 'Stammspieler');

  const isExtension = String(session.mode).toUpperCase() === 'EXTENSION';
  const finance = getTeamFinanceSummary(next, session.buyerTeamId, players);
  const totalCashNeeded = (!isExtension ? (Number(session.agreedFee) || 0) : 0) + offeredBonus;
  if (finance.transferBudget < totalCashNeeded) {
    return fail(
      league,
      `Transferbudget (${finance.transferBudget} Mio. EUR) reicht nicht fuer Abloese + Handgeld (${totalCashNeeded.toFixed(1)} Mio. EUR). Verschiebe im Finanzen-Tab Budget mit dem FIFA 17 Regler!`,
    );
  }

  const netAdditionalWage = isExtension
    ? Math.max(0, offeredSalary - (getPlayerContract(next, { id: session.playerId, rating: session.rating })?.salary || 0))
    : offeredSalary;

  if (finance.freeWageBudget < netAdditionalWage) {
    return fail(
      league,
      `Freies Gehaltsbudget (${finance.freeWageBudget} Mio. EUR/J.) reicht nicht fuer dieses Gehalt (${offeredSalary} Mio. EUR/J.). Erhoehe das Gehaltsbudget ueber den FIFA 17 Regler im Finanzen-Tab!`,
    );
  }

  session.offeredSalary = offeredSalary;
  session.offeredYears = offeredYears;
  session.offeredBonus = offeredBonus;
  session.offeredRole = offeredRole;

  const bonusCompensation = (offeredBonus - session.demandedBonus) * 0.22;
  const effectiveSalary = offeredSalary + bonusCompensation;

  if (effectiveSalary >= session.minAcceptableSalary) {
    session.status = 'AWAITING_SIGNATURE';
    session.agentFeedback = `Berater ${session.agentName}: „Wir sind uns einig! ${session.playerName} akzeptiert ${offeredSalary} Mio. EUR/Jahr fuer ${offeredYears} Jahre (${offeredRole}). Zeichne jetzt deine Unterschrift unter den Vertrag!“`;
    session.updatedAt = now;
    return { league: next, session, accepted: true, decision: 'accept' };
  }

  session.patience = Math.max(0, session.patience - (session.patienceDrop || 25));
  if (session.patience <= 0) {
    session.status = 'WALKED_AWAY';
    session.agentFeedback = `Berater ${session.agentName} bricht das Gespraech ab: „Dieses Gehaltsangebot liegt zu weit unter dem Marktwert meines Klienten!“`;
    return { league: next, session, accepted: false, walkedAway: true, decision: 'walk_away' };
  }

  const nextCounterSalary = Number(Math.max(session.minAcceptableSalary, (session.demandedSalary + offeredSalary) / 2).toFixed(1));
  session.demandedSalary = nextCounterSalary;
  session.agentFeedback = `Berater ${session.agentName} (Geduld ${session.patience}%): „Zu niedrig! Komm uns auf mindestens ${nextCounterSalary} Mio. EUR/Jahr (oder mehr Handgeld) entgegen.“`;
  session.updatedAt = now;
  return { league: next, session, accepted: false, counterSalary: nextCounterSalary, decision: 'counter' };
}

/**
 * Finalizes Stage 2 with the manager's static drawn signature!
 * Supports both:
 *  - finalizeAgentDealWithSignature(league, sessionId, managerTeamId, { svgPath, strokes, now })
 *  - finalizeAgentDealWithSignature(league, sessionId, { svgPath, strokes, signerName, players, now })
 */
export function finalizeAgentDealWithSignature(league, sessionId, managerTeamIdOrOpts, maybeOpts = {}) {
  if (!league) return fail(league, 'Keine aktive Liga.');

  let managerTeamId = '';
  let opts = maybeOpts || {};
  if (typeof managerTeamIdOrOpts === 'object' && managerTeamIdOrOpts !== null) {
    opts = managerTeamIdOrOpts;
    managerTeamId = opts.managerTeamId || '';
  } else {
    managerTeamId = String(managerTeamIdOrOpts || '');
  }

  const svgPath = opts.svgPath || '';
  const strokes = opts.strokes || [];
  const now = opts.now || new Date().toISOString();

  if (!svgPath || !String(svgPath).trim()) {
    return fail(league, 'Bitte zeichne zuerst deine Unterschrift auf das Unterschriften-Pad.');
  }

  const next = clone(league);
  next.agentNegotiations ??= [];
  const session = next.agentNegotiations.find((s) => s.id === sessionId);
  if (!session) return fail(league, 'Verhandlungssitzung nicht gefunden.');

  const currentYear = Number(String(next.currentDate || '2026-08-01').slice(0, 4)) || 2026;
  const contractUntil = currentYear + (Number(session.offeredYears) || 3);
  const buyer = (next.teams ?? []).find((t) => t.id === session.buyerTeamId);
  const seller = (next.teams ?? []).find((t) => t.id === session.sellerTeamId);
  const signerTeam = (next.teams ?? []).find((t) => t.id === managerTeamId) || buyer || seller;
  const signerName = opts.signerName || signerTeam?.managerName || signerTeam?.name || 'Manager';

  if (String(session.mode).toUpperCase() === 'EXTENSION') {
    if (!buyer) return fail(league, 'Team nicht gefunden.');
    buyer.budget = Number(Math.max(0, Number(buyer.budget ?? 150) - (session.offeredBonus || 0)).toFixed(1));
    next.contracts ??= {};
    next.contracts[session.playerId] = {
      playerId: session.playerId,
      teamId: buyer.id,
      teamName: buyer.name,
      salary: session.offeredSalary,
      contractYears: session.offeredYears,
      contractUntil,
      squadRole: session.offeredRole,
      agentName: session.agentName,
      releaseClause: Math.round(session.offeredSalary * 12),
      signatureSvgPath: svgPath,
      signedByManager: signerName,
      extendedAt: now,
    };
    session.status = 'COMPLETED';
    session.mode = 'extension';
    session.signatureSvgPath = svgPath;

    const renewalTransfer = {
      callId: session.id,
      playerId: session.playerId,
      playerName: session.playerName,
      position: session.position,
      rating: session.rating,
      sellerTeamId: buyer.id,
      sellerTeamName: buyer.name,
      buyerTeamId: buyer.id,
      buyerTeamName: buyer.name,
      fee: session.offeredBonus || 0,
      salary: session.offeredSalary,
      contractYears: session.offeredYears,
      squadRole: session.offeredRole,
      agentName: session.agentName,
      isContractExtension: true,
      reason: `Vertragsverlaengerung bis ${contractUntil} (${session.offeredSalary} Mio. EUR/J. · ${session.offeredRole})`,
      signedAt: now,
      signatureSvgPath: svgPath,
      signatures: [
        {
          managerTeamId: buyer.id,
          managerName: signerName,
          svgPath,
          pathData: svgPath,
          strokes,
          signedAt: now,
        },
      ],
      at: now,
    };
    next.transfers ??= [];
    next.transfers.push(renewalTransfer);
    return { league: next, transfer: renewalTransfer, session };
  }

  // Mode: 'TRANSFER' or 'CPU_BUY_RELEASE'
  const pick = (next.draft?.picks ?? []).find((p) => p.playerId === session.playerId);
  if (!pick || !buyer || !seller) {
    return fail(league, 'Transfer konnte nicht abgeschlossen werden (Spieler oder Team nicht mehr verfuegbar).');
  }

  const isTransferMode = String(session.mode).toUpperCase() === 'TRANSFER';
  const totalBuyerCost = Number((session.agreedFee + (isTransferMode ? (session.offeredBonus || 0) : 0)).toFixed(1));
  buyer.budget = Number(Math.max(0, Number(buyer.budget ?? 150) - totalBuyerCost).toFixed(1));
  seller.budget = Number((Number(seller.budget ?? 150) + session.agreedFee).toFixed(1));

  pick.previousTeamId = seller.id;
  pick.teamId = buyer.id;
  pick.teamName = buyer.name;
  pick.managerName = buyer.managerName || buyer.name;

  if (next.squads?.[seller.id]?.starters) {
    for (const [slotId, starterId] of Object.entries(next.squads[seller.id].starters)) {
      if (starterId === pick.playerId) next.squads[seller.id].starters[slotId] = null;
    }
  }

  next.contracts ??= {};
  next.contracts[session.playerId] = {
    playerId: session.playerId,
    teamId: buyer.id,
    teamName: buyer.name,
    salary: session.offeredSalary,
    contractYears: session.offeredYears,
    contractUntil,
    squadRole: session.offeredRole,
    agentName: session.agentName,
    releaseClause: Math.round(Math.max(session.agreedFee * 1.35, session.offeredSalary * 11)),
    signatureSvgPath: svgPath,
    signedByManager: signerName,
    signedAt: now,
  };

  session.status = 'COMPLETED';
  session.signatureSvgPath = svgPath;

  for (const m of next.mailItems ?? []) {
    if (m.agentSessionId === session.id || (m.playerId === session.playerId && m.status !== 'DECLINED')) {
      m.status = 'COMPLETED';
      m.stage = 'COMPLETED';
      m.signatureSvgPath = svgPath;
    }
  }

  const transferRecord = {
    callId: session.id,
    playerId: session.playerId,
    playerName: session.playerName,
    position: session.position,
    rating: session.rating,
    sellerTeamId: seller.id,
    sellerTeamName: seller.name,
    buyerTeamId: buyer.id,
    buyerTeamName: buyer.name,
    fee: session.agreedFee,
    salary: session.offeredSalary,
    contractYears: session.offeredYears,
    signingBonus: session.offeredBonus,
    squadRole: session.offeredRole,
    agentName: session.agentName,
    reason: `Vertrag bis ${contractUntil} (${session.offeredSalary} Mio. EUR/J. · ${session.offeredRole})`,
    signedAt: now,
    signatureSvgPath: svgPath,
    signatures: [
      {
        managerTeamId: signerTeam?.id || buyer.id,
        managerName: signerName,
        svgPath,
        pathData: svgPath,
        strokes,
        signedAt: now,
      },
    ],
    at: now,
  };

  next.transfers ??= [];
  next.transfers.push(transferRecord);

  return { league: next, transfer: transferRecord, session };
}

/**
 * Renders a static drawn signature box (Zero stroke replay animation — directly visible to all managers).
 * Supports both `renderStaticSignatureCard(transfer, league)` and `renderStaticSignatureCard(svgPath, signerLabel, clubLabel)`.
 */
export function renderStaticSignatureCard(signatureOrTransfer, signerOrLeague = 'Manager', clubLabel = '') {
  let pathStr = '';
  let signerName = typeof signerOrLeague === 'string' ? signerOrLeague : 'Manager';
  let clubName = clubLabel;

  if (typeof signatureOrTransfer === 'string') {
    pathStr = signatureOrTransfer;
  } else if (signatureOrTransfer && typeof signatureOrTransfer === 'object') {
    const firstSig = Array.isArray(signatureOrTransfer.signatures) ? signatureOrTransfer.signatures[0] : null;
    pathStr = signatureOrTransfer.signatureSvgPath
      || signatureOrTransfer.svgPath
      || signatureOrTransfer.pathData
      || firstSig?.svgPath
      || firstSig?.pathData
      || '';
    signerName = firstSig?.managerName
      || signatureOrTransfer.signedByManager
      || signatureOrTransfer.buyerTeamName
      || signerName;
    clubName = clubName
      || (signatureOrTransfer.sellerTeamName && signatureOrTransfer.buyerTeamName
        ? `${signatureOrTransfer.sellerTeamName} -> ${signatureOrTransfer.buyerTeamName}`
        : signatureOrTransfer.buyerTeamName || '');
  }

  if (!pathStr) {
    return `
      <div class="sl-static-sig-card is-unsigned">
        <div class="sl-static-sig-head">
          <span class="sl-static-sig-kicker">UNTERSCHRIFT AUSSTEHEND</span>
          <span class="sl-done-stamp-badge">OFFEN</span>
        </div>
        <div class="sl-static-sig-meta">
          <strong>${escapeHtml(signerName)}</strong>
          ${clubName ? `<span>${escapeHtml(clubName)}</span>` : ''}
        </div>
      </div>
    `;
  }
  return `
    <div class="sl-static-sig-card is-signed">
      <div class="sl-static-sig-head">
        <span class="sl-static-sig-kicker">ORIGINAL-UNTERSCHRIFT (STATISCH GESPEICHERT)</span>
        <span class="sl-done-stamp-badge">DONE</span>
      </div>
      <div class="sl-static-sig-viewport">
        <svg class="sl-static-sig-svg" viewBox="0 0 180 54" aria-label="Gezeichnete Vertragsunterschrift von ${escapeHtml(signerName)}">
          <path d="${escapeHtml(pathStr)}" fill="none" stroke="#38bdf8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="sl-static-sig-meta">
        <strong>${escapeHtml(signerName)}</strong>
        ${clubName ? `<span>${escapeHtml(clubName)}</span>` : ''}
      </div>
    </div>
  `;
}

function clubMonogram(name = '') {
  const words = String(name || 'FC').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }
  return String(words[0] || 'FC').slice(0, 2).toUpperCase();
}

/**
 * Renders the Mail App (Postfach) view for both Command Center and TransferHub.
 */
export function renderMailInboxView({
  league,
  players = [],
  activeManagerTeamId = '',
  selectedMailId = '',
  mailFilter = 'all',
  composeTargetTeamId = '',
  preselectedTargetTeamId = '',
  composePlayerId = '',
  preselectedPlayerId = '',
  embeddedInTransferHub = false,
} = {}) {
  if (!league) return '';
  const managerId = activeManagerTeamId || league.teams?.[0]?.id || '';
  const myTeam = (league.teams ?? []).find((t) => t.id === managerId) || league.teams?.[0];
  const finance = getTeamFinanceSummary(league, managerId, players);

  const allMails = (league.mailItems ?? []).filter((m) => {
    const recId = m.recipientTeamId || m.toTeamId;
    const sndId = m.senderTeamId || m.fromTeamId;
    return recId === managerId || sndId === managerId || m.buyerTeamId === managerId || m.sellerTeamId === managerId;
  });

  const openOffersCount = allMails.filter((m) => {
    const st = String(m.status || 'PENDING').toUpperCase();
    return st === 'PENDING';
  }).length;
  const stage2ReadyCount = allMails.filter((m) => {
    const st = String(m.status || 'PENDING').toUpperCase();
    return st === 'AGENT_STAGE' || m.stage === 'AGENT_NEGOTIATION';
  }).length;
  const completedCount = allMails.filter((m) => String(m.status || '').toUpperCase() === 'COMPLETED').length;

  const filteredMails = allMails.filter((m) => {
    const st = String(m.status || 'PENDING').toUpperCase();
    if (mailFilter === 'Action' || mailFilter === 'offers') return st === 'PENDING' || st === 'AGENT_STAGE';
    if (mailFilter === 'agent') return m.stage === 'AGENT_NEGOTIATION' || st === 'AGENT_STAGE';
    if (mailFilter === 'completed') return st === 'COMPLETED';
    return true;
  });

  const activeMail = filteredMails.find((m) => m.id === selectedMailId) || filteredMails[0] || null;
  const unreadCount = allMails.filter((m) => (m.unread || !m.read) && (m.recipientTeamId || m.toTeamId) === managerId).length;

  const rivalTeams = (league.teams ?? []).filter((t) => t.id !== managerId);
  const desiredTargetId = composeTargetTeamId || preselectedTargetTeamId;
  const selectedTargetClubId = desiredTargetId && rivalTeams.some((t) => t.id === desiredTargetId)
    ? desiredTargetId
    : (rivalTeams[0]?.id || '');
  const selectedTargetClub = rivalTeams.find((t) => t.id === selectedTargetClubId) || rivalTeams[0] || null;

  const targetClubPicks = (league.draft?.picks ?? [])
    .filter((p) => p.teamId === selectedTargetClubId)
    .sort((a, b) => (b.rating || 80) - (a.rating || 80));

  const desiredPlayerId = composePlayerId || preselectedPlayerId;
  const selectedComposePick = targetClubPicks.find((p) => p.playerId === desiredPlayerId) || targetClubPicks[0] || null;
  const suggestedFee = selectedComposePick
    ? calculatePlayerMarketValue({ rating: selectedComposePick.rating || 80, position: selectedComposePick.position || 'CM' })
    : 30;
  const composeAgentPreview = selectedComposePick
    ? getPlayerAgentProfile({ id: selectedComposePick.playerId, rating: selectedComposePick.rating, position: selectedComposePick.position }, league)
    : null;

  const mailListHtml = filteredMails.map((m) => {
    const isSelected = activeMail && activeMail.id === m.id;
    const st = String(m.status || 'PENDING').toUpperCase();
    const isUnread = Boolean(m.unread || m.read === false);
    const senderLabel = m.senderTeamName || m.fromTeamName || 'Liga-Verein';
    const monogram = clubMonogram(senderLabel);
    const isIncomingToMe = (m.recipientTeamId || m.toTeamId) === managerId;
    const directionLabel = isIncomingToMe ? 'Eingehend' : 'Gesendet';

    const stateClass = st === 'AGENT_STAGE'
      ? 'is-stage2'
      : st === 'COMPLETED'
        ? 'is-completed'
        : st === 'DECLINED'
          ? 'is-declined'
          : 'is-pending';
    const stateText = st === 'AGENT_STAGE'
      ? 'Stufe 2 · Agent bereit'
      : st === 'COMPLETED'
        ? 'Vollzug · DONE'
        : st === 'DECLINED'
          ? 'Abgelehnt'
          : 'Stufe 1 · Offen';

    const mkt = Number(m.marketValue || calculatePlayerMarketValue({ rating: m.rating || 80, position: m.position || 'CM' }));

    return `
      <button type="button" class="sl-mail-item ${isSelected ? 'is-selected is-active' : ''} ${isUnread ? 'is-unread' : ''} ${stateClass}" data-action="select-mail-item" data-mail-id="${escapeHtml(m.id)}">
        <div class="sl-mail-item-row">
          <div class="sl-mail-avatar ${isUnread ? 'has-unread' : ''}" aria-hidden="true">
            <span>${escapeHtml(monogram)}</span>
          </div>
          <div class="sl-mail-item-content">
            <div class="sl-mail-item-top">
              <span class="sl-mail-sender">${escapeHtml(senderLabel)} · <i>${directionLabel}</i></span>
              <span class="sl-mail-state-label ${stateClass}">${stateText}</span>
            </div>
            <div class="sl-mail-subject-row">
              <strong class="sl-mail-subject">${escapeHtml(m.playerName)}</strong>
              <span class="sl-mail-ovr-inline">${escapeHtml(m.position || 'CM')} · OVR ${Number(m.rating) || 80}</span>
            </div>
            <div class="sl-mail-preview">
              <span class="sl-mail-fee-inline">${Number(m.fee).toLocaleString('de-DE')} Mio. €</span>
              <span aria-hidden="true">·</span>
              <span>MW ~${mkt.toLocaleString('de-DE')} Mio. €</span>
              <span aria-hidden="true">·</span>
              <span class="sl-mail-route-inline">${escapeHtml(m.sellerTeamName)} → ${escapeHtml(m.buyerTeamName)}</span>
            </div>
          </div>
        </div>
      </button>
    `;
  }).join('');

  let detailHtml = `
    <div class="sl-mail-empty-reader">
      <div class="sl-mail-empty-monogram">SL</div>
      <h3>Kein Transfer-Schreiben ausgewählt</h3>
      <p>Wähle links eine Nachricht aus dem Posteingang oder verfasse oben ein neues schriftliches Transferangebot an einen der 29 anderen Vereine.</p>
    </div>
  `;

  if (activeMail) {
    const st = String(activeMail.status || 'PENDING').toUpperCase();
    const recId = activeMail.recipientTeamId || activeMail.toTeamId;
    const isMyDecision = st === 'PENDING' && recId === managerId;
    const isAgentStage = st === 'AGENT_STAGE';
    const isCompleted = st === 'COMPLETED';
    const isDeclined = st === 'DECLINED';
    const agentProfile = getPlayerAgentProfile({ id: activeMail.playerId, rating: activeMail.rating, position: activeMail.position }, league);
    const playerContract = getPlayerContract(league, { id: activeMail.playerId, name: activeMail.playerName, rating: activeMail.rating, position: activeMail.position });
    const senderDisplay = activeMail.senderManagerName || activeMail.senderName || activeMail.senderTeamName || activeMail.fromTeamName || 'Verein';
    const recipientDisplay = activeMail.recipientTeamName || activeMail.toTeamName || myTeam?.name || 'Verein';
    const counterpartyTeamId = activeMail.sellerTeamId === managerId ? activeMail.buyerTeamId : activeMail.sellerTeamId;
    const mktVal = Number(activeMail.marketValue || calculatePlayerMarketValue({ rating: activeMail.rating || 80, position: activeMail.position || 'CM' })) || 25;
    const feeVal = Number(activeMail.fee) || mktVal;
    const diffPct = Math.round(((feeVal - mktVal) / Math.max(1, mktVal)) * 100);
    const diffLabel = diffPct > 0
      ? `+${diffPct}% über Marktwert`
      : diffPct < 0
        ? `${diffPct}% unter Marktwert`
        : 'Exakt auf Marktwert';
    const wageFitsBudget = agentProfile.targetSalary <= finance.freeWageBudget;

    const step1State = isAgentStage || isCompleted ? 'is-done' : isDeclined ? 'is-declined' : 'is-current';
    const step2State = isCompleted ? 'is-done' : isAgentStage ? 'is-current' : 'is-upcoming';
    const step3State = isCompleted ? 'is-done' : 'is-upcoming';

    detailHtml = `
      <div class="sl-mail-detail-card">
        <div class="sl-mail-pipeline" aria-label="2-Stufen Transfer-Fortschritt">
          <div class="sl-mail-pipe-step ${step1State}">
            <span class="sl-mail-pipe-index">01</span>
            <div class="sl-mail-pipe-copy">
              <strong>Stufe 1 · Vereins-Ablöse</strong>
              <small>${isAgentStage || isCompleted ? `Geeinigt auf ${feeVal.toLocaleString('de-DE')} Mio. €` : isDeclined ? 'Verhandlung beendet' : `Gebot: ${feeVal.toLocaleString('de-DE')} Mio. €`}</small>
            </div>
          </div>
          <div class="sl-mail-pipe-step ${step2State}">
            <span class="sl-mail-pipe-index">02</span>
            <div class="sl-mail-pipe-copy">
              <strong>Stufe 2 · Berater &amp; Gehalt</strong>
              <small>${isCompleted ? 'Vertrag ausgehandelt' : isAgentStage ? `Bereit: ${escapeHtml(agentProfile.agentName)}` : `Wartet auf Stufe 1`}</small>
            </div>
          </div>
          <div class="sl-mail-pipe-step ${step3State}">
            <span class="sl-mail-pipe-index">03</span>
            <div class="sl-mail-pipe-copy">
              <strong>Stufe 3 · Unterschrift &amp; Vollzug</strong>
              <small>${isCompleted ? 'Rechtskräftig unterzeichnet' : 'Signatur-Pad nach Einigung'}</small>
            </div>
          </div>
        </div>

        <div class="sl-mail-detail-head">
          <div class="sl-mail-letterhead-left">
            <div class="sl-mail-letter-crest" aria-hidden="true">${escapeHtml(clubMonogram(activeMail.senderTeamName || senderDisplay))}</div>
            <div>
              <span class="eyebrow">OFFIZIELLES TRANSFER-SCHREIBEN · ${escapeHtml(isCompleted ? 'VERTRAG UNTERZEICHNET' : isAgentStage ? 'STUFE 2 FREIGESCHALTET' : 'STUFE 1 VEREINSVERHANDLUNG')}</span>
              <h3>${escapeHtml(activeMail.subject)}</h3>
              <div class="sl-mail-correspondence-meta">
                <span>Von: <b>${escapeHtml(senderDisplay)}</b></span>
                <span aria-hidden="true">·</span>
                <span>An: <b>${escapeHtml(recipientDisplay)}</b></span>
                <span aria-hidden="true">·</span>
                <span>Transferroute: <b>${escapeHtml(activeMail.sellerTeamName)} → ${escapeHtml(activeMail.buyerTeamName)}</b></span>
              </div>
            </div>
          </div>
          <div class="sl-mail-offer-fee-box">
            <small>${isAgentStage || isCompleted ? 'VEREINBARTE ABLÖSE' : 'GEBOTENE ABLÖSE'}</small>
            <strong>${feeVal.toLocaleString('de-DE')} <span>Mio. €</span></strong>
            <div class="sl-mail-valuation-sub">
              <span>MW ~${mktVal.toLocaleString('de-DE')} Mio. €</span>
              <span aria-hidden="true">·</span>
              <b class="${diffPct >= 0 ? 'is-plus' : 'is-minus'}">${diffLabel}</b>
            </div>
          </div>
        </div>

        <div class="sl-mail-letter-sheet">
          <p class="sl-mail-body-text">${escapeHtml(activeMail.body)}</p>
        </div>

        <div class="sl-mail-dossier-grid">
          <div class="sl-mail-dossier-card">
            <div class="sl-mail-dossier-top">
              <div>
                <span class="sl-mail-dossier-kicker">01 · ZIELSPIELER &amp; VERTRAGSSTATUS</span>
                <h4>${escapeHtml(activeMail.playerName)}</h4>
              </div>
              <button type="button" class="button light small" data-action="open-pes-player" data-player-id="${escapeHtml(activeMail.playerId)}">
                FIFA 17 Profil &amp; Hexagon
              </button>
            </div>
            <div class="sl-mail-dossier-metrics">
              <div>
                <small>Position &amp; Stärke</small>
                <strong>${escapeHtml(activeMail.position || 'CM')} · OVR ${Number(activeMail.rating) || 80}</strong>
              </div>
              <div>
                <small>Aktueller Vertrag</small>
                <strong>${Number(playerContract.salary).toFixed(1)} Mio. €/J. (bis ${playerContract.contractUntil})</strong>
              </div>
              <div>
                <small>Ausstiegsklausel</small>
                <strong>${Number(playerContract.releaseClause).toLocaleString('de-DE')} Mio. €</strong>
              </div>
            </div>
          </div>

          <div class="sl-mail-dossier-card is-agent-dossier">
            <div class="sl-mail-dossier-top">
              <div>
                <span class="sl-mail-dossier-kicker">02 · SPIELERBERATER &amp; STUFE-2-FORDERUNG</span>
                <h4>${escapeHtml(agentProfile.agentName)}</h4>
              </div>
              <span class="sl-mail-agent-style">${escapeHtml(agentProfile.agency)} · ${escapeHtml(agentProfile.styleLabel)}</span>
            </div>
            <div class="sl-mail-dossier-metrics">
              <div>
                <small>Gehaltsvorstellung</small>
                <strong>~${agentProfile.targetSalary.toFixed(1)} Mio. € / Jahr</strong>
              </div>
              <div>
                <small>Wunschlaufzeit &amp; Rolle</small>
                <strong>${agentProfile.targetYears} Jahre · ${escapeHtml(agentProfile.preferredRole)}</strong>
              </div>
              <div>
                <small>Gehaltsbudget-Check</small>
                <strong class="${wageFitsBudget ? 'is-fit' : 'is-tight'}">${wageFitsBudget ? `Deckung frei (${finance.freeWageBudget}M/J.)` : `Budget knapp (${finance.freeWageBudget}M/J.)`}</strong>
              </div>
            </div>
          </div>
        </div>

        ${isMyDecision ? `
          <div class="sl-mail-decision-deck">
            <div class="sl-mail-decision-head">
              <div>
                <strong>Entscheidung der Vereinsführung (${escapeHtml(myTeam?.name || 'Dein Verein')})</strong>
                <span>Nimm das Gebot an, um sofort in Stufe 2 (Berater &amp; Unterschrift) zu wechseln, oder sende ein schriftliches Gegenangebot.</span>
              </div>
            </div>
            <div class="sl-mail-action-buttons">
              <button type="button" class="button primary" data-action="mail-accept-offer" data-mail-id="${escapeHtml(activeMail.id)}">
                Ablöse (${feeVal.toLocaleString('de-DE')} Mio. €) annehmen &amp; Stufe 2 starten
              </button>

              <div class="sl-mail-counter-inline">
                <span class="sl-mail-counter-label">Gegenforderung (Mio. €)</span>
                <input type="number" id="mail-counter-fee-input" min="1" max="500" value="${Math.round(feeVal * 1.12)}" aria-label="Gegenangebot in Mio. EUR">
                <button type="button" class="sl-mail-bump-btn" data-action="bump-mail-counter-fee" data-fee="${Math.round(feeVal * 1.1)}">+10%</button>
                <button type="button" class="sl-mail-bump-btn" data-action="bump-mail-counter-fee" data-fee="${Math.round(feeVal * 1.2)}">+20%</button>
                <button type="button" class="button light small" data-action="mail-counter-offer" data-mail-id="${escapeHtml(activeMail.id)}">
                  Gegenangebot senden
                </button>
              </div>

              <div class="sl-mail-secondary-actions">
                ${counterpartyTeamId ? `
                  <button type="button" class="button light small" data-action="call-manager" data-team-id="${escapeHtml(counterpartyTeamId)}" title="Verhandlungspartner direkt auf dem Verhandlungs-Handy anrufen">
                    Schnell-Call im Handy
                  </button>
                ` : ''}
                <button type="button" class="button light small" data-action="mail-decline-offer" data-mail-id="${escapeHtml(activeMail.id)}">
                  Ablehnen
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        ${isAgentStage ? `
          <div class="sl-agent-agreed-banner">
            <div class="sl-agent-agreed-copy">
              <span class="eyebrow">STUFE 1 PERFEKT · VEREINS-EINIGUNG ÜBER ${feeVal.toLocaleString('de-DE')} MIO. €</span>
              <strong>Stufe 2 bereit: Verhandle jetzt mit Berater ${escapeHtml(agentProfile.agentName)} &amp; zeichne deine Unterschrift!</strong>
              <span>Einige dich mit ${escapeHtml(agentProfile.agentName)} (${escapeHtml(agentProfile.agency)}) über Jahresgehalt, Vertragslaufzeit und Handgeld. Danach unterschreibst du den Vertrag direkt auf dem Signatur-Pad.</span>
            </div>
            <div class="sl-agent-agreed-cta">
              <button type="button" class="button primary" data-action="open-agent-negotiation-modal" data-session-id="${escapeHtml(activeMail.agentSessionId || '')}" data-mail-id="${escapeHtml(activeMail.id)}">
                Stufe 2 öffnen: Mit Agent verhandeln &amp; unterschreiben
              </button>
            </div>
          </div>
        ` : ''}

        ${activeMail.signatureSvgPath ? `
          <div class="sl-mail-signed-footer">
            ${renderStaticSignatureCard(activeMail.signatureSvgPath, myTeam?.managerName || 'Manager', `${activeMail.sellerTeamName} → ${activeMail.buyerTeamName}`)}
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="sl-mail-workspace">
      ${!embeddedInTransferHub ? `
        <div class="page-heading">
          <div>
            <div class="eyebrow">POSTFACH · OFFIZIELLE TRANSFERKORRESPONDENZ (CPU &amp; MENSCHLICHE VEREINE)</div>
            <h1>Postfach &amp; Transfer-Dossiers · ${escapeHtml(myTeam?.name || 'Verein')}</h1>
            <p>Alle schriftlichen Transferangebote der CPU-Vereine und deiner Mitspieler laufen hier zusammen. Nach der Vereins-Einigung (Stufe 1) verhandelst du direkt mit dem Spielerberater und setzt deine gezeichnete Unterschrift unter den Vertrag (Stufe 2).</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="button light" data-action="trigger-cpu-market">Neues CPU-Angebot anfordern</button>
            <button type="button" class="button light" data-view="transfers">Scouting &amp; TransferHub</button>
            <button type="button" class="button primary" data-view="finances">FIFA 17 Finanzen &amp; Gehalt</button>
          </div>
        </div>
      ` : ''}

      <div class="sl-mail-kpi-strip" role="region" aria-label="Postfach und Budget Kennzahlen">
        <div class="sl-mail-kpi-card">
          <small>POSTEINGANG</small>
          <strong>${allMails.length} Schreiben</strong>
          <span>${unreadCount > 0 ? `${unreadCount} ungelesen` : 'Alle gelesen'} · ${completedCount} abgeschlossen</span>
        </div>
        <div class="sl-mail-kpi-card">
          <small>OFFENE ENTSCHEIDUNGEN</small>
          <strong>${openOffersCount} ${openOffersCount === 1 ? 'Angebot' : 'Angebote'}</strong>
          <span>${stage2ReadyCount} in Stufe 2 (Berater &amp; Signatur)</span>
        </div>
        <div class="sl-mail-kpi-card">
          <small>TRANSFERBUDGET (STUFE 1)</small>
          <strong>${finance.transferBudget.toLocaleString('de-DE')} Mio. €</strong>
          <span>Für Ablösesummen &amp; Handgeld</span>
        </div>
        <div class="sl-mail-kpi-card">
          <small>FREIES GEHALTSBUDGET (STUFE 2)</small>
          <strong>${finance.freeWageBudget.toLocaleString('de-DE')} Mio. €/J.</strong>
          <span>Spielraum für Agenten-Verträge</span>
        </div>
      </div>

      <section class="panel sl-mail-compose-bar">
        <div class="sl-mail-compose-top">
          <div>
            <span class="eyebrow">NEUES SCHRIFTLICHES GEBOT EINREICHEN</span>
            <h2>Offizielles Transferangebot per Mail senden</h2>
          </div>
          ${selectedComposePick && composeAgentPreview ? `
            <div class="sl-mail-compose-target-preview">
              <span>Zielspieler: <b>${escapeHtml(selectedComposePick.playerName)}</b> (${escapeHtml(selectedComposePick.position || 'CM')} · OVR ${selectedComposePick.rating || 80})</span>
              <span aria-hidden="true">·</span>
              <span>Marktwert: <b>~${suggestedFee} Mio. €</b></span>
              <span aria-hidden="true">·</span>
              <span>Berater: <b>${escapeHtml(composeAgentPreview.agentName)}</b> (~${composeAgentPreview.targetSalary} Mio. €/J.)</span>
              <span aria-hidden="true">·</span>
              <span>Empfänger: <b>${escapeHtml(selectedTargetClub?.name || '')}</b> (${selectedTargetClub?.managerType === 'human' ? 'Mensch' : 'CPU-Vorstand'})</span>
            </div>
          ` : ''}
        </div>

        <form id="mail-offer-compose-form" class="sl-mail-compose-grid">
          <div class="field">
            <label for="mail-target-team">Zielverein (CPU oder Mensch)</label>
            <select id="mail-target-team" name="toTeamId" data-mail-compose-club>
              ${rivalTeams.map((t) => `<option value="${escapeHtml(t.id)}" ${t.id === selectedTargetClubId ? 'selected' : ''}>${escapeHtml(t.name)} (${t.managerType === 'human' ? `Mensch: ${escapeHtml(t.managerName)}` : 'CPU'})</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="mail-target-player">Spieler auswählen</label>
            <select id="mail-target-player" name="playerId" data-mail-compose-player>
              ${targetClubPicks.map((p) => {
                const mv = calculatePlayerMarketValue({ rating: p.rating || 80, position: p.position || 'CM' });
                return `<option value="${escapeHtml(p.playerId)}" ${p.playerId === selectedComposePick?.playerId ? 'selected' : ''}>${escapeHtml(p.playerName)} (${escapeHtml(p.position || 'CM')} · OVR ${p.rating || 80} · MW ~${mv}M)</option>`;
              }).join('')}
            </select>
          </div>
          <div class="field">
            <div class="sl-mail-fee-label-row">
              <label for="mail-offer-fee">Ablöse (Mio. €)</label>
              <div class="sl-mail-fee-presets">
                <button type="button" class="sl-mail-preset-chip" data-action="set-compose-mail-fee" data-fee="${suggestedFee}">MW (${suggestedFee}M)</button>
                <button type="button" class="sl-mail-preset-chip" data-action="set-compose-mail-fee" data-fee="${Math.round(suggestedFee * 1.1)}">+10%</button>
                <button type="button" class="sl-mail-preset-chip" data-action="set-compose-mail-fee" data-fee="${Math.round(suggestedFee * 1.2)}">+20%</button>
              </div>
            </div>
            <input id="mail-offer-fee" name="fee" type="number" min="1" max="500" value="${suggestedFee}" required>
          </div>
          <div class="field">
            <label for="mail-offer-note">Begleitnotiz (optional)</label>
            <input id="mail-offer-note" name="note" type="text" placeholder="z. B. Sofortige Stammplatzgarantie &amp; Top-Boni" maxlength="120">
          </div>
          <div class="field sl-mail-compose-submit-col">
            <button type="submit" class="button primary" style="width:100%">Schriftliches Gebot senden</button>
          </div>
        </form>
      </section>

      <div class="sl-mail-split-grid">
        <aside class="panel sl-mail-list-panel">
          <div class="sl-mail-list-header">
            <div>
              <h2>Posteingang &amp; Verlauf</h2>
              <small>${filteredMails.length} von ${allMails.length} Nachrichten angezeigt</small>
            </div>
            <div class="sl-mail-list-header-right">
              ${unreadCount > 0 ? `<button type="button" class="sl-mail-mark-read-btn" data-action="mark-all-mail-read">Alle gelesen (${unreadCount})</button>` : `<span class="sl-mail-all-read-label">0 ungelesen</span>`}
            </div>
          </div>

          <div class="sl-mail-segmented-filters" role="tablist" aria-label="Postfach Filter">
            <button type="button" class="sl-mail-filter-btn ${mailFilter === 'all' ? 'is-active' : ''}" data-action="set-mail-filter" data-filter="all">
              Alle <span>${allMails.length}</span>
            </button>
            <button type="button" class="sl-mail-filter-btn ${mailFilter === 'offers' ? 'is-active' : ''}" data-action="set-mail-filter" data-filter="offers">
              Offen <span>${openOffersCount + stage2ReadyCount}</span>
            </button>
            <button type="button" class="sl-mail-filter-btn ${mailFilter === 'agent' ? 'is-active' : ''}" data-action="set-mail-filter" data-filter="agent">
              Stufe 2 <span>${stage2ReadyCount}</span>
            </button>
            <button type="button" class="sl-mail-filter-btn ${mailFilter === 'completed' ? 'is-active' : ''}" data-action="set-mail-filter" data-filter="completed">
              Vollzug <span>${completedCount}</span>
            </button>
          </div>

          <div class="sl-mail-items-scroll">
            ${mailListHtml || '<div class="empty-state"><p>Keine Nachrichten in dieser Ansicht.</p></div>'}
          </div>
        </aside>

        <section class="panel sl-mail-reader-panel">
          ${detailHtml}
        </section>
      </div>
    </div>
  `;
}

/**
 * Renders the FIFA 17 Style Finance & Wage Budget Management Tab ("Finanzen").
 */
export function renderFinanceTabView({
  league,
  players = [],
  activeManagerTeamId = '',
  previewSplitRatio = null,
} = {}) {
  if (!league) {
    return `
      <section class="panel empty-wide">
        <h2>Finanzen &amp; Gehaltsbudget (FIFA 17 Stil)</h2>
        <p>Starte zuerst eure Super League im Liga-Setup, um Transferbudget, Gehaltsbudget, den FIFA 17 Budget-Schieberegler und Spielervertraege zu verwalten.</p>
        <button type="button" class="button primary" data-view="setup">Zum Liga-Setup</button>
      </section>
    `;
  }

  const managerId = activeManagerTeamId || league.teams?.[0]?.id || '';
  const finance = getTeamFinanceSummary(league, managerId, players);
  const currentRatio = previewSplitRatio !== null ? clamp(Number(previewSplitRatio), 10, 95) : finance.splitRatio;
  const previewTransfer = Number(((finance.totalDisposablePool * currentRatio) / 100).toFixed(1));
  const previewFreeWage = Number(Math.max(2.0, finance.totalDisposablePool - previewTransfer).toFixed(1));
  const previewTotalWage = Number((finance.committedWages + previewFreeWage).toFixed(1));

  const myPicks = (league.draft?.picks ?? [])
    .filter((p) => p.teamId === managerId)
    .sort((a, b) => (b.rating || 80) - (a.rating || 80));

  const rosterRowsHtml = myPicks.map((pick) => {
    const raw = (players ?? []).find((p) => p.id === pick.playerId) || {
      id: pick.playerId,
      name: pick.playerName,
      position: pick.position,
      rating: pick.rating,
    };
    const contract = getPlayerContract(league, raw);
    const storedContract = league.contracts?.[pick.playerId] || {};
    const agent = getPlayerAgentProfile(raw, league);
    const roleLabel = storedContract.squadRole || agent.preferredRole;
    const sigHtml = storedContract.signatureSvgPath
      ? `<svg width="92" height="28" viewBox="0 0 180 54" style="background:rgba(15,23,42,0.7);border:1px solid rgba(56,189,248,0.35);border-radius:6px"><path d="${escapeHtml(storedContract.signatureSvgPath)}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/></svg>`
      : '<span class="draft-sub">Standard-Vertrag</span>';

    return `
      <tr>
        <td>
          <button type="button" class="pes-inline-player-trigger" data-action="open-pes-player" data-player-id="${escapeHtml(pick.playerId)}">
            <strong>${escapeHtml(pick.playerName || raw.name)}</strong>
          </button>
          <div class="draft-sub">Berater: ${escapeHtml(agent.agentName)} (${escapeHtml(agent.styleLabel)})</div>
        </td>
        <td><span class="position-tag">${escapeHtml(pick.position || 'CM')}</span></td>
        <td><strong>OVR ${Number(pick.rating) || 80}</strong></td>
        <td><span class="pes-mode-pill">${escapeHtml(roleLabel)}</span></td>
        <td style="font-family:var(--font-mono);font-variant-numeric:tabular-nums"><strong>${Number(contract.salary).toFixed(1)} Mio. EUR / J.</strong></td>
        <td style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">
          <span class="fm-contract-pill ${contract.isExpiring ? 'is-expiring' : 'is-safe'}">
            ${contract.yearsRemaining} J. (bis ${contract.contractUntil})
          </span>
        </td>
        <td>${sigHtml}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="button primary small" data-action="start-agent-extension" data-player-id="${escapeHtml(pick.playerId)}">
              Mit Agent verhandeln
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <section class="calendar-page finance-command-page" aria-label="FIFA 17 Finanzen und Gehaltsbudget">
      <div class="page-heading">
        <div>
          <div class="eyebrow">FINANZEN · FIFA 17 BUDGET-VERTEILUNG &amp; GEHALTSMANAGEMENT</div>
          <h1>Finanzen &amp; Gehaltsbudget · ${escapeHtml(finance.teamName)}</h1>
          <p>Verwalte dein Transfer- und Gehaltsbudget wie in FIFA 17 per Schieberegler und verhandle Spielervertraege direkt mit den Beratern.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="button light" data-view="mail">Zum Postfach</button>
          <button type="button" class="button primary" data-view="transfers">Zum TransferHub</button>
        </div>
      </div>

      <div class="metric-grid">
        <div class="panel metric">
          <div class="metric-top"><span class="metric-icon is-blue">TB</span><span class="metric-trend is-positive">${currentRatio}% Anteil</span></div>
          <div class="metric-label">Verfuegbares Transferbudget</div>
          <div class="metric-value" style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">${previewTransfer.toLocaleString('de-DE')} <small>Mio. EUR</small></div>
          <div class="metric-note">Fuer Abloesesummen &amp; Handgelder</div>
        </div>
        <div class="panel metric">
          <div class="metric-top"><span class="metric-icon is-emerald">GB</span><span class="metric-trend is-positive">${100 - currentRatio}% Anteil</span></div>
          <div class="metric-label">Freies Gehaltsbudget (Spielraum)</div>
          <div class="metric-value" style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">${previewFreeWage.toLocaleString('de-DE')} <small>Mio. EUR / Jahr</small></div>
          <div class="metric-note">Gesamter Gehaltsetat: ${previewTotalWage.toLocaleString('de-DE')} Mio. EUR/J.</div>
        </div>
        <div class="panel metric">
          <div class="metric-top"><span class="metric-icon is-gold">KG</span><span class="metric-trend is-gold">${finance.rosterCount} Profis</span></div>
          <div class="metric-label">Gebundene Kader-Gehaelter</div>
          <div class="metric-value" style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">${finance.committedWages.toLocaleString('de-DE')} <small>Mio. EUR / Jahr</small></div>
          <div class="metric-note">${finance.expiringCount} Vertraege laufen in 1 Jahr aus</div>
        </div>
      </div>

      <section class="panel sl-fifa-budget-panel" style="margin-bottom:20px">
        <div class="panel-header">
          <div>
            <h2>FIFA 17 Budget-Aufteilung (Transferbudget / Gehaltsbudget)</h2>
            <div class="draft-sub">Verschiebe dein frei verfuegbares Vereinskapital (${finance.totalDisposablePool.toLocaleString('de-DE')} Mio. EUR) stufenlos zwischen Transfer- und Gehaltstopf.</div>
          </div>
          <span id="fifa-slider-ratio-label" class="pes-team-kpi-pill" style="font-family:var(--font-mono)">${currentRatio}% Transfer / ${100 - currentRatio}% Gehalt</span>
        </div>

        <div class="sl-fifa-slider-card">
          <div class="sl-fifa-slider-side is-transfer">
            <span>TRANSFERBUDGET</span>
            <strong id="fifa-slider-tx-val">${previewTransfer.toLocaleString('de-DE')} Mio. EUR</strong>
            <small>Sofort verfuegbar fuer Abloesen &amp; Boni</small>
          </div>

          <div class="sl-fifa-slider-center">
            <input
              type="range"
              id="fifa-budget-slider"
              class="sl-fifa-range-input"
              min="15"
              max="95"
              step="1"
              value="${currentRatio}"
              aria-label="FIFA 17 Budget-Regler zwischen Transferbudget und Gehaltsbudget"
            >
            <div class="sl-fifa-slider-ticks">
              <span>Mehr Gehaltsbudget</span>
              <span>Ausgewogen</span>
              <span>Mehr Transferbudget</span>
            </div>
            <div style="display:flex;justify-content:center;margin-top:6px">
              <button type="button" class="button primary" data-action="apply-fifa-budget-split">
                Budget-Aufteilung uebernehmen
              </button>
            </div>
          </div>

          <div class="sl-fifa-slider-side is-wage">
            <span>FREIES GEHALTSBUDGET</span>
            <strong id="fifa-slider-wage-val">${previewFreeWage.toLocaleString('de-DE')} Mio. EUR / Jahr</strong>
            <small>Spielraum fuer Agenten-Verhandlungen</small>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h2>Kader-Gehaltsliste, Berater &amp; Vertragsunterschriften (${myPicks.length} Spieler)</h2>
            <div class="draft-sub">Jeder Spieler hat Laufzeit, Jahresgehalt, Kaderrolle und einen Berater fuer Vertragsverhandlungen.</div>
          </div>
        </div>
        <div class="standings-scroll">
          <table class="player-table fm-scouting-table">
            <thead>
              <tr>
                <th>Spieler &amp; Berater</th>
                <th>Pos</th>
                <th>OVR</th>
                <th>Kaderrolle</th>
                <th>Jahresgehalt</th>
                <th>Vertragslaufzeit</th>
                <th>Gezeichnete Signatur</th>
                <th>Agenten-Verhandlung</th>
              </tr>
            </thead>
            <tbody>
              ${rosterRowsHtml || '<tr><td colspan="8" class="empty-table">Noch keine Spieler im Kader.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

/**
 * Renders the Stage 2 Player & Agent Contract Negotiation + Static Signature Pad Modal.
 * Supports both `renderAgentNegotiationModal({ league, session, players })` and `renderAgentNegotiationModal(league, session)`.
 */
export function renderAgentNegotiationModal(leagueOrObj, maybeSession) {
  let league = leagueOrObj;
  let session = maybeSession;
  let players = [];
  if (leagueOrObj && typeof leagueOrObj === 'object' && 'session' in leagueOrObj) {
    league = leagueOrObj.league;
    session = leagueOrObj.session;
    players = leagueOrObj.players || [];
  }
  if (!league || !session) return '';
  const finance = getTeamFinanceSummary(league, session.buyerTeamId, players);
  const statusUpper = String(session.status || '').toUpperCase();
  const canSign = statusUpper === 'AWAITING_SIGNATURE' || statusUpper === 'AGREED';
  const walkedAway = statusUpper === 'WALKED_AWAY';
  const isExtension = String(session.mode || '').toUpperCase() === 'EXTENSION';

  return `
    <div class="signing-backdrop" role="dialog" aria-modal="true" aria-label="Stufe 2 Spieler und Agenten Vertragsverhandlung">
      <section class="signing-modal sl-agent-modal">
        <div class="signing-modal-top">
          <span>SUPER LEAGUE · STUFE 2: SPIELER &amp; AGENTEN-VERHANDLUNG</span>
          <button type="button" class="signing-close" data-action="close-agent-modal" aria-label="Schliessen">×</button>
        </div>

        <h2>${isExtension ? `Vertragsverlaengerung: ${escapeHtml(session.playerName)}` : `Transfer-Stufe 2: ${escapeHtml(session.playerName)}`}</h2>
        <p class="signing-subtitle">
          ${isExtension
            ? `Verhandle mit Berater ${escapeHtml(session.agentName)} (${escapeHtml(session.agentStyle)}) ueber das neue Gehalt und zeichne deine Unterschrift.`
            : `Vereins-Abloese (${Number(session.agreedFee).toLocaleString('de-DE')} Mio. EUR an ${escapeHtml(session.sellerTeamName)}) ist vereinbart! Einigt euch jetzt mit Berater ${escapeHtml(session.agentName)} und unterschreibe den Vertrag.`}
        </p>

        <div class="sl-agent-header-strip">
          <div class="sl-agent-card">
            <small>SPIELER &amp; POS</small>
            <strong>${escapeHtml(session.playerName)} (${escapeHtml(session.position)} · OVR ${session.rating})</strong>
            <span>Zielverein: ${escapeHtml(session.buyerTeamName || finance.teamName)}</span>
          </div>
          <div class="sl-agent-card">
            <small>BERATER &amp; GEDULD</small>
            <strong>${escapeHtml(session.agentName)}</strong>
            <span>Stil: ${escapeHtml(session.agentStyle || 'Ausgewogen')} · Geduld: ${session.patience}%</span>
          </div>
          <div class="sl-agent-card">
            <small>VERFUEGBARES BUDGET (${escapeHtml(finance.teamName)})</small>
            <strong>Transfer: ${finance.transferBudget}M · Gehalt frei: ${finance.freeWageBudget}M/J.</strong>
            <span>Abloese Stufe 1: ${Number(session.agreedFee).toLocaleString('de-DE')} Mio. EUR</span>
          </div>
        </div>

        <div class="sl-agent-chat-box">
          <div class="sl-agent-chat-meta">
            <span>VERHANDLUNGSPROTOKOLL · ${escapeHtml(session.agentName)}</span>
            <strong>${canSign ? 'EINIGUNG ERZIELT — BEREIT ZUR UNTERSCHRIFT' : walkedAway ? 'ABGEBROCHEN' : 'VERHANDLUNG AKTIV'}</strong>
          </div>
          <p>${escapeHtml(session.agentFeedback)}</p>
        </div>

        ${!canSign && !walkedAway ? `
          <form id="agent-contract-offer-form" data-session-id="${escapeHtml(session.id)}" class="sl-agent-offer-grid">
            <div class="field">
              <label for="agent-offer-salary">Gebotenes Jahresgehalt (Mio. EUR / Jahr)</label>
              <input id="agent-offer-salary" name="salary" type="number" step="0.1" min="0.5" max="45" value="${session.offeredSalary}" required>
              <small class="draft-sub">Forderung: ${session.demandedSalary} Mio. EUR/J.</small>
            </div>
            <div class="field">
              <label for="agent-offer-years">Vertragslaufzeit (Jahre)</label>
              <select id="agent-offer-years" name="years">
                ${[1, 2, 3, 4, 5].map((yr) => `<option value="${yr}" ${Number(session.offeredYears) === yr ? 'selected' : ''}>${yr} ${yr === 1 ? 'Jahr' : 'Jahre'} (bis ${2026 + yr})</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="agent-offer-bonus">Handgeld / Unterschriftsbonus (Mio. EUR)</label>
              <input id="agent-offer-bonus" name="signingBonus" type="number" step="0.5" min="0" max="80" value="${session.offeredBonus}" required>
              <small class="draft-sub">Wunsch: ${session.demandedBonus} Mio. EUR</small>
            </div>
            <div class="field">
              <label for="agent-offer-role">Zugesicherte Kaderrolle</label>
              <select id="agent-offer-role" name="role">
                ${SQUAD_ROLES.map((r) => `<option value="${escapeHtml(r.label)}" ${session.offeredRole === r.label ? 'selected' : ''}>${escapeHtml(r.label)}</option>`).join('')}
              </select>
            </div>
            <div style="grid-column: 1 / -1; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:6px">
              <button type="button" class="button light small" data-action="agent-open-finance-tab">FIFA 17 Budget-Regler oeffnen</button>
              <button type="submit" class="button primary">Vertragsangebot an Berater vorlegen</button>
            </div>
          </form>
        ` : ''}

        ${canSign ? `
          <div class="signature-pad-box sl-static-signature-pad">
            <div class="signature-pad-head">
              <strong>Vertragsunterschrift zeichnen (Sichtbar fuer alle Manager · Ohne Strich-Animation)</strong>
              <div style="display:flex;gap:8px">
                <button type="button" class="button light small" data-action="clear-agent-signature-pad">Feld leeren</button>
                <button type="button" class="button primary small" data-action="finalize-agent-signature" data-session-id="${escapeHtml(session.id)}">
                  Vertrag rechtskraeftig unterzeichnen &amp; DONE-Showreel starten
                </button>
              </div>
            </div>
            <canvas id="agent-signature-pad-canvas" width="360" height="108"></canvas>
            <small>Zeichne mit der Maus oder dem Finger deine Unterschrift. Alle anderen Spieler sehen exakt deine gezeichnete Unterschrift auf dem Vertrag.</small>
          </div>
        ` : ''}
      </section>
    </div>
  `;
}
