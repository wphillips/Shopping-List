/**
 * Import controller for detecting and decoding shared grocery lists from URL fragments.
 * Dependencies are injected for testability — no global browser API access.
 */

import type { GroceryList } from './types';
import { decodeListFragment } from './url-codec';
import { deserialize } from './serializer';

/** Injected browser API dependencies */
export interface ImportDeps {
  getHash: () => string;
  replaceState: (url: string) => void;
}

/** Result of checking the URL for a shared list */
export type ImportCheckResult =
  | { status: 'none' }
  | { status: 'decoded'; list: GroceryList }
  | { status: 'error'; message: string };

/**
 * Check the current URL for a shared list fragment.
 *
 * 1. Read the hash via `deps.getHash()`.
 * 2. Decode via `decodeListFragment(hash)`.
 *    - If `null` (no `list=` param): return `{ status: 'none' }`.
 *    - If `{ error }`: return `{ status: 'error', message }`.
 * 3. Deserialize the decoded JSON string.
 *    - If `{ error }`: return `{ status: 'error', message }`.
 *    - Otherwise: return `{ status: 'decoded', list }`.
 */
export function checkImportUrl(deps: ImportDeps): ImportCheckResult {
  const hash = deps.getHash();
  const decoded = decodeListFragment(hash);

  if (decoded === null) {
    return { status: 'none' };
  }

  if (typeof decoded === 'object' && 'error' in decoded) {
    return { status: 'error', message: decoded.error };
  }

  const result = deserialize(decoded);

  if ('error' in result) {
    return { status: 'error', message: result.error };
  }

  return { status: 'decoded', list: result };
}
