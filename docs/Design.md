# ZKAttend — Design System

This extends the visual language already established in the Phase 1 demo
(login screen, student/admin dashboards) rather than introducing a new
look for Phase 2 — consistency across phases matters for the final demo.

## 1. Color Palette

| Role | Color | Usage |
|---|---|---|
| Primary | Indigo/Purple (`#4F46E5` range) | Primary buttons, active states, login gradient — matches existing login screen |
| Background | Soft lavender gradient | App shell background, matches existing login screen |
| Success | Green (`#16A34A` range) | Verified checkmarks, "Present", valid proofs |
| Warning/Active | Amber/Orange (`#F59E0B` range) | Active internship banner, in-progress states |
| Danger | Red (`#DC2626` range) | Anomalies, logout, invalid proofs |
| Neutral text | Slate gray scale | Body text, secondary labels |
| Surface | White / very light gray cards | Dashboard cards, consistent with existing Manager/Admin dashboards |

**Note:** exact hex values should be pulled from the existing Phase 1
frontend's Tailwind config once the codebase is shared, rather than
guessed — this table is a starting reference, confirm against the real
`tailwind.config.js` before applying broadly.

## 2. Typography
- **Font family:** system-first stack (`Inter`, or platform default sans)
  for readability across dashboard-heavy screens — matches the clean,
  non-decorative look of the existing login/dashboard screens.
- **Headings:** semi-bold, sentence case (matches "Student / Intern
  Dashboard", "Manager Dashboard" style already used).
- **Body:** regular weight, comfortable line height for data-dense
  dashboard tables (attendance logs, anomaly lists).
- **Numeric/status displays** (hours tracked, live timer): slightly larger,
  medium weight — matches existing "0.0 hrs" / "0m 0s" display style.

## 3. Component Patterns (reuse from Phase 1)
- **Cards with rounded corners** for dashboard stat blocks (Today's Total
  Time, Live Tracking Time, etc.) — keep this pattern for new stats
  (session anomalies, continuity check status).
- **Colored banner strip** for current status (existing orange "Active
  Internship" banner) — reuse this pattern for "Session Active" /
  "Anomaly Detected" states, swapping color per status (amber = active,
  red = anomaly, green = completed normally).
- **Timeline list** (existing "Today's Timeline" with Entry/Periodic
  Check/Exit rows) — extend directly for Phase 2's periodic continuity
  checks; this component already fits the new data shape almost exactly.

## 4. New Components Needed for Phase 2
- **QR display screen** (company-facing): large centered QR, subtle
  rotating-countdown indicator (e.g. a thin progress ring) so company staff
  can see it's live, not stale.
- **Anomaly badge:** small inline indicator on timeline entries, distinct
  from the existing green "Verified" checkmark — suggest amber triangle
  icon, not full red, since anomalies are flagged for review, not
  automatic failures (per Rules.md section 5).
- **T&P cross-company table:** company name, active students, today's
  attendance %, anomaly count — sortable, exportable (reuse existing
  "Export Report" button pattern from Manager Dashboard).

## 5. Icons
- Continue using the existing icon set/style visible in dashboards
  (clock, location pin, calendar icons in current Student Dashboard) —
  introduce BLE/WiFi icons only for internal/debug views, not
  student-facing UI (students shouldn't need to think about environment
  fingerprinting mechanics at all).
