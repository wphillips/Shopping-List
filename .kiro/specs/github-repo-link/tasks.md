# Implementation Plan: GitHub Repository Link

## Overview

Add a GitHub repository link to the app footer in `AppShell.createAppStructure()` and style it with CSS. The implementation is minimal: one HTML element addition, one CSS rule set, and unit tests.

## Tasks

- [x] 1. Add GitHub link element to the footer template
  - [x] 1.1 Add `<a>` element in `AppShell.createAppStructure()` in `src/index.ts`
    - Insert an anchor element inside the `<footer>` template literal, after the `.build-timestamp` span and before the closing `</footer>` tag
    - The anchor must have: `href` pointing to the GitHub repository URL, `target="_blank"`, `rel="noopener noreferrer"`, `aria-label="View source code on GitHub"`, `class="github-link"`, and visible text `"GitHub"`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.3_

  - [x] 1.2 Add `.github-link` CSS rules to `src/styles/main.css`
    - Add a `.github-link` rule set in the app footer section with: `display: block`, `font-size: 0.75rem`, `color: var(--text-disabled)`, `text-align: center`, `text-decoration: none`, `margin-bottom: 0.25rem`
    - Add a `.github-link:hover` rule with: `color: var(--text-secondary)`, `text-decoration: underline`
    - _Requirements: 3.1, 3.2_

- [x] 2. Checkpoint - Verify link renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Write unit tests for the GitHub link
  - [ ]* 3.1 Create unit test file `tests/github-repo-link.unit.test.ts`
    - Test that the footer contains an `<a>` element with class `github-link` (validates 1.1)
    - Test that `href` points to the expected GitHub repository URL (validates 1.1)
    - Test that `target="_blank"` is set (validates 1.2)
    - Test that visible `textContent` is `"GitHub"` (validates 1.3)
    - Test that `aria-label` is `"View source code on GitHub"` (validates 2.1)
    - Test that `rel` is `"noopener noreferrer"` (validates 2.2)
    - Test DOM order: `.build-timestamp` → `.github-link` → `.update-btn` (validates 3.3)
    - Test that computed font-size and color match the build timestamp element (validates 3.1)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.3_

- [x] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- No property-based tests needed — all criteria involve fixed static values
- The update button is appended dynamically in the constructor, so the `<a>` in the template will naturally appear between the timestamp and the button in DOM order
