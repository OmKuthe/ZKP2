# ZKAttend — Product Requirements Document

## 1. Vision
ZKAttend is a privacy-preserving attendance verification system that proves a
student is physically present at an internship location — without ever
transmitting or storing their exact location, and without requiring
continuous background GPS access. Phase 1 proved feasibility (geofence +
Groth16 ZKP). Phase 2 turns this into a deployable system usable college-wide
during 8th-semester internship season.

## 2. Problem Statement
Existing attendance systems either:
- Collect raw GPS coordinates centrally (privacy + breach risk), or
- Require infrastructure/cooperation companies won't reasonably grant
  (installing software on company networks, continuous background location
  on personal BYOD phones).

There is no lightweight, privacy-preserving, company-friction-minimal system
for verifying internship attendance that also gives a placement cell
auditable records.

## 3. Target Users
| Role | Who | Needs |
|---|---|---|
| T&P Coordinator | College placement cell staff | Cross-company attendance reports, anomaly visibility |
| Company Admin | HR/manager at internship site | Manage their interns, see their own attendance only |
| Student | Interning student | Low-friction daily check-in, privacy of own location |

## 4. Core Features (Phase 2 scope)

### 4.1 Entry Verification
- One-time GPS check on arrival (geofence proof, reusing Phase 1 circuit).
- On success, server issues a rotating (TOTP-style) QR shown on a company
  display.
- Student's app auto-detects the QR (no manual scan button) and generates a
  ZK proof of knowledge of the current token.
- Server verifies proof → entry timestamp recorded.

### 4.2 Session Continuity ("still present" verification)
- After entry, GPS is not used again for the rest of the session.
- App captures a **hashed commitment** of the local environment (WiFi
  BSSIDs, cell IDs, visible BLE devices) as a session reference — raw values
  never leave the device or get stored server-side.
- Every 15–30 min (server-triggered via silent push, not a client timer):
  - App recomputes current environment commitment, proves threshold overlap
    with the reference commitment via ZKP (fuzzy match, not exact).
  - App reveals the next link in a session hash chain (proves session
    continuity / anti-tampering).
- Anomalies (environment mismatch, broken hash chain) are flagged, not
  auto-rejected — reviewed by company admin / T&P.

### 4.3 Exit Verification
- Student opens app, server issues exit QR.
- App re-proves environment match + QR knowledge.
- Session closed, duration computed.

### 4.4 Dashboards
- **T&P Coordinator:** cross-company attendance summary, anomaly list,
  exportable reports.
- **Company Admin:** own interns' attendance, manage geofence/QR display,
  approve/flag anomalies.
- **Student:** today's session status, history.

## 5. Non-Functional Requirements
- **Privacy:** no raw location, WiFi BSSID, or cell ID ever stored — only
  cryptographic commitments and proofs.
- **Low company friction:** no software installed on company infrastructure;
  only a browser tab for the QR display is required.
- **Hostable:** entire backend deployable via Docker Compose on any VPS or
  college server. Single central deployment serves all companies as tenants.
- **Exportable student app:** packaged as an installable APK (Capacitor),
  shareable without app store distribution.

## 6. Out of Scope (Phase 2)
- Work-from-home verification (explicitly descoped — different trust model,
  future work).
- Company-hosted WiFi/BLE infrastructure (descoped due to IT-approval risk;
  see Rules.md for rationale).
- Productivity/activity monitoring of any kind — this system proves
  *presence*, never *activity*.

## 7. Success Criteria
- End-to-end demo: entry → periodic checks → exit, with attendance record
  visible on T&P dashboard.
- No raw location/network data ever appears in the database (verifiable by
  inspection).
- System runs against at least one real company scenario without requiring
  their IT team to install anything.
