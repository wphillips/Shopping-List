/**
 * Unit tests for mobile layout density — desktop/tablet regression and structural constraints.
 * Feature: mobile-layout-density
 * Uses postcss to parse and validate CSS rule structure.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import postcss, { Root, AtRule, Rule } from 'postcss';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let cssRoot: Root;

beforeAll(() => {
  const cssPath = resolve(__dirname, '..', 'src', 'styles', 'main.css');
  const cssContent = readFileSync(cssPath, 'utf-8');
  cssRoot = postcss.parse(cssContent);
});

/**
 * Find the `@media (max-width: 767px)` AtRule node.
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
 * Collect all rules matching a selector within a given parent node.
 */
function findRulesInParent(parent: AtRule | Root, selector: string): Rule[] {
  const rules: Rule[] = [];
  parent.walkRules((rule) => {
    if (rule.selector === selector) {
      rules.push(rule);
    }
  });
  return rules;
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

/**
 * Collect all top-level rules (not inside any @media) from the root.
 */
function getBaseRules(root: Root): Rule[] {
  const rules: Rule[] = [];
  root.each((node) => {
    if (node.type === 'rule') {
      rules.push(node as Rule);
    }
  });
  return rules;
}

/**
 * Find all @media rules that are NOT the mobile media query.
 */
function getNonMobileMediaQueries(root: Root): AtRule[] {
  const queries: AtRule[] = [];
  root.walkAtRules('media', (atRule) => {
    if (atRule.params.replace(/\s+/g, ' ').trim() !== '(max-width: 767px)') {
      queries.push(atRule);
    }
  });
  return queries;
}


/**
 * Task 8.1: No compact overrides at 768px
 * **Validates: Requirements 7.3**
 *
 * At 768px the mobile media query does not apply, so the base button styles
 * (44px min-height/min-width) should be in effect. We verify this by ensuring
 * that the compact `button` rule with `min-width: 32px` or `min-height: 32px`
 * only exists inside the mobile media query — not in base styles or
 * tablet/desktop media queries.
 */
describe('Task 8.1: No compact overrides at 768px', () => {
  it('should not have compact button overrides (32px) in base styles', () => {
    const baseRules = getBaseRules(cssRoot);
    const baseButtonRules = baseRules.filter((r) => r.selector === 'button');

    for (const rule of baseButtonRules) {
      const minWidth = getPropertyValue(rule, 'min-width');
      const minHeight = getPropertyValue(rule, 'min-height');
      // Base button should have 44px, not 32px
      if (minWidth) {
        expect(minWidth).not.toBe('32px');
      }
      if (minHeight) {
        expect(minHeight).not.toBe('32px');
      }
    }
  });

  it('should not have compact button overrides (32px) in tablet/desktop media queries', () => {
    const nonMobileQueries = getNonMobileMediaQueries(cssRoot);

    for (const query of nonMobileQueries) {
      const buttonRules = findRulesInParent(query, 'button');
      for (const rule of buttonRules) {
        const minWidth = getPropertyValue(rule, 'min-width');
        const minHeight = getPropertyValue(rule, 'min-height');
        if (minWidth) {
          expect(minWidth).not.toBe('32px');
        }
        if (minHeight) {
          expect(minHeight).not.toBe('32px');
        }
      }
    }
  });

  it('should have base button styles with 44px min dimensions', () => {
    const baseRules = getBaseRules(cssRoot);
    const baseButtonRule = baseRules.find((r) => r.selector === 'button');
    expect(baseButtonRule).toBeDefined();

    const minWidth = getPropertyValue(baseButtonRule!, 'min-width');
    expect(minWidth).toBe('44px');

    const minHeight = getPropertyValue(baseButtonRule!, 'min-height');
    expect(minHeight).toBe('44px');
  });

  it('should have compact button overrides only inside mobile media query', () => {
    const mobileQuery = findMobileMediaQuery(cssRoot);
    expect(mobileQuery).toBeDefined();

    const mobileButtonRules = findRulesInParent(mobileQuery!, 'button');
    expect(mobileButtonRules.length).toBeGreaterThan(0);

    const hasMobileCompact = mobileButtonRules.some((rule) => {
      const minWidth = getPropertyValue(rule, 'min-width');
      const minHeight = getPropertyValue(rule, 'min-height');
      return minWidth === '32px' || minHeight === '32px';
    });
    expect(hasMobileCompact).toBe(true);
  });
});


/**
 * Task 8.2: All compact rules inside mobile media query
 * **Validates: Requirements 8.1**
 *
 * Verify that all compact override selectors exist within the
 * `@media (max-width: 767px)` block.
 */
describe('Task 8.2: All compact rules inside mobile media query', () => {
  const compactSelectors: { selector: string; property: string; value: string }[] = [
    { selector: '.item', property: 'gap', value: '6px' },
    { selector: '.item-checkbox', property: 'min-width', value: '36px' },
    { selector: '.item-checkbox input[type="checkbox"]', property: 'width', value: '20px' },
    { selector: '.section-header', property: 'min-height', value: 'auto' },
    { selector: '.section-controls button', property: 'min-width', value: '36px' },
    { selector: '.section-title', property: 'font-size', value: '0.75rem' },
    { selector: '.section-add-input', property: 'min-height', value: '36px' },
    { selector: '.item-quantity', property: 'gap', value: '2px' },
    { selector: '.item-quantity button', property: 'min-width', value: '32px' },
    { selector: '.item-quantity-value', property: 'font-size', value: '0.8125rem' },
    { selector: 'button.icon-only', property: 'min-width', value: '32px' },
  ];

  it('should have all compact selectors present inside the mobile media query', () => {
    const mobileQuery = findMobileMediaQuery(cssRoot);
    expect(mobileQuery).toBeDefined();

    for (const { selector, property, value } of compactSelectors) {
      const rules = findRulesInParent(mobileQuery!, selector);
      expect(
        rules.length,
        `Expected selector "${selector}" to exist in mobile media query`
      ).toBeGreaterThan(0);

      const hasExpectedValue = rules.some((rule) => {
        const actual = getPropertyValue(rule, property);
        return actual === value;
      });
      expect(
        hasExpectedValue,
        `Expected "${selector}" to have ${property}: ${value} in mobile media query`
      ).toBe(true);
    }
  });

  it('should not have compact override values in base styles', () => {
    const baseRules = getBaseRules(cssRoot);

    // Check that base .item does not have the compact gap: 6px
    const baseItemRules = baseRules.filter((r) => r.selector === '.item');
    for (const rule of baseItemRules) {
      const gap = getPropertyValue(rule, 'gap');
      if (gap) {
        expect(gap).not.toBe('6px');
      }
    }

    // Check that base .item-checkbox does not have compact 36px dimensions
    const baseCheckboxRules = baseRules.filter((r) => r.selector === '.item-checkbox');
    for (const rule of baseCheckboxRules) {
      const minWidth = getPropertyValue(rule, 'min-width');
      if (minWidth) {
        expect(minWidth).not.toBe('36px');
      }
    }
  });
});


/**
 * Task 8.3: :root block unchanged
 * **Validates: Requirements 8.2**
 *
 * Verify the `:root` block contains only the original CSS custom properties
 * and no new ones were added by this feature.
 */
describe('Task 8.3: :root block unchanged', () => {
  const originalRootProperties = [
    '--bg-primary',
    '--bg-secondary',
    '--bg-tertiary',
    '--bg-hover',
    '--text-primary',
    '--text-secondary',
    '--text-disabled',
    '--accent',
    '--accent-hover',
    '--accent-active',
    '--warning',
    '--error',
    '--border',
    '--border-light',
    '--button-bg',
    '--button-hover',
    '--button-active',
    '--checked-bg',
    '--checked-text',
  ];

  it('should have a :root rule', () => {
    let rootRule: Rule | undefined;
    cssRoot.walkRules((rule) => {
      if (rule.selector === ':root') {
        rootRule = rule;
      }
    });
    expect(rootRule).toBeDefined();
  });

  it('should contain all original custom properties in :root', () => {
    let rootRule: Rule | undefined;
    cssRoot.walkRules((rule) => {
      if (rule.selector === ':root') {
        rootRule = rule;
      }
    });
    expect(rootRule).toBeDefined();

    const declaredProps: string[] = [];
    rootRule!.walkDecls((decl) => {
      declaredProps.push(decl.prop);
    });

    for (const prop of originalRootProperties) {
      expect(
        declaredProps,
        `Expected :root to contain ${prop}`
      ).toContain(prop);
    }
  });

  it('should not contain any new custom properties beyond the originals', () => {
    let rootRule: Rule | undefined;
    cssRoot.walkRules((rule) => {
      if (rule.selector === ':root') {
        rootRule = rule;
      }
    });
    expect(rootRule).toBeDefined();

    const declaredProps: string[] = [];
    rootRule!.walkDecls((decl) => {
      declaredProps.push(decl.prop);
    });

    // Every property in :root should be one of the originals
    for (const prop of declaredProps) {
      expect(
        originalRootProperties,
        `Unexpected property "${prop}" found in :root`
      ).toContain(prop);
    }

    // Count should match exactly
    expect(declaredProps.length).toBe(originalRootProperties.length);
  });
});
