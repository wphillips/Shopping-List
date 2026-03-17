# Bugfix Design — Offline Fetch Crash

## Overview

Two defects cause the app to crash when offline: (1) the service worker fetch handler re-throws on network failure, passing a rejected promise to `respondWith()`, and (2) `forceUpdate()` calls `reload()` even when `registration.update()` fails offline.

## Bug Condition

```
isBugCondition(request, networkState, cacheState) =
  (request ∉ cacheState ∧ networkState = offline ∧ respondWith receives rejected Promise)
  ∨ (registration.update() throws ∧ reload() is called)
```

### Examples

1. Airplane mode → navigate to app → `/` misses cache → `fetch()` rejects → `.catch()` re-throws → `respondWith()` gets rejected promise → Safari crash.
2. Airplane mode → click "Check for updates" → `registration.update()` throws → `reload()` called → navigation through broken SW → crash.

## Root Cause Analysis

**RC-1: sw.js `.catch()` re-throws** — `public/sw.js` line 75: `throw error` passes a rejected promise to `respondWith()` instead of a fallback Response.

**RC-2: No SPA fallback** — No fallback path for navigation requests that miss both cache and network.

**RC-3: forceUpdate reload on error** — `src/forceUpdate.ts` line 48: `reload()` is called even when `update()` fails, triggering navigation through the broken SW.

## Correctness Properties

| ID | Type | Property |
|----|------|----------|
| CP-1 | Bug fix (navigation) | For any navigation request not in cache + offline, `respondWith()` receives a resolved Response (cached `/index.html`), never a rejected promise |
| CP-2 | Bug fix (non-navigation) | For any non-navigation request not in cache + offline, `respondWith()` receives a resolved 503 Response, never a rejected promise |
| CP-3 | Bug fix (forceUpdate) | When `registration.update()` throws, `forceUpdate()` never calls `reload()` |
| CP-4 | Preservation (cache hit) | For any request in cache, the cached response is returned regardless of network state |
| CP-5 | Preservation (network 200) | For any cache miss where network returns 200, the response is returned and a clone is cached |
| CP-6 | Preservation (forceUpdate success) | When `registration.update()` succeeds, `forceUpdate()` clears caches and calls `reload()` |

## Fix Implementation

### Fix 1: `public/sw.js` — Graceful offline fallback

Replace the `.catch()` block in the fetch handler:

```js
.catch((error) => {
  console.error('[Service Worker] Fetch failed:', error);
  
  // Navigation: serve cached /index.html as SPA fallback
  if (event.request.mode === 'navigate') {
    return caches.match('/index.html').then((fallback) => {
      return fallback || new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' }
      });
    });
  }
  
  // Non-navigation: return 503
  return new Response('Service Unavailable', {
    status: 503,
    statusText: 'Service Unavailable'
  });
});
```

Never re-throw. `respondWith()` always gets a resolved Response.

### Fix 2: `src/forceUpdate.ts` — Don't reload on error

Replace the `if (updateError)` block:

```ts
if (updateError) {
  return {
    status: 'error',
    message: 'You appear to be offline. Please check your connection and try again.',
    cacheCleared,
  };
}
```

Remove `reload()`. Return user-friendly offline message.

## Testing Strategy

### Exploration Tests
PBT confirming the bug exists in current code before fixing (tests expected to fail on unfixed code).

### Fix-Checking Tests (CP-1, CP-2, CP-3)
- Random navigation requests not in cache + offline → resolved Response (SPA fallback)
- Random non-navigation requests not in cache + offline → resolved 503 Response
- Random errors for `registration.update()` → `reload()` never called

### Preservation Tests (CP-4, CP-5, CP-6)
- Random requests in cache → cached response returned
- Random cache misses with network 200 → response returned and cached
- Successful `registration.update()` → caches cleared and `reload()` called

### Unit Tests
- `tests/service-worker.test.ts`: navigation fallback + 503 response tests
- `tests/forceUpdate.test.ts`: update error branch (no reload, offline message)

## Files Changed

| File | Change |
|------|--------|
| `public/sw.js` | Replace `.catch()` with navigation fallback + 503 |
| `src/forceUpdate.ts` | Remove `reload()` from error branch, return offline message |
| `tests/offline-fetch-crash.exploration.test.ts` | New: exploration tests confirming bug |
| `tests/offline-fetch-crash.properties.test.ts` | New: PBT for CP-1 through CP-6 |
| `tests/service-worker.test.ts` | Add offline fallback unit tests |
| `tests/forceUpdate.test.ts` | Update error branch test, add offline message test |
