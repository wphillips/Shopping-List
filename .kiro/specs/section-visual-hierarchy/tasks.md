# Implementation Plan: Section Visual Hierarchy

## Overview

CSS-only changes to `src/styles/main.css` to reduce section header visual weight (muted background, smaller/lighter font, uppercase letter-spacing, reduced padding) while keeping item rows completely unchanged. All modifications target `.section-header` and `.section-title` rules across default, mobile, tablet, and desktop breakpoints.

## Tasks

- [x] 1. Modify default section header and title styles
  - [x] 1.1 Update `.section-header` base styles in `src/styles/main.css`
    - Change `background-color` from `var(--bg-tertiary)` to `var(--bg-secondary)`
    - Change `padding` from `0.5rem 0.75rem` to `0.25rem 0.75rem`
    - Change `min-height` from `44px` to `auto`
    - _Requirements: 1.1, 9.1, 9.2, 9.3_
  - [x] 1.2 Update `.section-header:hover` background
    - Change from `var(--bg-hover)` to `var(--bg-tertiary)` so hover remains less prominent than item default
    - _Requirements: 3.3_
  - [x] 1.3 Update `.section-title` base styles
    - Change `font-size` from `1rem` to `0.8125rem`
    - Change `font-weight` from `500` to `400`
    - Change `color` from `var(--text-primary)` to `var(--text-secondary)`
    - Add `text-transform: uppercase`
    - Add `letter-spacing: 0.05em`
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [x] 2. Update responsive breakpoint overrides
  - [x] 2.1 Update mobile media query (`max-width: 767px`) section header styles
    - Change `.section-header` padding from `4px 0.5rem` to `0.25rem 0.5rem`
    - Change `.section-header` min-height from `36px` to `auto`
    - Change `.section-title` font-size from `0.9375rem` to `0.75rem`
    - _Requirements: 6.1, 6.3, 9.1, 9.2_
  - [x] 2.2 Update desktop media query (`min-width: 1025px`) section header styles
    - Change `.section-header` padding from `0.625rem 1rem` to `0.25rem 1rem`
    - _Requirements: 6.1, 9.1_

- [x] 3. Checkpoint - Verify visual changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Write property-based and unit tests
  - [ ]* 4.1 Write property test: Section title is subordinate to item name across all breakpoints
    - **Property 1: Section title is subordinate to item name across all breakpoints**
    - Parse `main.css` with PostCSS, generate breakpoint contexts with fast-check, verify `.section-title` font-size < `.item-name` font-size and font-weight <= 400
    - **Validates: Requirements 1.2, 1.3, 6.1, 6.3**
  - [ ]* 4.2 Write property test: Item styling remains unchanged
    - **Property 2: Item styling remains unchanged**
    - Parse `main.css`, verify `.item-name` font-size is `0.9375rem` and no font-weight declaration exists across all breakpoints
    - **Validates: Requirements 2.1, 2.2, 2.3**
  - [ ]* 4.3 Write property test: Section header hover remains less prominent than item default
    - **Property 3: Section header hover remains less prominent than item default**
    - Resolve CSS variable references to hex values, compare luminance of `.section-header:hover` bg vs `.item` bg
    - **Validates: Requirements 3.3**
  - [ ]* 4.4 Write property test: WCAG contrast compliance
    - **Property 4: WCAG contrast compliance for text/background pairings**
    - Parse `:root` hex values, compute WCAG 2.1 contrast ratios for section header text/bg and item text/bg pairings, verify >= 4.5:1
    - **Validates: Requirements 7.1, 7.2**
  - [ ]* 4.5 Write property test: Section header padding is reduced
    - **Property 5: Section header padding is reduced**
    - Parse padding and min-height across breakpoints, verify vertical padding is 0.25rem and min-height is `auto`
    - **Validates: Requirements 9.1, 9.2**
  - [ ]* 4.6 Write property test: Touch target minimums preserved
    - **Property 6: Touch target minimums preserved**
    - Parse `.section-controls button` min-width/min-height across breakpoints, verify >= 44px on tablet/desktop and >= 36px on mobile
    - **Validates: Requirements 4.1**
  - [ ]* 4.7 Write unit tests for section visual hierarchy
    - Verify `.section-title` has `text-transform: uppercase` and `letter-spacing: 0.05em` (Req 1.5)
    - Verify `.section-title` color is `var(--text-secondary)` (Req 1.4)
    - Verify `.section-header` has `border-bottom` declaration (Req 3.1)
    - Verify `.section` has `margin-bottom > 0` (Req 3.2)
    - Verify `.item.checked .item-name` retains `--checked-text`, `line-through` (Req 5.1)
    - Verify `.item-name` font-size is `0.9375rem`, no font-weight added (Req 2.1, 2.2)
    - Verify `.item` background is `var(--bg-secondary)` unchanged (Req 2.3)
    - Verify `.item-name` color is `var(--text-primary)` unchanged (Req 2.4)
    - Verify section `margin-bottom` not increased beyond current values (Req 10.2)
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 5.1, 10.2_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- This is a CSS-only change — no TypeScript/HTML modifications needed
- Item rows (`.item`, `.item-name`) must NOT be modified at all
- All section control buttons (rename, move up/down, delete) are preserved — only visual styling changes
- Property tests follow the existing `mobile-layout-density.properties.test.ts` pattern using PostCSS + fast-check
