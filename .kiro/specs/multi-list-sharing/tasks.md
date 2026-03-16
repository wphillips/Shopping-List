# Implementation Plan: Multi-List Sharing

## Overview

Extend the Grocery List PWA from a single-list model to a multi-list model with URL-based sharing. Implementation proceeds bottom-up: types → storage/migration → state manager → pure-logic modules (serializer, URL codec, share/import controllers) → UI components → AppShell integration → styles.

## Tasks

- [x] 1. Add new types and install lz-string dependency
  - [x] 1.1 Add `GroceryList` and `MultiListState` interfaces to `src/types.ts`
    - Add `GroceryList` interface with `id`, `name`, `sections`, `items`, `createdAt`
    - Add `MultiListState` interface with `lists`, `activeListId`, `filterMode`, `collapsedSections`, `version`
    - Keep existing `Section`, `Item`, `FilterMode`, `DragData` interfaces unchanged
    - _Requirements: 1.1, 2.1_

  - [x] 1.2 Install `lz-string` as a runtime dependency
    - Run `npm install lz-string` and `npm install -D @types/lz-string`
    - _Requirements: 4.1_

- [x] 2. Extend storage module with v2 multi-list support
  - [x] 2.1 Add `loadMultiListState`, `saveMultiListState`, and `migrateV1ToV2` to `src/storage.ts`
    - `migrateV1ToV2` wraps existing v1 `AppState` into a single `GroceryList` inside `MultiListState`
    - `loadMultiListState` checks version field: missing/1 → migrate, 2 → load directly, invalid → default state
    - `saveMultiListState` serializes `MultiListState` (converting `Set` to `Array` for `collapsedSections`)
    - Add `createDefaultMultiListState()` helper that returns a v2 state with one empty list
    - Keep existing `loadState`/`saveState`/`createDefaultState` for backward compatibility during transition
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.2 Write property tests for storage migration (`tests/storage-migration.properties.test.ts`)
    - **Property 6: V1 to V2 migration preserves all sections and items**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.3 Write property test for v2 load idempotency (`tests/storage-migration.properties.test.ts`)
    - **Property 7: Loading a valid V2 state is idempotent**
    - **Validates: Requirements 2.3**

  - [x] 2.4 Write property test for invalid data fallback (`tests/storage-migration.properties.test.ts`)
    - **Property 8: Invalid stored data falls back to a default state**
    - **Validates: Requirements 2.4**

  - [x] 2.5 Write unit tests for storage migration (`tests/storage-migration.unit.test.ts`)
    - Test specific v1 data shapes, empty v1 state, v1 with special characters
    - Test corrupt JSON, missing fields, wrong types
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Refactor state manager for multi-list support
  - [x] 3.1 Refactor `src/state.ts` reducer to operate on `MultiListState`
    - Update `Action` union type with new actions: `CREATE_LIST`, `DELETE_LIST`, `RENAME_LIST`, `SWITCH_LIST`, `IMPORT_LIST`
    - Refactor reducer to scope existing actions (`ADD_ITEM`, `DELETE_SECTION`, etc.) to the active list
    - `CREATE_LIST`: add new empty list, set as active
    - `DELETE_LIST`: remove list; if active, fall back to first remaining; if last list, create default
    - `RENAME_LIST`: update target list name only
    - `SWITCH_LIST`: update `activeListId`
    - `IMPORT_LIST`: add list to state, set as active
    - Update `createStateManager` to use `loadMultiListState`/`saveMultiListState`
    - Update `getVisibleItems` and `filterItemsByText` to scope to active list
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 6.2_

  - [x] 3.2 Write property tests for multi-list state (`tests/multi-list-state.properties.test.ts`)
    - **Property 1: Creating a list adds it and sets it active**
    - **Validates: Requirements 1.2**

  - [x] 3.3 Write property test for switching lists (`tests/multi-list-state.properties.test.ts`)
    - **Property 2: Switching lists updates the active list ID**
    - **Validates: Requirements 1.3**

  - [x] 3.4 Write property test for renaming lists (`tests/multi-list-state.properties.test.ts`)
    - **Property 3: Renaming a list updates only the target list's name**
    - **Validates: Requirements 1.4**

  - [x] 3.5 Write property test for deleting lists (`tests/multi-list-state.properties.test.ts`)
    - **Property 4: Deleting a list removes it and falls back to the first remaining list**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 3.6 Write property test for active list persistence (`tests/multi-list-state.properties.test.ts`)
    - **Property 5: Active list ID persists across save and load**
    - **Validates: Requirements 1.8**

  - [x] 3.7 Write property test for importing lists (`tests/multi-list-state.properties.test.ts`)
    - **Property 19: Importing a list adds it and sets it as active**
    - **Validates: Requirements 6.2**

  - [x] 3.8 Write unit tests for multi-list state (`tests/multi-list-state.unit.test.ts`)
    - Test delete-only-list creates default, specific state transitions
    - _Requirements: 1.5, 1.6, 1.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement serializer module
  - [x] 5.1 Create `src/serializer.ts` with `serialize` and `deserialize` functions
    - `serialize`: convert `GroceryList` to JSON string of `SerializedList` shape (name, sections with nested items, no IDs/timestamps)
    - `deserialize`: parse JSON, validate shape, generate fresh UUIDs and timestamps, return `GroceryList` or `{ error: string }`
    - Define `SerializedList` interface
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Write property tests for serializer (`tests/serializer.properties.test.ts`)
    - **Property 9: Serialized output contains exactly the portable fields**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 5.3 Write property test for serialization round-trip (`tests/serializer.properties.test.ts`)
    - **Property 10: Serialization round-trip preserves list content**
    - **Validates: Requirements 3.6**

  - [x] 5.4 Write property test for fresh unique IDs (`tests/serializer.properties.test.ts`)
    - **Property 11: Deserialization generates fresh unique IDs**
    - **Validates: Requirements 3.4, 6.6**

  - [x] 5.5 Write property test for invalid input rejection (`tests/serializer.properties.test.ts`)
    - **Property 12: Deserialization rejects invalid input**
    - **Validates: Requirements 3.5**

  - [x] 5.6 Write unit tests for serializer (`tests/serializer.unit.test.ts`)
    - Test specific serialization examples, empty list, list with special characters
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Implement URL codec module
  - [x] 6.1 Create `src/url-codec.ts` with `encodeListUrl` and `decodeListFragment` functions
    - `encodeListUrl`: compress with lz-string `compressToEncodedURIComponent`, return `${origin}/#list=${encoded}`
    - `decodeListFragment`: extract `list=` from hash, decompress, return JSON string or `null` or `{ error }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.2 Write property tests for URL codec (`tests/url-codec.properties.test.ts`)
    - **Property 13: URL codec round-trip preserves the serialized string**
    - **Validates: Requirements 4.7**

  - [x] 6.3 Write property test for URL format (`tests/url-codec.properties.test.ts`)
    - **Property 14: Encoded URL matches the expected format**
    - **Validates: Requirements 4.2**

  - [x] 6.4 Write property test for missing list parameter (`tests/url-codec.properties.test.ts`)
    - **Property 15: Missing list parameter returns null**
    - **Validates: Requirements 4.5**

  - [x] 6.5 Write property test for corrupted data (`tests/url-codec.properties.test.ts`)
    - **Property 16: Corrupted encoded data returns an error**
    - **Validates: Requirements 4.6**

  - [x] 6.6 Write unit tests for URL codec (`tests/url-codec.unit.test.ts`)
    - Test specific encode/decode examples, empty hash, hash with other params
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 7. Implement share and import controllers
  - [x] 7.1 Create `src/share-controller.ts` with `shareList` function
    - Dependency-injected `ShareDeps` with optional `navigatorShare` and `clipboardWriteText`
    - Try `navigator.share` first; on `AbortError` return `{ status: 'shared' }`; on other errors fall back to clipboard
    - If neither API available, return `{ status: 'unsupported' }`
    - _Requirements: 5.2, 5.3, 5.5, 5.6_

  - [x] 7.2 Create `src/import-controller.ts` with `checkImportUrl` function
    - Dependency-injected `ImportDeps` with `getHash` and `replaceState`
    - Read hash, decode via `decodeListFragment`, deserialize, return result
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6_

  - [x] 7.3 Write property tests for share controller (`tests/share-controller.properties.test.ts`)
    - **Property 17: Share invokes navigator.share with correct parameters**
    - **Validates: Requirements 5.2**

  - [x] 7.4 Write property test for share clipboard fallback (`tests/share-controller.properties.test.ts`)
    - **Property 18: Share falls back to clipboard when share is unavailable or fails**
    - **Validates: Requirements 5.3, 5.5**

  - [x] 7.5 Write unit tests for share controller (`tests/share-controller.unit.test.ts`)
    - Test AbortError handling, unsupported browser scenario
    - _Requirements: 5.2, 5.3, 5.5, 5.6_

  - [x] 7.6 Write unit tests for import controller (`tests/import-controller.unit.test.ts`)
    - Test full import flow, cancel flow, URL cleanup, error notification
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement ListSelector UI component
  - [x] 9.1 Create `src/components/ListSelector.ts`
    - Horizontal scrollable bar of list tabs with "+" button
    - Active list tab visually highlighted
    - Double-click on tab enters rename mode (inline editable)
    - Delete affordance on each tab (hidden when only one list)
    - `update(config)` method for re-rendering with new data
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 9.2 Write unit tests for ListSelector (`tests/ListSelector.test.ts`)
    - Test component rendering, interaction callbacks, rename mode, delete visibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 10. Integrate everything in AppShell and add styles
  - [x] 10.1 Refactor `src/index.ts` AppShell to use `MultiListState` and wire all new modules
    - Replace `AppState` usage with `MultiListState`
    - Add `ListSelector` component to app structure
    - Add "Share" button to the UI
    - Wire `ListSelector` callbacks to dispatch `CREATE_LIST`, `DELETE_LIST`, `RENAME_LIST`, `SWITCH_LIST`
    - Wire "Share" button: serialize active list → encode URL → call `shareList` → show notification
    - On init: call `checkImportUrl`, show confirm prompt if list decoded, dispatch `IMPORT_LIST` on confirm
    - Remove `#list=` fragment after import via `history.replaceState`
    - Update `render()` to scope sections/items to active list
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 10.2 Add CSS styles for ListSelector and share button in `src/styles/main.css`
    - Style list selector bar (horizontal scroll, tab appearance, active highlight)
    - Style share button
    - Style import confirmation prompt
    - _Requirements: 1.1, 5.1_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All property tests use fast-check with `{ numRuns: 100 }`
