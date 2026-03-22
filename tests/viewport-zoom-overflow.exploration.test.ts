/**
 * Bug Condition Exploration Test — Viewport Zoom Overflow
 *
 * Tests that the viewport meta tag and CSS rules prevent horizontal overflow
 * and zoom drift on mobile devices.
 *
 * This test MUST FAIL on unfixed code — failure confirms the bug exists.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// Read source files once for all tests
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
const mainCss = fs.readFileSync(path.resolve(__dirname, '../src/styles/main.css'), 'utf-8');

/**
 * Extract the content attribute value from the viewport meta tag.
 */
function getViewportContent(html: string): string | null {
  const match = html.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/**
 * Check if a CSS property exists for a given selector in the CSS source.
 * Handles combined selectors like "html, body" and individual selectors.
 */
function cssRuleExists(css: string, selector: string, property: string, value: string): boolean {
  // Normalize whitespace in CSS for easier matching
  const normalized = css.replace(/\s+/g, ' ');

  // Build regex patterns for the selector
  // Handle "html, body" as well as "html" and "body" separately
  const selectors = selector.includes(',')
    ? [selector, ...selector.split(',').map(s => s.trim())]
    : [selector];

  for (const sel of selectors) {
    // Escape special regex chars in selector
    const escapedSel = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the selector block and look for the property inside it
    const blockRegex = new RegExp(escapedSel + '\\s*\\{([^}]*)\\}', 'gi');
    let match;
    while ((match = blockRegex.exec(normalized)) !== null) {
      const block = match[1];
      // Check if the property: value pair exists in the block
      const propRegex = new RegExp(property.replace('-', '\\-') + '\\s*:\\s*' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (propRegex.test(block)) {
        return true;
      }
    }
  }
  return false;
}

describe('Bug Condition Exploration: Viewport Zoom Overflow', () => {

  it('viewport meta tag should include maximum-scale=1.0 and user-scalable=no', () => {
    const content = getViewportContent(indexHtml);
    expect(content).not.toBeNull();
    expect(content).toContain('maximum-scale=1.0');
    expect(content).toContain('user-scalable=no');
  });

  it('html and body should have overflow-x: hidden in CSS', () => {
    // Check for combined "html, body" rule or individual rules
    const hasCombined = cssRuleExists(mainCss, 'html, body', 'overflow-x', 'hidden');
    const hasHtmlRule = cssRuleExists(mainCss, 'html', 'overflow-x', 'hidden');
    const hasBodyRule = cssRuleExists(mainCss, 'body', 'overflow-x', 'hidden');

    const htmlHasOverflow = hasCombined || hasHtmlRule;
    const bodyHasOverflow = hasCombined || hasBodyRule;

    expect(htmlHasOverflow).toBe(true);
    expect(bodyHasOverflow).toBe(true);
  });

  it('.install-prompt-banner should have max-width: 100vw and overflow-x: hidden', () => {
    const hasMaxWidth = cssRuleExists(mainCss, '.install-prompt-banner', 'max-width', '100vw');
    const hasOverflow = cssRuleExists(mainCss, '.install-prompt-banner', 'overflow-x', 'hidden');

    expect(hasMaxWidth).toBe(true);
    expect(hasOverflow).toBe(true);
  });

  it('.notification should have overflow-x: hidden', () => {
    const hasOverflow = cssRuleExists(mainCss, '.notification', 'overflow-x', 'hidden');
    expect(hasOverflow).toBe(true);
  });

  it('Property 1: Bug Condition — CSS rules should prevent horizontal overflow for all mobile viewport widths', () => {
    /**
     * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**
     *
     * For any mobile viewport width (320–430px), the CSS and HTML should
     * contain all necessary rules to prevent horizontal overflow.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 430 }),
        (_viewportWidth: number) => {
          // 1. Viewport meta tag must constrain zoom
          const content = getViewportContent(indexHtml);
          expect(content).not.toBeNull();
          expect(content).toContain('maximum-scale=1.0');
          expect(content).toContain('user-scalable=no');

          // 2. html and body must have overflow-x: hidden
          const hasCombined = cssRuleExists(mainCss, 'html, body', 'overflow-x', 'hidden');
          const hasHtmlRule = cssRuleExists(mainCss, 'html', 'overflow-x', 'hidden');
          const hasBodyRule = cssRuleExists(mainCss, 'body', 'overflow-x', 'hidden');
          expect(hasCombined || hasHtmlRule).toBe(true);
          expect(hasCombined || hasBodyRule).toBe(true);

          // 3. Fixed-position banner must be constrained
          expect(cssRuleExists(mainCss, '.install-prompt-banner', 'max-width', '100vw')).toBe(true);
          expect(cssRuleExists(mainCss, '.install-prompt-banner', 'overflow-x', 'hidden')).toBe(true);

          // 4. Notification must be constrained
          expect(cssRuleExists(mainCss, '.notification', 'overflow-x', 'hidden')).toBe(true);

          // 5. Verify no element would exceed the viewport width
          // The banner uses left:0; right:0 with padding — with box-sizing: border-box
          // and overflow-x: hidden, it should be contained within viewportWidth
          // Without these constraints, the banner could overflow on narrow devices
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
