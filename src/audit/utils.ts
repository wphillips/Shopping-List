import type { AuditCategory, Finding, Severity } from './types';

const categoryPrefixMap: Record<AuditCategory, string> = {
  Dependencies: 'DEP',
  'Duplicate Code': 'DUP',
  Security: 'SEC',
  TypeScript: 'TS',
  PWA: 'PWA',
  Build: 'BLD',
  Infrastructure: 'INF',
  Architecture: 'ARC',
};

const counters: Record<string, number> = {};

/**
 * Creates a Finding with an auto-incrementing ID per category.
 * ID format: PREFIX-NNN (e.g., "SEC-001", "DEP-002").
 */
export function createFinding(
  params: Omit<Finding, 'id'>
): Finding {
  const prefix = categoryPrefixMap[params.category];
  const count = (counters[prefix] ?? 0) + 1;
  counters[prefix] = count;
  const id = `${prefix}-${String(count).padStart(3, '0')}`;
  return { id, ...params };
}

const severityOrder: Record<Severity, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

/**
 * Compares two severity levels for sorting.
 * Returns negative if `a` is higher severity, positive if `b` is higher, 0 if equal.
 */
export function compareSeverity(a: Severity, b: Severity): number {
  return severityOrder[a] - severityOrder[b];
}

/**
 * Resets the auto-incrementing counters (useful for testing).
 */
export function resetCounters(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
}
