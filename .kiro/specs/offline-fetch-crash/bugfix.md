# Bugfix Requirements Document

## Introduction

When the app is offline (e.g. airplane mode on iOS Safari), clicking the "Check for updates" button causes the entire page to crash. There are two contributing defects:

1. In `public/sw.js`, the fetch event handler's cache-miss path calls `fetch(event.request)` and when that network request fails (offline), the `.catch()` block re-throws the error. This passes a rejected promise to `event.respondWith()`, which Safari surfaces as a full-page error: "FetchEvent.respondWith received an error: TypeError: Load failed".

2. In `src/forceUpdate.ts`, when `registration.update()` fails (offline), the function still calls `reload()`, which triggers a navigation request through the broken service worker fetch handler, compounding the crash. When offline and the update fails, reloading is pointless and harmful.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a navigation request (e.g. page load) misses the cache AND the network fetch fails (device is offline) THEN the system re-throws the network error inside `.catch()`, passing a rejected promise to `event.respondWith()`, which causes iOS Safari to display a full-page crash error ("FetchEvent.respondWith received an error: TypeError: Load failed")

1.2 WHEN a non-navigation request (e.g. JS, CSS, image asset) misses the cache AND the network fetch fails (device is offline) THEN the system re-throws the network error inside `.catch()`, passing a rejected promise to `event.respondWith()`, which causes the resource load to fail with an unhandled error instead of a graceful HTTP error response

1.3 WHEN `registration.update()` fails (device is offline) THEN `forceUpdate()` still calls `reload()`, triggering a navigation request through the broken service worker fetch handler, which compounds the crash instead of showing a graceful error notification

### Expected Behavior (Correct)

2.1 WHEN a navigation request misses the cache AND the network fetch fails (device is offline) THEN the system SHALL fall back to serving the cached `/index.html` as an SPA fallback response, so the page loads gracefully instead of crashing

2.2 WHEN a non-navigation request misses the cache AND the network fetch fails (device is offline) THEN the system SHALL return a `503 Service Unavailable` Response object, so `respondWith()` always receives a resolved Response and the page does not crash

2.3 WHEN `registration.update()` fails (device is offline) THEN `forceUpdate()` SHALL NOT call `reload()`, and SHALL return a result with `status: 'error'` and a user-friendly message indicating the device appears to be offline, without reloading the page

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a request (navigation or non-navigation) hits the cache THEN the system SHALL CONTINUE TO return the cached response immediately without attempting a network fetch

3.2 WHEN a request misses the cache AND the network fetch succeeds with a 200 status THEN the system SHALL CONTINUE TO return the network response and cache a clone of it for future use

3.3 WHEN a request misses the cache AND the network fetch succeeds with a non-200 status THEN the system SHALL CONTINUE TO return the network response without caching it

3.4 WHEN `registration.update()` succeeds THEN `forceUpdate()` SHALL CONTINUE TO clear caches and reload as it does today
