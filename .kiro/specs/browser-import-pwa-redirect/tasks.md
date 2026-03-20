# Implementation Plan: Browser Import PWA Redirect

## Overview

Implement two complementary features to bridge the iOS PWA shared-link gap: a PWA Redirect Banner for browser contexts and a Link Import UI for the installed PWA. New modules follow the existing dependency-injection pattern (same as `install-prompt.ts`). All changes are client-side only, compatible with static S3/CloudFront hosting.

## Tasks

- [x] 1. Create browser context detector module
  - [x] 1.1 Create `src/browser-context-detector.ts` with `BrowserContextDeps` interface, `isIOSDevice(deps)`, and `shouldShowRedirectBanner(deps)` functions
    - Define `BrowserContextDeps` interface with `userAgent`, `matchMedia`, `standalone`, and `locationSearch` fields
    - `isIOSDevice(deps)`: check UA for iPhone/iPad/iPod + AppleWebKit, excluding CriOS and FxiOS
    - `shouldShowRedirectBanner(deps)`: returns true when URL has `?list=` param AND device is iOS AND context is browser (not standalone)
    - Re-export or import `isStandaloneMode` from `install-prompt.ts` for standalone detection
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

  - [x] 1.2 Write unit tests for browser context detector
    - Test `isIOSDevice` with iOS Safari, Chrome iOS (CriOS), Firefox iOS (FxiOS), Android, and desktop UAs
    - Test `shouldShowRedirectBanner` returns true only when all three conditions met (iOS + browser + `?list=` param)
    - Test `shouldShowRedirectBanner` returns false in standalone mode, on non-iOS devices, and without `?list=` param
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

  - [ ]* 1.3 Write property tests for browser context detector
    - **Property 1: shouldShowRedirectBanner is false whenever isStandaloneMode is true**
    - **Validates: Requirements 1.3, 5.1**
    - **Property 2: shouldShowRedirectBanner is false whenever locationSearch lacks a `list=` parameter**
    - **Validates: Requirements 5.3**
    - **Property 3: shouldShowRedirectBanner is false whenever isIOSDevice is false**
    - **Validates: Requirements 2.3**

- [x] 2. Create clipboard helper module
  - [x] 2.1 Create `src/clipboard-helper.ts` with `ClipboardDeps` interface, `CopyResult` type, and `copyToClipboard(text, deps)` function
    - Try `deps.clipboardWriteText` first if available
    - Fallback: create temporary `<textarea>`, select, `execCommand('copy')`, remove
    - Return `{ status: 'copied' }` or `{ status: 'failed', message }`
    - _Requirements: 4.1, 4.2, 4.3, 7.3_

  - [ ]* 2.2 Write unit tests for clipboard helper
    - Test successful copy via Clipboard API
    - Test successful copy via textarea fallback when Clipboard API unavailable
    - Test failure result when both methods fail
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 2.3 Write property test for clipboard helper
    - **Property 4: copyToClipboard always returns a CopyResult with status 'copied' or 'failed'**
    - **Validates: Requirements 4.2, 4.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create PwaRedirectBanner component
  - [x] 4.1 Create `src/components/PwaRedirectBanner.ts` with `PwaRedirectBannerConfig` interface and `PwaRedirectBanner` class
    - Render container `div` with `role="alert"` and class `pwa-redirect-banner`
    - Render explanatory message paragraph
    - Render numbered instruction list (`<ol>`) with 4 steps: copy link, open PWA, tap Import from Link, paste and import
    - Render "Copy Link" button that calls `copyToClipboard` and updates text to "Link copied ✓" on success or shows error
    - Render "Dismiss" button that calls `onDismiss` callback
    - Implement `getElement()` and `remove()` methods (same pattern as `InstallPromptBanner`)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.4, 4.5, 9.1, 9.2, 9.3_

  - [ ]* 4.2 Write unit tests for PwaRedirectBanner
    - Test DOM structure: container has `role="alert"`, contains message, `<ol>` with 4 steps, Copy Link button, Dismiss button
    - Test Copy Link button calls `copyToClipboard` and updates button text on success
    - Test Copy Link button shows error message on copy failure
    - Test Dismiss button calls `onDismiss` callback
    - Test `remove()` removes element from DOM
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 4.4, 4.5, 9.1, 9.2, 9.3_

