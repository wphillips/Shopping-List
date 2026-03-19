# Implementation Plan: List Merge Collaboration

## Overview

Implement a merge engine and updated import flow so that opening a shared URL whose list name matches an existing local list merges the incoming list instead of creating a duplicate. The merge follows additive-only, unchecked-wins semantics. Implementation proceeds bottom-up: types/interfaces → pure merge engine → state reducer action → import controller orchestration → wiring.

## Tasks

- [x] 1. Create the merge engine module
  - [x] 1.1 Create `src/merge-engine.ts` with `MergeResult`, `MergeStats` interfaces and the `mergeLists` pure function
    - Define `MergeStats` interface with `itemsAdded`, `itemsUnchecked`, `sectionsAdded`
    - Define `MergeResult` interface with `mergedList: GroceryList` and `stats: MergeStats`
    - Implement `mergeLists(local: GroceryList, incoming: GroceryList): MergeResult`
    - Build case-insensitive section name → local section lookup map
    - Build case-insensitive `(sectionName, itemName)` → local item lookup map
    - Iterate incoming sections: create new sections when no match, track `sectionsAdded`
    - Iterate incoming items: add new items (with fresh IDs) when no match, track `itemsAdded`
    - For matched items: apply `isChecked = local.isChecked AND incoming.isChecked`, track `itemsUnchecked`
    - Preserve local quantities for matched items
    - Append new items after existing items within each section
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 10.3_

  - [ ]* 1.2 Write property test: Unchecked-wins check state (Property 2)
    - **Property 2: Unchecked-Wins Check State**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [ ]* 1.3 Write property test: No item removal / superset (Property 3)
    - **Property 3: No Item Removal (Superset)**
    - **Validates: Requirements 4.1, 4.2, 2.1**

  - [ ]* 1.4 Write property test: Local quantity preservation (Property 4)
    - **Property 4: Local Quantity Preservation**
    - **Validates: Requirements 4.3**

  - [ ]* 1.5 Write property test: Section preservation and creation (Property 5)
    - **Property 5: Section Preservation and Creation**
    - **Validates: Requirements 5.1, 5.3, 2.3**

  - [ ]* 1.6 Write property test: Case-insensitive within-section matching only (Property 6)
    - **Property 6: Case-Insensitive Within-Section Matching Only**
    - **Validates: Requirements 6.1, 6.3, 5.2**

  - [ ]* 1.7 Write property test: Unique IDs in merged result (Property 7)
    - **Property 7: Unique IDs in Merged Result**
    - **Validates: Requirements 2.2**

  - [ ]* 1.8 Write property test: New items appended after existing (Property 8)
    - **Property 8: New Items Appended After Existing**
    - **Validates: Requirements 2.4**

  - [ ]* 1.9 Write property test: Idempotent merge (Property 9)
    - **Property 9: Idempotent Merge**
    - **Validates: Requirements 7.1**

  - [ ]* 1.10 Write property test: Commutative merge (Property 10)
    - **Property 10: Commutative Merge**
    - **Validates: Requirements 7.2**

  - [ ]* 1.11 Write property test: Merge stats accuracy (Property 12)
    - **Property 12: Merge Stats Accuracy**
    - **Validates: Requirements 9.1, 9.3**

- [x] 2. Checkpoint - Verify merge engine
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add `MERGE_LIST` action to the state reducer
  - [x] 3.1 Add `MERGE_LIST` action type to the `Action` union in `src/state.ts`
    - Add `| { type: 'MERGE_LIST'; listId: string; mergedList: GroceryList }` to the `Action` type
    - Implement `handleMergeList` handler that replaces the list with matching `listId` in `state.lists` with `mergedList`, preserving the original list's `id` and `createdAt`
    - Wire the new case into the `reducer` switch statement
    - _Requirements: 9.2_

  - [ ]* 3.2 Write unit tests for `MERGE_LIST` reducer action
    - Test that dispatching `MERGE_LIST` replaces the target list's sections and items
    - Test that the original list's `id` and `createdAt` are preserved
    - Test that non-target lists are unaffected
    - Test that `activeListId` switches to the merged list
    - _Requirements: 9.2_

- [x] 4. Implement `resolveImportAction` in the import controller
  - [x] 4.1 Add `ImportAction` type and `resolveImportAction` function to `src/import-controller.ts`
    - Define `ImportAction` union type: `import-new`, `merge`, `choose`, `error`, `none`
    - Implement `resolveImportAction(incoming: GroceryList, existingLists: GroceryList[]): ImportAction`
    - Case-insensitive name comparison against all existing lists
    - Return `import-new` when zero matches, `merge` when one match, `choose` when multiple matches
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 4.2 Write property test: Import action resolution (Property 1)
    - **Property 1: Import Action Resolution**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 4.3 Write unit tests for `resolveImportAction`
    - Test zero matches → `import-new`
    - Test single match → `merge` with correct local list
    - Test multiple matches → `choose` with all candidates
    - Test case-insensitive matching (e.g., "Weekly" vs "weekly")
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Checkpoint - Verify import action resolution
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Wire merge flow into import controller and state
  - [x] 6.1 Update `checkImportUrl` or add orchestration logic in `src/import-controller.ts` to call `resolveImportAction`, invoke `mergeLists` when action is `merge`, and dispatch `MERGE_LIST` or `IMPORT_LIST` accordingly
    - After decoding, call `resolveImportAction` with the decoded list and existing lists
    - For `merge` action: call `mergeLists`, dispatch `MERGE_LIST` with the result
    - For `import-new` action: dispatch `IMPORT_LIST` (existing behavior)
    - For `choose` action: return candidates for UI to present
    - Return `MergeStats` for notification display
    - _Requirements: 1.1, 1.2, 1.3, 9.1, 9.2, 9.3, 10.1, 10.2_

  - [ ]* 6.2 Write property test: Serialization round-trip (Property 11)
    - **Property 11: Serialization Round-Trip**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 6.3 Write unit tests for the end-to-end merge/import flow
    - Test merge path: incoming list with matching name → merged result dispatched
    - Test import path: incoming list with no match → imported as new
    - Test error path: corrupted data → error returned, local state unchanged
    - Test empty incoming list → local list unchanged, stats all zero
    - Test notification message: "3 new items added, 2 items unchecked" format
    - Test "Lists are already in sync" when stats are all zero
    - _Requirements: 9.1, 9.3, 10.1, 10.2, 10.3_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The merge engine is a pure function with no side effects, tested independently before integration
