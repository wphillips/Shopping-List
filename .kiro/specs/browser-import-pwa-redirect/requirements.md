# Requirements Document

## Introduction

When a shared grocery list link (`?list=` URL) is opened on iOS, the link always opens in the default browser rather than the installed PWA due to platform limitations. Because the browser and PWA have separate localStorage contexts, any import performed in the browser is invisible to the installed PWA. This feature addresses the gap with a two-pronged approach: (1) a browser-side redirect banner that detects the "opened in browser but PWA is likely installed" scenario and guides the user to copy the link, and (2) an in-app "Import from Link" UI inside the installed PWA that lets the user paste and import a shared list URL. Together these provide a complete end-to-end flow for getting shared lists into the installed PWA. The solution must remain fully static (S3/CloudFront hosted) with no server-side logic.

## Glossary

- **Import_Controller**: The module (`src/import-controller.ts`) responsible for detecting and processing shared grocery list URLs.
- **Browser_Context_Detector**: A new module that determines whether the app is running inside the installed PWA (standalone mode) or in a regular browser tab.
- **PWA_Redirect_Banner**: A UI banner displayed when a shared list link is opened in a browser context on iOS, guiding the user to open the link in the installed PWA.
- **Standalone_Mode**: The display mode when a PWA is launched from the home screen, detectable via `display-mode: standalone` media query or `navigator.standalone`.
- **Clipboard_Helper**: A utility that copies the current shared list URL to the device clipboard, with fallback for environments where the Clipboard API is unavailable.
- **iOS_Device**: A device whose user-agent indicates iPhone, iPad, or iPod with AppleWebKit.
- **Link_Import_UI**: A UI element within the installed PWA (Standalone_Mode) that provides an input field for pasting and importing a shared list URL.
- **decodeListFragment**: The existing function in `src/url-codec.ts` that extracts and decompresses the `list=` parameter from a URL string.

## Requirements

### Requirement 1: Detect Browser vs. Standalone Context

**User Story:** As a user who received a shared grocery list link, I want the app to detect whether it is running inside the installed PWA or in a regular browser, so that the app can warn me if my import will not reach my installed app.

#### Acceptance Criteria

1. WHEN the app loads with a `?list=` query parameter, THE Browser_Context_Detector SHALL determine whether the app is running in Standalone_Mode or in a browser tab.
2. THE Browser_Context_Detector SHALL use the `display-mode: standalone` media query and the `navigator.standalone` property to detect Standalone_Mode.
3. WHEN the app is running in Standalone_Mode, THE Browser_Context_Detector SHALL report the context as "standalone".
4. WHEN the app is running in a browser tab (not Standalone_Mode), THE Browser_Context_Detector SHALL report the context as "browser".

### Requirement 2: Detect iOS Device

**User Story:** As a developer, I want the app to identify iOS devices, so that the redirect guidance is shown only on the platform where PWA link interception does not work.

#### Acceptance Criteria

1. THE Browser_Context_Detector SHALL identify an iOS_Device by checking the user-agent for iPhone, iPad, or iPod tokens combined with AppleWebKit.
2. THE Browser_Context_Detector SHALL exclude Chrome on iOS (CriOS) and Firefox on iOS (FxiOS) from the iOS Safari identification, since those browsers cannot add PWAs to the home screen.
3. WHEN the device is not an iOS_Device, THE Browser_Context_Detector SHALL not trigger the PWA redirect flow.

### Requirement 3: Show PWA Redirect Banner

**User Story:** As an iOS user who opened a shared list link in my browser, I want to see a clear message explaining that the import will not reach my installed PWA, so that I understand why and know what to do.

#### Acceptance Criteria

1. WHEN a `?list=` URL is opened in a browser context on an iOS_Device, THE Import_Controller SHALL display the PWA_Redirect_Banner instead of proceeding with the normal import confirmation flow.
2. THE PWA_Redirect_Banner SHALL display a message explaining that the shared list was opened in the browser and will not appear in the installed PWA app.
3. THE PWA_Redirect_Banner SHALL include step-by-step instructions: (a) Tap "Copy Link" to copy the share URL, (b) Open the installed PWA app from the home screen, (c) Tap "Import from Link" in the PWA, (d) Paste the link and import.
4. THE PWA_Redirect_Banner SHALL include a "Copy Link" button that copies the current page URL to the clipboard.
5. THE PWA_Redirect_Banner SHALL include a "Dismiss" button that closes the banner and allows the user to proceed with the normal browser-based import flow.
6. THE PWA_Redirect_Banner SHALL be accessible, using an ARIA `role="alert"` attribute and descriptive labels on all interactive elements.

### Requirement 4: Copy Link to Clipboard

**User Story:** As an iOS user viewing the redirect banner, I want to copy the shared list link to my clipboard with one tap, so that I can paste it into my installed PWA app.

#### Acceptance Criteria

