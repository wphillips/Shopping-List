# Implementation Plan: Uncheck Move to Top

## Overview

Modify the `handleToggleItemCheck` method in `StateManager` so that unchecking an item moves it to the position immediately after the last unchecked item (and before the first checked item) in the same section. No new action types, components, or data model changes are needed — only the reducer logic changes.

## Tasks

- [x] 1. Modify `handleToggleItemCheck` in `src/state.ts` to reorder on uncheck
  - [x] 1.1 Update the `handleToggleItemCheck` method to place unchecked items after the last unchecked item in their section
    - Find the target item by `id`; return state unchanged if not found
    - Toggle `isChecked` on the target item
    - If the item was previously checked (now unchecked): remove it from the array, find the index of the first checked item (`isChecked === true`) with the same `sectionId`, and insert the toggled item at that index (placing it after the last unchecked item and before the first checked item). If no checked items exist in the section, insert after the last item in the same section. If no other items exist in the section, push the item.
    - If the item was previously unchecked (now checked): return items with only the `isChecked` flag toggled, no reorder
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_

  - [x] 1.2 Write unit tests for uncheck-move-to-top behavior
    - Create `tests/uncheck-move-to-top.unit.test.ts`
    - Test: single checked item unchecked moves after last unchecked item in section
    - Test: unchecking item in one section doesn't affect another section's order
    - Test: checking an item keeps its position unchanged
    - Test: only item in section stays in place when unchecked
    - Test: all items checked — unchecked item becomes first in section
    - Test: all items unchecked — unchecked item appears after all unchecked items
    - Test: persistence is called with reordered items array after uncheck
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_

  - [x] 1.3 Write property test: Unchecked item is placed after last unchecked item in its section
    - Create `tests/uncheck-move-to-top.properties.test.ts`
    - **Property 1: Unchecked item is placed after last unchecked item in its section**
    - Generate random `AppState` with at least one checked item using `fast-check`
    - Dispatch `TOGGLE_ITEM_CHECK` for a checked item
    - Assert the item appears immediately after the last unchecked item (and before the first checked item) among items with the same `sectionId`. If no other unchecked items exist, it should be the first item in the section. If no checked items remain, it should be the last item in the section.
    - Minimum 100 iterations
    - **Validates: Requirements 1.1**

  - [x] 1.4 Write property test: All other items preserve relative order
    - Append to `tests/uncheck-move-to-top.properties.test.ts`
    - **Property 2: All other items preserve relative order**
    - Generate random `AppState` with at least one checked item
    - Dispatch `TOGGLE_ITEM_CHECK` for a checked item
    - Assert the relative order of all other items (excluding the toggled item) is unchanged
    - Minimum 100 iterations
    - **Validates: Requirements 1.2, 1.3**

  - [x] 1.5 Write property test: Checking an item does not reorder
    - Append to `tests/uncheck-move-to-top.properties.test.ts`
    - **Property 3: Checking an item does not reorder**
    - Generate random `AppState` with at least one unchecked item
    - Dispatch `TOGGLE_ITEM_CHECK` for an unchecked item
    - Assert the `items` array order is identical before and after (only `isChecked` differs)
    - Minimum 100 iterations
    - **Validates: Requirements 1.4**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The only production code change is in `src/state.ts` — the `handleToggleItemCheck` method
- Persistence (Requirement 2.1) and visual rendering (Requirement 3.1, 3.2) are handled automatically by existing `dispatch` → `saveState` and `render` flows
- Property tests use `fast-check` (already in devDependencies)
