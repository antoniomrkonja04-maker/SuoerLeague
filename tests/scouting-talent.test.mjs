import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extendPlayerContract,
  generateRandomTalents,
  getPlayerContract,
  getPlayerScoutingReport,
  isPlayerShortlisted,
  releasePlayerToFreeAgency,
  scoutPlayer,
  signFreeAgent,
  toggleShortlistPlayer,
} from '../src/scouting-talent-core.mjs';
import fs from 'node:fs';
import { renderCommandTransferHubView } from '../src/transfer-hub-view.mjs';
import { renderPesPlayerModal } from '../src/pes-view.mjs';
import { renderNewsView } from '../src/news-view.mjs';
import {
  ensureHijackableDeals,
  evaluateCpuOfferResponse,
  hijackTransferDeal,
  resolveCompetingHijack,
  triggerRivalHijackOnCall,
} from '../src/transfer-core.mjs';
import {
  adjustTeamBudgetSplit,
  createAgentNegotiationSession,
  ensureMailInboxInitialized,
  finalizeAgentDealWithSignature,
  getTeamFinanceSummary,
  markMailRead,
  renderAgentNegotiationModal,
  renderFinanceTabView,
  renderMailInboxView,
  renderStaticSignatureCard,
  respondToMailOffer,
  sendMailTransferOffer,
  submitAgentContractOffer,
} from '../src/mail-finance-agent.mjs';
import { buildShowreelFrameSvg } from '../src/deal-done-showreel.mjs';

function createSampleLeague() {
  return {
    name: 'Test Champions League',
    season: '2026/27',
    currentDate: '2026-08-05',
    adminName: 'Admin',
    teams: [
      { id: 'arsenal', name: 'Arsenal', managerName: 'Admin', managerType: 'human', budget: 150 },
      { id: 'bayern', name: 'Bayern München', managerName: 'CPU 1', managerType: 'cpu', budget: 150 },
    ],
    draft: {
      order: ['arsenal', 'bayern'],
      picks: [
        { playerId: 'p-saka', playerName: 'Bukayo Saka', position: 'RW', rating: 88, teamId: 'arsenal', teamName: 'Arsenal', managerName: 'Admin', number: 1, round: 1 },
        { playerId: 'p-musiala', playerName: 'Jamal Musiala', position: 'CAM', rating: 89, teamId: 'bayern', teamName: 'Bayern München', managerName: 'CPU 1', number: 2, round: 1 },
      ],
    },
    scouting: {},
    shortlists: {},
    contracts: {},
    transfers: [],
    calls: [],
  };
}

test('generateRandomTalents creates 16-20 year old wonderkids with high potential', () => {
  const talents = generateRandomTalents(12, { seed: 'season-2026-test' });
  assert.equal(talents.length, 12);
  for (const t of talents) {
    assert.equal(t.isGeneratedTalent, true);
    assert.ok(t.age >= 16 && t.age <= 20, `Expected age 16-20, got ${t.age}`);
    assert.ok(t.rating >= 68 && t.rating <= 81, `Expected OVR 68-81, got ${t.rating}`);
    assert.ok(t.potential >= t.rating + 7 && t.potential <= 96, `Expected high potential, got ${t.potential}`);
    assert.ok(t.nationality && t.playingStyle && t.talentTier);
  }
});