1. WHEN the user taps the "Copy Link" button, THE Clipboard_Helper SHALL copy the full current page URL (including the `?list=` parameter) to the device clipboard.
2. WHEN the Clipboard API is available, THE Clipboard_Helper SHALL use `navigator.clipboard.writeText` to perform the copy.
3. IF the Clipboard API is unavailable, THEN THE Clipboard_Helper SHALL fall back to a temporary textarea-based `document.execCommand('copy')` approach.
4. WHEN the copy operation succeeds, THE PWA_Redirect_Banner SHALL display a confirmation message (e.g., "Link copied") to the user.
5. IF the copy operation fails, THEN THE PWA_Redirect_Banner SHALL display an error message informing the user that the copy failed.

### Requirement 5: Preserve Normal Import Flow in Non-iOS and Standalone Contexts

**User Story:** As a user on Android or on any device running the installed PWA, I want the import flow to work exactly as it does today, so that this feature does not disrupt existing behavior.

#### Acceptance Criteria

1. WHEN the app is running in Standalone_Mode, THE Import_Controller SHALL proceed with the existing import/merge flow without showing the PWA_Redirect_Banner.
2. WHEN the device is not an iOS_Device, THE Import_Controller SHALL proceed with the existing import/merge flow without showing the PWA_Redirect_Banner.
3. WHEN the URL does not contain a `?list=` parameter, THE Import_Controller SHALL not invoke the Browser_Context_Detector or display the PWA_Redirect_Banner.

### Requirement 6: Allow Browser-Based Import After Dismissal

**User Story:** As an iOS user who understands the limitation but still wants to import in the browser, I want to dismiss the banner and proceed with the normal import, so that I have the option to use the list in the browser context.

#### Acceptance Criteria

1. WHEN the user taps the "Dismiss" button on the PWA_Redirect_Banner, THE PWA_Redirect_Banner SHALL close and remove itself from the DOM.
2. WHEN the PWA_Redirect_Banner is dismissed, THE Import_Controller SHALL proceed with the standard import confirmation flow (confirm dialog, merge/import-new logic).
3. THE Import_Controller SHALL not persist the dismissal state across sessions, so the banner appears again on subsequent shared link opens in the browser.

### Requirement 7: Static Hosting Compatibility

**User Story:** As a developer, I want the redirect detection and banner to work entirely on the client side, so that no server-side changes are needed and the app remains deployable as a static site.

#### Acceptance Criteria

1. THE Browser_Context_Detector SHALL use only client-side browser APIs (media queries, navigator properties, user-agent string) for detection.
2. THE PWA_Redirect_Banner SHALL be rendered entirely via DOM manipulation in TypeScript, with no server-side rendering or API calls.
3. THE Clipboard_Helper SHALL use only client-side clipboard APIs with no server-side dependencies.


### Requirement 8: In-App Import from Link

**User Story:** As a user running the installed PWA, I want an "Import from Link" option accessible from the main screen, so that I can paste a shared list URL that was copied from the browser and import the list into my PWA.

#### Acceptance Criteria

1. WHILE the app is running in Standalone_Mode, THE App_Shell SHALL display an "Import from Link" button accessible from the main screen.
2. WHEN the user taps the "Import from Link" button, THE Link_Import_UI SHALL display an input field where the user can paste a shared list URL.
3. WHEN the user submits a pasted URL containing a `?list=` parameter, THE Link_Import_UI SHALL extract and decode the list data using the existing decodeListFragment function and proceed with the standard import/merge flow.
4. IF the pasted text does not contain a valid `?list=` parameter or decoding fails, THEN THE Link_Import_UI SHALL display an error message indicating the pasted text is not a valid share link.
5. WHEN the import succeeds, THE Link_Import_UI SHALL close the input field and display the imported or merged list.
6. THE Link_Import_UI SHALL include a "Cancel" button that closes the input field without performing an import.
7. THE Link_Import_UI SHALL be available on all platforms when running in Standalone_Mode, not limited to iOS_Device.
8. THE Link_Import_UI SHALL be accessible, with descriptive labels on the input field and all interactive elements.

### Requirement 9: Banner Instructions Update

**User Story:** As an iOS user viewing the redirect banner, I want clear step-by-step instructions on how to get the shared list into my installed PWA, so that I know exactly what to do after copying the link.

#### Acceptance Criteria

1. THE PWA_Redirect_Banner SHALL display numbered step-by-step instructions guiding the user through the complete flow: (1) Tap "Copy Link" to copy the share URL, (2) Open the installed PWA app from the home screen, (3) Tap "Import from Link" in the PWA, (4) Paste the link and import.
2. THE PWA_Redirect_Banner instructions SHALL reference the "Import from Link" feature by name so the user knows what to look for inside the installed PWA.
3. THE PWA_Redirect_Banner instructions SHALL be concise and use plain language understandable without technical knowledge.
