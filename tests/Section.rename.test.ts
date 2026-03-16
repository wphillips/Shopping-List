/**
 * Unit tests for Section component rename UI
 * Feature: section-management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Section, SectionConfig } from '../src/components/Section';

describe('Section Rename UI', () => {
  let mockConfig: SectionConfig;

  beforeEach(() => {
    mockConfig = {
      id: 'test-section-1',
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

  it('should have aria-label="Rename section" and maxlength="50" on rename input', () => {
    const section = new Section(mockConfig);
    const el = section.getElement();

    section.enterRenameMode();
    const input = el.querySelector('.section-title input') as HTMLInputElement;

    expect(input).toBeTruthy();
    expect(input.getAttribute('aria-label')).toBe('Rename section');
    expect(input.maxLength).toBe(50);
  });

  it('should focus the rename input with all text selected on enter', () => {
    const section = new Section(mockConfig);
    const el = section.getElement();

    // Append to document so focus works in jsdom
    document.body.appendChild(el);

    section.enterRenameMode();
    const input = el.querySelector('.section-title input') as HTMLInputElement;

    expect(input).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(mockConfig.name.length);

    document.body.removeChild(el);
  });

  it('should be a no-op when double-clicking while already in rename mode', () => {
    const section = new Section(mockConfig);
    const el = section.getElement();

    // Enter rename mode the first time
    section.enterRenameMode();
    const input1 = el.querySelector('.section-title input') as HTMLInputElement;
    expect(input1).toBeTruthy();

    // Change the input value to detect if it gets reset
    input1.value = 'Modified';

    // Try to enter rename mode again (should be no-op)
    section.enterRenameMode();
    const input2 = el.querySelector('.section-title input') as HTMLInputElement;

    // Should be the same input with the modified value (not reset)
    expect(input2).toBeTruthy();
    expect(input2.value).toBe('Modified');
  });

  it('should not double-commit when blur fires after Escape', () => {
    const section = new Section(mockConfig);
    const el = section.getElement();

    document.body.appendChild(el);

    section.enterRenameMode();
    const input = el.querySelector('.section-title input') as HTMLInputElement;
    expect(input).toBeTruthy();

    input.value = 'New Name';

    // Press Escape first (cancels rename, sets isRenaming = false)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    // Then blur fires (browser behavior) — should be a no-op
    input.dispatchEvent(new Event('blur'));

    // onRename should NOT have been called at all
    expect(mockConfig.onRename).not.toHaveBeenCalled();

    // Original name should be restored
    const titleSpan = el.querySelector('.section-title span:not(.section-chevron)') as HTMLElement;
    expect(titleSpan).toBeTruthy();
    expect(titleSpan.textContent).toBe('Produce');

    document.body.removeChild(el);
  });
});