test('FM Scouting fog-of-war hides rival player attributes until scouted to 100%', () => {
  let league = createSampleLeague();
  const ownPlayer = { id: 'p-saka', name: 'Bukayo Saka', position: 'RW', rating: 88, club: 'Arsenal' };
  const rivalPlayer = { id: 'p-musiala', name: 'Jamal Musiala', position: 'CAM', rating: 89, club: 'Bayern München' };

  // Own player is automatically 100% known
  const ownReport = getPlayerScoutingReport(league, 'arsenal', ownPlayer);
  assert.equal(ownReport.level, 2);
  assert.equal(ownReport.progress, 100);
  assert.equal(ownReport.isFullyScouted, true);
  assert.equal(ownReport.displayedOvr, '88');

  // Rival player starts at 0% (fog of war)
  const initialRival = getPlayerScoutingReport(league, 'arsenal', rivalPlayer);
  assert.equal(initialRival.level, 0);
  assert.equal(initialRival.progress, 0);
  assert.equal(initialRival.isFullyScouted, false);
  assert.match(initialRival.displayedOvr, /\d+–\d+/);
  assert.equal(initialRival.grade, '??');

  // Step 1 scouting -> 50% (Vorbericht)
  const step1 = scoutPlayer(league, 'arsenal', rivalPlayer, { full: false });
  assert.ok(!step1.error);
  assert.equal(step1.report.progress, 50);
  league = step1.league;
  const midReport = getPlayerScoutingReport(league, 'arsenal', rivalPlayer);
  assert.equal(midReport.level, 1);
  assert.equal(midReport.isFullyScouted, false);
  assert.notEqual(midReport.grade, '??');

  // Step 2 scouting -> 100% (Vollständig gescoutet)
  const step2 = scoutPlayer(league, 'arsenal', rivalPlayer, { full: false });
  assert.ok(!step2.error);
  assert.equal(step2.report.progress, 100);
  league = step2.league;
  const fullReport = getPlayerScoutingReport(league, 'arsenal', rivalPlayer);
  assert.equal(fullReport.level, 2);
  assert.equal(fullReport.isFullyScouted, true);
  assert.equal(fullReport.displayedOvr, '89');
  assert.equal(fullReport.grade, 'A+');
});

test('signFreeAgent signs a wonderkid or free agent into the club roster and creates a contract', () => {
  let league = createSampleLeague();
  const [wonderkid] = generateRandomTalents(1, { seed: 'wonderkid-sign' });

  const signed = signFreeAgent(league, 'arsenal', wonderkid, { contractYears: 4 });
  assert.ok(!signed.error);
  league = signed.league;

  const inRoster = league.draft.picks.some((pk) => pk.playerId === wonderkid.id && pk.teamId === 'arsenal');
  assert.equal(inRoster, true);

  const contract = getPlayerContract(league, wonderkid);
  assert.equal(contract.teamId, 'arsenal');
  assert.equal(contract.yearsRemaining, 4);
  assert.ok(contract.salary > 0);
  assert.ok(contract.releaseClause > 0);
});

test('extendPlayerContract and releasePlayerToFreeAgency manage club contracts', () => {
  let league = createSampleLeague();
  const saka = { id: 'p-saka', name: 'Bukayo Saka', position: 'RW', rating: 88 };

  const beforeContract = getPlayerContract(league, saka);
  const extended = extendPlayerContract(league, 'arsenal', saka, { additionalYears: 2 });
  assert.ok(!extended.error);
  league = extended.league;
  assert.ok(extended.contract.contractUntil > beforeContract.contractUntil);

  // Add a second player so we can test releasing
  league.draft.picks.push({
    playerId: 'p-extra',
    playerName: 'Extra Player',
    position: 'CM',
    rating: 76,
    teamId: 'arsenal',
    teamName: 'Arsenal',
  });
  const released = releasePlayerToFreeAgency(league, 'arsenal', 'p-extra');
  assert.ok(!released.error);
  assert.equal(released.league.draft.picks.some((pk) => pk.playerId === 'p-extra'), false);
});

test('toggleShortlistPlayer adds and removes players from manager shortlist', () => {
  let league = createSampleLeague();
  const res1 = toggleShortlistPlayer(league, 'arsenal', 'p-musiala');
  assert.equal(res1.added, true);
  assert.equal(isPlayerShortlisted(res1.league, 'arsenal', 'p-musiala'), true);

  const res2 = toggleShortlistPlayer(res1.league, 'arsenal', 'p-musiala');
  assert.equal(res2.added, false);
  assert.equal(isPlayerShortlisted(res2.league, 'arsenal', 'p-musiala'), false);
});

test('renderCommandTransferHubView and renderPesPlayerModal enforce FM scouting fog-of-war', () => {
  const league = createSampleLeague();
  const talents = generateRandomTalents(4, { seed: 'hub-view-test' });
  const players = [
    { id: 'p-saka', name: 'Bukayo Saka', position: 'RW', rating: 88, club: 'Arsenal' },
    { id: 'p-musiala', name: 'Jamal Musiala', position: 'CAM', rating: 89, club: 'Bayern München' },
    ...talents,
  ];

  const scoutingHtml = renderCommandTransferHubView({
    league,
    players,
    activeManagerTeamId: 'arsenal',
    activeTab: 'scouting',
  });
  assert.ok(scoutingHtml.includes('Scouting-Zentrale'));
  assert.ok(scoutingHtml.includes('Jamal Musiala'));
  assert.ok(scoutingHtml.includes('Ungescoutet'));

  const modalFogged = renderPesPlayerModal(players[1], league, {
    activeManagerTeamId: 'arsenal',
    enforceScouting: true,
  });
  assert.ok(modalFogged.includes('Super League Scouting-Status'));
  assert.ok(modalFogged.includes('Voll-Scouting'));
});

