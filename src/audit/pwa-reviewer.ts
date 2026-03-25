import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { Finding } from './types';
import { createFinding } from './utils';

const REQUIRED_MANIFEST_FIELDS = [
  'name',
  'short_name',
  'start_url',
  'display',
  'icons',
  'theme_color',
  'background_color',
] as const;

/**
 * Verify manifest.webmanifest has all required fields.
 * Pure function — operates on the raw manifest JSON string.
 */
export function checkManifestFields(manifestContent: string): Finding[] {
  const findings: Finding[] = [];

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestContent);
  } catch {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'High',
        title: 'manifest.webmanifest is not valid JSON',
        description: 'The web manifest file could not be parsed as JSON.',
        filePaths: ['public/manifest.webmanifest'],
        recommendation: 'Fix the JSON syntax in public/manifest.webmanifest.',
        requirementRef: 'Req 5.1',
      })
    );
    return findings;
  }

  const missingFields = REQUIRED_MANIFEST_FIELDS.filter(
    (field) => manifest[field] === undefined || manifest[field] === null
  );

  if (missingFields.length > 0) {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'High',
        title: `Web manifest missing required field(s): ${missingFields.join(', ')}`,
        description:
          `The manifest.webmanifest is missing the following required fields: ${missingFields.join(', ')}. ` +
          'These fields are needed for proper PWA installation and display.',
        filePaths: ['public/manifest.webmanifest'],
        recommendation:
          `Add the missing fields to public/manifest.webmanifest: ${missingFields.join(', ')}.`,
        requirementRef: 'Req 5.1',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'Low',
        title: 'Web manifest has all required fields',
        description:
          `All ${REQUIRED_MANIFEST_FIELDS.length} required fields are present: ${REQUIRED_MANIFEST_FIELDS.join(', ')}.`,
        filePaths: ['public/manifest.webmanifest'],
        recommendation: 'No action needed. Manifest is correctly configured.',
        requirementRef: 'Req 5.1',
      })
    );
  }

  return findings;
}

/**
 * Check that the service worker uses a versioned cache name and cleans up old caches
 * in the activate handler.
 * Pure function — operates on the SW source string.
 */
