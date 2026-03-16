# Requirements Document

## Introduction

The Grocery List PWA uses a service worker with a cache-first strategy for offline functionality. This caching can cause the browser to serve stale versions of the application even after new code is deployed. Users need a visible UI control that forces the service worker to check for updates and reload the page with the latest version from the server, giving them direct control over when the app refreshes.

## Glossary

- **Update_Button**: A UI button rendered in the application header that triggers a forced update check and page reload.
- **Service_Worker_Registration**: The browser's `ServiceWorkerRegistration` object obtained when the service worker is registered, providing access to update and lifecycle methods.
- **App_Shell**: The main `AppShell` class that orchestrates all UI components and manages application state.
- **Cache_Store**: The set of cached responses managed by the service worker under the current cache name.

## Requirements

### Requirement 1: Display Force-Update Button

**User Story:** As a user, I want to see an update button in the app header, so that I can trigger a manual update check at any time.

#### Acceptance Criteria

1. THE App_Shell SHALL render the Update_Button inside the application header element.
2. THE Update_Button SHALL display a label that communicates its purpose (e.g., "Update App").
3. THE Update_Button SHALL include an accessible `aria-label` attribute describing its action.
4. THE Update_Button SHALL be visible on mobile, tablet, and desktop viewports.

### Requirement 2: Trigger Service Worker Update Check

**User Story:** As a user, I want the app to check for a new version when I press the update button, so that I get the latest code from the server.

#### Acceptance Criteria

1. WHEN the user activates the Update_Button, THE App_Shell SHALL call the `update()` method on the Service_Worker_Registration.
2. IF the Service_Worker_Registration is not available (e.g., service workers are unsupported), THEN THE App_Shell SHALL display a notification informing the user that updates are not supported in the current browser.
3. IF the `update()` call fails, THEN THE App_Shell SHALL display an error notification describing the failure.

### Requirement 3: Clear Caches and Reload

**User Story:** As a user, I want the app to clear stale caches and reload with fresh content after an update check, so that I always see the latest version.

#### Acceptance Criteria

1. WHEN the Update_Button is activated, THE App_Shell SHALL delete all entries in the Cache_Store before reloading.
2. WHEN the cache deletion completes, THE App_Shell SHALL perform a hard reload of the page bypassing the browser cache.
3. IF cache deletion fails, THEN THE App_Shell SHALL still attempt to reload the page and display a warning notification.

### Requirement 4: Provide Visual Feedback During Update

**User Story:** As a user, I want to see feedback while the update is in progress, so that I know the app is working on my request.

#### Acceptance Criteria

1. WHILE the update process is in progress, THE Update_Button SHALL enter a disabled state to prevent duplicate activations.
2. WHILE the update process is in progress, THE Update_Button SHALL display a loading indicator (e.g., changed label text such as "Updating...").
3. IF the update process completes without triggering a reload (e.g., no new version found and cache clear succeeds), THEN THE App_Shell SHALL re-enable the Update_Button and display a notification indicating the app is already up to date.

### Requirement 5: Expose Service Worker Registration

**User Story:** As a developer, I want the service worker registration to be accessible from the AppShell, so that the update button can interact with the service worker lifecycle.

#### Acceptance Criteria

1. WHEN the service worker registers successfully, THE `registerServiceWorker` function SHALL return the `ServiceWorkerRegistration` object.
2. THE App_Shell SHALL store the returned Service_Worker_Registration for use by the Update_Button handler.
3. IF service worker registration fails, THEN THE App_Shell SHALL store a null reference and the Update_Button handler SHALL treat this as an unsupported state.
