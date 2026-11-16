import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, simulateThroughDate } from '../src/calendar-core.mjs';
import { renderCalendarView, renderStandingsTable } from '../src/calendar-view.mjs';
import { renderClubPageView, renderMatchReportModal } from '../src/club-page-view.mjs';

const teams = Array.from({ length: 30 }, (_, index) => ({ id: `t${index + 1}`, name: `Team ${index + 1}`, managerType: index === 0 || index === 29 ? 'human' : 'cpu' }));

test('renders calendar, transfer deadlines, host simulation and highlighted human fixture', () => {
  const schedule = buildSchedule(teams);
  const league = { teams, schedule, currentDate: '2026-07-31', matchHistory: [] };
  const html = renderCalendarView({ league, selectedDate: '2026-08-01', canAdvance: true });
  assert.match(html, /Der Kalender/);
  assert.match(html, /HOST STEUERT SIMULATION/);
  assert.match(html, /data-action="simulate-calendar"/);
  assert.match(html, /Sommer-Deadline/);
  assert.match(html, /Mensch-gegen-Mensch · manuell eintragen/);
  assert.match(html, /calendar-fixture[^>]*is-human-match/);
});

test('calendar renderer escapes team names and disables simulation for other managers', () => {
  const hostileTeams = teams.map((team) => ({ ...team }));
  hostileTeams[0].name = '<script>bad()</script>';
  const html = renderCalendarView({ league: { teams: hostileTeams, schedule: buildSchedule(hostileTeams), currentDate: '2026-07-31', matchHistory: [] }, selectedDate: '2026-08-01' });
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.doesNotMatch(html, /<script>bad/);
  assert.match(html, /data-action="simulate-calendar" disabled/);
  assert.match(html, /id="calendar-target-date"[^>]*disabled/);
});

test('calendar view includes next matches, selected day, transfer deadlines, league progress, open human games, standings table, and trophy-style human aura controls', () => {
  const schedule = buildSchedule(teams, '2026-08-01');
  const league = { teams, schedule, currentDate: '2026-08-01', matchHistory: [{ fixtureId: schedule[1].id, homeId: schedule[1].homeId, awayId: schedule[1].awayId, homeScore: 2, awayScore: 0 }] };
  const html = renderCalendarView({ league, selectedDate: '2026-08-01', canAdvance: true });
  assert.match(html, /Nächste Spiele|Als Nächstes/);
  assert.match(html, /Ausgewählter Tag/);
  assert.match(html, /Transferfristen/);
  assert.match(html, /Liga-Fortschritt/);
  assert.match(html, /Offene Mensch-gegen-Mensch-Spiele/);
  assert.match(html, /Ligatabelle/);
  assert.match(html, /human-aura-card/);
  assert.match(html, /trophy-shimmer-sweep/);
  assert.match(html, /data-action="approve-human-fixture"/);
  assert.match(html, /data-action="launch-pes-fixture"/);
  assert.match(html, /career-week-ribbon/);
});

test('standings table links to club page, supports scorers subtab, and club page + match report render full telemetry', () => {
  const cpuTeams = Array.from({ length: 30 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Club ${index + 1}`,
    managerType: 'cpu',
  }));
  const schedule = buildSchedule(cpuTeams, '2026-08-01');
  const picks = [];
  for (const t of cpuTeams) {
    picks.push({ playerId: `${t.id}-st`, playerName: `${t.name} Striker`, position: 'ST', rating: 88, teamId: t.id, teamName: t.name });
    picks.push({ playerId: `${t.id}-cm`, playerName: `${t.name} Playmaker`, position: 'CAM', rating: 85, teamId: t.id, teamName: t.name });
    picks.push({ playerId: `${t.id}-cb`, playerName: `${t.name} Defender`, position: 'CB', rating: 82, teamId: t.id, teamName: t.name });
    picks.push({ playerId: `${t.id}-gk`, playerName: `${t.name} Keeper`, position: 'GK', rating: 84, teamId: t.id, teamName: t.name });
  }
  const sim = simulateThroughDate(
    { teams: cpuTeams, schedule, currentDate: '2026-08-01', matchHistory: [], draft: { picks } },
    '2026-08-05',
    { isHost: true },
  );
  assert.equal(sim.error, undefined);

  const tableHtml = renderStandingsTable(sim.league, { subTab: 'table' });
  assert.match(tableHtml, /data-action="open-club-page"/);
  assert.match(tableHtml, /data-subtab="scorers"/);

  const scorersHtml = renderStandingsTable(sim.league, { subTab: 'scorers' });
  assert.match(scorersHtml, /Offizielle Torjägerliste/);

  for (const tab of ['overview', 'roster', 'lineup', 'matches']) {
    const clubHtml = renderClubPageView({ league: sim.league, teamId: 't1', activeTab: tab });
    assert.match(clubHtml, /Club 1/);
    assert.match(clubHtml, /data-action="set-club-page-tab"/);
  }

  const completedFixture = sim.league.schedule.find((f) => f.status === 'completed');
  assert.ok(completedFixture);
  const reportHtml = renderMatchReportModal(sim.league, completedFixture.id);
  assert.match(reportHtml, /Expected Goals \(xG\)/);
  assert.match(reportHtml, /Ballbesitz \(Pass-Share\)/);
  assert.match(reportHtml, /Multi-Seed Simulations-Prognose/);
  assert.match(reportHtml, /Startelf, Spieler-Telemetrie/);
});



