# Implementation Plan: Search Clear Button

## Overview

Add an inline clear ("✕") button to the InputField component. The implementation wraps the existing input and new clear button in a container div, adds CSS styles, updates existing tests for the new wrapper structure, and adds property-based and unit tests for the new functionality.

## Tasks

- [x] 1. Refactor InputField to use wrapper structure and add clear button
  - [x] 1.1 Add wrapper div, clear button, and `getInputElement()` method to `InputField` class
    - In `src/components/InputField.ts`:
    - Add `private wrapper: HTMLDivElement` and `private clearButton: HTMLButtonElement` members
    - Create `createWrapper()` that builds a `div.input-field-wrapper` with `position: relative`
    - Create `createClearButton()` that builds a `<button type="button">` with text "✕", `aria-label="Clear search"`, class `input-field-clear-btn`, initially hidden (`display: none`, `tabindex="-1"`)
    - Modify constructor to build wrapper containing the input and clear button
    - Change `getElement()` return type to `HTMLDivElement`, returning the wrapper
    - Add `getInputElement(): HTMLInputElement` that returns the raw input element
    - Add `updateClearButtonVisibility()` — shows button (`display: flex`, removes `tabindex="-1"`) when input is non-empty, hides it when empty
    - Add `handleClearClick()` — cancels pending debounce, sets input value to `""`, calls `onInput("")`, moves focus to input, updates button visibility
    - Call `updateClearButtonVisibility()` from the existing input event listener and from `clear()`
    - Attach click listener on clear button calling `handleClearClick()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 1.2 Add CSS styles for wrapper and clear button
    - In `src/styles/main.css`:
    - Add `.input-field-wrapper` — `position: relative`, inherits border/bg/border-radius from `.input-field` styles, `margin-bottom: 0.625rem`
    - Add `.input-field-wrapper .input-field` — removes own border, margin, background; full width
    - Add `.input-field-clear-btn` — absolute positioned right, vertically centered, circular gray background (`border-radius: 50%`, `background: var(--text-secondary)` or `#475569`), white "✕" text, `display: none` by default
    - Add `.input-field-clear-btn:hover` — lighter background for hover state
    - Add right padding on input inside wrapper to prevent text overlap with button
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2. Update existing tests for wrapper structure
  - [x] 2.1 Update `InputField.test.ts` to use `getInputElement()`
    - Replace all `inputField.getElement()` calls with `inputField.getInputElement()` where the test interacts with the raw `HTMLInputElement` (setting `.value`, dispatching events, checking `.type`, `.placeholder`, `aria-label`)
    - Update the rendering test that checks `element.tagName === 'INPUT'` to use `getInputElement()`
    - Add a test verifying `getElement()` returns a `DIV`
    - _Requirements: 3.2, 3.3_

  - [x] 2.2 Update `InputField.integration.test.ts` to use `getInputElement()`
    - Replace all `inputField.getElement()` calls with `inputField.getInputElement()` where the test sets `.value` or dispatches events on the input
    - _Requirements: 3.2, 3.3_

  - [x] 2.3 Update `InputField.debounce.test.ts` to use `getInputElement()`
    - Replace all `inputField.getElement()` calls with `inputField.getInputElement()` where the test sets `.value` or dispatches events on the input
    - _Requirements: 3.2, 3.3_

- [x] 3. Checkpoint - Ensure all existing tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add property-based tests for clear button behavior
  - [ ]* 4.1 Write property test for clear button visibility tracking
    - **Property 1: Clear button visibility tracks input content**
    - In `tests/search-clear-button.properties.test.ts`
    - Use `fc.string({ minLength: 1 })` for non-empty and `fc.constant('')` for empty
    - Assert: non-empty → button visible and focusable; empty → button hidden and `tabindex="-1"`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.3**

  - [ ]* 4.2 Write property test for clear click reset behavior
    - **Property 2: Clear click resets input and invokes filter callback**
    - Use `fc.string({ minLength: 1 })` to generate non-empty input values
    - Assert: after click, input value is `""` and `onInput` called exactly once with `""`
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 4.3 Write property test for debounce cancellation on clear
    - **Property 3: Clear click cancels pending debounce**
    - Use `fc.string({ minLength: 1 })` to type text (starting debounce), then click clear before 300ms
    - Assert: `onInput` is only called with `""`, never with the old typed value
    - **Validates: Requirements 2.3**

  - [ ]* 4.4 Write property test for focus after clear
    - **Property 4: Clear click moves focus to input**
    - Use `fc.string({ minLength: 1 })` to set input value, click clear button
    - Assert: `document.activeElement` is the `HTMLInputElement`
    - **Validates: Requirements 2.4**

  - [ ]* 4.5 Write property test for programmatic clear
    - **Property 5: Programmatic clear() hides button and resets state**
    - Use `fc.string({ minLength: 1 })` to set input value, call `clear()`
    - Assert: input value is `""`, `onInput` called with `""`, clear button hidden
    - **Validates: Requirements 3.4**

- [ ] 5. Add unit tests for structure, accessibility, and edge cases
  - [ ]* 5.1 Write unit tests for clear button
    - In `tests/search-clear-button.unit.test.ts`
    - Test `getElement()` returns a `<div>` with class `input-field-wrapper`
    - Test `getInputElement()` returns an `<input>` element
    - Test wrapper contains both input and button elements
    - Test clear button has `aria-label="Clear search"` and `type="button"`
    - Test clear button contains "✕" text
    - Test clear on already-empty input is idempotent (no double callbacks)
    - Test rapid clear clicks don't cause double callbacks
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 5.1, 5.2_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Existing test files (`InputField.test.ts`, `InputField.integration.test.ts`, `InputField.debounce.test.ts`) must be updated before new tests are added
