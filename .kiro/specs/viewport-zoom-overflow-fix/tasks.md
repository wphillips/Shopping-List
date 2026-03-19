# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Mobile Viewport Zoom Overflow
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the viewport overflow bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases: viewport meta tag missing `maximum-scale=1.0` and `user-scalable=no`, and CSS missing `overflow-x: hidden` on html/body
  - Create test file `tests/viewport-zoom-overflow.exploration.test.ts`
  - Parse `index.html` and assert the viewport meta tag content attribute includes `maximum-scale=1.0` and `user-scalable=no` (will fail on unfixed code)
  - Read `src/styles/main.css` and assert that `html, body` (or `html` and `body` separately) have `overflow-x: hidden` (will fail on unfixed code)
  - Assert that `.install-prompt-banner` has `max-width: 100vw` and `overflow-x: hidden` to prevent horizontal overflow (will fail on unfixed code)
  - Assert that `.notification` has `overflow-x: hidden` (will fail on unfixed code)
  - Use `fast-check` to generate random viewport widths (320–430px range for mobile) and verify the CSS rules would prevent horizontal overflow for all widths
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., "viewport meta tag is `width=device-width, initial-scale=1.0` — missing `maximum-scale=1.0` and `user-scalable=no`")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Existing Layout and Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create test file `tests/viewport-zoom-overflow.preservation.test.ts`
  - Observe on UNFIXED code: `#app` has `max-width: 1024px` and `margin: 0 auto` in CSS — desktop layout centering works
  - Observe on UNFIXED code: `.install-prompt-banner` has `position: fixed`, `bottom: 0`, `left: 0`, `right: 0` — banner renders at bottom
  - Observe on UNFIXED code: `.notification` has `position: fixed`, `bottom: 1.5rem`, `left: 50%`, `transform: translateX(-50%)`, `max-width: calc(100% - 2rem)` — toast centered at bottom
  - Observe on UNFIXED code: no rule sets `overflow-y: hidden` on `html` or `body` — vertical scrolling is unrestricted
  - Observe on UNFIXED code: `.list-selector__dropdown` has `z-index: 100` and `position: absolute` — dropdown stacking works
  - Write property-based tests using `fast-check`:
    - For all CSS content variations, `#app` max-width and margin centering are preserved
    - For all CSS content variations, `.install-prompt-banner` retains `position: fixed`, `bottom: 0`, `left: 0`, `right: 0`, and child elements (`.install-prompt-message`, `.install-prompt-install`, `.install-prompt-dismiss`) are present
    - For all CSS content variations, `.notification` retains fixed positioning, centering transform, and max-width constraint
    - For all CSS content variations, vertical scrolling is NOT blocked (no `overflow-y: hidden` on html/body)
    - For all CSS content variations, `.list-selector__dropdown` retains z-index and absolute positioning
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for mobile viewport zoom overflow

  - [x] 3.1 Update viewport meta tag in index.html
    - Change `<meta name="viewport" content="width=device-width, initial-scale=1.0">` to `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`
    - This prevents mobile browsers from applying zoom drift on page load
    - _Bug_Condition: isBugCondition(input) where viewportMetaTag.maximumScale IS NOT SET OR viewportMetaTag.userScalable != "no"_
    - _Expected_Behavior: viewport meta tag includes maximum-scale=1.0 and user-scalable=no_
    - _Preservation: Desktop browsers ignore these directives — no desktop impact_
    - _Requirements: 1.2, 2.2_

  - [x] 3.2 Add overflow-x: hidden to html and body in CSS
    - Add `html, body { overflow-x: hidden; width: 100%; }` rule to `src/styles/main.css`
    - Place it near the top of the file, after the reset styles and before the `body` rule
    - This prevents any child element from causing horizontal scrolling
    - Do NOT add `overflow-y: hidden` — vertical scrolling must remain functional
    - _Bug_Condition: isBugCondition(input) where htmlElement.overflowX != "hidden" OR bodyElement.overflowX != "hidden"_
    - _Expected_Behavior: html and body have overflow-x: hidden and width: 100%_
    - _Preservation: Vertical scrolling unaffected, desktop layout unaffected_
    - _Requirements: 1.4, 2.4, 3.4_

  - [x] 3.3 Constrain fixed-position elements to prevent horizontal overflow
    - Add `max-width: 100vw` and `overflow-x: hidden` to `.install-prompt-banner` in `src/styles/main.css`
    - Add `overflow-x: hidden` to `.notification` in `src/styles/main.css`
    - These defensive rules ensure fixed-position elements cannot push content beyond the viewport width even with padding/borders
    - _Bug_Condition: isBugCondition(input) where fixed-position elements span full width with padding/borders_
    - _Expected_Behavior: no fixed-position element exceeds viewport width_
    - _Preservation: Banner and notification visual appearance and functionality unchanged_
    - _Requirements: 1.3, 2.3, 3.2, 3.3_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Mobile Viewport Renders at Exactly 100% Scale
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (viewport meta tag has correct directives, CSS has overflow constraints)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `tests/viewport-zoom-overflow.exploration.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** — Existing Layout and Functionality Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `tests/viewport-zoom-overflow.preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm desktop layout, install prompt banner, notification toast, vertical scrolling, and dropdown behavior are all preserved
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run full test suite to ensure no regressions across the project
  - Ensure all tests pass, ask the user if questions arise
