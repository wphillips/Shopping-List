# Implementation Plan: Dependency Upgrade

## Overview

Upgrade all outdated dependencies in sequence, removing unused packages first, then upgrading Vite→Vitest→fast-check→jsdom→@types/node. Each step includes a verification checkpoint using the existing 262-test suite as the regression gate. No new tests are needed. Steering docs are updated last.

## Tasks

- [x] 1. Remove unused packages
  - [x] 1.1 Remove vite-plugin-pwa and workbox-window from the project
    - Run `npm uninstall vite-plugin-pwa workbox-window` to remove both packages from `package.json` and `package-lock.json`
    - Verify `package.json` no longer contains `vite-plugin-pwa` in devDependencies or `workbox-window` in dependencies
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 Checkpoint — verify build and tests after removal
    - Run `npm run build` and confirm it completes without errors
    - Run `npm test` and confirm all 262 tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 1.5_

- [x] 2. Upgrade Vite 5→8
  - [x] 2.1 Install Vite 8.x
    - Run `npm install vite@^8 --save-dev` to upgrade Vite
    - Verify `package.json` declares `vite` with a `^8` version range in devDependencies
    - _Requirements: 2.1_
  - [x] 2.2 Update vite.config.ts for Vite 8 compatibility
    - Check if `rollupOptions` needs to be renamed to `rolldownOptions` (Vite 8 uses Rolldown bundler)
    - If Vite 8 does not accept `rollupOptions`, rename the key to `rolldownOptions` in `vite.config.ts`
    - Ensure `plugins: []`, `publicDir`, and `test` block remain unchanged
    - _Requirements: 2.3, 2.4_
  - [x] 2.3 Checkpoint — verify build after Vite upgrade
    - Run `npm run build` and confirm it completes without errors or CJS deprecation warnings
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 2.2, 2.5_

- [x] 3. Upgrade Vitest 1→4
  - [x] 3.1 Install Vitest 4.x
    - Run `npm install vitest@^4 --save-dev` to upgrade Vitest
    - Verify `package.json` declares `vitest` with a `^4` version range in devDependencies
    - _Requirements: 3.1_
  - [x] 3.2 Update vite.config.ts for Vitest 4 compatibility if needed
    - Verify the `test` block in `vite.config.ts` is compatible with Vitest 4 (`globals: true`, `environment: 'jsdom'`)
    - If Vitest 4 requires explicit pool settings or changes the config format, update accordingly
    - _Requirements: 3.5, 3.6_
  - [x] 3.3 Fix any test compatibility issues
    - Run `npm test` and check for failures
    - If Vitest 4 changes mock restoration behavior, update affected test files (likely none based on design analysis)
    - If Vitest 4 changes `vi.fn().getMockName()` default, update affected assertions (likely none based on design analysis)
    - _Requirements: 3.2, 3.3, 3.4_
  - [x] 3.4 Checkpoint — verify all tests pass after Vitest upgrade
    - Run `npm test` and confirm all 262 tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 3.2_

- [x] 4. Upgrade fast-check 3→4
  - [x] 4.1 Install fast-check 4.x
    - Run `npm install fast-check@^4 --save-dev` to upgrade fast-check
    - Verify `package.json` declares `fast-check` with a `^4` version range in devDependencies
    - _Requirements: 4.1_
  - [x] 4.2 Fix any property-based test compatibility issues
    - Run `npm test` and check property-based test files for failures
    - If fast-check 4 removes or renames any arbitraries used in tests, update to replacement APIs
    - Core APIs (`fc.assert`, `fc.property`, `fc.string`, `fc.integer`, `fc.boolean`, `fc.array`, `fc.pre`) are expected to be unchanged
    - _Requirements: 4.2, 4.3, 4.4_
  - [x] 4.3 Checkpoint — verify all tests pass after fast-check upgrade
    - Run `npm test` and confirm all property-based tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 4.2_

- [x] 5. Upgrade jsdom 28→29
  - [x] 5.1 Install jsdom 29.x
    - Run `npm install jsdom@^29 --save-dev` to upgrade jsdom
    - Verify `package.json` declares `jsdom` with a `^29` version range in devDependencies
    - _Requirements: 5.1_
  - [x] 5.2 Fix any DOM-related test compatibility issues
    - Run `npm test` and check for failures in tests that use DOM APIs
    - If jsdom 29 changes behavior of any DOM API used by test files, update accordingly
    - _Requirements: 5.2, 5.3_
  - [x] 5.3 Checkpoint — verify all tests pass after jsdom upgrade
    - Run `npm test` and confirm all 262 tests pass
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 5.2_

- [x] 6. Upgrade @types/node 20→25
  - [x] 6.1 Install @types/node 25.x
    - Run `npm install @types/node@^25 --save-dev` to upgrade type definitions
    - Verify `package.json` declares `@types/node` with a `^25` version range in devDependencies
    - _Requirements: 6.1_
  - [x] 6.2 Checkpoint — verify build compiles after @types/node upgrade
    - Run `npm run build` and confirm `tsc` compiles without type errors
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 6.2_

- [x] 7. Full regression verification
  - [x] 7.1 Run complete build and test suite
    - Run `npm run build` and confirm it completes without errors, CJS warnings, or type errors
    - Run `npm test` and confirm all 262 tests pass across all 20 test files
    - Verify `dist/` output is produced with the expected structure
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 8. Update steering documentation
  - [x] 8.1 Update architecture.md with new dependency versions
    - Change Vite version from `5.x` to `8.x` in the Tech Stack section
    - Change fast-check version from `3.x` to `4.x` in the Tech Stack section
    - Remove any references to `vite-plugin-pwa` or `workbox-window` if present
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 8.2 Update development-workflow.md with Node.js prerequisite
    - If Vitest 4 requires Node >= 20, update the Prerequisites section from `Node.js 18+` to `Node.js 20+`
    - Remove any references to `vite-plugin-pwa` or `workbox-window` if present
    - _Requirements: 8.3, 8.4_
  - [x] 8.3 Final checkpoint
    - Ensure all tests pass, ask the user if questions arise.

## Notes

- No new tests are needed — the existing 262 tests serve as the regression gate
- Each upgrade step is independently committable; partial upgrades are acceptable as long as build and tests pass
- If `npm install` fails due to peer dependency conflicts, try `--legacy-peer-deps` temporarily
- The minimum viable upgrade is Vite 8 + Vitest 4 together (peer dependency relationship)
