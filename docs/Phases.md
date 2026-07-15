# ZKAttend — Project Phases

Ordered by risk: guaranteed-working pieces first, riskiest/most uncertain
pieces last, so a working demo exists at every checkpoint.

## Phase 2A — QR Entry/Exit (core, lowest risk)
- Backend: rotating token generation per company (TOTP-style), Poseidon
  commitment endpoint, proof verification endpoint.
- Circuit: QR knowledge proof (hash preimage).
- Frontend: QR display page (`/display/{company_id}`).
- Mobile: camera auto-detection (no manual scan button), witness + proof
  generation, submission.
- **Milestone:** student can "enter" and "exit" via QR alone, verified
  end-to-end, recorded in DB.

## Phase 2B — Hash Chain Session Integrity
- Backend: session hash-chain root storage, per-check link verification.
- Mobile: chain link reveal on each periodic check (piggybacks on
  whatever wake mechanism is available at this point — can initially be
  manual/foreground-triggered for testing before push is wired up).
- **Milestone:** a session can be shown to break (fail verification) if
  the chain is tampered with or skipped.

## Phase 2C — Environment Commitment + Threshold Match
- Mobile: capture WiFi/BLE/cell environment, compute local hashed
  commitment at entry (reference) and at each check (current).
- Circuit: overlap/threshold proof (fuzzy match, not exact equality).
- Backend: store only commitments, never raw scan data (enforced per
  Rules.md).
- **Milestone:** environment mismatch (student physically leaves) is
  detectable without exact-match false positives from normal signal drift.

## Phase 2D — Server-Triggered Continuity (push wake-up)
- Backend: scheduler that pushes silent notifications every 15-30 min per
  active session.
- Mobile: handle silent push, run 2B + 2C checks on wake, submit combined
  proof.
- **Milestone:** full continuity loop runs without relying on the app
  being kept open or a client-side timer.

## Phase 2E — Dashboards & Multi-Tenant Admin
- T&P Coordinator dashboard: cross-company view, anomaly list, export.
- Company Admin dashboard: extend Phase 1's Admin/Manager pattern with
  new company onboarding (rotation secret issuance, geofence config).
- **Milestone:** a T&P staff member can see attendance across multiple
  companies from one screen.

## Phase 2F — Packaging & Deployment
- Wrap mobile-app in Capacitor, produce installable APK.
- Docker Compose for backend + Postgres, tested on a fresh VPS.
- **Milestone:** system deployable by someone who isn't one of the four of
  you, from a README alone.

## Explicitly Deferred (not a phase, tracked for future work only)
- WFH/remote session verification.
- Company-hosted WiFi/BLE infrastructure mode.
- On-chain verification / ZK-Rollup batching (mentioned in Phase 1 future
  scope, still future scope here).

## Suggested Ownership Split (4 people)
Assign per Phase, not per "GPS person / QR person" — everyone should touch
the full stack once, since the viva will ask any of you about any part.
Recommend: 2 people pair on 2A+2B first (core path), 2 people start 2C in
parallel once circuit design is settled, then swap for 2D/2E/2F.
