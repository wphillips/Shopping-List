# PWA Share Link Handling Bugfix Design

## Overview

When a user shares a grocery list via a `?list=` URL, the receiving user's device opens the link in the default browser instead of the installed PWA. This happens because the PWA manifest (`public/manifest.webmanifest`) lacks `share_target`, `handle_links`, and proper `scope` declarations. The fix adds these manifest fields and ensures the service worker correctly handles inbound share-target navigations, so the OS routes matching URLs to the installed PWA.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a user with the PWA installed taps a shared `?list=` link, but the OS opens it in the default browser because the manifest provides no URL-handling signals
- **Property (P)**: The desired behavior — shared `?list=` links open inside the installed PWA, and the import is processed against the PWA's localStorage
- **Preservation**: Existing behaviors that must remain unchanged — share-link generation, direct PWA launch, service worker caching, and browser-only import for users without the PWA installed
- **manifest.webmanifest**: The PWA manifest file at `public/manifest.webmanifest` that declares app metadata, icons, and (after the fix) URL handling configuration
- **share_target**: A W3C manifest member that tells the OS the PWA can receive shared data (URLs, text, files) via the system share sheet
- **handle_links**: A manifest member (`"preferred"`) that tells the browser to prefer opening matching-scope URLs in the installed PWA rather than a browser tab
- **scope**: The manifest member that defines which URL paths belong to the PWA; the OS uses this to decide whether a navigation should be routed to the app

## Bug Details

### Bug Condition

The bug manifests when a user who has the PWA installed taps a shared link containing a `?list=` query parameter. The OS has no manifest-level signal to route the URL to the PWA, so it opens in the default browser. The browser has a separate localStorage context, so the imported list never reaches the PWA's storage.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { url: URL, pwaInstalled: boolean, manifest: ManifestConfig }
  OUTPUT: boolean

  RETURN input.pwaInstalled == true
         AND input.url.searchParams.has('list')
         AND input.manifest.share_target == undefined
         AND input.manifest.handle_links == undefined
         AND (input.manifest.scope == undefined OR input.manifest.scope == '/')
END FUNCTION
```

### Examples

- User A shares a list, generating `https://example.com/?list=abc123`. User B (PWA installed) taps the link → **Expected**: PWA opens and imports the list. **Actual**: Default browser opens, list imports into browser localStorage, invisible to PWA.
- User B opens the same link from an SMS notification → **Expected**: OS intercepts the navigation and launches the PWA. **Actual**: SMS app opens the default browser.
- User B receives a link via the system share sheet (another app shares the URL) → **Expected**: PWA appears as a share target. **Actual**: PWA is not listed as a share target.
- User C (PWA not installed) taps the same link → **Expected**: Browser opens normally and processes the import. **Actual**: Browser opens normally (correct behavior, unchanged).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Users without the PWA installed must continue to open shared links in the browser and import normally (Requirement 3.1)
- The share button in the PWA must continue to generate valid `?list=` URLs and invoke the Web Share API or clipboard fallback (Requirement 3.2)
- Direct PWA launches (no `?list=` parameter) must continue to load the home screen with existing lists from localStorage (Requirement 3.3)
- The service worker must continue to serve cached assets and fall back to `/index.html` for offline SPA routing (Requirement 3.4)

**Scope:**
All inputs that do NOT involve a PWA-installed user tapping a `?list=` link should be completely unaffected by this fix. This includes:
- Direct app launches from the home screen
- Share-link generation from within the PWA
- Service worker fetch/cache behavior for non-navigation requests
- Browser-based import for users without the PWA

## Hypothesized Root Cause

Based on the bug description and inspection of `public/manifest.webmanifest`, the root causes are:

1. **Missing `share_target`**: The manifest has no `share_target` member, so the PWA never registers as a share target with the OS. When another app shares a URL, the PWA is not offered as a destination.

2. **Missing `handle_links`**: The manifest does not declare `"handle_links": "preferred"`, so the browser does not attempt to intercept in-scope navigations and route them to the installed PWA.

3. **Minimal `scope` / missing `url_handlers`**: While `start_url` is `"/"`, there is no explicit `scope` declaration. More importantly, there are no `url_handlers` to associate the app's origin with the PWA for link capturing on platforms that support it.

4. **No service worker handling for share-target POST**: If `share_target` uses `method: "POST"` with `enctype: "application/x-www-form-urlencoded"`, the service worker needs to intercept the POST, extract the shared URL, and redirect to the app with the `?list=` parameter. The current service worker (`public/sw.js`) only handles GET fetches.

## Correctness Properties

Property 1: Bug Condition - Share Links Open in PWA

_For any_ shared URL where the `?list=` query parameter is present and the PWA is installed, the updated manifest SHALL declare `share_target`, `handle_links`, and `scope` such that the OS can route the URL to the installed PWA, and the PWA SHALL process the import against its own localStorage.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Share-Link Behavior Unchanged

_For any_ input that is NOT a `?list=` link tap by a PWA-installed user (direct launches, share generation, service worker caching, browser-only imports), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `public/manifest.webmanifest`

**Specific Changes**:
1. **Add `scope`**: Set `"scope": "/"` explicitly to make the PWA's URL scope unambiguous for link-capturing browsers.

