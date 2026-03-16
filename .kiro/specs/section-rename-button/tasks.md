# Implementation Plan: Section Rename Button

## Overview

Add a visible ✏️ rename button to section controls in `src/components/Section.ts`. The button is the first control button, uses the existing `icon-only` class and `data-action` pattern, and calls the existing `enterRenameMode()` method. No new files or CSS changes needed.

## Tasks

- [x] 1. Add rename button to Section component
  - [x] 1.1 Create the rename button element in `createElement()`
    - In `src/components/Section.ts`, in the `createElement()` method, create a `<button>` element with `className='icon-only'`, `textContent='✏️'`, `aria-label='Rename section'`, and `data-action='rename'`
    - Append the rename button to the controls container as the first child, before moveUpBtn, moveDownBtn, and deleteBtn
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2_
  - [x] 1.2 Add rename case to controls click handler
    - In the `attachEventListeners()` method, add a `case 'rename': this.enterRenameMode(); break;` to the existing `switch` statement in the controls click listener
    - The existing `event.stopPropagation()` at the top of the handler already prevents collapse toggle
    - _Requirements: 2.1, 2.2_
  - [x] 1.3 Verify existing double-click rename is preserved
    - Confirm the double-click handler on the title span is unchanged and still calls `enterRenameMode()`
    - _Requirements: 3.1, 3.2_

- [x] 2. Verify all tests pass
  - [x] 2.1 Run the full test suite
    - Run `npm test` and confirm all 262 tests pass
    - No new test files are needed — existing rename unit tests and property tests cover the behavior
    - _Requirements: 2.3, 3.2_
