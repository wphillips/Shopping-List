/**
 * Property-based tests for Section component rename UI
 * Feature: section-management
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Section, SectionConfig } from '../src/components/Section';

function createMockConfig(overrides: Partial<SectionConfig> = {}): SectionConfig {
  return {
    id: 'test-section-1',
    name: 'Default',
    isCollapsed: false,
    onToggle: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onItemDrop: vi.fn(),
    onAddItem: vi.fn(),
    ...overrides,
  };
}

/** Generator: valid section names (1–50 chars, non-empty) */
const sectionNameArb = fc.string({ minLength: 1, maxLength: 50 });

/** Generator: whitespace-only strings (including empty) */
const whitespaceOnlyArb = fc.string({
  unit: fc.constantFrom(' ', '\t', '\n', '\r'),
  minLength: 0,
  maxLength: 50,
});

/** Generator: padded strings (whitespace + non-empty core + whitespace) */
const paddedStringArb = fc
  .tuple(
    fc.string({ unit: fc.constantFrom(' ', '\t'), minLength: 0, maxLength: 5 }),
    fc.string({ minLength: 1, maxLength: 40 }),
    fc.string({ unit: fc.constantFrom(' ', '\t'), minLength: 0, maxLength: 5 })
  )
  .map(([pre, mid, post]) => pre + mid + post);

/**
 * Feature: section-management, Property 4: Double-click enters rename mode with current name
 * **Validates: Requirements 3.1**
 */
describe('Property 4: Double-click enters rename mode with current name', () => {
  it('should display an input with the current section name when title is double-clicked', () => {
    fc.assert(
      fc.property(sectionNameArb, (name) => {
        const config = createMockConfig({ name });
        const section = new Section(config);
        const el = section.getElement();

        // Find the title span (not the chevron)
        const titleSpan = el.querySelector(
          '.section-title span:not(.section-chevron)'
        ) as HTMLElement;
        expect(titleSpan).toBeTruthy();

        // Double-click the title span
        titleSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

        // An input should now be present in the title container
        const input = el.querySelector('.section-title input') as HTMLInputElement;
        expect(input).toBeTruthy();
        expect(input.value).toBe(name);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: section-management, Property 5: Commit rename invokes callback with trimmed name
 * **Validates: Requirements 3.3, 3.5, 4.1, 4.2**
 */
describe('Property 5: Commit rename invokes callback with trimmed name', () => {
  it('should invoke onRename with trimmed name when Enter is pressed', () => {
    fc.assert(
      fc.property(sectionNameArb, paddedStringArb, (originalName, typedValue) => {
        fc.pre(typedValue.trim().length > 0);

        const onRename = vi.fn();
        const config = createMockConfig({ name: originalName, onRename });
        const section = new Section(config);
        const el = section.getElement();

        // Enter rename mode
        section.enterRenameMode();
        const input = el.querySelector('.section-title input') as HTMLInputElement;
        expect(input).toBeTruthy();

        // Type a new value and press Enter
        input.value = typedValue;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(onRename).toHaveBeenCalledWith('test-section-1', typedValue.trim());
      }),
      { numRuns: 100 }
    );
  });

  it('should invoke onRename with trimmed name when input loses focus', () => {
    fc.assert(
      fc.property(sectionNameArb, paddedStringArb, (originalName, typedValue) => {
        fc.pre(typedValue.trim().length > 0);

        const onRename = vi.fn();
        const config = createMockConfig({ name: originalName, onRename });
        const section = new Section(config);
        const el = section.getElement();

        // Enter rename mode
        section.enterRenameMode();
        const input = el.querySelector('.section-title input') as HTMLInputElement;
        expect(input).toBeTruthy();

        // Type a new value and blur
        input.value = typedValue;
        input.dispatchEvent(new Event('blur'));

        expect(onRename).toHaveBeenCalledWith('test-section-1', typedValue.trim());
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: section-management, Property 6: Escape cancels rename and restores original name
 * **Validates: Requirements 3.4**
 */
describe('Property 6: Escape cancels rename and restores original name', () => {
  it('should restore original name and not invoke onRename when Escape is pressed', () => {
    fc.assert(
      fc.property(sectionNameArb, fc.string({ minLength: 0, maxLength: 50 }), (originalName, typedValue) => {
        const onRename = vi.fn();
        const config = createMockConfig({ name: originalName, onRename });
        const section = new Section(config);
        const el = section.getElement();

        // Enter rename mode
        section.enterRenameMode();
        const input = el.querySelector('.section-title input') as HTMLInputElement;
        expect(input).toBeTruthy();

        // Type something and press Escape
        input.value = typedValue;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        // Should have exited rename mode — input replaced by span
        const titleSpan = el.querySelector('.section-title span:not(.section-chevron)') as HTMLElement;
        expect(titleSpan).toBeTruthy();
        expect(titleSpan.textContent).toBe(originalName);

        // onRename should NOT have been called
        expect(onRename).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: section-management, Property 7: Whitespace-only name reverts to original
 * **Validates: Requirements 3.6**
 */
describe('Property 7: Whitespace-only name reverts to original', () => {
  it('should revert to original name and not invoke onRename for whitespace-only input', () => {
    fc.assert(
      fc.property(sectionNameArb, whitespaceOnlyArb, (originalName, wsValue) => {
        const onRename = vi.fn();
        const config = createMockConfig({ name: originalName, onRename });
        const section = new Section(config);
        const el = section.getElement();

        // Enter rename mode
        section.enterRenameMode();
        const input = el.querySelector('.section-title input') as HTMLInputElement;
        expect(input).toBeTruthy();

        // Set whitespace-only value and commit via Enter
        input.value = wsValue;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        // Should have exited rename mode with original name restored
        const titleSpan = el.querySelector('.section-title span:not(.section-chevron)') as HTMLElement;
        expect(titleSpan).toBeTruthy();
        expect(titleSpan.textContent).toBe(originalName);

        // onRename should NOT have been called
        expect(onRename).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: section-management, Property 8: Rename input does not trigger collapse
 * **Validates: Requirements 3.8**
 */
describe('Property 8: Rename input does not trigger collapse', () => {
  it('should not trigger onToggle when clicking the rename input', () => {
    fc.assert(
      fc.property(sectionNameArb, (name) => {
        const onToggle = vi.fn();
        const config = createMockConfig({ name, onToggle });
        const section = new Section(config);
        const el = section.getElement();

        // Enter rename mode
        section.enterRenameMode();
        const input = el.querySelector('.section-title input') as HTMLInputElement;
        expect(input).toBeTruthy();

        // Click the input
        input.click();

        // onToggle should NOT have been called
        expect(onToggle).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});
