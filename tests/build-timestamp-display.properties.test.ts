/**
 * Property-based tests for build timestamp display
 * Feature: build-timestamp-display
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { toShortTimestamp } from '../src/build-timestamp';

/**
 * Applies the same formatting logic used in vite.config.ts to produce
 * the full build timestamp string from a Date object.
 */
function formatBuildTimestamp(date: Date): string {
  return `Built ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;
}

describe('Feature: build-timestamp-display, Property 1: Build timestamp format validity', () => {
  /**
   * **Validates: Requirements 1.1, 1.3**
   *
   * For any valid JavaScript Date object, formatting it with the build
   * timestamp logic should produce a string matching the pattern
   * "Built <Mon> <DD>, <YYYY> <h>:<mm> <AM|PM>".
   */
  it('should produce a valid format for any Date', () => {
    const pattern = /^Built [A-Z][a-z]{2} \d{1,2}, \d{4},? \d{1,2}:\d{2}\s?[AP]M$/;

    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2099-12-31T23:59:59Z') })
          .filter(d => !isNaN(d.getTime())),
        (date) => {
          const result = formatBuildTimestamp(date);
          expect(result).toMatch(pattern);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: build-timestamp-display, Property 2: Short timestamp derivation preserves components', () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * For any valid full-format build timestamp string, applying `toShortTimestamp`
   * should produce a string that:
   * (a) starts with lowercase "built"
   * (b) contains the same month and day
   * (c) contains the same time and AM/PM
   * (d) does not contain the 4-digit year
   */
  it('should preserve month, day, time, AM/PM and remove year', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2000-01-01T00:00:00Z'), max: new Date('2099-12-31T23:59:59Z') })
          .filter(d => !isNaN(d.getTime())),
        (date) => {
          const full = formatBuildTimestamp(date);
          const short = toShortTimestamp(full);

          // Extract components from the full timestamp
          const month = date.toLocaleString('en-US', { month: 'short' });
          const day = date.toLocaleString('en-US', { day: 'numeric' });
          const hour = date.toLocaleString('en-US', { hour: 'numeric', hour12: true }).replace(/\s?[AP]M/, '');
          const minute = date.toLocaleString('en-US', { minute: '2-digit' });
          const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
          const year = date.getFullYear().toString();

          // (a) starts with lowercase "built"
          expect(short.startsWith('built ')).toBe(true);

          // (b) contains the same month and day
          expect(short).toContain(month);
          expect(short).toContain(day);

          // (c) contains the same time and AM/PM
          expect(short).toContain(minute);
          expect(short).toContain(ampm);
          expect(short).toContain(hour);

          // (d) does not contain the 4-digit year
          expect(short).not.toContain(year);
        },
      ),
      { numRuns: 100 },
    );
  });
});
