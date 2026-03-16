/**
 * Property-based tests for Section inline add input feature
 * Feature: section-item-add
 * Uses fast-check with minimum 100 iterations per property
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
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

/**
 * Feature: section-item-add, Property 1: Inline input visibility matches collapsed state
 * **Validates: Requirements 1.1, 1.2**
 */
describe('Property 1: Inline input visibility matches collapsed state', () => {
  it('input is inside visible content area when not collapsed and hidden when collapsed', () => {
    fc.assert(
      fc.property(fc.boolean(), (isCollapsed) => {
        const config = createMockConfig({ isCollapsed });
        const section = new Section(config);
        const el = section.getElement();

        const content = el.querySelector('.section-content') as HTMLElement;
        const input = content.querySelector('input.section-add-input');

        // Input should always exist inside section-content
        expect(input).not.toBeNull();

        if (isCollapsed) {
          // Section element should have 'collapsed' class
          expect(el.classList.contains('collapsed')).toBe(true);
        } else {
          // Section element should NOT have 'collapsed' class
          expect(el.classList.contains('collapsed')).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: section-item-add, Property 2: Inline input attributes contain section name
 * **Validates: Requirements 1.3, 2.4, 5.3**
 */
describe('Property 2: Inline input attributes contain section name', () => {
  it('placeholder and aria-label contain the section name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (name) => {
          const config = createMockConfig({ name });
          const section = new Section(config);
          const input = section.getAddInputElement();

          expect(input.placeholder).toContain(name);
          expect(input.getAttribute('aria-label')).toContain(name);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: section-item-add, Property 3: Valid submission dispatches callback, clears input, and retains focus
 * **Validates: Requirements 1.4, 1.6, 4.2**
 */
describe('Property 3: Valid submission dispatches callback, clears input, and retains focus', () => {
  afterEach(() => {
    // Clean up any elements appended to document.body
    document.body.innerHTML = '';
  });

  it('Enter with non-whitespace text calls onAddItem with trimmed value, clears input, retains focus', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (text) => {
          const onAddItem = vi.fn();
          const config = createMockConfig({ onAddItem });
          const section = new Section(config);
          const el = section.getElement();

          // Append to document.body so focus works in jsdom
          document.body.appendChild(el);

          const input = section.getAddInputElement();
          input.value = text;
          input.focus();

          input.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
          );

          expect(onAddItem).toHaveBeenCalledWith(text.trim());
          expect(input.value).toBe('');
          expect(document.activeElement).toBe(input);

          // Cleanup
          document.body.removeChild(el);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: section-item-add, Property 4: Whitespace-only input is rejected
 * **Validates: Requirements 1.7**
 */
describe('Property 4: Whitespace-only input is rejected', () => {
  it('Enter with whitespace-only text does not call onAddItem', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom(' ', '\t', '\n'), minLength: 1 }),
        (wsText) => {
          const onAddItem = vi.fn();
          const config = createMockConfig({ onAddItem });
          const section = new Section(config);
          const input = section.getAddInputElement();

          input.value = wsText;

          input.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
          );

          expect(onAddItem).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: section-item-add, Property 5: Escape clears and blurs
 * **Validates: Requirements 5.2**
 */
describe('Property 5: Escape clears and blurs', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Escape clears input value and removes focus', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const config = createMockConfig();
        const section = new Section(config);
        const el = section.getElement();

        // Append to document.body so focus/blur works in jsdom
        document.body.appendChild(el);

        const input = section.getAddInputElement();
        input.value = text;
        input.focus();

        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );

        expect(input.value).toBe('');
        expect(document.activeElement).not.toBe(input);

        // Cleanup
        document.body.removeChild(el);
      }),
      { numRuns: 100 }
    );
  });
});
