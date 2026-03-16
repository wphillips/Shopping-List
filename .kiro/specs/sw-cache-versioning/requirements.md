# Requirements Document

## Introduction

The service worker in `public/sw.js` uses a hardcoded `CACHE_NAME = 'grocery-list-v1'` that never changes between builds. This means the browser cannot detect new deployments, old caches are never invalidated, and the "Check for updates" button has limited effectiveness. This feature introduces automatic cache versioning tied to the Vite build process so that each build produces a service worker with a unique cache name, enabling proper cache invalidation and update detection.

## Glossary

- **Build_Pipeline**: The Vite build process that compiles TypeScript and bundles the application into the `dist/` directory.
- **SW_Template**: The service worker source file that contains a placeholder token for the cache version, used as input to the Build_Plugin.
- **Build_Plugin**: A Vite plugin that processes the SW_Template during the build and replaces the version placeholder with a unique Build_Hash.
- **Build_Hash**: A unique identifier (content hash or timestamp) generated during each build, used to version the service worker cache.
- **Cache_Name**: The string identifier used by the service worker to open and manage its cache (e.g., `grocery-list-<Build_Hash>`).
- **SW_Output**: The final service worker file written to the `dist/` directory with the Build_Hash injected.
- **Old_Cache**: Any cache whose name does not match the current Cache_Name of the active service worker.
- **Force_Update_Button**: The UI button that triggers the `forceUpdate` function to check for service worker updates, clear caches, and reload the page.

## Requirements

### Requirement 1: SW Template with Version Placeholder

**User Story:** As a developer, I want the service worker source to contain a replaceable version placeholder, so that the build process can inject a unique version on each build.

#### Acceptance Criteria

1. THE SW_Template SHALL contain a placeholder token `__BUILD_HASH__` in the Cache_Name definition.
2. THE SW_Template SHALL define Cache_Name as the string `grocery-list-` concatenated with the `__BUILD_HASH__` token.
3. WHEN the SW_Template is served during development, THE Build_Pipeline SHALL replace `__BUILD_HASH__` with a static development identifier so the service worker remains functional.

### Requirement 2: Build Plugin Generates Unique Hash

**User Story:** As a developer, I want each production build to generate a unique hash, so that every deployment produces a distinct service worker file.

#### Acceptance Criteria

1. WHEN a production build is executed, THE Build_Plugin SHALL generate a unique Build_Hash.
2. THE Build_Hash SHALL differ between two builds that have different source file contents.
3. THE Build_Plugin SHALL replace the `__BUILD_HASH__` placeholder in the SW_Template with the generated Build_Hash.
4. THE Build_Plugin SHALL write the SW_Output file to the `dist/` directory with the Build_Hash injected.

### Requirement 3: SW Output File Differs Between Builds

**User Story:** As a developer, I want the built service worker file to have different content when the app source changes, so that the browser detects a new version and triggers an update.

#### Acceptance Criteria

1. WHEN two production builds are executed with different source file contents, THE SW_Output files SHALL have different Cache_Name values.
2. WHEN the browser compares the currently installed service worker with the newly deployed SW_Output, THE browser SHALL detect a byte-level difference due to the changed Cache_Name.

### Requirement 4: New Service Worker Cleans Up Old Caches

**User Story:** As a user, I want old caches to be automatically removed when a new version of the app is deployed, so that stale assets do not consume storage or cause inconsistencies.

#### Acceptance Criteria

1. WHEN the service worker activates, THE SW_Output SHALL enumerate all existing caches.
2. WHEN the service worker activates, THE SW_Output SHALL delete every Old_Cache whose name does not match the current Cache_Name.
3. WHEN the service worker activates, THE SW_Output SHALL retain the cache matching the current Cache_Name.
4. IF cache deletion fails for an Old_Cache, THEN THE SW_Output SHALL log the error and continue deleting remaining Old_Caches.

### Requirement 5: Force Update Detects New Service Worker

**User Story:** As a user, I want the "Check for updates" button to detect when a new service worker is available, so that I can get the latest version of the app.

#### Acceptance Criteria

1. WHEN the Force_Update_Button is activated, THE forceUpdate function SHALL call `registration.update()` to check for a new service worker.
2. WHEN `registration.update()` finds a new SW_Output with a different Build_Hash, THE forceUpdate function SHALL detect the installing or waiting service worker.
3. WHEN a new service worker is detected, THE forceUpdate function SHALL clear all caches and reload the page.
4. WHEN no new service worker is detected, THE forceUpdate function SHALL clear all caches and reload the page to ensure fresh assets are fetched.

### Requirement 6: Development Mode Compatibility

**User Story:** As a developer, I want the service worker to function correctly during local development, so that I can test PWA features without running a production build.

#### Acceptance Criteria

1. WHILE the Build_Pipeline is running in development mode, THE Build_Plugin SHALL serve the service worker with a consistent development Cache_Name.
2. WHILE the Build_Pipeline is running in development mode, THE SW_Template SHALL remain functional with the development Cache_Name substituted for the `__BUILD_HASH__` token.

### Requirement 7: Build Plugin Integration with Vite

**User Story:** As a developer, I want the build plugin to integrate cleanly with the existing Vite configuration, so that no manual build steps are required.

#### Acceptance Criteria

1. THE Build_Plugin SHALL be registered in `vite.config.ts` as a Vite plugin.
2. WHEN the `npm run build` command is executed, THE Build_Plugin SHALL execute automatically as part of the Build_Pipeline.
3. THE Build_Plugin SHALL not modify any files other than the SW_Template during the build process.
4. THE Build_Plugin SHALL not introduce additional runtime dependencies to the project.

### Requirement 8: Service Worker Pretty-Prints and Round-Trips Cache Name

**User Story:** As a developer, I want to verify that the cache name format is consistent and parseable, so that cache versioning logic remains correct across builds.

#### Acceptance Criteria

1. THE Cache_Name SHALL follow the format `grocery-list-<Build_Hash>` where Build_Hash is a non-empty alphanumeric string.
2. FOR ALL valid Build_Hash values, constructing a Cache_Name and extracting the Build_Hash from the Cache_Name SHALL produce the original Build_Hash value (round-trip property).
