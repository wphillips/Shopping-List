# List Import Overwrite Fix — Bugfix Design

## Overview

When a user with existing grocery lists navigates to an import URL (`?list=...`), their existing lists are lost. The user ends up with only the imported list and a fresh default list. The `handleImportList` reducer correctly appends via `[...state.lists, list]`, so the data loss occurs earlier in the initialization sequence. The fix must ensure `loadMultiListState()` reliably preserves existing lists before the import action is dispatched, and that no silent fallback to default state can discard user data.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a page load with a `?list=` URL parameter when the user has existing lists in localStorage whose persisted state triggers a silent validation fallback in `loadMultiListState()`
- **Property (P)**: The desired behavior — all existing lists are preserved in memory before the import action appends the new list
- **Preservation**: Existing import flow behavior (confirmation prompt, URL cleanup, active list switching, error handling) and all non-import CRUD operations must remain unchanged
- **`loadMultiListState()`**: The function in `src/storage.ts` that reads persisted state from localStorage, validates it, and returns a `MultiListState` — falling back to `createDefaultMultiListState()` on any validation failure
- **`handleImportList()`**: The reducer handler in `src/state.ts` that appends an imported `GroceryList` to `state.lists` and sets it as active
- **`createStateManager()`**: The factory in `src/state.ts` that calls `loadMultiListState()` and passes the result to the `StateManager` constructor
- **`handleImport()`**: The method in `src/index.ts` (`AppShell`) that checks the URL for a `?list=` parameter, decodes it, and dispatches `IMPORT_LIST`

## Bug Details

### Bug Condition

The bug manifests when a user with existing lists in localStorage opens the app via a `?list=` import URL, and `loadMultiListState()` silently discards their persisted state by falling back to `createDefaultMultiListState()`. The `handleImportList` reducer then appends the imported list to this empty default state instead of the user's real data.

The silent fallback can be triggered by:
1. A strict validation failure in `validateV2State()` — any single corrupted item, section, or field causes the entire state to be discarded
2. A JSON parse error on the stored data
3. An unexpected version number
4. The `loadMultiListState()` catch-all that returns default state for any non-`StorageUnavailableError` exception

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { url: string, localStorage: string | null }
  OUTPUT: boolean

  hasImportParam := input.url contains '?list=' with valid encoded data
  hasExistingLists := input.localStorage is not null
                      AND JSON.parse(input.localStorage).lists.length > 0

  loadResult := loadMultiListState()  // reads input.localStorage
  loadFellBack := loadResult.lists.length === 1
                  AND loadResult.lists[0].sections.length === 0
                  AND loadResult.lists[0].items.length === 0
                  AND hasExistingLists

  RETURN hasImportParam AND hasExistingLists AND loadFellBack
END FUNCTION
```

### Examples

- **Example 1**: User has 3 lists ("Weekly", "Party", "Camping") in localStorage. They click a shared link `?list=encoded_data`. After page load, they see only "My Grocery List" (default) and the imported list. Their 3 original lists are gone.
- **Example 2**: User has 1 list with 5 sections and 20 items. One item was saved with `quantity: 0` due to a prior bug. `validateV2State()` → `isValidItem()` fails on `quantity >= 1`, entire state is discarded. Import appends to empty default state.
- **Example 3**: User has valid lists. `loadMultiListState()` succeeds, returns their real state. Import appends correctly. All 4 lists (3 existing + 1 imported) are present. This is the non-buggy case.
- **Edge case**: User has no prior lists (fresh install). `loadMultiListState()` returns default state (1 empty list). Import appends. User sees default list + imported list. This is correct behavior.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The `handleImportList` reducer must continue to append via `[...state.lists, list]` and set the imported list as active
- The import confirmation prompt (`confirm(...)`) must continue to appear before importing
- The `?list=` query parameter must continue to be removed from the URL via `history.replaceState` after import
- Invalid/corrupted import URLs must continue to show the "Could not load shared list: invalid link" notification
- Declining the import prompt must continue to load normally without modifying existing lists
- All non-import list operations (create, delete, rename, switch) must continue to work correctly
- The `saveMultiListState()` serialization format must remain backward-compatible

**Scope:**
All inputs that do NOT involve a page load with `?list=` URL parameter should be completely unaffected by this fix. This includes:
- Normal page loads without import parameters
- All CRUD operations on lists, sections, and items
- Share/export functionality
- Filter and search operations
- Service worker and force-update flows

## Hypothesized Root Cause

Based on the code analysis, the most likely issues are:

1. **Silent validation fallback in `loadMultiListState()`**: The function has multiple paths that return `createDefaultMultiListState()` when validation fails. The `validateV2State()` function is strict — any single invalid item (e.g., `quantity < 1`), missing field, or type mismatch causes the entire persisted state to be silently discarded. The `catch` blocks log a `console.warn` but return default state, making the data loss invisible to the user and to calling code.

2. **No error propagation from load to import flow**: `createStateManager()` catches all errors from `loadMultiListState()` and falls back to `new StateManager()` (default state). The `AppShell` constructor has no way to know that the loaded state is a fallback rather than the user's real data. The import then appends to this empty state.

3. **Overly strict validation in `isValidItem()`**: The check `obj.quantity >= 1` means any item with `quantity: 0` (which could result from a prior bug or data migration issue) causes the entire state to be rejected. Similarly, `isValidGroceryList` delegates to `isValidSection` and `isValidItem` for every entity — one bad entity kills all lists.

4. **No partial recovery**: When validation fails, the entire state is discarded rather than recovering the valid lists and skipping only the corrupted ones. A single corrupted item in one list causes all lists to be lost.

## Correctness Properties

Property 1: Bug Condition — Existing Lists Preserved During Import

_For any_ page load where the URL contains a valid `?list=` parameter AND localStorage contains existing lists with valid structure, the `StateManager` SHALL be initialized with all existing lists from localStorage, and after the `IMPORT_LIST` action is dispatched, the resulting state SHALL contain all previously existing lists plus the newly imported list.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Non-Import Behavior Unchanged

_For any_ input that is NOT a page load with a `?list=` URL parameter (normal page loads, CRUD operations, share/export, filter/search), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality for non-import interactions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/storage.ts`

