# Local Manager Transfer Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let two browser profiles on one computer share one local Career league, select separate manager identities, and run silent human/CPU transfer calls with offers and counteroffers.

**Architecture:** Keep the existing vanilla frontend and Node HTTP server. Add a file-backed local state API, a per-tab manager identity, and a transfer state machine. The server remains loopback-only; this is a same-machine test harness, not public multiplayer.

**Tech Stack:** Node.js built-ins, browser `fetch`, `sessionStorage`, and existing Node test runner; no new package dependencies.

**Spec:** `docs/specs/career-online-transfers.md` (local test milestone section; no ringtone per user's latest request).

## Global Constraints

- Login and registration stay absent.
- Preserve existing local browser data and migrate it only when the shared server has no saved state.
- The Node server stays bound to `127.0.0.1`.
- No ringtone, voice call, external game launch, commit, or push.
- The actual FM26 roster CSV is not present; do not fabricate roster records.

## Review Focus

- Two browsers opening simultaneously must not silently replace a league state; cover revision conflicts with a test.
- A call must be visible only to its target manager and answer/decline must update shared state; cover transitions with tests.
- Transfers must reject an unknown or unowned player and leave rosters unchanged; cover invalid ownership with a test.
- CPU response must vary with table position/need and remain deterministic for a saved call; cover boundary positions and seeded outcome with tests.
- User-generated state must not be served as a static file; cover route access denial or verify through server integration test.

## File Map

- Create `src/shared-state.mjs`: atomic local JSON store, revision checks, and loopback API helpers.
- Modify `src/server.mjs`: private state endpoints, presence tracking, and static access exclusions.
- Create `src/transfer-core.mjs`: match-table calculation, call states, CPU response, and offer/transfer validation.
- Modify `src/app.mjs`: async shared-state bootstrap, polling, session manager picker, call page/dialog, and offer controls.
- Modify `index.html` and `styles.css`: transfer navigation, manager selector shell, call/offer presentation.
- Create `tests/shared-state.test.mjs` and `tests/transfer-core.test.mjs`.
- Update `README.md`: distinguish same-machine simulation from real online multiplayer and record how to open two browsers.

## Tasks

### Task 1: File-backed shared state API

**Files:** Create `src/shared-state.mjs`, modify `src/server.mjs`, create `tests/shared-state.test.mjs`.

**Interface:** `createSharedStateStore(filePath)` exposes `read()` returning `{revision, state}` and `write(state, expectedRevision)` returning the updated envelope or a conflict containing the current envelope. JSON is stored under ignored `runtime-data/`; the server exposes `GET /api/state` and `PUT /api/state`, rejects bodies larger than 2 MiB, and never serves `runtime-data/` as static content.

- [ ] Write failing tests for first write, revision conflict preserving the newer state, and static path denial.
- [ ] Run those tests and confirm the expected failures.
- [ ] Implement the store and API with temporary-file plus rename persistence.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Per-browser manager identity and shared-state sync

**Files:** Modify `src/app.mjs`, `index.html`, and `styles.css`.

**Interface:** The selected manager ID is kept in `sessionStorage`, independent per browser session. On startup, the app hydrates from local browser state if the server has no state; otherwise it hydrates from the shared server. Saves send the expected revision; a 409 refreshes the current shared state and shows a conflict message. A 1.5-second poll refreshes newer server revisions without overwriting focused form input. The selector can choose any league team for the local simulation, including a CPU team.

- [ ] Add tests for the identity/state normalization helpers in a new exported module or the existing core test file.
- [ ] Verify the new tests fail before implementation.
- [ ] Implement bootstrap, safe legacy adoption, per-session selection, polling, and UI status.
- [ ] Run the focused and full existing Node test suite.

### Task 3: Transfer call and offer state machine

**Files:** Create `src/transfer-core.mjs`, create/update `tests/transfer-core.test.mjs`.

**Interface:** `createCall(league, callerTeamId, targetTeamId, now)` adds a `ringing` call; `respondToCall(league, callId, managerTeamId, decision, now)` accepts or declines only for the target; `submitOffer(league, callId, managerTeamId, {playerId, fee}, now)` appends a proposal or counter; `acceptOffer(league, callId, managerTeamId, now)` verifies ownership and a nonnegative fee, changes the drafted player's team, and appends the transfer to history. All operations return `{league, error}` without mutation on failure. `rankTeamsFromResults(teams, results)` derives position from played results; `cpuAnswersCall({rank, teamCount, rosterNeed, randomValue})` returns a deterministic answer decision for a saved random value.

- [ ] Write failing tests for call transitions, target-only response, duplicate response rejection, offer/counter behavior, invalid ownership, valid transfer, and CPU rank sensitivity.
- [ ] Run tests and confirm the expected failures.
- [ ] Implement the pure state transitions and standings calculation.
- [ ] Run focused tests, then the full suite.

### Task 4: Transfer center UI and browser verification

**Files:** Modify `src/app.mjs`, `index.html`, `styles.css`, and `README.md`.

- [ ] Add the Transferzentrale view with manager contacts, a silent incoming-call overlay, accept/decline/hang-up, and an offer/counter/accept/reject room.
- [ ] Route human calls to the selected recipient session; simulate a CPU response after a short delay using current table rank and roster need when no browser session owns that team.
- [ ] Save state changes through the shared API and append all call/offer/transfer actions to the existing admin log.
- [ ] Run `node --test` and fix failures.
- [ ] Run the local server, open its URL in two different browser profiles, select separate manager teams, place a call, answer, and verify both browsers show the same offer and accepted transfer.
- [ ] Confirm the state file is inaccessible over HTTP, existing setup/draft/match screens still work, and no audio plays.

No commit or push is included. The user will review the uncommitted result before any integration step.
