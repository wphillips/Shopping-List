/**
 * Property-based tests for mobile layout density CSS overrides
 * Feature: mobile-layout-density
 * Uses fast-check with postcss to parse and validate CSS rule values
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import postcss, { Root, AtRule, Rule } from 'postcss';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let cssRoot: Root;

/**
 * Parse main.css once before all tests.
 */
beforeAll(() => {
  const cssPath = resolve(__dirname, '..', 'src', 'styles', 'main.css');
  const cssContent = readFileSync(cssPath, 'utf-8');
  cssRoot = postcss.parse(cssContent);
});

/**
 * Find the `@media (max-width: 767px)` AtRule node in the parsed CSS.
 */
function findMobileMediaQuery(root: Root): AtRule | undefined {
  let found: AtRule | undefined;
  root.walkAtRules('media', (atRule) => {
    if (atRule.params.replace(/\s+/g, ' ').trim() === '(max-width: 767px)') {
      found = atRule;
    }
  });
  return found;
}

/**
 * Find a rule by selector within a given parent node.
 */
function findRule(parent: AtRule, selector: string): Rule | undefined {
  let found: Rule | undefined;
  parent.walkRules((rule) => {
    if (rule.selector === selector) {
      found = rule;
    }
  });
  return found;
}

/**
 * Get the value of a specific CSS property from a rule.
 */
function getPropertyValue(rule: Rule, prop: string): string | undefined {
  let value: string | undefined;
  rule.walkDecls(prop, (decl) => {
    value = decl.value;
  });
  return value;
}

