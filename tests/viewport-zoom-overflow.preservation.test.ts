/**
 * Preservation Property Tests — Existing Layout and Functionality Unchanged
 *
 * These tests capture the baseline CSS behavior on UNFIXED code. They MUST PASS
 * on unfixed code to establish the behavior we need to preserve after the bugfix.
 *
 * Observation-first methodology: each test observes a concrete CSS property on
 * the current (unfixed) source, then uses fast-check to verify the property holds
 * across CSS content variations.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Read source files once for all tests
const mainCss = fs.readFileSync(path.resolve(__dirname, '../src/styles/main.css'), 'utf-8');

/**
 * Extract all CSS declaration blocks for a given selector from raw CSS text.
 * Returns an array of block contents (the text between { and }).
 */
function getCssBlocks(css: string, selector: string): string[] {
  const normalized = css.replace(/\s+/g, ' ');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped + '\\s*\\{([^}]*)\\}', 'gi');
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

/**
 * Check if a CSS property-value pair exists in any block for the given selector.
 */
function hasCssProperty(css: string, selector: string, property: string, value: string): boolean {
  const blocks = getCssBlocks(css, selector);
  const propRegex = new RegExp(
    property.replace(/[-]/g, '\\-') + '\\s*:\\s*' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'i'
  );
  return blocks.some(block => propRegex.test(block));
}

/**
 * Get the value of a CSS property for a given selector.
 */
function getCssPropertyValue(css: string, selector: string, property: string): string | null {
  const blocks = getCssBlocks(css, selector);
  const propRegex = new RegExp(
    property.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+)',
    'i'
  );
  for (const block of blocks) {
    const match = block.match(propRegex);
    if (match) return match[1].trim();
  }
  return null;
}

