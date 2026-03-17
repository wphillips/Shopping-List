# Implementation Tasks — Offline Fetch Crash Bugfix

## Task 1: Write bug condition exploration tests
- [x] 1. Write bug condition exploration property tests
  - [x] 1.1 Create `tests/offline-fetch-crash.exploration.test.ts` with PBT confirming SW fetch handler re-throws on navigation cache miss + offline (bug condition for defects 1.1, 1.2)
  - [x] 1.2 Add PBT confirming `forceUpdate()` calls `reload()` when `registration.update()` throws (bug condition for defect 1.3)

## Task 2: Write preservation property tests
- [x] 2. Write preservation property tests (expected to PASS on unfixed code)
  - [x] 2.1 Create `tests/offline-fetch-crash.properties.test.ts` with CP-4: cache hit returns cached response regardless of network state
  - [x] 2.2 Add CP-5: cache miss + network 200 returns response and caches clone
  - [x] 2.3 Add CP-6: successful `registration.update()` clears caches and calls `reload()`

## Task 3: Implement fixes and fix-checking tests
- [x] 3. Implement fixes and verify correctness
  - [x] 3.1 Fix `public/sw.js`: replace `.catch()` block with navigation fallback to cached `/index.html` + 503 for non-navigation (defects 1.1, 1.2 → expected 2.1, 2.2)
  - [x] 3.2 Fix `src/forceUpdate.ts`: remove `reload()` from error branch, return offline message (defect 1.3 → expected 2.3)
  - [x] 3.3 Add fix-checking PBT to `tests/offline-fetch-crash.properties.test.ts`: CP-1 (navigation offline → resolved SPA fallback), CP-2 (non-navigation offline → resolved 503), CP-3 (update throws → no reload)
  - [x] 3.4 Update `tests/service-worker.test.ts`: add unit tests for navigation fallback and 503 offline response
  - [x] 3.5 Update `tests/forceUpdate.test.ts`: update error branch test (no reload, offline message)
  - [x] 3.6 Verify exploration tests from Task 1 now pass (bug condition eliminated)
  - [x] 3.7 Verify preservation tests from Task 2 still pass (no regressions)

## Task 4: Final verification
- [x] 4. Run full test suite and confirm all tests pass
