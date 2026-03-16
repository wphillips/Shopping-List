# Implementation Plan: Auto-Collapse Empty Sections

## Overview

Implement the auto-collapse engine as a pure function `computeCollapsedSections` in `src/state.ts`, integrate it into the `StateManager` reducer for visibility-changing actions, and run it on initial load. The function computes which sections should be collapsed based on visible items under the current filter mode. Manual toggle remains unaffected.

## Tasks

- [x] 1. Implement `computeCollapsedSections` pure function
  - [x] 1.1 Add `computeCollapsedSections` function to `src/state.ts`
    - Export a pure function that takes `sections: Section[]`, `items: Item[]`, `filterMode: FilterMode` and returns `Set<string>` of section IDs to collapse
    - A section is collapsed if it has zero items matching the current filter mode
    - When `filterMode` is `'all'`, a section is collapsed only if it has zero items total
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 1.2 Write property test: Filter change collapse invariant
    - **Property 1: Filter change collapse invariant**
    - Generate random AppState with sections and items, apply SET_FILTER_MODE, verify collapsedSections contains exactly section IDs with zero matching items
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.3 Write property test: Item check toggle collapse invariant
    - **Property 2: Item check toggle collapse invariant**
    - Generate random AppState and toggle a random item's check state, verify collapsedSections is correct; under "all" filter, no section with items is collapsed
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. Integrate auto-collapse into the reducer
  - [x] 2.1 Modify `StateManager.reduce` in `src/state.ts` to call `computeCollapsedSections` after visibility-changing actions
    - After the switch statement produces the new state, check if the action type is one of: `SET_FILTER_MODE`, `TOGGLE_ITEM_CHECK`, `ADD_ITEM`, `DELETE_ITEM`, `MOVE_ITEM_TO_SECTION`
    - If so, overwrite `collapsedSections` with the result of `computeCollapsedSections(newState.sections, newState.items, newState.filterMode)`
    - Do NOT run auto-collapse for `TOGGLE_SECTION_COLLAPSE`, `ADD_SECTION`, `DELETE_SECTION`, `RENAME_SECTION`, or section reorder actions
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [x] 2.2 Write property test: Item add/delete/move collapse invariant
    - **Property 3: Item add/delete/move collapse invariant**
    - Generate random AppState, apply ADD_ITEM / DELETE_ITEM / MOVE_ITEM_TO_SECTION, verify collapsedSections contains exactly section IDs with zero visible items
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 2.3 Write property test: Manual toggle independence
    - **Property 4: Manual toggle independence**
    - Generate random AppState and a section ID, dispatch TOGGLE_SECTION_COLLAPSE, verify only the toggled section's membership changed and no auto-collapse ran
    - **Validates: Requirements 4.1**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate auto-collapse on initial load
  - [x] 4.1 Modify `StateManager` constructor in `src/state.ts` to run `computeCollapsedSections` on the initial state
    - After setting `this.state`, overwrite `collapsedSections` with `computeCollapsedSections(this.state.sections, this.state.items, this.state.filterMode)`
    - This ensures persisted state has correct collapse state on app startup
    - _Requirements: 5.1, 5.2_

  - [x] 4.2 Write property test: Initial load collapse invariant
    - **Property 5: Initial load collapse invariant**
    - Generate random valid AppState, construct a new StateManager with it, verify collapsedSections matches `computeCollapsedSections` output
    - **Validates: Requirements 5.1, 5.2**

- [x] 5. Write unit tests for specific examples and edge cases
  - [x] 5.1 Write unit tests in `tests/auto-collapse-empty-sections.unit.test.ts`
    - Filter to "checked" collapses section with only unchecked items
    - Filter to "all" expands all sections with items
    - Checking last unchecked item collapses section under "unchecked" filter
    - Adding item to collapsed section expands it
    - Deleting last visible item collapses section
    - Moving item collapses source, expands target
    - Manual toggle is not overridden until next visibility-changing action
    - Toggle item under "all" filter never collapses sections with items
    - Section with zero items is always collapsed regardless of filter mode
    - Initial load computes correct collapse state
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design uses TypeScript throughout — all implementation and tests use TypeScript
- Property-based tests use `fast-check` with minimum 100 iterations per property
- `computeCollapsedSections` is a pure function with no side effects, making it straightforward to test
- No changes needed to Section, Item, FilterControl, AppShell, storage, or types — the feature is entirely contained in `src/state.ts`
