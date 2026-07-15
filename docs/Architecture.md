# ZKAttend — Architecture

## 1. High-Level Flow

Student reaches company -> opens app -> one-time GPS geofence check ->
server issues rotating QR -> app auto-detects QR -> ZK proof of QR token ->
entry recorded -> app commits local environment profile (hashed) -> session
starts -> every 15-30 min: server push wakes app -> environment-overlap ZK
proof + hash-chain reveal -> student leaves -> exit QR -> environment +
QR proof -> session closed -> attendance summary stored.

## 2. System Components

- **Central Backend (FastAPI)** — single deployment, multi-tenant (one row
  per company). Owns: auth, QR/token rotation, proof verification, push
  notification scheduling, attendance records.
- **Postgres** — companies, students, internships, sessions, attendance
  logs, anomaly flags. Never stores raw location/network data — only
  commitments, hashes, and proof verification results.
- **QR Display Page (React)** — a route like `/display/{company_id}`,
  opened on any screen/tablet at the company. Polls backend for current
  rotating token, renders as QR.
- **Student App (React + Capacitor)** — camera-based QR auto-detection,
  in-app snarkjs proof generation (WASM), background wake via push
  notification, packaged as APK for direct install.
- **T&P / Company Admin Dashboards (React, existing Phase 1 base)** —
  extend existing Admin/Manager pattern; add T&P role above Company Admin.
- **ZK Circuits (Circom + snarkjs)** — three circuits, see section 4.

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | FastAPI | existing, async, reused from Phase 1 |
| DB | PostgreSQL | relational, handles tenant/session structure |
| Frontend (web) | React + Vite + Tailwind | existing, reused |
| Mobile app | React + Capacitor | wraps existing frontend, native camera + push |
| ZK toolchain | Circom + snarkjs | existing, Groth16, BN254 |
| Push notifications | FCM (Android) / APNs (iOS) | server-triggered wake, not client timers |
| Deployment | Docker Compose | single command spin-up, self-hostable |
| Auth | JWT | existing pattern from Phase 1 |

## 4. Circuits

1. **Geofence circuit** (Phase 1, reused) — one-time entry gate only.
2. **QR knowledge proof** — Poseidon hash preimage:
   `Poseidon(student_secret, time_window) == commitment_on_QR`.
   Used at entry and exit.
3. **Session continuity circuit** — combines:
   - Threshold/overlap proof: current environment commitment shares >= N
     elements with reference commitment (fuzzy match, not exact equality).
   - Hash chain reveal: `H(next_link) == previous_stored_link`.
   Used every 15-30 min and at exit.

## 5. Suggested Folder Structure

```
zkattend/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── auth/
│   │   ├── companies/          # tenant management
│   │   ├── students/
│   │   ├── sessions/           # entry/exit/continuity logic
│   │   ├── proofs/             # verification key loading, proof checks
│   │   ├── push/               # FCM/APNs scheduling
│   │   └── db/                 # models, migrations
│   ├── circuits/
│   │   ├── geofence/
│   │   ├── qr_proof/
│   │   └── session_continuity/
│   ├── docker-compose.yml
│   └── requirements.txt
├── frontend-web/                # T&P + company admin dashboards, QR display
│   ├── src/
│   │   ├── pages/
│   │   │   ├── display/         # QR display route
│   │   │   ├── tp-dashboard/
│   │   │   └── company-admin/
│   │   └── components/
├── mobile-app/                  # Capacitor-wrapped student app
│   ├── src/
│   │   ├── screens/
│   │   ├── zk/                  # wasm witness gen + snarkjs calls
│   │   └── native/              # camera, push handling
│   └── capacitor.config.ts
└── docs/                        # this documentation set
    ├── PRD.md
    ├── Architecture.md
    ├── Rules.md
    ├── Phases.md
    ├── Design.md
    └── Memory.md
```

## 6. Data Model (core entities)

- `Company(id, name, geofence_center, geofence_radius, rotation_secret)`
- `Student(id, name, company_id, device_secret)`
- `Session(id, student_id, entry_time, exit_time, reference_commitment,
  hash_chain_root, status)`
- `ContinuityCheck(id, session_id, timestamp, overlap_result, chain_valid,
  anomaly_flag)`
