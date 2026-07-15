# ZKAttend — Rules for AI Coding Agents

These rules apply to any AI agent (Claude, ChatGPT, DeepSeek, etc.) working
on this codebase. Read this before generating code.

## 1. Privacy invariants — never violate these
- **Never store raw GPS coordinates** anywhere server-side, in logs, or in
  any database table, beyond the single one-time entry geofence check
  (which itself should only ever see a boolean pass/fail from the ZK proof,
  never coordinates in the clear).
- **Never store raw WiFi SSIDs/BSSIDs, cell tower IDs, or BLE device IDs.**
  Only hashed commitments may be persisted. If you find yourself writing a
  DB column for any of these raw values, stop and flag it — that's a bug.
- **Never log proof private inputs** (student secrets, raw environment
  scans) even at debug level.
- Any feature request that implies "just store the location for now, we'll
  fix privacy later" should be pushed back on, not implemented — this is a
  final-year ZKP thesis; leaking the thing we're proving we don't leak
  undermines the entire project.

## 2. Cryptography boundaries
- **Do not invent new circuit logic without spec review.** All three
  circuits (geofence, QR proof, session continuity) have an agreed
  mathematical definition in Architecture.md — implement exactly that, ask
  before changing constraints.
- Use **Circom + snarkjs + Groth16 over BN254** — consistent with Phase 1,
  do not introduce a second proof system (e.g. no PLONK, no Halo2) without
  explicit discussion; consistency matters for the report.
- Use **Poseidon** for in-circuit hashing (circomlib), not SHA-256 inside
  circuits — Poseidon is arithmetic-circuit-friendly and already used in
  Phase 1's Fiat-Shamir transcript.
- Hash chain construction: use a standard cryptographic hash off-circuit is
  acceptable for the chain itself; only the *reveal check* needs to happen
  in a verifiable way — confirm with the team before assuming this needs a
  circuit at all (it may be checkable server-side without ZK if no private
  input is involved).

## 3. Mobile platform rules
- **Never call location-flavored APIs** for WiFi/BLE scanning
  (`CLBeaconRegion` on iOS, anything requiring `ACCESS_FINE_LOCATION` on
  Android beyond the one-time entry check). Use `neverForLocation` BLE scan
  flags (Android 12+) and direct service-UUID CoreBluetooth scanning (iOS).
- **Do not rely on client-side timers for periodic checks.** Background
  execution is throttled on both platforms — use server-triggered silent
  push (FCM/APNs) to wake the app for each continuity check.
- Camera-based QR detection only needs camera permission — do not
  request location permission for this step.

## 4. Backend/library conventions
- Backend: FastAPI, Python. Use Pydantic models for all request/response
  schemas — no raw dict passing across route boundaries.
- DB: PostgreSQL via SQLAlchemy (or the team's chosen ORM) — no raw SQL
  string concatenation, always parameterized queries.
- Auth: JWT, consistent with Phase 1. Do not introduce a second auth
  scheme for a subset of routes.
- All new companies/tenants must go through the same onboarding flow — no
  hardcoded company-specific logic in route handlers.

## 5. Error handling
- Every proof verification endpoint must return a clear
  valid/invalid/error distinction — never silently treat a verification
  error as "invalid" (a crashed verifier is not the same as a rejected
  proof; log and surface differently).
- Anomalies (environment mismatch, broken hash chain) must be **flagged for
  review, not auto-rejected** — see PRD.md 4.2. Do not write logic that
  silently ends a session on a single failed check; require a policy
  (e.g. N consecutive failures) agreed with the team first.

## 6. What NOT to build (explicitly descoped)
- No company-hosted WiFi/BLE server or beacon requiring company IT
  cooperation — descoped due to real-world adoption risk (see PRD.md
  section 6).
- No WFH/remote verification in this phase.
- No activity/productivity monitoring (keystrokes, screenshots, app usage)
  — out of scope and against the project's privacy thesis.

## 7. When in doubt
If a request from a teammate implies loosening a privacy invariant, adding
a new crypto primitive, or scope creep beyond Phases.md — implement the
smallest reversible version and flag it for discussion rather than
committing fully. Update Memory.md with any deviation from this document so
the next session (human or AI) knows what changed and why.
