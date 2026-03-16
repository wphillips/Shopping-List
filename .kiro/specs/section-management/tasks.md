# Implementation Plan: Section Management

## Overview

Add section management UI to the Grocery List PWA: a `RENAME_SECTION` state action, an "Add Section" button in AppShell, and inline rename on section headers. Implementation proceeds bottom-up — state layer first, then component changes, then wiring and integration.

## Tasks

- [x] 1. Add RENAME_SECTION action to StateManager
  - [x] 1.1 Add `RENAME_SECTION` to the `Action` union type and implement the reducer handler in `src/state.ts`
    - Add `| { type: 'RENAME_SECTION'; id: string; name: string }` to the `Action` type
    - Add `case 'RENAME_SECTION'` to the `reduce` switch that finds the section by ID and updates its name
    - Return state unchanged if no section matches the ID
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Write property test: Rename updates section name (Property 1)
    - **Property 1: Rename updates section name**
    - **Validates: Requirements 2.1, 2.2**
    - File: `tests/state.rename.properties.test.ts`

  - [x] 1.3 Write property test: Rename with non-matching ID is a no-op (Property 2)
    - **Property 2: Rename with non-matching ID is a no-op**
    - **Validates: Requirements 2.3**
    - File: `tests/state.rename.properties.test.ts`

  - [x] 1.4 Write property test: Rename round-trip persistence (Property 3)
    - **Property 3: Rename round-trip persistence**
    - **Validates: Requirements 2.4**
    - File: `tests/state.rename.properties.test.ts`

- [x] 2. Checkpoint — Verify state layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add inline rename UI to Section component
  - [x] 3.1 Extend `SectionConfig` interface and implement rename mode in `src/components/Section.ts`
    - Add `onRename: (id: string, newName: string) => void` and `initialRenameMode?: boolean` to `SectionConfig`
    - Add `isRenaming` and `originalName` private fields
    - Implement `enterRenameMode()`: swap title span for `<input type="text" maxlength="50" aria-label="Rename section">`, focus and select all text
    - Implement `commitRename()`: trim input value; if empty/whitespace revert to original name; otherwise call `onRename(id, trimmedName)` and exit rename mode
    - Implement `cancelRename()`: restore original name, exit rename mode without calling `onRename`
    - Bind double-click on title span → `enterRenameMode()`
    - Bind Enter → `commitRename()`, Escape → `cancelRename()`, blur → `commitRename()`
    - `stopPropagation()` on input click to prevent header collapse toggle
    - If `initialRenameMode` is true, call `enterRenameMode()` after construction
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 5.2, 5.4_

  - [x] 3.2 Write property test: Double-click enters rename mode with current name (Property 4)
    - **Property 4: Double-click enters rename mode with current name**
    - **Validates: Requirements 3.1**
    - File: `tests/Section.rename.properties.test.ts`

  - [x] 3.3 Write property test: Commit rename invokes callback with trimmed name (Property 5)
    - **Property 5: Commit rename invokes callback with trimmed name**
    - **Validates: Requirements 3.3, 3.5, 4.1, 4.2**
    - File: `tests/Section.rename.properties.test.ts`

  - [x] 3.4 Write property test: Escape cancels rename and restores original name (Property 6)
    - **Property 6: Escape cancels rename and restores original name**
    - **Validates: Requirements 3.4**
    - File: `tests/Section.rename.properties.test.ts`

  - [x] 3.5 Write property test: Whitespace-only name reverts to original (Property 7)
    - **Property 7: Whitespace-only name reverts to original**
    - **Validates: Requirements 3.6**
    - File: `tests/Section.rename.properties.test.ts`

  - [x] 3.6 Write property test: Rename input does not trigger collapse (Property 8)
    - **Property 8: Rename input does not trigger collapse**
    - **Validates: Requirements 3.8**
    - File: `tests/Section.rename.properties.test.ts`

  - [x] 3.7 Write unit tests for Section rename UI
    - Test rename input has `aria-label="Rename section"` and `maxlength="50"`
    - Test rename input is focused with all text selected on enter
    - Test double-click while already in rename mode is a no-op
    - Test blur after Escape does not double-commit
    - File: `tests/Section.rename.test.ts`
    - _Requirements: 3.1, 3.2, 3.7, 5.2_

- [x] 4. Checkpoint — Verify Section component rename
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Wire Add Section button and onRename in AppShell
  - [x] 5.1 Render "Add Section" button and wire `onRename` callback in `src/index.ts`
    - In `render()`, append an "Add Section" button after all section elements: `<button class="add-section-btn" aria-label="Add new section"><span aria-hidden="true">+</span> Add Section</button>`
    - On click: dispatch `ADD_SECTION` with name `"New Section"`, then after re-render call `enterRenameMode()` on the new Section component
    - Pass `onRename: (id, newName) => this.stateManager.dispatch({ type: 'RENAME_SECTION', id, name: newName })` to each Section config
    - Pass `initialRenameMode: true` for newly added sections so they auto-enter rename mode
    - Ensure the button is visible even when no sections exist (render it alongside or instead of the empty state message)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.3, 5.1, 5.3_

  - [x] 5.2 Write unit tests for Add Section button and AppShell wiring
    - Test Add Section button renders below sections with correct text and `aria-label="Add new section"`
    - Test Add Section button visible when no sections exist
    - Test clicking Add Section creates section named "New Section" and enters rename mode
    - Test Add Section button activatable via Enter and Space keys
    - Test AppShell dispatches `RENAME_SECTION` when `onRename` fires
    - File: `tests/AppShell.section-management.test.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 4.3, 5.1, 5.3_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Checkpoints ensure incremental validation between layers
