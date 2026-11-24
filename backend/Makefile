# backend/Makefile — Phase 0/1 developer targets
# Usage:
#   make dev-v1                  # run V1 on :8000 with v1.db
#   make dev-v2                  # run V2 on :8001 with v2.db
#   make migrate-v2-dry CONFIRM_TZ=MIXED
#   make migrate-v2    CONFIRM_TZ=MIXED
#   make test-v2
#
# Env overrides:
#   CONFIRM_TZ   required by migration targets
#   PYTHON       python interpreter (default: python3)

PYTHON ?= python3
CONFIRM_TZ ?=

.PHONY: dev-v1 dev-v2 migrate-v2-dry migrate-v2 test-v2 copy-db help

help:
	@echo "Targets:"
	@echo "  dev-v1              run V1 on :8000 (v1.db)"
	@echo "  dev-v2              run V2 on :8001 (v2.db)"
	@echo "  copy-db             cp v1.db v2.db (once, before migrate)"
	@echo "  migrate-v2-dry      dry-run migration (CONFIRM_TZ=UTC|Asia/Kolkata|MIXED)"
	@echo "  migrate-v2          apply migration"
	@echo "  test-v2             run Phase 1 exit-criteria queries on v2.db"

dev-v1:
	DATABASE_URL=sqlite:///./v1.db \
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

dev-v2:
	DATABASE_URL=sqlite:///./v2.db \
	V2_WRITE_EVENTS=true \
	V2_CHALLENGES_ENABLED=false \
	REVERIFY_TIMEOUT_MIN=5 \
	DEFAULT_COMPANY_TZ=Asia/Kolkata \
	uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

copy-db:
	@test -f v1.db || (echo "❌ v1.db not found"; exit 1)
	cp v1.db v2.db
	@echo "✅ v2.db copied from v1.db"

migrate-v2-dry:
	@test -n "$(CONFIRM_TZ)" || (echo "❌ CONFIRM_TZ required (UTC|Asia/Kolkata|MIXED)"; exit 1)
	DATABASE_URL=sqlite:///./v2.db \
	$(PYTHON) -m migrations.v1_to_v2 --dry-run --confirm-tz=$(CONFIRM_TZ)

migrate-v2:
	@test -n "$(CONFIRM_TZ)" || (echo "❌ CONFIRM_TZ required (UTC|Asia/Kolkata|MIXED)"; exit 1)
	DATABASE_URL=sqlite:///./v2.db \
	$(PYTHON) -m migrations.v1_to_v2 --confirm-tz=$(CONFIRM_TZ)

test-v2:
	@echo "== schema_migrations =="
	@sqlite3 v2.db "SELECT name, applied_at FROM schema_migrations;"
	@echo "== users by role =="
	@sqlite3 v2.db "SELECT role, COUNT(*) FROM users GROUP BY role;"
	@echo "== sessions by status =="
	@sqlite3 v2.db "SELECT status, COUNT(*) FROM sessions GROUP BY status;"
	@echo "== verification_events by layer/type =="
	@sqlite3 v2.db "SELECT layer, event_type, COUNT(*) FROM verification_events GROUP BY layer, event_type;"
	@echo "== heartbeats (backfilled vs new) =="
	@sqlite3 v2.db "SELECT backfilled, COUNT(*) FROM heartbeats GROUP BY backfilled;"
	@echo "== anomalies by status =="
	@sqlite3 v2.db "SELECT status, COUNT(*) FROM anomalies GROUP BY status;"
	@echo "== sessions.internship_id populated =="
	@sqlite3 v2.db "SELECT (internship_id IS NOT NULL) AS has_internship, COUNT(*) FROM sessions GROUP BY has_internship;"