# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Missing PWA URL Handling Declarations
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the manifest lacks URL handling signals
  - **Scoped PBT Approach**: Parse `public/manifest.webmanifest` and assert the presence and correctness of `share_target`, `handle_links`, and `scope` fields
  - Test that `manifest.share_target` is defined with `action: "/"`, `method: "GET"`, and `params.url: "list"`
  - Test that `manifest.handle_links` equals `"preferred"`
  - Test that `manifest.scope` equals `"/"`
  - Test that `share_target.params.url` matches the `list` query key used by `decodeListFragment` in `src/url-codec.ts`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the manifest lacks URL handling declarations)
  - Document counterexamples found (e.g., `manifest.share_target` is `undefined`, `manifest.handle_links` is `undefined`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.3, 2.1, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing PWA Manifest Fields and Codec Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: existing manifest fields (`name`, `short_name`, `start_url`, `display`, `icons`, etc.) on unfixed code
  - Observe: `encodeListUrl` and `decodeListFragment` round-trip behavior on unfixed code with random serialized grocery lists
  - Observe: `decodeListFragment` returns `null` for URLs without a `list=` parameter on unfixed code
  - Observe: `processImport` returns `{ action: 'none' }` when no `list=` parameter is present on unfixed code
  - Write property-based test: for all random serialized grocery list JSON strings, `decodeListFragment(encodeListUrl(json, origin).split('?')[1])` round-trips to the original JSON (preservation of codec behavior from Requirement 3.2)
  - Write property-based test: for all URL strings without a `list=` parameter, `decodeListFragment` returns `null` (preservation of direct-launch behavior from Requirement 3.3)
  - Write test: existing manifest fields (`name`, `short_name`, `description`, `start_url`, `display`, `background_color`, `theme_color`, `icons`) remain unchanged after fix (preservation from Requirements 3.1, 3.3, 3.4)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix manifest to declare PWA URL handling for share links

  - [x] 3.1 Add `scope`, `handle_links`, and `share_target` to `public/manifest.webmanifest`
    - Add `"scope": "/"` to explicitly declare the PWA's URL scope
    - Add `"handle_links": "preferred"` so browsers prefer opening in-scope URLs in the installed PWA
    - Add `"share_target": { "action": "/", "method": "GET", "params": { "url": "list" } }` so the OS routes shared URLs to the PWA via the existing `?list=` query parameter import flow
    - Ensure `share_target.params.url` value `"list"` matches the query key parsed by `decodeListFragment` in `src/url-codec.ts`
    - Preserve all existing manifest fields unchanged
    - _Bug_Condition: isBugCondition(input) where manifest.share_target == undefined AND manifest.handle_links == undefined_
    - _Expected_Behavior: manifest.share_target is defined with action="/", method="GET", params.url="list"; manifest.handle_links == "preferred"; manifest.scope == "/"_
    - _Preservation: Existing manifest fields (name, short_name, start_url, display, icons, theme_color, background_color) remain unchanged_
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Missing PWA URL Handling Declarations
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the manifest now declares proper URL handling
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing PWA Manifest Fields and Codec Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
