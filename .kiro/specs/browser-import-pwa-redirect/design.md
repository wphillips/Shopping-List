# Design Document

## Overview

This design adds two complementary features to handle the iOS PWA shared-link gap:

1. A **PWA Redirect Banner** shown when a `?list=` URL is opened in a browser on iOS, guiding the user to copy the link and open it in the installed PWA.
2. A **Link Import UI** inside the installed PWA (standalone mode) that lets the user paste a shared list URL and import it.

All logic is client-side only, consistent with the static S3/CloudFront hosting model.

## Architecture

### New Modules

#### `src/browser-context-detector.ts`
Pure-function module with injectable dependencies (same pattern as `install-prompt.ts`). Provides:

- `isStandaloneMode(deps): boolean` — reuses the existing function from `install-prompt.ts` (re-exported for convenience, or imported directly).
- `isIOSDevice(deps): boolean` — checks UA for iPhone/iPad/iPod + AppleWebKit, excluding CriOS and FxiOS.
- `shouldShowRedirectBanner(deps): boolean` — returns `true` when: URL has `?list=` param AND device is iOS AND context is browser (not standalone).

**Dependency interface** (mirrors `DetectDeps` from `install-prompt.ts`):

```typescript
export interface BrowserContextDeps {
  userAgent: string;
  matchMedia: (query: string) => { matches: boolean };
  standalone?: boolean;
  locationSearch: string;
}
```

#### `src/clipboard-helper.ts`
Utility module for clipboard operations with fallback:

```typescript
export interface ClipboardDeps {
  clipboardWriteText?: (text: string) => Promise<void>;
  document: {
    createElement: (tag: string) => HTMLElement;
    body: { appendChild: (el: HTMLElement) => void; removeChild: (el: HTMLElement) => void };
    execCommand: (cmd: string) => boolean;
  };
}

export type CopyResult = { status: 'copied' } | { status: 'failed'; message: string };

export async function copyToClipboard(text: string, deps: ClipboardDeps): Promise<CopyResult>;
```

1. Try `navigator.clipboard.writeText` if available.
2. Fallback: create a temporary `<textarea>`, select, `execCommand('copy')`, remove.
3. Return `{ status: 'copied' }` or `{ status: 'failed', message }`.

#### `src/components/PwaRedirectBanner.ts`
DOM component (same class-based pattern as `InstallPromptBanner`):

```typescript
export interface PwaRedirectBannerConfig {
  pageUrl: string;
  onDismiss: () => void;
  onCopyResult: (result: CopyResult) => void;
}

export class PwaRedirectBanner {
  constructor(config: PwaRedirectBannerConfig);
  getElement(): HTMLElement;
  remove(): void;
}
```

Renders:
- Container `div` with `role="alert"` and class `pwa-redirect-banner`.
- Explanatory message paragraph.
- Numbered instruction list (`<ol>`):
  1. Tap "Copy Link" to copy the share URL.
  2. Open the installed app from the home screen.
  3. Tap "Import from Link" in the app.
  4. Paste the link and import.
- "Copy Link" button — calls `copyToClipboard`, updates button text to "Link copied ✓" on success or shows error.
- "Dismiss" button — calls `onDismiss`.

#### `src/components/LinkImportUI.ts`
DOM component for the in-app paste-and-import flow:

```typescript
export interface LinkImportUIConfig {
  onImport: (url: string) => void;
  onCancel: () => void;
}

export class LinkImportUI {
  constructor(config: LinkImportUIConfig);
  getElement(): HTMLElement;
  showError(message: string): void;
  remove(): void;
}
```

Renders:
- Container `div` with class `link-import-ui`.
- Text input with `aria-label="Paste a shared list link"` and placeholder text.
- "Import" button (primary style) — extracts input value, calls `onImport(url)`.
- "Cancel" button — calls `onCancel`.
- Error message `<p>` (hidden by default, shown via `showError()`).

### Modified Modules

#### `src/import-controller.ts`
No changes to existing functions. The orchestration logic in `AppShell` will call `checkImportUrl` / `processImport` after the redirect banner is dismissed or when the Link Import UI submits a URL.

#### `src/index.ts` (AppShell)

**`handleImport()` modification:**

Before calling `processImport`, check if the redirect banner should be shown:

```
1. Build BrowserContextDeps from window APIs.
2. If shouldShowRedirectBanner(deps) is true:
   a. Create PwaRedirectBanner with pageUrl = window.location.href.
   b. Append banner to .app-shell.
   c. On "Dismiss": remove banner, proceed with existing processImport flow.
   d. On copy result: show notification (success/failure).
   e. Return early (don't run processImport yet).
3. Otherwise: proceed with existing processImport flow unchanged.
```

