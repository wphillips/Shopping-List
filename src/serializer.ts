/**
 * Serializer module for converting GroceryList to/from a portable JSON format.
 * The serialized format excludes IDs, timestamps, and UI state — only the
 * data needed to reconstruct the list is included.
 */

import type { GroceryList, Section, Item } from './types';

/** Portable list representation — no IDs, no timestamps, no UI state */
export interface SerializedList {
  name: string;
  sections: {
    name: string;
    order: number;
    items: {
      name: string;
      quantity: number;
      isChecked: boolean;
    }[];
  }[];
}

/** Generate a v4-style UUID (same pattern as storage.ts) */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Serialize a GroceryList into a JSON string of SerializedList shape.
 * Items are nested under their parent section (denormalized).
 */
export function serialize(list: GroceryList): string {
  const serialized: SerializedList = {
    name: list.name,
    sections: list.sections.map((section) => ({
      name: section.name,
      order: section.order,
      items: list.items
        .filter((item) => item.sectionId === section.id)
        .map((item) => ({
          name: item.name,
          quantity: item.quantity,
          isChecked: item.isChecked,
        })),
    })),
  };
  return JSON.stringify(serialized);
}

/**
 * Validate that a parsed object conforms to the SerializedList schema.
 * Returns an error string if invalid, or null if valid.
 */
function validateSerializedList(data: any): string | null {
  if (data === null || typeof data !== 'object') {
    return 'Missing required field: name';
  }
  if (typeof data.name !== 'string') {
    return 'Missing required field: name';
  }
  if (!Array.isArray(data.sections)) {
    return 'Missing required field: sections';
  }
  for (let si = 0; si < data.sections.length; si++) {
    const section = data.sections[si];
    if (section === null || typeof section !== 'object') {
      return `Invalid section at index ${si}`;
    }
    if (typeof section.name !== 'string') {
      return `Missing required field: name at section ${si}`;
    }
    if (typeof section.order !== 'number') {
      return `Missing required field: order at section ${si}`;
    }
    if (!Array.isArray(section.items)) {
      return `Missing required field: items at section ${si}`;
    }
    for (let ii = 0; ii < section.items.length; ii++) {
      const item = section.items[ii];
      if (item === null || typeof item !== 'object') {
        return `Invalid item at section ${si}, item ${ii}`;
      }
      if (typeof item.name !== 'string') {
        return `Invalid name at section ${si}, item ${ii}`;
      }
      if (typeof item.quantity !== 'number' || item.quantity < 1) {
        return `Invalid quantity at section ${si}, item ${ii}`;
      }
      if (typeof item.isChecked !== 'boolean') {
        return `Invalid isChecked at section ${si}, item ${ii}`;
      }
    }
  }
  return null;
}

/**
 * Deserialize a JSON string into a GroceryList.
 * Validates the shape, generates fresh UUIDs and timestamps for all entities.
 * Returns a GroceryList on success, or { error: string } on failure.
 */
export function deserialize(json: string): GroceryList | { error: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch (e: any) {
    return { error: `Invalid JSON: ${e.message}` };
  }

  const validationError = validateSerializedList(parsed);
  if (validationError !== null) {
    return { error: validationError };
  }

  const now = Date.now();
  const listId = generateId();
  const sections: Section[] = [];
  const items: Item[] = [];

  for (const sectionData of parsed.sections) {
    const sectionId = generateId();
    sections.push({
      id: sectionId,
      name: sectionData.name,
      order: sectionData.order,
      createdAt: now,
    });

    for (const itemData of sectionData.items) {
      items.push({
        id: generateId(),
        name: itemData.name,
        quantity: itemData.quantity,
        isChecked: itemData.isChecked,
        sectionId,
        createdAt: now,
      });
    }
  }

  return {
    id: listId,
    name: parsed.name,
    sections,
    items,
    createdAt: now,
  };
}
