# FIFA 17 Private Multiplayer Feasibility Plan

> **For agentic workers:** Use `superpowers:executing-plans` to carry out this phase task by task. Steps use checkbox syntax for tracking.

**Goal:** Establish whether a lightweight SuperLeague client and private lobby service can launch and coordinate a real FIFA 17 PC 1v1 match without streaming.

**Architecture:** Phase 0 is a bounded feasibility investigation, not a FIFA patch or a full server implementation. The SuperLeague web service remains authoritative for fixtures and career data; a prospective lobby service coordinates two clients, while FIFA clients handle gameplay. A go decision requires evidence from two separate FIFA 17 clients completing a match through the proposed session path.

**Tech Stack:** Existing SuperLeague Node.js app, the existing Python FIFA 17 bridge and public protocol research, Windows 10/11, Frosty Mod Manager, and network captures from legitimate FIFA 17 installations. No new runtime dependency is introduced in this phase.

**Spec:** `C:\Users\anton\Documents\Codex\2026-11-16\superpowers-plugin-superpowers-openai-curated-remote\outputs\SuperLeague-FIFA17-Client-Design.md`

## Global Constraints

- The user wants a compact Windows client, browser-to-client launch, mods, a real 1v1 match, and results returned to SuperLeague.
- The existing SuperLeague checkout contains earlier uncommitted bridge changes; preserve every existing modified file.
- Do not modify FIFA, Frosty, EA App, Windows certificates, Windows hosts, router settings, or the user's Aurora executable in Phase 0.
- Do not bypass game ownership, EA entitlement checks, DRM, or authentication.
- Do not claim online 1v1 support until two separate clients complete a real FIFA match.
- Do not treat a lobby REST endpoint, redirector response, or TCP capture as proof that matchmaking or gameplay works.
- Do not add or run automated tests during this research phase; produce inspectable evidence and a go/no-go report instead.

## Review Focus

- **Only one FIFA client is available:** the report must label actual two-client compatibility unproven and identify the exact missing evidence.
- **FIFA/mod builds differ:** the proposed client must require matching game-build, mod-pack, and squad fingerprints before attempting a session.
- **Redirector reaches a capture probe:** the report must distinguish observed connection setup from a Blaze/FUT/Online Friendlies implementation.
- **Online Friendlies require session signaling:** the report must identify which room, invite, authentication, and peer-address steps are known versus unknown.
- **Match telemetry is unavailable:** the result plan must distinguish match connectivity from automatic score, stats, and player-rating capture.

---

### Task 1: Record the current implementation boundary

**Files:**
- Read: `tools/fifa17-bridge/README.de.md`
- Read: `docs/superpowers/specs/2026-11-16-fifa17-bridge-design.md`
- Read: `docs/superpowers/plans/2026-11-16-fifa17-superleague-bridge.md`
- Read: [FIFA17-Private-Server README](https://github.com/rplm10/FIFA17-Private-Server/blob/main/README.md)
- Read: [server/redirector.py](https://github.com/rplm10/FIFA17-Private-Server/blob/main/server/redirector.py), [server/probe.py](https://github.com/rplm10/FIFA17-Private-Server/blob/main/server/probe.py), and [server/http_server.py](https://github.com/rplm10/FIFA17-Private-Server/blob/main/server/http_server.py)
- Create: `docs/superpowers/research/2026-11-20-fifa17-online-session-feasibility.md`

**Interfaces:**
- Consumes: current repository files and public source/documentation links.
- Produces: an evidence table with `claim`, `evidence`, `status` (`confirmed`, `inferred`, or `unknown`), and `next evidence needed`.

- [x] Inspect the current bridge files and public server source read-only; record which endpoints return application data, which paths only redirect, and which listeners only capture bytes.
- [x] Separate SuperLeague lobby state (`/api/pes-bridge/lobby`) from FIFA's own online-friend invite and session establishment.
- [x] Record the online-service shutdown evidence and the limits of applying later FIFA P2P descriptions to FIFA 17.
- [x] Write the evidence table and a short protocol flow sketch in the research report; do not copy third-party implementation code into SuperLeague.
- [x] Check the new report against the exact reviewed source files and links; mark every unsupported statement as `inferred` or `unknown`.

### Task 2: Define the two-client test prerequisites

**Files:**
- Modify: `docs/superpowers/research/2026-11-20-fifa17-online-session-feasibility.md`

**Interfaces:**
- Produces: a preflight checklist for two separate Windows PCs, both with a legitimate FIFA 17 PC installation and matching FIFA/mod/squad builds.

- [x] Specify the required inputs: two reachable PCs, exact FIFA build, Frosty version/profile, mod-pack fingerprint, current SuperLeague `dbHash`, and one test fixture.
- [x] Define observable success for each client: same room/fixture, both ready, FIFA starts, both enter the same live match, match completes, and the result is attributable to the fixture.
- [x] Define observable failure states: client exits before room creation, authentication/service failure, invite/session failure, peer connection failure, desync, or result unavailable.
- [x] Mark any test requiring system certificate trust, HOSTS edits, injection, or EA/DRM changes as out of scope for this plan until it has a separate reviewed design.
- [x] State plainly that local single-PC tests, a mocked REST response, or Parsec streaming do not satisfy the two-client success criterion.

### Task 3: Decide whether a bounded protocol prototype is justified

**Files:**
- Modify: `docs/superpowers/research/2026-11-20-fifa17-online-session-feasibility.md`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: a decision of `go`, `no-go`, or `blocked`, with concrete evidence and the smallest next experiment.

- [x] Map the minimum missing path between lobby readiness and a live FIFA match: authentication state, redirector response, game-service protocol, room/invite signaling, peer-address exchange, and match completion.
- [x] Identify which path can be observed without modifying the game or system trust store; separate passive observations from active redirection.
- [x] If two eligible clients are unavailable, classify the real-match gate as `blocked` and finish only the static evidence report; do not represent the result as proven.
- [x] No safe active experiment was available within this plan's scope; the report specifies why and the prerequisite for a separately reviewed attempt.
- [x] Recommend a separate implementation plan for the custom session service only if the evidence shows an actionable route to a real client session; otherwise recommend the minimal viable alternative for the user to choose.

### Task 4: Review the Phase 0 outcome

**Files:**
- Modify: `docs/superpowers/research/2026-11-20-fifa17-online-session-feasibility.md`

**Interfaces:**
- Produces: a concise decision report suitable for approving or rejecting further server/client implementation.

- [x] Summarize that no real client was run, identify what remains inferred, and state what could not be tested.
- [x] Give separate decisions for private lobby, real 1v1 gameplay, automatic FIFA launch into the match, and result/stat capture.
- [x] Recommend the smallest next step and list any required user-provided setup, especially the second compatible FIFA client.
- [x] Do not begin the desktop launcher or claim automatic Online Friendlies support in this Phase 0 report.

## Handoff Notes

- The approved product direction is one integrated SuperLeague Windows client with a hosted lobby service and a genuine, non-streamed FIFA match.
- The user selected native in-session execution earlier.
- The current working checkout is a regular checkout on `codex/fifa17-bridge` with pre-existing uncommitted bridge work. This plan adds one file only; implementation should happen in an isolated worktree after plan review.