**New "Import from Link" button (standalone mode only):**

In `createAppStructure()`, replace the existing `<div id="share-container">` with a grouped container:

```html
<div id="header-actions" class="header-actions">
  <div id="link-import-container"></div>
  <div id="share-container"></div>
</div>
```

The `.header-actions` container uses `display: flex; gap: 0.25rem;` to keep both buttons grouped and right-aligned (the list selector's `flex: 1` already pushes everything after it to the right).

In `mountComponents()`:
1. Check `isStandaloneMode(deps)`.
2. If standalone: create an "Import from Link" button (`📋` icon), append to `#link-import-container`.
3. On click: toggle the `LinkImportUI` component visibility (rendered inline below the header, above the search input).

New method `handleLinkImport(url: string)`:
1. Parse the pasted URL to extract the `?list=` or `#list=` parameter.
2. Call `decodeListFragment(searchOrHash)` from `url-codec.ts`.
3. If decode fails: call `linkImportUI.showError('Not a valid share link')`.
4. If decode succeeds: call `deserialize()`, then `resolveImportAction()`, then dispatch the appropriate state action (same logic as existing `handleImport` but without URL cleanup since there's no URL to clean).
5. On success: remove the LinkImportUI, show notification, render.

## Component Hierarchy

```
AppShell
├── ListSelector
├── ShareButton
├── ImportFromLinkButton (standalone only)
│   └── LinkImportUI (toggled on click)
├── InputField (search)
├── FilterControl
├── SectionsContainer
│   └── Section[] → Item[]
├── PwaRedirectBanner (conditional: iOS + browser + ?list= URL)
└── Footer
```

## Data Flow

### Redirect Banner Flow (iOS browser with `?list=` URL)
```
Page load with ?list= param
  → shouldShowRedirectBanner() returns true
  → Show PwaRedirectBanner
  → User taps "Copy Link" → copyToClipboard(window.location.href)
  → User taps "Dismiss" → Remove banner → Run normal processImport flow
```

### Link Import Flow (standalone PWA)
```
User taps "Import from Link" button
  → Show LinkImportUI (input + Import/Cancel buttons)
  → User pastes URL, taps "Import"
  → Extract search/hash from pasted URL
  → decodeListFragment(extracted) → deserialize() → resolveImportAction()
  → Dispatch IMPORT_LIST or MERGE_LIST
  → Remove LinkImportUI, show notification
```

## Styling

New CSS classes added to `src/styles/main.css`:

### `.pwa-redirect-banner`
- Fixed position bottom bar (same pattern as `.install-prompt-banner`).
- `role="alert"` for accessibility.
- Dark theme colors from existing CSS variables.
- Contains message, numbered list, Copy Link button, Dismiss button.

### `.pwa-redirect-banner__instructions`
- `<ol>` with left padding, numbered steps.
- Font size `0.875rem`, color `var(--text-secondary)`.

### `.pwa-redirect-banner__copy-btn`
- Primary button style (`.primary` class pattern).
- Min touch target 44×44px.

### `.pwa-redirect-banner__dismiss-btn`
- Same pattern as `.install-prompt-dismiss`.

### `.link-import-ui`
- Inline panel below the header area.
- Flex row: input field + Import button + Cancel button.
- Uses existing input and button styles.

### `.header-actions`
- `display: flex; gap: 0.25rem;` to group the import and share buttons.
- Right-aligned naturally by the list selector's `flex: 1`.

### `.import-from-link-btn`
- Same style as `.share-btn` (icon button in header).
- Only rendered when `isStandaloneMode()` is true.

### Responsive
- Mobile (`< 768px`): Link import UI stacks vertically; banner uses smaller font/padding.
- Tablet/Desktop: Horizontal layout maintained.

## Testing Considerations

All new modules use dependency injection, enabling unit testing without browser APIs:

- `browser-context-detector.ts`: Test with mock `BrowserContextDeps` objects for iOS Safari, Chrome iOS, Android, standalone, browser contexts.
- `clipboard-helper.ts`: Test with mock `ClipboardDeps` — successful clipboard API, failed clipboard API, fallback path.
- `PwaRedirectBanner`: Test DOM structure, button callbacks, copy result display.
- `LinkImportUI`: Test DOM structure, input validation, error display, callbacks.
- `AppShell` integration: Test that redirect banner appears/doesn't appear based on context, and that link import flow dispatches correct state actions.
