/**
 * Merge engine for combining two GroceryList objects using additive-only,
 * unchecked-wins semantics. This is a pure function with no side effects.
 */

import type { GroceryList, Section, Item } from './types';

/** Statistics about what changed during a merge */
export interface MergeStats {
  /** Number of new items added from the incoming list */
  itemsAdded: number;
  /** Number of items flipped from checked → unchecked */
  itemsUnchecked: number;
  /** Number of new sections created from the incoming list */
  sectionsAdded: number;
}

/** Result of a merge operation */
export interface MergeResult {
  mergedList: GroceryList;
  stats: MergeStats;
}

/** Generate a v4-style UUID (same pattern as serializer.ts) */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Merge an incoming list into a local list using additive, unchecked-wins semantics.
 * Pure function — no side effects.
 *
 * - Items matched by (itemName, sectionName) case-insensitive
 * - Unchecked wins: merged isChecked = local.isChecked AND incoming.isChecked
 * - Never removes items — result is superset of both inputs
 * - Local quantities preserved for matched items
 * - New items appended after existing items within each section
 */
export function mergeLists(local: GroceryList, incoming: GroceryList): MergeResult {
  const stats: MergeStats = { itemsAdded: 0, itemsUnchecked: 0, sectionsAdded: 0 };

  // Deep copy local sections and items
  const mergedSections: Section[] = local.sections.map((s) => ({ ...s }));
  const mergedItems: Item[] = local.items.map((i) => ({ ...i }));

  // Build case-insensitive section name → local section lookup
  const localSectionMap = new Map<string, Section>();
  for (const section of mergedSections) {
    localSectionMap.set(section.name.toLowerCase(), section);
  }

  // Build case-insensitive (sectionName, itemName) → local item lookup
  const localItemMap = new Map<string, Item>();
  for (const item of mergedItems) {
    const section = mergedSections.find((s) => s.id === item.sectionId);
    if (section) {
      const key = `${section.name.toLowerCase()}\0${item.name.toLowerCase()}`;
      localItemMap.set(key, item);
    }
  }

  // Determine next section order
  let nextOrder = mergedSections.reduce((max, s) => Math.max(max, s.order), -1) + 1;

  // Build a map from incoming section id → section for item lookups
  const incomingSectionById = new Map<string, Section>();
  for (const section of incoming.sections) {
    incomingSectionById.set(section.id, section);
  }

  // Process incoming sections
  for (const incomingSection of incoming.sections) {
    const sectionKey = incomingSection.name.toLowerCase();

    if (!localSectionMap.has(sectionKey)) {
      // New section — create with fresh ID
      const newSection: Section = {
        id: generateId(),
        name: incomingSection.name,
        order: nextOrder++,
        createdAt: Date.now(),
      };
      mergedSections.push(newSection);
      localSectionMap.set(sectionKey, newSection);
      stats.sectionsAdded++;
    }
  }

  // Process incoming items
  for (const incomingItem of incoming.items) {
    const incomingSection = incomingSectionById.get(incomingItem.sectionId);
    if (!incomingSection) continue;

    const sectionKey = incomingSection.name.toLowerCase();
    const itemKey = `${sectionKey}\0${incomingItem.name.toLowerCase()}`;

    if (localItemMap.has(itemKey)) {
      // Matched item — apply unchecked-wins
      const localItem = localItemMap.get(itemKey)!;
      const newChecked = localItem.isChecked && incomingItem.isChecked;
      if (localItem.isChecked && !newChecked) {
        stats.itemsUnchecked++;
      }
      localItem.isChecked = newChecked;
      // Local quantity preserved — no change
    } else {
      // New item — add with fresh ID, assigned to the matching local section
      const targetSection = localSectionMap.get(sectionKey)!;
      const newItem: Item = {
        id: generateId(),
        name: incomingItem.name,
        quantity: incomingItem.quantity,
        isChecked: incomingItem.isChecked,
        sectionId: targetSection.id,
        createdAt: Date.now(),
      };
      mergedItems.push(newItem);
      // Track in map so duplicate incoming items don't double-add
      localItemMap.set(itemKey, newItem);
      stats.itemsAdded++;
    }
  }

  const mergedList: GroceryList = {
    id: local.id,
    name: local.name,
    sections: mergedSections,
    items: mergedItems,
    createdAt: local.createdAt,
  };

  return { mergedList, stats };
}
