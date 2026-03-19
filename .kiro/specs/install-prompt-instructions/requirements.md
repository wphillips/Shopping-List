# Requirements Document

## Introduction

The PWA install prompt banner in the grocery list app currently shows a generic fallback message ("Add this app to your home screen for quick access.") that tells users *what* to do but not *how* to do it. This is the message path taken when the native `beforeinstallprompt` event is unavailable and the device is not iOS Safari — covering browsers like Firefox on Android, Samsung Internet, and other mobile browsers.

This feature improves the install prompt messaging by detecting the user's browser and providing browser-specific, step-by-step installation instructions so users can act on the prompt without guessing.

## Glossary

- **Install_Prompt_Banner**: The dismissible UI component (`InstallPromptBanner` class in `src/install-prompt.ts`) that prompts users to add the app to their home screen.
- **Browser_Detector**: A pure function that inspects the user agent string to identify the user's browser family (e.g., Chrome, Firefox, Samsung Internet, Safari).
- **Instruction_Resolver**: A pure function that maps a detected browser identifier to a human-readable installation instruction string.
- **Fallback_Message**: The generic instruction shown when the browser cannot be specifically identified.
- **DetectDeps**: The existing injectable dependency interface providing `userAgent`, `maxTouchPoints`, `matchMedia`, and `standalone` properties.

## Requirements

### Requirement 1: Browser Detection

**User Story:** As a user on a mobile browser without native install support, I want the app to detect which browser I am using, so that I receive relevant installation instructions.

#### Acceptance Criteria

1. WHEN the Install_Prompt_Banner is created without a `deferredPrompt`, THE Browser_Detector SHALL identify the browser family from the user agent string provided via DetectDeps.
2. THE Browser_Detector SHALL distinguish between at least the following browser families: Chrome (Android), Firefox (Android), Samsung Internet, Safari (iOS), and an "unknown" category.
3. THE Browser_Detector SHALL accept the user agent string via the existing DetectDeps interface to remain testable without a real browser environment.
4. THE Browser_Detector SHALL return a single browser identifier string for any given user agent input.

### Requirement 2: Browser-Specific Instructions

**User Story:** As a user seeing the install prompt, I want clear step-by-step instructions for my specific browser, so that I know exactly how to add the app to my home screen.

#### Acceptance Criteria

1. WHEN the detected browser is Chrome on Android, THE Instruction_Resolver SHALL return an instruction referencing the three-dot menu and "Add to Home Screen" or "Install App" option.
2. WHEN the detected browser is Firefox on Android, THE Instruction_Resolver SHALL return an instruction referencing the three-dot menu and "Install" option.
3. WHEN the detected browser is Samsung Internet, THE Instruction_Resolver SHALL return an instruction referencing the menu button and "Add page to" then "Home screen" option.
4. WHEN the detected browser is Safari on iOS, THE Instruction_Resolver SHALL return an instruction referencing the Share button and "Add to Home Screen" option.
5. WHEN the detected browser is unknown, THE Instruction_Resolver SHALL return a Fallback_Message that instructs the user to use the browser menu to find an "Add to Home Screen" or "Install" option.
6. THE Instruction_Resolver SHALL return a non-empty string for every browser identifier input.

### Requirement 3: Banner Message Rendering

**User Story:** As a user on any mobile browser, I want the install banner to display the resolved instruction text, so that I see actionable guidance instead of a vague prompt.

#### Acceptance Criteria

1. WHEN the Install_Prompt_Banner is created with a non-null `deferredPrompt`, THE Install_Prompt_Banner SHALL continue to display the existing message with the Install button (no change to this path).
2. WHEN the Install_Prompt_Banner is created without a `deferredPrompt` and `isIOS` is true, THE Install_Prompt_Banner SHALL display the iOS-specific instruction from the Instruction_Resolver instead of the current hardcoded iOS message.
3. WHEN the Install_Prompt_Banner is created without a `deferredPrompt` and `isIOS` is false, THE Install_Prompt_Banner SHALL display the browser-specific instruction from the Instruction_Resolver instead of the current generic message.
4. THE Install_Prompt_Banner SHALL pass the DetectDeps to the Browser_Detector so the correct browser is identified at render time.

### Requirement 4: Instruction Purity and Testability

**User Story:** As a developer, I want the browser detection and instruction resolution to be pure functions with injectable dependencies, so that I can unit test them without a browser.

#### Acceptance Criteria

1. THE Browser_Detector SHALL be a pure function that accepts a DetectDeps object and returns a browser identifier string with no side effects.
2. THE Instruction_Resolver SHALL be a pure function that accepts a browser identifier string and returns an instruction string with no side effects.
3. FOR ALL valid browser identifier strings returned by the Browser_Detector, THE Instruction_Resolver SHALL return a non-empty instruction string (round-trip completeness).

### Requirement 5: Backward Compatibility

**User Story:** As an existing user, I want the native install flow and dismissal behavior to remain unchanged, so that the improvement does not break any working functionality.

#### Acceptance Criteria

1. WHEN a `deferredPrompt` is available, THE Install_Prompt_Banner SHALL render the Install button and existing message without modification.
2. THE Install_Prompt_Banner SHALL continue to render the dismiss button on all message paths.
3. THE Install_Prompt_Banner SHALL continue to respect the existing dismissal persistence via the `pwa-install-dismissed` localStorage key.