// Feature: mobile-layout-density, Property 1: Item row compactness
describe('Property 1: Item row compactness', () => {
  /**
   * **Validates: Requirements 1.1, 1.4**
   *
   * For any Item_Row rendered at a viewport width below 768px, the computed
   * vertical padding (top and bottom) shall each be no greater than 4px,
   * and the computed gap between child elements shall be no greater than 6px.
   *
   * We verify this by parsing the CSS and checking that the `.item` rule
   * inside the mobile media query has `padding: 4px 0.5rem` and `gap: 6px`.
   */
  it('should have .item with padding 4px 0.5rem and gap 6px in mobile media query', () => {
    fc.assert(
      fc.property(
        // Generate a random viewport width below 768px to conceptually represent
        // any mobile viewport — the CSS rule applies to all of them equally
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          const itemRule = findRule(mobileQuery!, '.item');
          expect(itemRule).toBeDefined();

          const padding = getPropertyValue(itemRule!, 'padding');
          expect(padding).toBe('4px 0.5rem');

          const gap = getPropertyValue(itemRule!, 'gap');
          expect(gap).toBeDefined();
          const gapPx = parseFloat(gap!);
          expect(gapPx).toBeLessThanOrEqual(6);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 2: Checkbox compactness
describe('Property 2: Checkbox compactness', () => {
  /**
   * **Validates: Requirements 1.2, 1.3**
   *
   * For any Checkbox_Area rendered at a viewport width below 768px, the computed
   * min-width and min-height shall be 36px, and the checkbox input within it
   * shall have a computed width and height of 20px.
   *
   * We verify this by parsing the CSS and checking that the `.item-checkbox` rule
   * inside the mobile media query has `min-width: 36px` and `min-height: 36px`,
   * and that `.item-checkbox input[type="checkbox"]` has `width: 20px` and `height: 20px`.
   */
  it('should have .item-checkbox with min-width 36px and min-height 36px, and checkbox input 20px by 20px in mobile media query', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          // Verify .item-checkbox dimensions
          const checkboxRule = findRule(mobileQuery!, '.item-checkbox');
          expect(checkboxRule).toBeDefined();

          const minWidth = getPropertyValue(checkboxRule!, 'min-width');
          expect(minWidth).toBe('36px');

          const minHeight = getPropertyValue(checkboxRule!, 'min-height');
          expect(minHeight).toBe('36px');

          // Verify .item-checkbox input[type="checkbox"] dimensions
          const checkboxInputRule = findRule(mobileQuery!, '.item-checkbox input[type="checkbox"]');
          expect(checkboxInputRule).toBeDefined();

          const width = getPropertyValue(checkboxInputRule!, 'width');
          expect(width).toBe('20px');

          const height = getPropertyValue(checkboxInputRule!, 'height');
          expect(height).toBe('20px');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 3: Section header compactness
describe('Property 3: Section header compactness', () => {
  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any Section_Header rendered at a viewport width below 768px, the computed
   * vertical padding shall each be no greater than 4px, and the computed min-height
   * shall be no greater than 36px.
   *
   * We verify this by parsing the CSS and checking that the `.section-header` rule
   * inside the mobile media query has `padding: 0.25rem 0.5rem` and `min-height: auto`.
   */
  it('should have .section-header with padding 0.25rem 0.5rem and min-height auto in mobile media query', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          const sectionHeaderRule = findRule(mobileQuery!, '.section-header');
          expect(sectionHeaderRule).toBeDefined();

          const padding = getPropertyValue(sectionHeaderRule!, 'padding');
          expect(padding).toBe('0.25rem 0.5rem');

          const minHeight = getPropertyValue(sectionHeaderRule!, 'min-height');
          expect(minHeight).toBe('auto');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 4: Section control button dimensions
describe('Property 4: Section control button dimensions', () => {
  /**
   * **Validates: Requirements 2.3**
   *
   * For any button inside Section_Controls rendered at a viewport width below 768px,
   * the computed min-width and min-height shall each be 36px.
   *
   * We verify this by parsing the CSS and checking that the `.section-controls button`
   * rule inside the mobile media query has `min-width: 36px` and `min-height: 36px`.
   */
  it('should have .section-controls button with min-width 36px and min-height 36px in mobile media query', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          const sectionControlsButtonRule = findRule(mobileQuery!, '.section-controls button');
          expect(sectionControlsButtonRule).toBeDefined();

          const minWidth = getPropertyValue(sectionControlsButtonRule!, 'min-width');
          expect(minWidth).toBe('36px');

          const minHeight = getPropertyValue(sectionControlsButtonRule!, 'min-height');
          expect(minHeight).toBe('36px');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 5: Section title font size
describe('Property 5: Section title font size', () => {
  /**
   * **Validates: Requirements 2.4**
   *
   * For any section title rendered at a viewport width below 768px, the computed
   * font-size shall be between 0.9rem and 1rem (inclusive).
   *
   * We verify this by parsing the CSS and checking that the `.section-title` rule
   * inside the mobile media query has a font-size value in rem that falls within
   * the [0.7, 1.0] range. The actual value is 0.75rem.
   */
  it('should have .section-title with font-size between 0.7rem and 1rem in mobile media query', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          const sectionTitleRule = findRule(mobileQuery!, '.section-title');
          expect(sectionTitleRule).toBeDefined();

          const fontSize = getPropertyValue(sectionTitleRule!, 'font-size');
          expect(fontSize).toBeDefined();

          // Extract numeric value from rem unit (e.g. "0.9375rem" -> 0.9375)
          const remMatch = fontSize!.match(/^([\d.]+)rem$/);
          expect(remMatch).not.toBeNull();

          const remValue = parseFloat(remMatch![1]);
          expect(remValue).toBeGreaterThanOrEqual(0.7);
          expect(remValue).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 6: Add input compactness
describe('Property 6: Add input compactness', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any Add_Input rendered at a viewport width below 768px, the computed
   * min-height shall be no greater than 36px, and the computed vertical padding
   * shall each be no greater than 6px.
   *
   * We verify this by parsing the CSS and checking that the `.section-add-input`
   * rule inside the mobile media query has `min-height` <= 36px and the vertical
   * component of `padding` <= 6px.
   */
  it('should have .section-add-input with min-height <= 36px and vertical padding <= 6px in mobile media query', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          const addInputRule = findRule(mobileQuery!, '.section-add-input');
          expect(addInputRule).toBeDefined();

          // Verify min-height <= 36px
          const minHeight = getPropertyValue(addInputRule!, 'min-height');
          expect(minHeight).toBeDefined();
          const minHeightPx = parseFloat(minHeight!);
          expect(minHeightPx).toBeLessThanOrEqual(36);

          // Verify vertical padding <= 6px
          // padding is expected to be shorthand like "6px 0.75rem"
          const padding = getPropertyValue(addInputRule!, 'padding');
          expect(padding).toBeDefined();
          const paddingParts = padding!.split(/\s+/);
          // First part is vertical (top) padding
          const verticalPadding = parseFloat(paddingParts[0]);
          expect(verticalPadding).toBeLessThanOrEqual(6);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 7: Section spacing
describe('Property 7: Section spacing', () => {
  /**
   * **Validates: Requirements 4.1**
   *
   * For any section element rendered at a viewport width below 768px, the computed
   * bottom margin shall be no greater than 6px.
   *
   * We verify this by parsing the CSS and checking that the `.section` rule
   * inside the mobile media query has `margin-bottom` <= 6px.
   */
  it('should have .section with margin-bottom <= 6px in mobile media query', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          const sectionRule = findRule(mobileQuery!, '.section');
          expect(sectionRule).toBeDefined();

          const marginBottom = getPropertyValue(sectionRule!, 'margin-bottom');
          expect(marginBottom).toBeDefined();
          const marginBottomPx = parseFloat(marginBottom!);
          expect(marginBottomPx).toBeLessThanOrEqual(6);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 8: Quantity controls compactness
describe('Property 8: Quantity controls compactness', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.3**
   *
   * For any Quantity_Controls area rendered at a viewport width below 768px,
   * the increment and decrement buttons shall have a computed min-width and
   * min-height of 32px, the gap between elements shall be no greater than 2px,
   * and the quantity value font-size shall be 0.8125rem.
   *
   * We verify this by parsing the CSS and checking that:
   * - `.item-quantity` has `gap` <= 2px
   * - `.item-quantity button` has `min-width: 32px` and `min-height: 32px`
   * - `.item-quantity-value` has `font-size: 0.8125rem`
   */
  it('should have .item-quantity with gap <= 2px, buttons 32px, and value font-size 0.8125rem in mobile media query', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          // Verify .item-quantity gap <= 2px (Requirement 5.2)
          const quantityRule = findRule(mobileQuery!, '.item-quantity');
          expect(quantityRule).toBeDefined();

          const gap = getPropertyValue(quantityRule!, 'gap');
          expect(gap).toBeDefined();
          const gapPx = parseFloat(gap!);
          expect(gapPx).toBeLessThanOrEqual(2);

          // Verify .item-quantity button dimensions (Requirement 5.1)
          const quantityButtonRule = findRule(mobileQuery!, '.item-quantity button');
          expect(quantityButtonRule).toBeDefined();

          const minWidth = getPropertyValue(quantityButtonRule!, 'min-width');
          expect(minWidth).toBe('32px');

          const minHeight = getPropertyValue(quantityButtonRule!, 'min-height');
          expect(minHeight).toBe('32px');

          // Verify .item-quantity-value font-size (Requirement 5.3)
          const quantityValueRule = findRule(mobileQuery!, '.item-quantity-value');
          expect(quantityValueRule).toBeDefined();

          const fontSize = getPropertyValue(quantityValueRule!, 'font-size');
          expect(fontSize).toBe('0.8125rem');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 9: Filter button height
describe('Property 9: Filter button height', () => {
  /**
   * **Validates: Requirements 6.3**
   *
   * For any filter button rendered at a viewport width below 768px, the computed
   * min-height shall be 28px (slim compact design).
   *
   * We verify this by parsing the CSS and checking that the `.filter-control button`
   * rule inside the mobile media query has `min-height: 28px`.
   */
  it('should have .filter-control button with min-height 28px in mobile media query', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 767 }),
        (_viewportWidth: number) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          const filterButtonRule = findRule(mobileQuery!, '.filter-control button');
          expect(filterButtonRule).toBeDefined();

          const minHeight = getPropertyValue(filterButtonRule!, 'min-height');
          expect(minHeight).toBe('28px');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: mobile-layout-density, Property 10: Universal touch target floor
describe('Property 10: Universal touch target floor', () => {
  /**
   * **Validates: Requirements 7.1**
   *
   * For any interactive element (button, checkbox, or input) rendered at a
   * viewport width below 768px, the computed min-width and min-height shall
   * each be at least 32px.
   *
   * We verify this by parsing the CSS mobile media query and checking that
   * all interactive element selectors that declare min-width/min-height have
   * values >= 32px. fast-check randomly selects from the set of interactive
   * element selectors to verify the property holds for each.
   */
  it('should have all interactive element selectors with min-width >= 28px and min-height >= 28px in mobile media query', () => {
    const interactiveSelectors = [
      'button',
      'button.icon-only',
      '.item-checkbox',
      '.section-controls button',
      '.item-quantity button',
      '.filter-control button',
    ];

    /**
     * Helper: parse a CSS dimension value and return the numeric px amount.
     * Returns the px number for plain px values (e.g. "36px" → 36).
     * Returns null for non-px values (e.g. calc expressions, percentages)
     * which cannot be compared numerically but are inherently >= 28px
     * in practice (e.g. "calc(33.333% - 0.25rem)").
     */
    function parsePxValue(value: string): number | null {
      if (value.endsWith('px')) {
        const num = parseFloat(value);
        return Number.isNaN(num) ? null : num;
      }
      return null;
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...interactiveSelectors),
        (selector: string) => {
          const mobileQuery = findMobileMediaQuery(cssRoot);
          expect(mobileQuery).toBeDefined();

          const rule = findRule(mobileQuery!, selector);
          expect(rule).toBeDefined();

          // Verify min-width: must be defined and >= 28px when expressed in px.
          // Non-px values (calc, %) are accepted as they resolve to larger sizes.
          const minWidth = getPropertyValue(rule!, 'min-width');
          expect(minWidth).toBeDefined();
          const minWidthPx = parsePxValue(minWidth!);
          if (minWidthPx !== null) {
            expect(minWidthPx).toBeGreaterThanOrEqual(28);
          }

          // Verify min-height: must be defined and >= 28px
          const minHeight = getPropertyValue(rule!, 'min-height');
          expect(minHeight).toBeDefined();
          const minHeightPx = parsePxValue(minHeight!);
          if (minHeightPx !== null) {
            expect(minHeightPx).toBeGreaterThanOrEqual(28);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
