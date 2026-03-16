# Implementation Plan: SW Cache Versioning

## Overview

Add automatic cache versioning to the service worker by introducing a `__BUILD_HASH__` placeholder in `public/sw.js` and a custom Vite plugin that replaces it with a content hash of the built assets. This ensures each production build produces a unique service worker, enabling proper cache invalidation.

## Tasks

- [x] 1. Update service worker template with placeholder
  - [x] 1.1 Replace hardcoded cache name with placeholder token
    - In `public/sw.js`, change `const CACHE_NAME = 'grocery-list-v1';` to `const CACHE_NAME = 'grocery-list-__BUILD_HASH__';`
    - No other changes to the service worker file
    - _Requirements: 1.1, 1.2_

- [x] 2. Create the Vite plugin
  - [x] 2.1 Create `vite-plugin-sw-cache-version.ts` with plugin skeleton
    - Create the file at project root alongside `vite.config.ts`
    - Export a `swCacheVersionPlugin()` function returning a Vite `Plugin` object
    - Plugin name: `sw-cache-version`
    - _Requirements: 7.1, 7.4_
  - [x] 2.2 Implement `closeBundle` hook for production builds
    - Read `public/sw.js` template using `fs.readFileSync`
    - List all files in `dist/assets/` directory
    - Read each file's contents, concatenate, compute SHA-256 hash
    - Take first 8 hex characters as the Build_Hash
    - Replace `__BUILD_HASH__` in the template with the Build_Hash
    - Write the result to `dist/sw.js`
    - Handle edge cases: missing template (throw), empty assets dir (warn + hash empty input), missing placeholder (warn + write unchanged)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.3_
  - [x] 2.3 Implement `configureServer` hook for development mode
    - Add middleware that intercepts GET requests for `/sw.js`
    - Read `public/sw.js`, replace `__BUILD_HASH__` with `dev`
    - Serve the result with `Content-Type: application/javascript`
    - If template read fails, call `next()` to fall through to default serving
    - _Requirements: 1.3, 6.1, 6.2_

- [x] 3. Register plugin in Vite config
  - [x] 3.1 Update `vite.config.ts` to import and register the plugin
    - Add `import { swCacheVersionPlugin } from './vite-plugin-sw-cache-version';`
    - Add `swCacheVersionPlugin()` to the `plugins` array
    - _Requirements: 7.1, 7.2_

- [x] 4. Write unit tests
  - [x] 4.1 Create `tests/sw-cache-version-plugin.test.ts`
    - Test that `public/sw.js` contains the `__BUILD_HASH__` placeholder
    - Test hash generation produces an 8-char hex string
    - Test placeholder replacement produces valid output (no `__BUILD_HASH__` remaining)
    - Test dev mode replacement substitutes `dev` for `__BUILD_HASH__`
    - Test edge case: missing placeholder logs warning
    - _Requirements: 1.1, 1.2, 2.3, 6.1_

- [x] 5. Write property-based tests
  - [x] 5.1 Create `tests/sw-cache-version-plugin.properties.test.ts` with Property 1
    - Feature: sw-cache-versioning, Property 1: Distinct asset contents produce distinct hashes
    - Generate pairs of distinct random byte arrays, compute hashes, assert they differ
    - Minimum 100 iterations
    - _Requirements: 2.1, 2.2, 3.1_
  - [x] 5.2 Add Property 2: Placeholder replacement produces valid service worker
    - Feature: sw-cache-versioning, Property 2: Placeholder replacement produces valid service worker
    - Generate random 8-char hex strings, run replacement on template, verify output contains hash and no placeholder
    - Minimum 100 iterations
    - _Requirements: 2.3_
  - [x] 5.3 Add Property 3: Cache cleanup retains only the current cache
    - Feature: sw-cache-versioning, Property 3: Cache cleanup retains only the current cache
    - Generate random sets of cache names + current cache name, simulate activate cleanup, verify only current remains
    - Minimum 100 iterations
    - _Requirements: 4.2, 4.3_
  - [x] 5.4 Add Property 4: Cache name round-trip
    - Feature: sw-cache-versioning, Property 4: Cache name round-trip
    - Generate random non-empty alphanumeric strings, construct cache name, extract hash, assert equality
    - Minimum 100 iterations
    - _Requirements: 8.1, 8.2_

- [x] 6. Update existing service worker tests
  - [x] 6.1 Update hardcoded cache name references in `tests/service-worker.test.ts`
    - Replace `'grocery-list-v1'` references with a pattern that accounts for the dynamic hash, or use a known test hash
    - Ensure all existing SW tests still pass
    - _Requirements: 3.1, 4.2_

- [x] 7. Verify build and tests
  - [x] 7.1 Run full build and verify `dist/sw.js` contains a hashed cache name
    - Run `npm run build` and inspect `dist/sw.js`
    - Verify `CACHE_NAME` is `grocery-list-<8-char-hex>`, not `grocery-list-__BUILD_HASH__`
    - _Requirements: 2.4, 7.2_
  - [x] 7.2 Run full test suite and verify all tests pass
    - Run `npm test` and confirm all tests pass including new property-based tests
    - _Requirements: 7.2_
