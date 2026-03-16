# Implementation Plan: Force Update Control

## Overview

Add a "Force Update" button to the Grocery List PWA header that triggers a service worker update check, clears all caches, and hard-reloads the page. Implementation follows a bottom-up approach: utility module first, then AppShell wiring, then CSS, then tests.

## Tasks

- [x] 1. Create the `forceUpdate` utility module
  - [x] 1.1 Create `src/forceUpdate.ts` with `ForceUpdateDeps`, `ForceUpdateResult` interfaces and `forceUpdate` async function
    - Implement the orchestration logic: check registration availability, call `registration.update()`, clear all caches via `caches.keys()` + `caches.delete()`, then call `reload()`
    - Return appropriate `ForceUpdateResult` for each outcome: `reloading`, `up-to-date`, `unsupported`, `error`
    - Handle errors at each phase independently so a failure in one phase does not block subsequent phases
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 1.2 Write property test: All caches are deleted (Property 1)
    - **Property 1: All caches are deleted**
    - Generate random arrays of cache name strings, populate a mock `CacheStorage`, call `forceUpdate`, assert all caches are gone
    - Create `tests/forceUpdate.properties.test.ts`
    - **Validates: Requirements 3.1**

  - [x] 1.3 Write unit tests for `forceUpdate` utility
    - Test: when registration is null, returns `unsupported` status (Req 2.2)
    - Test: when `update()` rejects, returns `error` status with message (Req 2.3)
    - Test: when cache deletion fails, still calls reload and sets `cacheCleared: false` (Req 3.3)
    - Test: when all succeeds, calls reload and returns `reloading` (Req 3.1, 3.2)
    - Test: when no new version found and caches cleared, returns `up-to-date` (Req 4.3)
    - Create `tests/forceUpdate.test.ts`
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.3_

- [x] 2. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Modify `registerServiceWorker` and wire into AppShell
  - [x] 3.1 Update `registerServiceWorker()` in `src/index.ts` to return `Promise<ServiceWorkerRegistration | null>`
    - Change return type from `void` to `Promise<ServiceWorkerRegistration | null>`
    - Return the `registration` object on success, `null` on failure or when unsupported
    - _Requirements: 5.1, 5.3_

  - [x] 3.2 Store the registration in AppShell and create the update button
    - Add `swRegistration` private member to `AppShell`
    - Store the result of `registerServiceWorker()` in `swRegistration` (Req 5.2)
    - Create `createUpdateButton()` method that returns an `HTMLButtonElement` with label "Update App" and `aria-label="Force update the application"` (Req 1.2, 1.3)
    - Render the button inside the `<header>` element in `createAppStructure()` (Req 1.1)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2_

  - [x] 3.3 Implement `handleForceUpdate` and `showNotification` methods on AppShell
    - `handleForceUpdate()`: disable button + set text to "Updating..." (Req 4.1, 4.2), call `forceUpdate()` utility, handle result to show notification or reload
    - `showNotification(message, type)`: append a toast `<div>` to `.app-shell` that auto-hides after a timeout
    - Wire the button's click event to `handleForceUpdate`
    - On `unsupported` result: show info notification "Updates are not supported in this browser." and re-enable button (Req 2.2)
    - On `error` result: show error notification with message and re-enable button (Req 2.3)
    - On `up-to-date` result: show info notification "App is already up to date." and re-enable button (Req 4.3)
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_

- [x] 4. Add CSS styles for the update button and notification toast
  - Add styles for the update button in the header (consistent with existing button styles)
  - Add styles for the notification toast element (info, warning, error variants)
  - Ensure the button is visible and touch-friendly on mobile, tablet, and desktop viewports
  - _Requirements: 1.4_

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integration tests for AppShell wiring
  - [x] 6.1 Write property test: Button is disabled and shows loading text during update (Property 2)
    - **Property 2: Button is disabled and shows loading text during update**
    - Generate random delay durations for the async operation, invoke the handler, assert button state while the promise is pending
    - Create `tests/forceUpdate.properties.test.ts` (append to existing file from 1.2)
    - **Validates: Requirements 4.1, 4.2**

  - [x] 6.2 Write integration tests for button rendering and AppShell wiring
    - Test: button is rendered inside the header element (Req 1.1)
    - Test: button has correct label text and aria-label (Req 1.2, 1.3)
    - Test: clicking button calls `registration.update()` (Req 2.1)
    - Test: when registration is null, notification is shown (Req 2.2)
    - Test: `registerServiceWorker()` returns the registration object on success (Req 5.1)
    - Test: AppShell stores the registration (Req 5.2)
    - Test: when registration fails, null is stored (Req 5.3)
    - Create `tests/AppShell.force-update.test.ts`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.1, 5.2, 5.3_

- [x] 7. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `forceUpdate` utility is extracted into its own module (`src/forceUpdate.ts`) for testability, as specified in the design
- Property tests validate universal correctness properties from the design document
- Checkpoints ensure incremental validation