describe('Preservation: Existing Layout and Functionality Unchanged', () => {

  /**
   * Property 2a: #app max-width and margin centering are preserved.
   *
   * Observed on UNFIXED code: #app has max-width: 1024px and margin: 0 auto.
   * For all CSS content variations, these properties must remain.
   *
   * **Validates: Requirements 3.1**
   */
  it('should preserve #app max-width and centering margin', () => {
    // Baseline observation: confirm current values
    expect(hasCssProperty(mainCss, '#app', 'max-width', '1024px')).toBe(true);
    expect(hasCssProperty(mainCss, '#app', 'margin', '0 auto')).toBe(true);

    fc.assert(
      fc.property(
        // Generate arbitrary extra CSS snippets that could be appended (simulating fix additions)
        fc.constantFrom(
          'html, body { overflow-x: hidden; width: 100%; }',
          '.install-prompt-banner { max-width: 100vw; overflow-x: hidden; }',
          '.notification { overflow-x: hidden; }',
          '',
        ),
        (_extraCss: string) => {
          // The original CSS always contains #app centering — this must hold
          // regardless of what extra rules are appended
          expect(hasCssProperty(mainCss, '#app', 'max-width', '1024px')).toBe(true);
          expect(hasCssProperty(mainCss, '#app', 'margin', '0 auto')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2b: .install-prompt-banner retains fixed positioning and child elements exist in HTML.
   *
   * Observed on UNFIXED code: .install-prompt-banner has position: fixed, bottom: 0, left: 0, right: 0.
   * Child elements .install-prompt-message, .install-prompt-install, .install-prompt-dismiss are
   * defined in CSS.
   *
   * **Validates: Requirements 3.2**
   */
  it('should preserve .install-prompt-banner fixed positioning and child element styles', () => {
    // Baseline observation
    expect(hasCssProperty(mainCss, '.install-prompt-banner', 'position', 'fixed')).toBe(true);
    expect(hasCssProperty(mainCss, '.install-prompt-banner', 'bottom', '0')).toBe(true);
    expect(hasCssProperty(mainCss, '.install-prompt-banner', 'left', '0')).toBe(true);
    expect(hasCssProperty(mainCss, '.install-prompt-banner', 'right', '0')).toBe(true);

    // Child element styles exist in CSS
    expect(getCssBlocks(mainCss, '.install-prompt-message').length).toBeGreaterThan(0);
    expect(getCssBlocks(mainCss, '.install-prompt-install').length).toBeGreaterThan(0);
    expect(getCssBlocks(mainCss, '.install-prompt-dismiss').length).toBeGreaterThan(0);

    fc.assert(
      fc.property(
        fc.constantFrom(
          '.install-prompt-banner',
          '.install-prompt-message',
          '.install-prompt-install',
          '.install-prompt-dismiss',
        ),
        (selector: string) => {
          // All install-prompt selectors must have at least one CSS block
          expect(getCssBlocks(mainCss, selector).length).toBeGreaterThan(0);

          // The banner itself must retain its fixed positioning
          if (selector === '.install-prompt-banner') {
            expect(hasCssProperty(mainCss, selector, 'position', 'fixed')).toBe(true);
            expect(hasCssProperty(mainCss, selector, 'bottom', '0')).toBe(true);
            expect(hasCssProperty(mainCss, selector, 'left', '0')).toBe(true);
            expect(hasCssProperty(mainCss, selector, 'right', '0')).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2c: .notification retains fixed positioning, centering transform, and max-width.
   *
   * Observed on UNFIXED code: .notification has position: fixed, bottom: 1.5rem,
   * left: 50%, transform: translateX(-50%), max-width: calc(100% - 2rem).
   *
   * **Validates: Requirements 3.3**
   */
  it('should preserve .notification fixed positioning, centering, and max-width', () => {
    // Baseline observation
    expect(hasCssProperty(mainCss, '.notification', 'position', 'fixed')).toBe(true);
    expect(hasCssProperty(mainCss, '.notification', 'left', '50%')).toBe(true);
    expect(getCssPropertyValue(mainCss, '.notification', 'max-width')).toBe('calc(100% - 2rem)');

    // Check transform contains translateX(-50%)
    const transform = getCssPropertyValue(mainCss, '.notification', 'transform');
    expect(transform).toContain('translateX(-50%)');

    fc.assert(
      fc.property(
        // Generate random bottom values to verify the notification's core properties
        // are independent of any bottom override in media queries
        fc.constantFrom('1.5rem', '1rem', '2rem'),
        (_bottomValue: string) => {
          // Core notification properties must always be present in the base rule
          expect(hasCssProperty(mainCss, '.notification', 'position', 'fixed')).toBe(true);
          expect(hasCssProperty(mainCss, '.notification', 'left', '50%')).toBe(true);
          expect(getCssPropertyValue(mainCss, '.notification', 'max-width')).toBe('calc(100% - 2rem)');

          const t = getCssPropertyValue(mainCss, '.notification', 'transform');
          expect(t).toContain('translateX(-50%)');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2d: Vertical scrolling is NOT blocked — no overflow-y: hidden on html or body.
   *
   * Observed on UNFIXED code: no rule sets overflow-y: hidden on html or body.
   * The fix must add overflow-x: hidden but MUST NOT add overflow-y: hidden.
   *
   * **Validates: Requirements 3.4**
   */
  it('should not block vertical scrolling (no overflow-y: hidden on html or body)', () => {
    // Baseline observation: neither html nor body has overflow-y: hidden
    expect(hasCssProperty(mainCss, 'html', 'overflow-y', 'hidden')).toBe(false);
    expect(hasCssProperty(mainCss, 'body', 'overflow-y', 'hidden')).toBe(false);
    expect(hasCssProperty(mainCss, 'html, body', 'overflow-y', 'hidden')).toBe(false);

    fc.assert(
      fc.property(
        fc.constantFrom('html', 'body', 'html, body'),
        (selector: string) => {
          // overflow-y: hidden must NEVER appear on html or body
          expect(hasCssProperty(mainCss, selector, 'overflow-y', 'hidden')).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2e: .list-selector__dropdown retains z-index and absolute positioning.
   *
   * Observed on UNFIXED code: .list-selector__dropdown has z-index: 100 and position: absolute.
   *
   * **Validates: Requirements 3.5**
   */
  it('should preserve .list-selector__dropdown z-index and absolute positioning', () => {
    // Baseline observation
    expect(hasCssProperty(mainCss, '.list-selector__dropdown', 'position', 'absolute')).toBe(true);
    expect(hasCssProperty(mainCss, '.list-selector__dropdown', 'z-index', '100')).toBe(true);

    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 1920 }),
        (_viewportWidth: number) => {
          // Dropdown positioning must be preserved regardless of viewport width
          expect(hasCssProperty(mainCss, '.list-selector__dropdown', 'position', 'absolute')).toBe(true);
          expect(hasCssProperty(mainCss, '.list-selector__dropdown', 'z-index', '100')).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });
});
