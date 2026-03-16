/**
 * Unit tests for Section inline add input feature
 * Validates: Requirements 1.1, 1.2, 1.3, 2.4, 3.1, 3.2, 5.1, 5.2, 5.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Section, SectionConfig } from '../src/components/Section';

describe('Section Inline Add Input', () => {
  let mockConfig: SectionConfig;

  beforeEach(() => {
    mockConfig = {
      id: 'section-1',
      name: 'Produce',
      isCollapsed: false,
      onToggle: vi.fn(),
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
      onDelete: vi.fn(),
      onRename: vi.fn(),
      onItemDrop: vi.fn(),
      onAddItem: vi.fn(),
    };
  });

  it('inline input is present in section content when not collapsed', () => {
    const section = new Section(mockConfig);
    const content = section.getContentElement();
    const input = content.querySelector('input.section-add-input');

    expect(input).not.toBeNull();
  });

  it('inline input has correct placeholder containing section name', () => {
    const section = new Section(mockConfig);
    const input = section.getAddInputElement();

    expect(input.placeholder).toContain('Produce');
    expect(input.placeholder).toBe('Add to Produce...');
  });

  it('inline input has correct aria-label containing section name', () => {
    const section = new Section(mockConfig);
    const input = section.getAddInputElement();

    expect(input.getAttribute('aria-label')).toContain('Produce');
    expect(input.getAttribute('aria-label')).toBe('Add item to Produce');
  });

  it('inline input has section-add-input CSS class', () => {
    const section = new Section(mockConfig);
    const input = section.getAddInputElement();

    expect(input.classList.contains('section-add-input')).toBe(true);
  });

  it('inline input is not reachable (hidden) when section is collapsed', () => {
    mockConfig.isCollapsed = true;
    const section = new Section(mockConfig);
    const element = section.getElement();

    // When collapsed, the section has the 'collapsed' class
    expect(element.classList.contains('collapsed')).toBe(true);

    // The inline input is inside .section-content, which is hidden via CSS
    // (.section.collapsed .section-content { display: none })
    // In jsdom CSS isn't applied, so verify the input is a child of .section-content
    // inside a collapsed section
    const content = element.querySelector('.section-content');
    const input = content?.querySelector('input.section-add-input');
    expect(input).not.toBeNull();
    expect(element.classList.contains('collapsed')).toBe(true);
  });

  it('Escape key clears input and blurs', () => {
    const section = new Section(mockConfig);
    const input = section.getAddInputElement();

    // Append to document so focus/blur works in jsdom
    document.body.appendChild(section.getElement());

    input.focus();
    input.value = 'some text';

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    input.dispatchEvent(escapeEvent);

    expect(input.value).toBe('');
    expect(document.activeElement).not.toBe(input);

    // Cleanup
    document.body.removeChild(section.getElement());
  });

  it('Enter with non-empty text calls onAddItem and clears input', () => {
    const section = new Section(mockConfig);
    const input = section.getAddInputElement();

    input.value = '  Apples  ';

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    });
    input.dispatchEvent(enterEvent);

    expect(mockConfig.onAddItem).toHaveBeenCalledWith('Apples');
    expect(input.value).toBe('');
  });

  it('Enter with whitespace-only text does not call onAddItem', () => {
    const section = new Section(mockConfig);
    const input = section.getAddInputElement();

    input.value = '   ';

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
    });
    input.dispatchEvent(enterEvent);

    expect(mockConfig.onAddItem).not.toHaveBeenCalled();
  });

  it('inline input has no negative tabindex (keyboard reachable)', () => {
    const section = new Section(mockConfig);
    const input = section.getAddInputElement();

    // tabIndex should not be negative (default 0 or not set)
    expect(input.tabIndex).toBeGreaterThanOrEqual(0);
  });
});