- [x] 5. Create LinkImportUI component
  - [x] 5.1 Create `src/components/LinkImportUI.ts` with `LinkImportUIConfig` interface and `LinkImportUI` class
    - Render container `div` with class `link-import-ui`
    - Render text input with `aria-label="Paste a shared list link"` and placeholder
    - Render "Import" button (primary style) that extracts input value and calls `onImport(url)`
    - Render "Cancel" button that calls `onCancel`
    - Render hidden error message `<p>`, shown via `showError(message)` method
    - Implement `getElement()`, `showError()`, and `remove()` methods
    - _Requirements: 8.2, 8.4, 8.6, 8.8_

  - [ ]* 5.2 Write unit tests for LinkImportUI
    - Test DOM structure: container, input with aria-label, Import button, Cancel button, hidden error element
    - Test Import button calls `onImport` with input value
    - Test Cancel button calls `onCancel`
    - Test `showError()` displays error message
    - Test `remove()` removes element from DOM
    - _Requirements: 8.2, 8.4, 8.6, 8.8_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add CSS styles for new components
  - [x] 7.1 Add styles to `src/styles/main.css` for all new components
    - `.pwa-redirect-banner`: fixed bottom bar (same pattern as `.install-prompt-banner`), dark theme colors
    - `.pwa-redirect-banner__instructions`: `<ol>` with left padding, `font-size: 0.875rem`, `color: var(--text-secondary)`
    - `.pwa-redirect-banner__copy-btn`: primary button style, min touch target 44×44px
    - `.pwa-redirect-banner__dismiss-btn`: same pattern as `.install-prompt-dismiss`
    - `.link-import-ui`: inline panel below header, flex row with input + Import + Cancel buttons
    - `.header-actions`: `display: flex; gap: 0.25rem;` for grouped header buttons
    - `.import-from-link-btn`: same style as `.share-btn` (icon button in header)
    - Mobile responsive rules (`< 768px`): link import UI stacks vertically, banner uses smaller font/padding
    - _Requirements: 3.6, 8.8_

- [x] 8. Integrate redirect banner and link import into AppShell
  - [x] 8.1 Modify `src/index.ts` `handleImport()` to check `shouldShowRedirectBanner` before proceeding with import
    - Build `BrowserContextDeps` from window APIs
    - If `shouldShowRedirectBanner(deps)` is true: create `PwaRedirectBanner`, append to `.app-shell`, return early
    - On "Dismiss": remove banner, proceed with existing `processImport` flow
    - On copy result: show notification (success/failure)
    - Otherwise: proceed with existing `processImport` flow unchanged
    - _Requirements: 3.1, 3.4, 3.5, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [x] 8.2 Modify `src/index.ts` `createAppStructure()` to add `header-actions` container wrapping `link-import-container` and `share-container`
    - Replace existing `<div id="share-container">` with grouped `<div id="header-actions" class="header-actions">` containing `<div id="link-import-container">` and `<div id="share-container">`
    - _Requirements: 8.1_

  - [x] 8.3 Modify `src/index.ts` `mountComponents()` to add "Import from Link" button in standalone mode
    - Check `isStandaloneMode(deps)` using `BrowserContextDeps` built from window APIs
    - If standalone: create "Import from Link" button (`📋` icon) and append to `#link-import-container`
    - On click: toggle `LinkImportUI` visibility (rendered inline below header, above search input)
    - _Requirements: 8.1, 8.7_

  - [x] 8.4 Add `handleLinkImport(url)` method to AppShell
    - Parse pasted URL to extract `?list=` or `#list=` parameter
    - Call `decodeListFragment(searchOrHash)` from `url-codec.ts`
    - If decode fails: call `linkImportUI.showError('Not a valid share link')`
    - If decode succeeds: call `deserialize()`, then `resolveImportAction()`, dispatch IMPORT_LIST or MERGE_LIST
    - On success: remove LinkImportUI, show notification, render
    - _Requirements: 8.3, 8.4, 8.5_

  - [ ]* 8.5 Write unit tests for AppShell redirect banner integration
    - Test that redirect banner appears when `shouldShowRedirectBanner` returns true (iOS + browser + `?list=` URL)
    - Test that redirect banner does NOT appear in standalone mode
    - Test that redirect banner does NOT appear on non-iOS devices
    - Test that dismissing the banner proceeds with normal import flow
    - _Requirements: 3.1, 5.1, 5.2, 6.1, 6.2_

  - [ ]* 8.6 Write unit tests for AppShell link import integration
    - Test that "Import from Link" button appears only in standalone mode
    - Test that `handleLinkImport` correctly decodes a valid pasted URL and dispatches import
    - Test that `handleLinkImport` shows error for invalid pasted URL
    - Test that Cancel button closes the LinkImportUI
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design
- All new modules use dependency injection for testability (same pattern as `install-prompt.ts`)
- The existing `isStandaloneMode` from `install-prompt.ts` is reused rather than duplicated