export function checkServiceWorkerCacheVersioning(swContent: string): Finding[] {
  const findings: Finding[] = [];

  // Check for versioned cache name (contains a hash placeholder or version string)
  const cacheNameMatch = swContent.match(/CACHE_NAME\s*=\s*['"`]([^'"`]+)['"`]/);
  const hasVersionedCache =
    cacheNameMatch !== null &&
    (/__(BUILD_HASH|VERSION|CACHE_VERSION)__/.test(cacheNameMatch[1]) ||
      /v\d+/.test(cacheNameMatch[1]));

  if (!hasVersionedCache) {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'High',
        title: 'Service worker cache name is not versioned',
        description:
          'The service worker does not use a versioned or hashed cache name. ' +
          'Without versioning, users may receive stale cached assets after deployments.',
        filePaths: ['public/sw.js'],
        recommendation:
          'Use a versioned cache name (e.g., include a build hash placeholder like __BUILD_HASH__) so each deployment creates a new cache.',
        requirementRef: 'Req 5.2',
      })
    );
  }

  // Check for old cache cleanup in activate handler
  const hasActivateHandler = /addEventListener\s*\(\s*['"]activate['"]/.test(swContent);
  const hasCacheCleanup =
    hasActivateHandler &&
    /caches\.keys\s*\(\s*\)/.test(swContent) &&
    /caches\.delete\s*\(/.test(swContent);

  if (!hasCacheCleanup) {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'High',
        title: 'Service worker does not clean up old caches',
        description:
          'The service worker activate handler does not clean up old caches. ' +
          'Stale caches will accumulate and waste storage.',
        filePaths: ['public/sw.js'],
        recommendation:
          'In the activate event handler, enumerate caches with caches.keys() and delete any cache that does not match the current CACHE_NAME.',
        requirementRef: 'Req 5.2',
      })
    );
  }

  if (hasVersionedCache && hasCacheCleanup) {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'Low',
        title: 'Service worker uses versioned cache with old cache cleanup',
        description:
          'The service worker uses a versioned cache name and cleans up old caches in the activate handler.',
        filePaths: ['public/sw.js'],
        recommendation: 'No action needed. Cache versioning strategy is correctly configured.',
        requirementRef: 'Req 5.2',
      })
    );
  }

  return findings;
}

/**
 * Check that the service worker pre-caches critical assets via __PRECACHE_ASSETS__
 * or a similar build-injected mechanism.
 * Pure function — operates on the SW source string.
 */
export function checkServiceWorkerPrecache(swContent: string): Finding[] {
  const findings: Finding[] = [];

  const hasPrecacheAssets =
    /__PRECACHE_ASSETS__/.test(swContent) ||
    /PRECACHE_ASSETS/.test(swContent) ||
    /BUILT_ASSETS/.test(swContent);

  const hasInstallHandler = /addEventListener\s*\(\s*['"]install['"]/.test(swContent);
  const hasCacheAddAll = /cache\.addAll\s*\(/.test(swContent);

  if (!hasPrecacheAssets) {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'High',
        title: 'Service worker does not use build-injected pre-cache assets',
        description:
          'The service worker does not reference __PRECACHE_ASSETS__ or a similar build-injected asset list. ' +
          'Critical assets may not be pre-cached, leading to incomplete offline support.',
        filePaths: ['public/sw.js'],
        recommendation:
          'Use a build plugin (e.g., vite-plugin-sw-cache-version) to inject a __PRECACHE_ASSETS__ list into the service worker at build time.',
        requirementRef: 'Req 5.3',
      })
    );
  } else if (!hasInstallHandler || !hasCacheAddAll) {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'Medium',
        title: 'Service worker references pre-cache assets but may not cache them on install',
        description:
          'The service worker references __PRECACHE_ASSETS__ but does not appear to cache them during the install event using cache.addAll().',
        filePaths: ['public/sw.js'],
        recommendation:
          'Ensure the install event handler opens a cache and calls cache.addAll() with the pre-cache asset list.',
        requirementRef: 'Req 5.3',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'Low',
        title: 'Service worker pre-caches critical assets via build-injected list',
        description:
          'The service worker uses __PRECACHE_ASSETS__ (or equivalent) and caches them during the install event.',
        filePaths: ['public/sw.js'],
        recommendation: 'No action needed. Pre-caching is correctly configured.',
        requirementRef: 'Req 5.3',
      })
    );
  }

  return findings;
}

/**
 * Check that the service worker provides an offline fallback for navigation requests.
 * Pure function — operates on the SW source string.
 */
export function checkServiceWorkerOfflineFallback(swContent: string): Finding[] {
  const findings: Finding[] = [];

  const hasFetchHandler = /addEventListener\s*\(\s*['"]fetch['"]/.test(swContent);
  const hasNavigationCheck =
    /request\.mode\s*===?\s*['"]navigate['"]/.test(swContent) ||
    /\.mode\s*===?\s*['"]navigate['"]/.test(swContent);
  const hasFallback =
    /caches\.match\s*\(\s*['"]\/index\.html['"]/.test(swContent) ||
    /caches\.match\s*\(\s*['"]\/offline\.html['"]/.test(swContent) ||
    /caches\.match\s*\(\s*['"]\/['"]/.test(swContent);

  if (!hasFetchHandler) {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'High',
        title: 'Service worker has no fetch event handler',
        description:
          'The service worker does not have a fetch event handler. Without it, the app cannot serve cached content or provide offline fallback.',
        filePaths: ['public/sw.js'],
        recommendation:
          'Add a fetch event handler that serves cached responses and falls back to a cached page for navigation requests.',
        requirementRef: 'Req 5.4',
      })
    );
  } else if (!hasNavigationCheck || !hasFallback) {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'Medium',
        title: 'Service worker may not provide offline fallback for navigation',
        description:
          'The service worker has a fetch handler but does not appear to check for navigation requests ' +
          'and serve a cached fallback (e.g., /index.html) when the network is unavailable.',
        filePaths: ['public/sw.js'],
        recommendation:
          'In the fetch handler, check if event.request.mode === "navigate" and, on network failure, respond with a cached /index.html as a SPA fallback.',
        requirementRef: 'Req 5.4',
      })
    );
  } else {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'Low',
        title: 'Service worker provides offline fallback for navigation requests',
        description:
          'The service worker checks for navigation requests and serves a cached fallback page when the network is unavailable.',
        filePaths: ['public/sw.js'],
        recommendation: 'No action needed. Offline navigation fallback is correctly configured.',
        requirementRef: 'Req 5.4',
      })
    );
  }

  return findings;
}

/**
 * Read a file safely, returning null if it doesn't exist or can't be read.
 */
async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Main entry point: run all PWA configuration checks and return findings.
 */
export async function reviewPwa(): Promise<Finding[]> {
  const findings: Finding[] = [];

  // 1. Check manifest.webmanifest
  const manifestContent = await safeReadFile(resolve('public/manifest.webmanifest'));
  if (manifestContent) {
    findings.push(...checkManifestFields(manifestContent));
  } else {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'High',
        title: 'Unable to read manifest.webmanifest',
        description:
          'Could not read public/manifest.webmanifest. All manifest checks were skipped.',
        filePaths: ['public/manifest.webmanifest'],
        recommendation: 'Verify that public/manifest.webmanifest exists and is readable.',
        requirementRef: 'Req 5.1',
      })
    );
  }

  // 2. Check service worker
  const swContent = await safeReadFile(resolve('public/sw.js'));
  if (swContent) {
    findings.push(...checkServiceWorkerCacheVersioning(swContent));
    findings.push(...checkServiceWorkerPrecache(swContent));
    findings.push(...checkServiceWorkerOfflineFallback(swContent));
  } else {
    findings.push(
      createFinding({
        category: 'PWA',
        severity: 'High',
        title: 'Unable to read service worker file',
        description:
          'Could not read public/sw.js. All service worker checks were skipped.',
        filePaths: ['public/sw.js'],
        recommendation: 'Verify that public/sw.js exists and is readable.',
        requirementRef: 'Req 5.2',
      })
    );
  }

  return findings;
}