test('Multi-round negotiations require multiple rounds and allow rival transfer hijacking', () => {
  // Round 1 fair offer should counter when requireMultiRound is true
  const round1 = evaluateCpuOfferResponse({
    playerRating: 85,
    position: 'CM',
    fee: 38,
    sellerRosterCount: 30,
    offerRound: 1,
    requireMultiRound: true,
  });
  assert.equal(round1.decision, 'counter');
  assert.ok(round1.counterFee > round1.askingPrice);
  assert.ok(round1.stageLabel.includes('Runde 1/3'));

  // Round 3 meeting asking price accepts
  const round3 = evaluateCpuOfferResponse({
    playerRating: 85,
    position: 'CM',
    fee: round1.askingPrice,
    sellerRosterCount: 30,
    offerRound: 3,
    requireMultiRound: true,
  });
  assert.equal(round3.decision, 'accept');

  // Test ensureHijackableDeals and hijackTransferDeal
  const league = createSampleLeague();
  league.teams.push({ id: 'real', name: 'Real Madrid', managerName: 'CPU 2', managerType: 'cpu', budget: 180 });
  league.draft.picks.push({
    playerId: 'p-bellingham',
    playerName: 'Jude Bellingham',
    position: 'CAM',
    rating: 90,
    teamId: 'real',
    teamName: 'Real Madrid',
    managerName: 'CPU 2',
    number: 3,
    round: 1,
  });

  const ensured = ensureHijackableDeals(league, []);
  assert.ok(ensured.deals.length > 0);
  const rivalDeal = ensured.deals.find((d) => d.sellerTeamId !== 'arsenal' && d.buyerTeamId !== 'arsenal') || ensured.deals[0];
  // Force buyer to bayern and seller to real so arsenal can hijack it
  rivalDeal.sellerTeamId = 'real';
  rivalDeal.sellerTeamName = 'Real Madrid';
  rivalDeal.buyerTeamId = 'bayern';
  rivalDeal.buyerTeamName = 'Bayern München';
  rivalDeal.currentFee = 55;
  rivalDeal.hijackFee = 62;

  const hijacked = hijackTransferDeal(ensured.league, 'arsenal', rivalDeal.id, { customFee: 62 });
  assert.ok(!hijacked.error);
  assert.equal(hijacked.call.isHijack, true);
  assert.equal(hijacked.offer.fee, 62);

  // Trigger rival hijack on the active call and resolve it via outbid
  const rivalAttempt = triggerRivalHijackOnCall(hijacked.league, hijacked.call.id, { seed: 'test-rival' });
  assert.ok(rivalAttempt.competingBid);
  assert.equal(rivalAttempt.competingBid.rivalTeamId, 'bayern');

  const resolved = resolveCompetingHijack(rivalAttempt.league, hijacked.call.id, 'arsenal', 'outbid');
  assert.ok(!resolved.error);
  assert.equal(resolved.hijackedByRival, false);
  assert.ok(resolved.outbidFee > 62);
});

test('NewsHub renders 3-column desktop broadcast layout and zero emojis exist in codebase', () => {
  const league = ensureHijackableDeals(createSampleLeague(), []).league;
  const newsHtml = renderNewsView({
    league,
    activeCategory: 'all',
    activeManagerTeamId: 'arsenal',
  });
  assert.ok(newsHtml.includes('newshub-grid'));
  assert.ok(newsHtml.includes('newshub-left'));
  assert.ok(newsHtml.includes('newshub-center'));
  assert.ok(newsHtml.includes('newshub-right'));

  const emojiRegex = /[\p{Extended_Pictographic}]/u;
  const filesToCheck = [
    'index.html',
    'styles.css',
    ...fs.readdirSync('src', { withFileTypes: true }).filter((d) => d.isFile()).map((d) => `src/${d.name}`),
  ];
  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(emojiRegex.test(content), false, `Expected zero emojis in ${file}`);
  }
});

