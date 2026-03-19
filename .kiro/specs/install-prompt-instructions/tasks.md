# Implementation Plan: Install Prompt Instructions

## Overview

Add browser-specific PWA installation instructions to the install prompt banner. Introduces `BrowserId` type, `detectBrowser()` and `getInstallInstruction()` pure functions, and updates `InstallPromptBanner` to use them for non-native-install paths.

## Tasks

- [x] 1. Add BrowserId type and detectBrowser function
  - [x] 1.1 Add `BrowserId` type alias and `detectBrowser(deps: DetectDeps): BrowserId` function to `src/install-prompt.ts`
    - Define `BrowserId` as `'chrome-android' | 'firefox-android' | 'samsung-internet' | 'ios-safari' | 'unknown'`
    - Implement UA-based detection with priority: iOS Safari → Samsung Internet → Firefox Android → Chrome Android → unknown
    - Export both the type and the function
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1_

  - [x] 1.2 Add `getInstallInstruction(browserId: BrowserId): string` function to `src/install-prompt.ts`
    - Implement as a `Record<BrowserId, string>` lookup returning browser-specific instruction strings
    - Export the function
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.2_

- [x] 2. Update InstallPromptBanner to use browser-specific instructions
  - [x] 2.1 Add `detectDeps: DetectDeps` to `InstallPromptBannerConfig` interface
    - _Requirements: 3.4_

  - [x] 2.2 Update `InstallPromptBanner.createElement()` to call `detectBrowser` and `getInstallInstruction` for non-deferredPrompt paths
    - Replace the `isIOS` / generic message branches with a single path: `detectBrowser(config.detectDeps)` → `getInstallInstruction(browserId)`
    - Keep the `deferredPrompt` non-null path unchanged
    - _Requirements: 3.1, 3.2, 3.3, 5.1_

  - [x] 2.3 Update `AppShell.showInstallBannerIfEligible()` in `src/index.ts` to pass `detectDeps` in the banner config
    - _Requirements: 3.4, 5.1, 5.2, 5.3_

- [x] 3. Write unit tests
  - [x] 3.1 Write unit tests for `detectBrowser` in `tests/install-prompt-instructions.unit.test.ts`
    - Test each browser family with representative UA strings
    - Test Samsung Internet priority over Chrome (both contain "Chrome" token)
    - Test unknown/desktop UAs return `'unknown'`
    - _Requirements: 1.2, 1.4_

  - [x] 3.2 Write unit tests for `getInstallInstruction` in `tests/install-prompt-instructions.unit.test.ts`
    - Test each BrowserId returns the expected instruction string containing key phrases
    - Test all returned strings are non-empty
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.3 Write unit tests for updated `InstallPromptBanner` rendering in `tests/install-prompt-instructions.unit.test.ts`
    - Test banner with deferredPrompt still shows Install button (backward compat)
    - Test banner without deferredPrompt shows browser-specific instruction for each browser family
    - Test dismiss button is present in all configurations
    - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2_

- [x] 4. Write property-based tests
  - [x] 4.1 Write property test for detection-to-instruction round-trip (Property 1) in `tests/install-prompt-instructions.properties.test.ts`
    - Generate arbitrary strings, verify detectBrowser returns valid BrowserId and getInstallInstruction returns non-empty string
    - Tag: Feature: install-prompt-instructions, Property 1: Detection-to-instruction round-trip completeness
    - Min 100 iterations
    - _Requirements: 1.4, 2.6, 4.3_

  - [x] 4.2 Write property test for browser classification correctness (Property 2) in `tests/install-prompt-instructions.properties.test.ts`
    - Generate UAs from structured generators per browser family with random versions
    - Tag: Feature: install-prompt-instructions, Property 2: Browser classification correctness
    - Min 100 iterations
    - _Requirements: 1.2_

  - [x] 4.3 Write property test for banner instruction rendering (Property 3) in `tests/install-prompt-instructions.properties.test.ts`
    - Generate arbitrary UA strings, create banner with deferredPrompt: null, verify message equals getInstallInstruction(detectBrowser(deps))
    - Tag: Feature: install-prompt-instructions, Property 3: Banner displays resolved instruction when no deferredPrompt
    - Min 100 iterations
    - _Requirements: 3.2, 3.3_

  - [x] 4.4 Write property test for dismiss button presence (Property 4) in `tests/install-prompt-instructions.properties.test.ts`
    - Generate arbitrary banner configs, verify dismiss button with correct aria-label always exists
    - Tag: Feature: install-prompt-instructions, Property 4: Dismiss button always present
    - Min 100 iterations
    - _Requirements: 5.2_

- [x] 5. Verify all tests pass
  - Run `vitest --run` and confirm all new and existing tests pass

## Notes

- All changes are in `src/install-prompt.ts` and `src/index.ts` — no new source files
- `fast-check` is already in devDependencies
- The existing `isIOSSafari()` function is kept for backward compatibility but the banner no longer branches on `isIOS` directly
- Detection priority matters: Samsung Internet UA contains "Chrome", so it must be checked first
