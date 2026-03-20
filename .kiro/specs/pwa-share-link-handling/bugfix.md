# Bugfix Requirements Document

## Introduction

When a user shares a grocery list via a link (e.g., `https://example.com/?list=...`), the receiving user's device opens the link in the default browser instead of the installed PWA. Because the browser and the PWA have separate localStorage contexts, the imported list data never reaches the PWA's storage — the import is effectively lost. The root cause is that the PWA manifest does not declare URL handling for the app's share links, so the operating system has no reason to route those URLs to the installed PWA.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user with the PWA installed taps a shared link containing a `?list=` query parameter THEN the system opens the link in the default browser instead of the installed PWA

1.2 WHEN the shared link opens in the default browser THEN the system imports the list into the browser's separate localStorage context, making the data inaccessible from the installed PWA

1.3 WHEN the PWA manifest is inspected THEN the system has no `share_target` configuration, no `handle_links` preference, and no `scope` covering the `?list=` URL pattern, providing no signal to the OS to route share links to the PWA

### Expected Behavior (Correct)

2.1 WHEN a user with the PWA installed taps a shared link containing a `?list=` query parameter THEN the system SHALL open the link within the installed PWA so that the import is processed against the PWA's localStorage

2.2 WHEN the shared link opens in the installed PWA THEN the system SHALL decode and merge/import the list data into the PWA's existing localStorage, making it immediately available

2.3 WHEN the PWA manifest is inspected THEN the system SHALL include a `share_target` configuration and appropriate `handle_links` / URL scope declarations so the OS can route matching URLs to the installed PWA

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user without the PWA installed taps a shared link THEN the system SHALL CONTINUE TO open the link in the browser and process the import normally in that browser context

3.2 WHEN a user shares a list from the PWA using the share button THEN the system SHALL CONTINUE TO generate a valid `?list=` URL and invoke the Web Share API or clipboard fallback

3.3 WHEN the PWA is opened directly (without a `?list=` query parameter) THEN the system SHALL CONTINUE TO load the home screen with the user's existing lists from localStorage

3.4 WHEN the service worker intercepts navigation requests THEN the system SHALL CONTINUE TO serve cached assets and fall back to `/index.html` for offline SPA routing
