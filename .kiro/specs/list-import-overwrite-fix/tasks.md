# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Existing Lists Lost When loadMultiListState Falls Back to Default
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate `loadMultiListState()` silently discards existing lists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases that trigger the silent fallback:
    - Case 1: localStorage has 2 valid lists but one item has `quantity: 0` — `isValidItem()` rejects it, `validateV2State()` throws, entire state discarded
    - Case 2: localStorage has valid lists but a section is missing `createdAt` — `isValidSection()` fails, entire state discarded
    - Case 3: localStorage has valid lists but `activeListId` references a non-existent list — `validateV2State()` throws
  - For each case: save the corrupted v2 state JSON to localStorage, call `loadMultiListState()`, then create `StateManager` and dispatch `IMPORT_LIST`
  - Assert: the resulting `state.lists` contains all original valid lists PLUS the imported list (from Expected Behavior in design: requirements 2.1, 2.2, 2.3)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS — `loadMultiListState()` returns `createDefaultMultiListState()` instead of recovering valid lists, so existing lists are lost
  - Document counterexamples: e.g., "2 lists in localStorage, one item with quantity:0 → loadMultiListState returns default state with 1 empty list, user's 2 lists gone"
  - Mark task complete when test is written, run, and failure is documented
  - Create test file: `tests/list-import-overwrite.exploration.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Non-Import Load and CRUD Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - Valid `MultiListState` round-trips through `saveMultiListState()` → `loadMultiListState()` correctly (lists, activeListId, filterMode preserved)
    - Import appends to existing lists when state is fully valid (no validation failures)
    - Normal load without import parameters works correctly
    - CRUD operations (create, delete, rename, switch list) produce correct results
  - **Property-based tests**:
    - PBT 1: For all valid `MultiListState` objects (all items have `quantity >= 1`, all fields present), `saveMultiListState(state)` then `loadMultiListState()` returns a state with the same lists, activeListId, and filterMode (modulo `Set` ↔ `Array` conversion for collapsedSections)
    - PBT 2: For all valid `MultiListState` objects + a valid imported `GroceryList`, dispatching `IMPORT_LIST` appends the list and sets it as active, preserving all existing lists
    - Unit: Normal `loadMultiListState()` with no localStorage data returns default state with 1 empty list
    - Unit: `loadMultiListState()` with completely invalid JSON (e.g., `"not json"`) returns default state
  - Verify all tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS — these capture baseline behavior that must be preserved
  - Mark task complete when tests are written, run, and passing on unfixed code
  - Create test file: `tests/list-import-overwrite.preservation.test.ts`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for silent state fallback in loadMultiListState discarding existing lists on validation failure

  - [x] 3.1 Implement the fix in `src/storage.ts`
    - **Change 1**: Add resilient list-level recovery in `loadMultiListState()` v2 path — when `validateV2State()` throws, instead of returning `createDefaultMultiListState()`, iterate over `data.lists` and keep individually valid lists
    - **Change 2**: Relax item validation on load path — in a new `isValidItemForLoad()` or inline in the recovery logic, clamp `quantity` to `Math.max(1, obj.quantity)` instead of rejecting items with `quantity < 1`
    - **Change 3**: Add partial recovery logic — filter out corrupted lists/items, keep valid ones. Only fall back to `createDefaultMultiListState()` if zero lists survive validation
    - **Change 4**: Fix `activeListId` recovery — if `activeListId` references a non-existent list after filtering, fall back to the first surviving list's ID
    - **Change 5**: Add logging for partial recovery — log how many lists were recovered vs discarded for debugging
    - _Bug_Condition: isBugCondition(input) where loadMultiListState silently falls back to default state when any single item/section/field fails validation, discarding all lists_
    - _Expected_Behavior: loadMultiListState recovers all individually valid lists, only discards corrupted entities, preserves user data_
    - _Preservation: All valid states must continue to load identically; saveMultiListState format unchanged; non-import flows unaffected_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Existing Lists Preserved During Import
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (all valid existing lists preserved + imported list appended)
    - When this test passes, it confirms the fix correctly recovers valid lists from corrupted state
    - Run bug condition exploration test from step 1: `tests/list-import-overwrite.exploration.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES — confirms bug is fixed, valid lists are recovered
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** — Non-Import Load and CRUD Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2: `tests/list-import-overwrite.preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS — confirms no regressions in valid state loading, round-trip, or import behavior
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite to confirm no regressions across the entire codebase
  - Ensure all tests pass, ask the user if questions arise
