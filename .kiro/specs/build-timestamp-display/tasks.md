# Implementation Plan: Build Timestamp Display

## Overview

Add a build-time timestamp to the app footer and "up to date" notification. The implementation uses Vite's `define` config for injection, a type declaration for TypeScript support, a pure helper for short-format derivation, and DOM/CSS changes in AppShell.

## Tasks

- [x] 1. Add build timestamp injection to Vite config and type declaration
  - [x] 1.1 Update `vite.config.ts` to use callback form and add `define` block
    - Switch `defineConfig({...})` to `defineConfig(({ command }) => ({...}))` to access `command`
    - Add `define: { __BUILD_TIMESTAMP__: JSON.stringify(...) }` with full-format timestamp for `'build'` and `"Built dev"` for `'serve'`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Create `src/build-env.d.ts` type declaration
    - Declare `const __BUILD_TIMESTAMP__: string` as ambient global
    - Verify it is picked up by `tsconfig.json` include glob `src/**/*`
    - _Requirements: 4.1_

- [x] 2. Implement short timestamp helper and display logic
  - [x] 2.1 Create `src/build-timestamp.ts` with `toShortTimestamp()` function
    - Export a pure function that strips the 4-digit year and lowercases "Built" to "built"
    - Handle graceful fallback for non-matching input (e.g. `"Built dev"` → `"built dev"`)
    - _Requirements: 3.1_

  - [x]* 2.2 Write property test: format validity (Property 1)
    - **Property 1: Build timestamp format validity**
    - Generate random `Date` objects, apply formatting logic, assert output matches `Built <Mon> <DD>, <YYYY> <h>:<mm> <AM|PM>` pattern
    - Test file: `tests/build-timestamp-display.properties.test.ts`
    - **Validates: Requirements 1.1, 1.3**

  - [x]* 2.3 Write property test: short timestamp derivation (Property 2)
    - **Property 2: Short timestamp derivation preserves components**
    - Generate random full-format timestamps, apply `toShortTimestamp`, assert lowercase "built", same month/day/time, no year
    - Test file: `tests/build-timestamp-display.properties.test.ts`
    - **Validates: Requirements 3.1**

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update AppShell footer and notification
  - [x] 4.1 Add build timestamp `<span>` to `createAppStructure()` in `src/index.ts`
    - Add `<span class="build-timestamp">` inside the footer, before the update button
    - Set its text content to `__BUILD_TIMESTAMP__`
    - _Requirements: 2.1, 2.3_

  - [x] 4.2 Add `.build-timestamp` CSS styles to `src/styles/main.css`
    - Add `display: block; font-size: 0.75rem; color: var(--text-disabled); margin-bottom: 0.25rem;`
    - _Requirements: 2.2_

  - [x] 4.3 Modify `handleForceUpdate()` up-to-date notification in `src/index.ts`
    - Import `toShortTimestamp` from `./build-timestamp`
    - Change `'up-to-date'` case message to `` `App is up to date (${toShortTimestamp(__BUILD_TIMESTAMP__)})` ``
    - Leave other status messages unchanged
    - _Requirements: 3.1, 3.2_

  - [x]* 4.4 Write unit tests for footer DOM structure and notification messages
    - Verify footer contains `.build-timestamp` span adjacent to `.update-btn`
    - Verify timestamp span is non-interactive (no click handler, not a button/anchor)
    - Verify up-to-date notification includes short timestamp
    - Verify non-up-to-date statuses exclude timestamp
    - Verify `toShortTimestamp("Built dev")` returns `"built dev"`
    - Test file: `tests/build-timestamp-display.unit.test.ts`
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

- [x] 5. Update README documentation
  - [x] 5.1 Add build timestamp section to `README.md`
    - Explain that the app displays a build timestamp in the footer
    - Describe how the timestamp is injected at build time via Vite's `define` config
    - Note that in development mode the timestamp shows "Built dev"
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- The implementation language is TypeScript, matching the existing codebase