2. **Add `handle_links`**: Set `"handle_links": "preferred"` so browsers that support the Handle Links API prefer opening in-scope navigations in the installed PWA.

3. **Add `share_target`**: Add a `share_target` member so the PWA registers as a share target. Use `method: "GET"` with `action: "/"` and `params: { url: "list" }` so that when a URL is shared to the PWA, the OS navigates to `/?list=<shared_url>`. Since the app already reads `?list=` from the URL in `import-controller.ts`, this aligns with the existing import flow.

   ```json
   "share_target": {
     "action": "/",
     "method": "GET",
     "params": {
       "url": "list"
     }
   }
   ```

4. **Add `url_handlers`** (optional, for origin association): Add `"url_handlers": [{ "origin": "https://*.example.com" }]` if the deployment origin is known. This strengthens link capturing on Chromium-based browsers. This may need to be templated or omitted if the origin varies.

**File**: `public/sw.js`

**Specific Changes**:
5. **Handle share-target navigations**: If the `share_target` uses GET (recommended), no service worker changes are needed — the existing fetch handler and SPA fallback already serve `/index.html` for navigation requests with query parameters. Verify that the service worker's `navigate` fallback correctly preserves the `?list=` query string when serving the cached `/index.html`. The current implementation uses `caches.match('/index.html')` which returns the cached HTML; the browser retains the original URL (including query params) in the address bar, so `import-controller.ts` can read them. No change needed.

**File**: `src/import-controller.ts`

**Specific Changes**:
6. **Verify share-target URL parsing**: The `checkImportUrl` function reads `window.location.search || window.location.hash` via `deps.getHash()`. When the OS launches the PWA via `share_target` with `method: "GET"`, the URL will be `/?list=...`, so `window.location.search` will contain `?list=...`. The existing `decodeListFragment` function already handles `?list=` parameters. No code change needed — just verification.

### Summary of Actual Code Changes

The fix is manifest-only:
- `public/manifest.webmanifest`: Add `scope`, `handle_links`, and `share_target` fields.
- No changes to TypeScript source files or the service worker are required.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that parse the manifest file and assert the presence of `share_target`, `handle_links`, and `scope` fields. Run these tests on the UNFIXED manifest to observe failures and confirm the missing declarations.

**Test Cases**:
1. **Manifest share_target Test**: Assert `manifest.share_target` is defined with correct `action`, `method`, and `params` (will fail on unfixed code)
2. **Manifest handle_links Test**: Assert `manifest.handle_links === "preferred"` (will fail on unfixed code)
3. **Manifest scope Test**: Assert `manifest.scope === "/"` is explicitly declared (will fail on unfixed code)
4. **Share Target Params Alignment Test**: Assert `share_target.params.url === "list"` matches the query parameter key used by `decodeListFragment` (will fail on unfixed code)

**Expected Counterexamples**:
- `manifest.share_target` is `undefined`
- `manifest.handle_links` is `undefined`
- Possible causes: manifest was created before share-target/handle-links specs were adopted; no URL handling was considered during initial PWA setup

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed manifest produces the expected configuration.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  manifest := parseManifest('public/manifest.webmanifest')
  ASSERT manifest.share_target IS NOT undefined
  ASSERT manifest.share_target.action == '/'
  ASSERT manifest.share_target.method == 'GET'
  ASSERT manifest.share_target.params.url == 'list'
  ASSERT manifest.handle_links == 'preferred'
  ASSERT manifest.scope == '/'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT encodeListUrl_original(input) == encodeListUrl_fixed(input)
  ASSERT decodeListFragment_original(input) == decodeListFragment_fixed(input)
  ASSERT processImport_original(input) == processImport_fixed(input)
  ASSERT swFetchHandler_original(input) == swFetchHandler_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for URL encoding/decoding, import processing, and service worker fetch handling, then write property-based tests capturing that behavior.

**Test Cases**:
1. **URL Encoding Preservation**: Verify `encodeListUrl` continues to produce valid `?list=` URLs after manifest changes
2. **URL Decoding Preservation**: Verify `decodeListFragment` continues to correctly parse `?list=` and `#list=` parameters
3. **Import Processing Preservation**: Verify `processImport` continues to decode, resolve, and merge/import lists correctly
4. **Service Worker Fallback Preservation**: Verify the SW continues to serve `/index.html` for navigation requests and cache static assets

### Unit Tests

- Test that the updated manifest is valid JSON and contains all required PWA fields
- Test that `share_target.params.url` matches the query key used by `decodeListFragment`
- Test that `share_target.action` matches the app's `start_url`
- Test that existing `encodeListUrl` output is compatible with the `share_target` configuration

### Property-Based Tests

- Generate random serialized grocery lists, encode them via `encodeListUrl`, and verify `decodeListFragment` round-trips correctly (preservation of existing codec behavior)
- Generate random URL strings and verify `decodeListFragment` returns consistent results before and after the fix
- Generate random `GroceryList` objects and verify `processImport` produces identical results with the unfixed and fixed code

### Integration Tests

- Test full share flow: serialize list → encode URL → simulate PWA launch with that URL → verify import succeeds
- Test that direct PWA launch (no `?list=` param) still loads the home screen
- Test that the service worker serves cached `/index.html` for navigation requests with `?list=` query parameters
