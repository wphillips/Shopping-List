# Requirements Document

## Introduction

This feature adds a human-readable build timestamp to the application, injected at build time via Vite's `define` configuration option. The timestamp is displayed in the app footer and included in the "up to date" notification, allowing users to verify which build is running on the client after deployments.

## Glossary

- **Build_Timestamp**: A string representing the date and time the application was built, formatted as "Built MMM DD, YYYY h:mm AM/PM" (e.g. "Built Mar 16, 2026 9:45 PM").
- **Vite_Define**: Vite's `define` configuration option that performs global constant replacements at build time.
- **Footer**: The `<footer>` element at the bottom of the app shell (class `app-footer`) containing the "Check for updates" button.
- **Update_Button**: The existing "Check for updates" button (class `update-btn`) in the Footer.
- **Notification_Toast**: The temporary toast message shown to the user after an update check completes.
- **Short_Timestamp**: A condensed timestamp format without the year, used in notifications (e.g. "built Mar 16, 9:45 PM").

## Requirements

### Requirement 1: Inject Build Timestamp at Build Time

**User Story:** As a developer, I want the build timestamp injected at build time via Vite's define config, so that the value is baked into the bundle and does not depend on runtime computation.

#### Acceptance Criteria

1. WHEN a production build is executed, THE Vite_Define config SHALL replace a global constant with the Build_Timestamp string.
2. WHEN the development server is running, THE Vite_Define config SHALL replace the same global constant with a placeholder value of "Built dev".
3. THE Build_Timestamp SHALL be formatted as "Built MMM DD, YYYY h:mm AM/PM" using the locale of the build environment at the time of the build.

### Requirement 2: Display Build Timestamp in Footer

**User Story:** As a user, I want to see the build timestamp in the app footer, so that I can verify which version of the app is running.

#### Acceptance Criteria

1. THE Footer SHALL display the Build_Timestamp as a text element adjacent to the Update_Button.
2. THE Build_Timestamp text SHALL use a muted, small font style consistent with the Update_Button styling (font-size 0.75rem, color `var(--text-disabled)`).
3. THE Build_Timestamp text element SHALL not be interactive (no click handler, no hover underline).

### Requirement 3: Include Build Timestamp in Up-to-Date Notification

**User Story:** As a user, I want the "up to date" notification to include the build timestamp, so that I can confirm the exact build that is current.

#### Acceptance Criteria

1. WHEN the update check returns an "up-to-date" status, THE Notification_Toast SHALL display the message "App is up to date (built MMM DD, h:mm AM/PM)" using the Short_Timestamp.
2. WHEN the update check returns any status other than "up-to-date", THE Notification_Toast SHALL display the existing message without the Build_Timestamp.

### Requirement 4: TypeScript Type Declaration for Build Constant

**User Story:** As a developer, I want the injected build constant to have a proper TypeScript type declaration, so that the codebase compiles without errors and provides autocomplete support.

#### Acceptance Criteria

1. THE codebase SHALL include a type declaration for the global build timestamp constant so that TypeScript resolves the constant without type errors.

### Requirement 5: Document Build Timestamp in README

**User Story:** As a developer looking at the repo, I want to quickly understand how the build timestamp works and where to find it, so that I don't have to dig through the code.

#### Acceptance Criteria

1. THE README SHALL include a section explaining that the app displays a build timestamp in the footer.
2. THE README section SHALL describe how the timestamp is injected at build time via Vite's define config.
3. THE README section SHALL note that in development mode the timestamp shows "Built dev".
