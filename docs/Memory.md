# ZKAttend — Project Memory Log

Update this file at the end of every work session (human or AI-assisted).
Newest entries at the top. Keep entries short — decisions and status, not
conversation transcripts.

---

## [Planning] Phase 2 direction finalized
**Status:** Design decided, not yet implemented.

**Decisions made:**
- Phase 2 task chosen: QR Code + ZKP (from guide's 4 options), scoped
  broader than the other 3 groups' tasks due to guide's request to build a
  real deployable product for 8th-sem internship season.
- Final architecture: one-time GPS geofence check at entry only -> rotating
  QR (TOTP-style) for entry/exit ZK proof -> hashed environment commitment
  (WiFi/BLE/cell) + hash-chain reveal for periodic continuity checks ->
  exit QR + environment re-check.
- Explicitly descoped: WFH verification, company-hosted WiFi/BLE
  infrastructure (IT-approval risk ruled out after discussion), any
  activity/productivity monitoring.
- Multi-tenant central server model chosen over per-company hosting —
  T&P coordinator is a role above company admin, one deployment serves all
  companies.
- Student app will be packaged via Capacitor (wraps existing React
  frontend) for direct APK sharing with the batch, not a Play Store
  release.
- Six planning docs created (this set) to keep AI coding agents aligned:
  PRD.md, Architecture.md, Rules.md, Phases.md, Design.md, Memory.md.

**Open questions for guide (not yet answered):**
- Who hosts/owns the central server long-term once handed over for real
  8th-sem use (T&P office vs department vs the four of you)?
- Does he want all of Phases 2A-2F working for evaluation, or is 2A+2B core
  with 2C/2D/2E/2F acceptable as documented future work if time runs out?

**Known risks flagged, not yet resolved:**
- Background execution limits on iOS/Android for periodic checks — plan is
  server-triggered push (FCM/APNs), not client timers, but not yet tested.
- Environment-commitment threshold matching needs real tuning (how much
  overlap counts as "still present") — not yet designed in circuit form.
- "GPS disabled" framing must be stated accurately to guide/panel: location
  *permission* is still required once (for the entry check and for reading
  WiFi/cell info), it's continuous raw-GPS *usage* that's removed, not the
  permission itself.

**Codebase:** not yet shared/linked in this doc — link repository here
once available.

---

## [Reference] Phase 1 summary (completed, prior submission)
- ZKAttend Phase 1: Groth16 zkSNARK circuit (Circom, ~15 constraints) proves
  a user is within a circular geofence without revealing coordinates.
- Stack used: Circom + snarkjs (BN254), React + Vite + Tailwind frontend,
  Python/FastAPI backend for server-side verification.
- Results: ~466ms proof generation, ~21ms verification, ~722 byte proof
  size (see submitted report, Chapter 4).
- Existing roles/dashboards: Student, Manager, Admin — company entity
  already modeled, "Export Report" pattern already exists.
