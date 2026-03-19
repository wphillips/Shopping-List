/**
 * Import controller for detecting and decoding shared grocery lists from URL fragments.
 * Dependencies are injected for testability — no global browser API access.
 */

import type { GroceryList } from './types';
import { decodeListFragment } from './url-codec';
import { deserialize } from './serializer';
import { mergeLists, MergeStats } from './merge-engine';

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
/** After decoding, determine the merge/import action */
export type ImportAction =
  | { action: 'import-new'; list: GroceryList }
  | { action: 'merge'; localList: GroceryList; incomingList: GroceryList }
  | { action: 'choose'; candidates: GroceryList[]; incomingList: GroceryList }
  | { action: 'error'; message: string }
  | { action: 'none' };

/**
 * Given a decoded incoming list and the current existing lists,
 * determine what action to take: import as new, merge, or let user choose.
 *
 * - Zero name matches → import-new
 * - One name match → merge
 * - Multiple name matches → choose
 */
export function resolveImportAction(
  incoming: GroceryList,
  existingLists: GroceryList[]
): ImportAction {
  const incomingNameLower = incoming.name.toLowerCase();
  const matches = existingLists.filter(
    (list) => list.name.toLowerCase() === incomingNameLower
  );

  if (matches.length === 0) {
    return { action: 'import-new', list: incoming };
  }

  if (matches.length === 1) {
    return { action: 'merge', localList: matches[0], incomingList: incoming };
  }

  return { action: 'choose', candidates: matches, incomingList: incoming };
}

/** Result of processing an import after URL decoding */
export type ProcessImportResult =
  | { action: 'none' }
  | { action: 'error'; message: string }
  | { action: 'import-new'; list: GroceryList }
  | { action: 'merged'; listId: string; mergedList: GroceryList; stats: MergeStats }
  | { action: 'choose'; candidates: GroceryList[]; incomingList: GroceryList };

/**
 * Full import orchestration: decode URL → resolve action → merge or import.
 *
 * - Decodes the shared URL via checkImportUrl
 * - Calls resolveImportAction to determine merge/import/choose
 * - For merge: invokes mergeLists and returns the merged list + stats
 * - For import-new: returns the decoded list for IMPORT_LIST dispatch
 * - For choose: returns candidates for UI selection
 */
export function processImport(
  deps: ImportDeps,
  existingLists: GroceryList[]
): ProcessImportResult {
  const decoded = checkImportUrl(deps);

  if (decoded.status === 'none') {
    return { action: 'none' };
  }

  if (decoded.status === 'error') {
    return { action: 'error', message: decoded.message };
  }

  const importAction = resolveImportAction(decoded.list, existingLists);

  switch (importAction.action) {
    case 'import-new':
      return { action: 'import-new', list: importAction.list };

    case 'merge': {
      const { mergedList, stats } = mergeLists(importAction.localList, importAction.incomingList);
      return { action: 'merged', listId: importAction.localList.id, mergedList, stats };
    }

    case 'choose':
      return { action: 'choose', candidates: importAction.candidates, incomingList: importAction.incomingList };

    default:
      return { action: 'none' };
  }
}

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