**Function**: `loadMultiListState()`

**Specific Changes**:

1. **Add resilient list-level validation**: Instead of discarding the entire state when `validateV2State()` fails, attempt to recover individual valid lists. Filter out only the corrupted lists/items rather than falling back to default state entirely.

2. **Relax item validation for load path**: In the load path (not the import path), tolerate minor data issues like `quantity: 0` by clamping to valid ranges rather than rejecting the entire state. For example, clamp `quantity` to `Math.max(1, obj.quantity)` during load.

3. **Add logging for fallback events**: When `loadMultiListState()` falls back to default state, log a more prominent warning that includes the reason and the number of lists that were discarded. This aids debugging without changing behavior.

4. **Preserve valid lists on partial validation failure**: If some lists pass validation and others don't, keep the valid ones rather than discarding everything. Only fall back to `createDefaultMultiListState()` if zero lists survive validation.

**File**: `src/state.ts`

**Function**: `createStateManager()`

5. **Surface load failures**: Consider returning metadata about whether the load was a fallback, so the `AppShell` can decide whether to proceed with import or warn the user. Alternatively, ensure `loadMultiListState()` is robust enough that fallback never silently discards real data.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that set up localStorage with existing lists, then simulate the `loadMultiListState()` → `StateManager` → `dispatch(IMPORT_LIST)` sequence. Run these tests on the UNFIXED code to observe whether existing lists are lost.

**Test Cases**:
1. **Valid State + Import**: Set localStorage with 2 valid lists, call `loadMultiListState()`, create `StateManager`, dispatch `IMPORT_LIST`. Assert all 3 lists present. (may pass on unfixed code if state is perfectly valid)
2. **Slightly Corrupted State + Import**: Set localStorage with 2 lists where one item has `quantity: 0`. Call `loadMultiListState()`. Assert it falls back to default state, losing both lists. (will fail on unfixed code — demonstrates the bug)
3. **Missing Field State + Import**: Set localStorage with a list missing `createdAt` on one section. Call `loadMultiListState()`. Assert fallback occurs. (will fail on unfixed code)
4. **Invalid activeListId + Import**: Set localStorage with valid lists but `activeListId` pointing to a non-existent list. Assert fallback occurs. (will fail on unfixed code)

**Expected Counterexamples**:
- `loadMultiListState()` returns `createDefaultMultiListState()` instead of the user's real lists
- Possible causes: strict validation in `validateV2State()`, `isValidItem()` rejecting `quantity: 0`, `isValidGroceryList()` rejecting a list with one bad entity

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  state := loadMultiListState_fixed()
  manager := new StateManager(state)
  manager.dispatch({ type: 'IMPORT_LIST', list: importedList })
  result := manager.getState()
  ASSERT result.lists contains all original lists from localStorage
  ASSERT result.lists contains importedList
  ASSERT result.activeListId === importedList.id
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT loadMultiListState_original(input) = loadMultiListState_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many valid `MultiListState` configurations automatically
- It catches edge cases in validation logic that manual tests might miss
- It provides strong guarantees that non-buggy load paths are unchanged

**Test Plan**: Observe behavior on UNFIXED code first for normal page loads (no `?list=` parameter) with various valid states, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Normal Load Preservation**: Generate random valid `MultiListState` objects, save to localStorage, call `loadMultiListState()`. Verify the loaded state matches the saved state (modulo `Set` ↔ `Array` conversion).
2. **CRUD Preservation**: Verify that create/delete/rename/switch list operations produce identical results before and after the fix.
3. **Import Error Preservation**: Verify that corrupted import URLs still show the error notification and don't modify existing lists.
4. **Decline Import Preservation**: Verify that declining the import prompt leaves existing lists unchanged.

### Unit Tests

- Test `loadMultiListState()` with valid v2 state — should return all lists
- Test `loadMultiListState()` with slightly corrupted state (one bad item) — should recover valid lists instead of falling back to default
- Test `loadMultiListState()` with completely invalid state — should fall back to default
- Test the full import sequence: load → StateManager → dispatch IMPORT_LIST → verify all lists present
- Test `validateV2State()` edge cases: missing fields, wrong types, empty lists array

### Property-Based Tests

- Generate random valid `MultiListState` objects, round-trip through save/load, verify all lists preserved
- Generate random `MultiListState` objects with one corrupted list, verify valid lists are recovered
- Generate random valid states + random valid import lists, verify import appends without losing existing lists

### Integration Tests

- Test full AppShell initialization with `?list=` URL and existing localStorage data — verify all lists present after import
- Test full AppShell initialization without `?list=` URL — verify normal load behavior unchanged
- Test import flow end-to-end: URL parsing → decode → confirm → dispatch → render — verify UI shows all lists
