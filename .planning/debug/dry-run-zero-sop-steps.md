---
status: awaiting_human_verify
trigger: "Skill Dry Run shows 已覆盖 0/0 个 SOP 步骤 after clicking Dry Run button"
created: 2026-04-27T00:00:00Z
updated: 2026-04-27T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED — Race condition: background task cannot see uncommitted DryRun row
test: Fix applied, all 68 tests pass, lint clean
expecting: User verifies dry run now produces non-zero SOP coverage in live environment
next_action: Await human verification

## Symptoms

expected: After clicking Dry Run, simulation runs (1-3 min), extracts SOP steps, simulates conversation, produces report with coverage like "3/5 SOP steps covered"
actual: UI shows "已覆盖 0/0 个 SOP 步骤" — both total and covered are 0
errors: No visible error messages — just 0/0 display
reproduction: Click Dry Run button on a skill with content, wait for result
started: First time feature tested in live environment; unit tests pass with mocked data

## Eliminated

## Evidence

- timestamp: 2026-04-27T00:00:30Z
  checked: backend/app/api/dry_runs.py endpoint flow
  found: Line 33-36 — create_dry_run + flush + create_task + return. The db session commit happens in get_db() AFTER the endpoint returns. The background task is scheduled via asyncio.create_task() before commit.
  implication: Background task opens own AsyncSessionLocal but main request hasn't committed yet.

- timestamp: 2026-04-27T00:00:40Z
  checked: backend/app/services/dry_run_engine.py line 405-411
  found: Background task does `async with AsyncSessionLocal() as db:` then `await db.get(DryRun, dry_run_id)`. If DryRun not found, logs error and returns silently. No retry logic.
  implication: With SQLite, uncommitted data from another session/connection is invisible. The DryRun row created by the main request is NOT visible to the background task's new session.

- timestamp: 2026-04-27T00:00:50Z
  checked: backend/.env and backend/app/database.py
  found: DATABASE_URL=sqlite+aiosqlite:///./ai_coach.db. SQLite WAL mode enabled. flush() writes to WAL but does NOT make data visible to other connections — only commit() does.
  implication: This is the exact condition for the race: flush without commit + new connection = invisible row.

- timestamp: 2026-04-27T00:00:55Z
  checked: backend/app/database.py get_db() dependency
  found: get_db() is a yield-based dependency. The commit happens AFTER the endpoint returns (in the cleanup phase). The background task is already scheduled by then.
  implication: Timeline is: flush -> create_task -> return -> (FastAPI sends response) -> commit. The background task can start executing before commit happens.

- timestamp: 2026-04-27T00:01:30Z
  checked: Fix applied and verified
  found: Changed `await db.flush()` to `await db.commit()` in backend/app/api/dry_runs.py line 37. All 68 tests pass. Ruff lint clean.
  implication: The DryRun row is now committed to DB before the background task is launched, guaranteeing visibility.

## Resolution

root_cause: Race condition in dry_runs.py endpoint. The DryRun row is created and flushed (not committed) in the request session, then a background task is launched that opens its OWN DB session to read the DryRun. With SQLite, the uncommitted row is invisible to the new session. The background task finds DryRun=None, logs an error, and returns silently. The DryRun stays in "pending" status with total_sop_steps=0 and covered_sop_steps=0 forever.
fix: Changed `await db.flush()` to `await db.commit()` in the create_dry_run endpoint, ensuring the DryRun row is committed to the database before the background task is launched. The background task's independent session can now always find the row.
verification: All 68 dry run tests pass. Ruff lint clean. Double-commit (endpoint commit + get_db cleanup commit) is harmless because expire_on_commit=False and the second commit is a no-op with no pending changes.
files_changed: [backend/app/api/dry_runs.py]