test('Postfach Mail App, 2-Stage Agent Negotiation, Static Signature, FIFA 17 Finance Slider & 15s Showreel work end-to-end', () => {
  let league = createSampleLeague();
  const ensured = ensureMailInboxInitialized(league, [], 'arsenal');
  league = ensured.league || ensured;
  assert.ok(Array.isArray(league.mailItems) && league.mailItems.length > 0);

  // Test markMailRead
  const firstMailId = league.mailItems[0].id;
  assert.equal(league.mailItems[0].unread, true);
  league = markMailRead(league, firstMailId);
  assert.equal(league.mailItems[0].unread, false);
  assert.equal(league.mailItems[0].read, true);

  // Test FIFA 17 Finance Slider (adjustTeamBudgetSplit & getTeamFinanceSummary)
  const finBefore = getTeamFinanceSummary(league, 'arsenal', []);
  assert.ok(finBefore.totalDisposablePool > 150);
  const splitRes = adjustTeamBudgetSplit(league, 'arsenal', 60, []);
  assert.ok(!splitRes.error);
  league = splitRes.league;
  assert.equal(splitRes.summary.splitRatio, 60);
  assert.ok(splitRes.summary.freeWageBudget > finBefore.freeWageBudget);

  // Test sending a written transfer offer via Mail App (object signature used by app.mjs)
  const offerRes = sendMailTransferOffer(league, {
    fromTeamId: 'arsenal',
    toTeamId: 'bayern',
    playerId: 'p-musiala',
    fee: 110,
    note: 'Sofortiges Top-Gebot',
    players: [],
  });
  assert.ok(!offerRes.error);
  league = offerRes.league;
  assert.ok(offerRes.stage2Session);
  assert.equal(offerRes.stage2Session.playerId, 'p-musiala');

  // Test Stage 2 Agent Contract Offer & Static Drawn Signature Finalization
  const sessionId = offerRes.stage2Session.id;
  const agentOfferRes = submitAgentContractOffer(league, sessionId, {
    salary: offerRes.stage2Session.demandedSalary + 1.0,
    years: 4,
    signingBonus: offerRes.stage2Session.demandedBonus,
    role: 'Schluesselspieler',
  });
  assert.ok(!agentOfferRes.error);
  assert.equal(agentOfferRes.decision, 'accept');
  league = agentOfferRes.league;

  const modalHtml = renderAgentNegotiationModal({ league, session: agentOfferRes.session, players: [] });
  assert.ok(modalHtml.includes('agent-signature-pad-canvas'));

  const finalized = finalizeAgentDealWithSignature(league, sessionId, {
    svgPath: 'M 12 36 L 90 18 L 164 32',
    strokes: [[{ x: 12, y: 36 }, { x: 90, y: 18 }, { x: 164, y: 32 }]],
    signerName: 'Admin',
  });
  assert.ok(!finalized.error);
  assert.equal(finalized.transfer.playerId, 'p-musiala');
  assert.equal(finalized.transfer.buyerTeamId, 'arsenal');
  assert.equal(finalized.transfer.signatureSvgPath, 'M 12 36 L 90 18 L 164 32');

  const sigCardHtml = renderStaticSignatureCard(finalized.transfer, finalized.league);
  assert.ok(sigCardHtml.includes('M 12 36 L 90 18 L 164 32'));
  assert.ok(sigCardHtml.includes('DONE'));

  // Test Mail Inbox & Finance Tab rendering
  const mailHtml = renderMailInboxView({ league: finalized.league, activeManagerTeamId: 'arsenal' });
  assert.ok(mailHtml.includes('mail-offer-compose-form'));
  const finHtml = renderFinanceTabView({ league: finalized.league, activeManagerTeamId: 'arsenal' });
  assert.ok(finHtml.includes('fifa-budget-slider'));

  // Test 15s 120-BPM Deal Done Showreel ("THE IRON SEAL")
  const frame0 = buildShowreelFrameSvg(0, { playerName: 'MUSIALA' });
  const frame12 = buildShowreelFrameSvg(12.25, { playerName: 'MUSIALA' });
  const frame15 = buildShowreelFrameSvg(15.0, { playerName: 'MUSIALA' });
  assert.ok(frame0.includes('<svg'));
  assert.ok(frame12.includes('DONE'));
  assert.equal(frame0, frame15, 'Loop frame at 15.0s must match frame at 0.0s');
});


