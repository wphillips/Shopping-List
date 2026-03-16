# Implementation Plan: Debounce Filter Input

## Overview

Add a 300ms debounce to the `InputField` component's filter callback (`onInput`) so the item list only updates after the user pauses typing. Submit (Enter) and input-clear paths remain immediate. All changes are scoped to `InputField` and its tests.

## Tasks

- [x] 1. Add debounce logic to InputField component
  - [x] 1.1 Add private debounce state and constant to `InputField`
    - Add `private debounceTimer: ReturnType<typeof setTimeout> | null = null` field
    - Add `private readonly DEBOUNCE_DELAY = 300` constant
    - _Requirements: 1.4, 4.1_

  - [x] 1.2 Implement debounced input handler in `attachEventListeners`
    - Replace the existing `input` event listener with debounce logic:
      - Cancel any pending timer on each keystroke
      - If the new value is empty, invoke `onInput("")` immediately (bypass debounce)
      - Otherwise, start a new 300ms timer that invokes `onInput(currentValue)`
    - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 4.1_

  - [x] 1.3 Update `handleSubmit` to cancel pending debounce timer
    - Before calling `onSubmit`, cancel any pending debounce timer
    - After clearing the input, invoke `onInput("")` immediately (not debounced)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.4 Add `destroy()` public method
    - Cancel any pending debounce timer and set it to null
    - _Requirements: 4.2, 4.3_

  - [x] 1.5 Update `clear()` method to cancel pending debounce timer
    - Cancel any pending debounce timer before clearing and invoking `onInput("")`
    - _Requirements: 3.1, 3.2_

- [x] 2. Checkpoint - Verify existing tests still pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add debounce unit tests
  - [x] 3.1 Create `tests/InputField.debounce.test.ts` with unit tests
    - Test: typing a single character and advancing 300ms fires `onInput` once
    - Test: rapid keystrokes within 300ms coalesce into a single `onInput` call with final value
    - Test: pressing Enter before 300ms fires `onSubmit` immediately and cancels pending debounce
    - Test: pressing Enter clears input and fires `onInput("")` immediately
    - Test: clearing input to empty fires `onInput("")` immediately and cancels pending debounce
    - Test: `destroy()` cancels pending timer so `onInput` is never called
    - Test: debounce delay is exactly 300ms (fires at 300, not at 299)
    - Test: multiple `destroy()` calls are safe (no errors)
    - Use `vi.useFakeTimers()` for deterministic timer control
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.2, 4.3_

  - [x] 3.2 Write property test: Debounce coalesces keystrokes (Property 1)
    - **Property 1: Debounce coalesces keystrokes into a single delayed callback**
    - Generator: `fc.array(fc.char(), {minLength: 1, maxLength: 20})` for random keystroke sequences
    - Assert: `onInput` called exactly once with the final value after 300ms
    - Create in `tests/InputField.debounce.properties.test.ts`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 3.3 Write property test: Submit cancels debounce (Property 2)
    - **Property 2: Submit immediately fires and cancels pending debounce**
    - Generator: `fc.string({minLength: 1, maxLength: 50}).filter(s => s.trim().length > 0)` for random non-empty strings
    - Assert: `onSubmit` called with trimmed value, pending debounce cancelled, `onInput("")` called immediately
    - Add to `tests/InputField.debounce.properties.test.ts`
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x] 3.4 Write property test: Empty input bypasses debounce (Property 3)
    - **Property 3: Empty input bypasses debounce**
    - Generator: `fc.string({minLength: 1, maxLength: 50})` for random strings typed before clearing
    - Assert: `onInput("")` called immediately, pending debounce cancelled
    - Add to `tests/InputField.debounce.properties.test.ts`
    - **Validates: Requirements 3.1, 3.2**

  - [x] 3.5 Write property test: Destroy prevents stale callbacks (Property 4)
    - **Property 4: Destroy prevents stale callbacks**
    - Generator: `fc.string({minLength: 1, maxLength: 50})` for random strings with pending debounce
    - Assert: after `destroy()`, advancing timers does not invoke `onInput`
    - Add to `tests/InputField.debounce.properties.test.ts`
    - **Validates: Requirements 4.2, 4.3**

- [x] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes are scoped to `src/components/InputField.ts` and test files
- No changes needed to AppShell, StateManager, FilterControl, or any other component
- Use `vi.useFakeTimers()` / `vi.advanceTimersByTime()` for all timer-dependent tests
- `fast-check` is already in devDependencies
