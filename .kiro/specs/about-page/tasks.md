# Implementation Plan: About Page

## Overview

Add an About page view to the existing `AppShell` class with view toggling, footer updates, CSS styling, and tests. All changes are in TypeScript within the existing Vite + Vitest project.

## Tasks

- [x] 1. Update footer and add view state to AppShell
  - [x] 1.1 Add `currentView` property and view-switching methods to `AppShell`
    - Add `private currentView: 'main' | 'about' = 'main'` property
    - Add `showAboutPage()` method that sets `currentView = 'about'` and calls `render()`
    - Add `showMainView()` method that sets `currentView = 'main'` and calls `render()`
    - _Requirements: 4.3_

  - [x] 1.2 Modify `createAppStructure()` to update footer
    - Remove the `<span class="build-timestamp">` and `<a class="github-link">` from the footer template
    - Add `<a href="#" class="about-link" aria-label="About this app">About</a>` after the update button in the footer
    - Wire the About link click to call `showAboutPage()`
    - _Requirements: 2.5, 2.6, 3.1, 3.2, 6.2_

  - [x] 1.3 Implement `renderAboutPage()` method
    - Render the About page HTML into `#sections-container` with heading, description, feature list, build timestamp, and GitHub link
    - Include back button as first element: `<button class="about-back-btn" aria-label="Back to grocery list">← Back</button>`
    - Include `<footer class="about-footer">` with build timestamp and GitHub link (`target="_blank"`, `rel="noopener noreferrer"`)
    - Wire back button click to call `showMainView()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 6.1, 6.3, 6.4_

  - [x] 1.4 Add view guard to `render()` method
    - At the top of `render()`, check `if (this.currentView === 'about') { this.renderAboutPage(); return; }`
    - _Requirements: 4.3_

- [x] 2. Add About page CSS styles
  - [x] 2.1 Add styles for `.about-page`, `.about-back-btn`, `.about-link`, and `.about-footer` to `src/styles/main.css`
    - Use existing CSS custom properties (`--bg-primary`, `--text-primary`, `--text-disabled`, `--accent`, etc.)
    - Style `.about-link` to match `.update-btn` font size and color
    - Ensure responsive readability across mobile, tablet, and desktop breakpoints
    - _Requirements: 3.3, 5.1, 5.2, 5.3_

- [x] 3. Checkpoint - Verify core implementation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Write tests for About page
  - [ ]* 4.1 Write property test for view switching round trip
    - **Property 1: View switching round trip**
    - Generate random `MultiListState` values with varying lists, sections, items, and filter modes using `fast-check`
    - Instantiate `AppShell`, navigate to About page, click Back, assert main view is restored with sections container populated
    - Minimum 100 iterations
    - Test file: `tests/about-page.properties.test.ts`
    - **Validates: Requirements 4.3**

  - [ ]* 4.2 Write unit tests for About page content
    - Verify About page contains heading (`h1`), description text, and all four feature descriptions (movable sections, sharing, offline support, multiple lists)
    - Test file: `tests/about-page.unit.test.ts`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.1_

  - [ ]* 4.3 Write unit tests for build info on About page
    - Verify About page displays build timestamp and GitHub link with correct URL, `target="_blank"`, and `rel="noopener noreferrer"`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.4_

  - [ ]* 4.4 Write unit tests for footer changes
    - Verify main footer no longer contains `.build-timestamp` span or `.github-link` anchor
    - Verify footer contains `.about-link` element positioned after the update button
    - _Requirements: 2.5, 2.6, 3.1, 3.2, 3.3, 6.2_

  - [ ]* 4.5 Write unit tests for back navigation
    - Verify About page has a back button as the first interactive element with `aria-label="Back to grocery list"`
    - Verify clicking back button returns to main view
    - _Requirements: 4.1, 4.2, 4.3, 6.3_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The project uses TypeScript, Vitest, and fast-check (all already in devDependencies)
- All unit tests go in `tests/about-page.unit.test.ts`, property tests in `tests/about-page.properties.test.ts`
- No new data models or state persistence needed — `currentView` is a transient UI property
