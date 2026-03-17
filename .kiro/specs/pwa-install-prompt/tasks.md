# Implementation Plan: PWA Install Prompt

## Overview

Implement a dismissible install-prompt banner that appears after a shared grocery list import on mobile devices. The banner supports native install via `beforeinstallprompt` on Chromium/Firefox Android and shows manual instructions on iOS Safari. Detection utilities are pure functions with injectable dependencies for testability.

## Tasks

- [x] 1. Create install-prompt module with detection utilities
  - [x] 1.1 Create `src/install-prompt.ts` with type definitions and detection functions
    - Define `DetectDeps`, `DismissalDeps`, and `InstallPromptBannerConfig` interfaces
    - Define ambient `BeforeInstallPromptEvent` interface
    - Implement `isMobileDevice(deps)` — returns true when UA contains Android/iPhone/iPad AND maxTouchPoints > 0
    - Implement `isStandaloneMode(deps)` — returns true when matchMedia standalone matches OR navigator.standalone is true
    - Implement `isIOSSafari(deps)` — returns true for iOS Safari user agents
    - Implement `isDismissed(deps)` / `setDismissed(deps)` — read/write `pwa-install-dismissed` key in localStorage
    - Implement `shouldShowInstallPrompt(detectDeps, dismissalDeps)` — returns true only when mobile AND not standalone AND not dismissed
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.3, 6.1, 6.2, 6.3_

  - [ ]* 1.2 Write property test: shouldShowInstallPrompt gate (Property 1)
    - **Property 1: shouldShowInstallPrompt gate**
    - Generate arbitrary booleans for (isMobile, isStandalone, isDismissed) and verify the function returns true only when isMobile=true AND isStandalone=false AND isDismissed=false
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 5.3**

  - [ ]* 1.3 Write property test: standalone mode detection (Property 3)
    - **Property 3: Standalone mode detection**
    - Generate arbitrary booleans for (mediaQueryMatches, navigatorStandalone) and verify isStandaloneMode returns true iff either is true
    - **Validates: Requirements 6.1**

  - [ ]* 1.4 Write property test: mobile device detection (Property 4)
    - **Property 4: Mobile device detection**
    - Generate arbitrary user agent strings from a pool of mobile/non-mobile UAs and arbitrary non-negative integers for maxTouchPoints, verify the AND logic
    - **Validates: Requirements 6.2**

- [x] 2. Implement InstallPromptBanner component
  - [x] 2.1 Add `InstallPromptBanner` class to `src/install-prompt.ts`
    - Constructor accepts `InstallPromptBannerConfig` with deferredPrompt, isIOS, onDismiss, onInstallAccepted
    - `getElement()` returns a banner div with `role="banner"`
    - Render dismiss button with `aria-label="Dismiss install prompt"`
    - When `deferredPrompt` is non-null, render an "Install" button with `aria-label="Install"`
    - When `deferredPrompt` is null and `isIOS` is true, render iOS manual instructions text
    - When `deferredPrompt` is null and `isIOS` is false, render generic "Add to Home Screen" message
    - Install button click calls `deferredPrompt.prompt()`, awaits `userChoice`, calls `onInstallAccepted` if accepted
    - Dismiss button click calls `onDismiss`
    - `remove()` detaches the element from the DOM
    - Handle `prompt()` errors by logging and leaving banner visible
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2_

  - [ ]* 2.2 Write property test: Install button presence (Property 2)
    - **Property 2: Install button presence matches deferredPrompt availability**
    - Generate arbitrary boolean for deferredPrompt presence, create the banner, assert Install button exists iff deferredPrompt is non-null
    - **Validates: Requirements 3.1, 4.2**

  - [ ]* 2.3 Write unit tests for InstallPromptBanner
    - Banner renders iOS instructions when isIOS=true and deferredPrompt=null
    - Banner renders Install button when deferredPrompt is provided
    - Clicking Install calls prompt() on the deferred event
    - Accepting native dialog calls onInstallAccepted
    - Dismissing native dialog leaves banner visible
    - Clicking dismiss button calls onDismiss
    - Banner has role="banner" and dismiss button has aria-label="Dismiss install prompt"
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add banner CSS styles
  - [x] 4.1 Add `.install-prompt-banner` styles to `src/styles/main.css`
    - Fixed-bottom bar with dark theme (using existing CSS variables)
    - Layout: message text, optional Install button, dismiss (×) button
    - Responsive adjustments for mobile breakpoint
    - Ensure touch targets meet 44px minimum on tablet, 32px on mobile (matching existing patterns)
    - _Requirements: 2.3_

- [x] 5. Integrate with AppShell
  - [x] 5.1 Wire `beforeinstallprompt` listener and post-import banner display in `src/index.ts`
    - In `init()` or AppShell constructor: register `window.addEventListener('beforeinstallprompt', ...)` to capture and store the deferred prompt event
    - In `handleImport()`: after successful import + user confirmation, call `shouldShowInstallPrompt()` with real browser deps
    - If true, create `InstallPromptBanner` with the captured deferredPrompt, isIOS detection result, and callbacks
    - Append banner to the app shell DOM
    - `onDismiss` callback: call `setDismissed()` then `banner.remove()`
    - `onInstallAccepted` callback: call `setDismissed()` then `banner.remove()`
    - _Requirements: 1.1, 3.2, 3.3, 5.1, 5.2_

  - [ ]* 5.2 Write unit tests for AppShell install prompt integration
    - Verify banner is shown after import when conditions are met
    - Verify banner is not shown when already dismissed
    - Verify banner is not shown in standalone mode
    - Verify banner is not shown on desktop
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already in devDependencies)
- Detection functions use dependency injection so tests don't need a browser environment
- The `BeforeInstallPromptEvent` is captured once per page load in `init()` and passed to the banner on creation
