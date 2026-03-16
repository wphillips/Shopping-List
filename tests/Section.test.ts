/**
 * Unit tests for Section component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Section, SectionConfig } from '../src/components/Section';

describe('Section Component', () => {
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

  describe('Rendering', () => {
    it('should render section with correct name', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      const titleSpan = element.querySelector('.section-title span:not(.section-chevron)');
      expect(titleSpan?.textContent).toBe('Produce');
    });

    it('should render with expanded state by default', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      expect(element.classList.contains('collapsed')).toBe(false);
      expect(element.querySelector('.section-chevron')?.textContent).toBe('▼');
    });

    it('should render with collapsed state when specified', () => {
      mockConfig.isCollapsed = true;
      const section = new Section(mockConfig);
      const element = section.getElement();

      expect(element.classList.contains('collapsed')).toBe(true);
      expect(element.querySelector('.section-chevron')?.textContent).toBe('▶');
    });

    it('should render all control buttons', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      const moveUpBtn = element.querySelector('[data-action="move-up"]');
      const moveDownBtn = element.querySelector('[data-action="move-down"]');
      const deleteBtn = element.querySelector('[data-action="delete"]');

      expect(moveUpBtn).toBeTruthy();
      expect(moveDownBtn).toBeTruthy();
      expect(deleteBtn).toBeTruthy();
    });

    it('should have section-content element', () => {
      const section = new Section(mockConfig);
      const contentElement = section.getContentElement();

      expect(contentElement).toBeTruthy();
      expect(contentElement.classList.contains('section-content')).toBe(true);
    });
  });

  describe('Toggle Functionality', () => {
    it('should call onToggle when header is clicked', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();
      const header = element.querySelector('.section-header') as HTMLElement;

      header.click();

      expect(mockConfig.onToggle).toHaveBeenCalledTimes(1);
    });

    it('should not call onToggle when control button is clicked', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();
      const moveUpBtn = element.querySelector('[data-action="move-up"]') as HTMLElement;

      moveUpBtn.click();

      expect(mockConfig.onToggle).not.toHaveBeenCalled();
    });

    it('should update collapsed state correctly', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      section.updateCollapsedState(true);

      expect(element.classList.contains('collapsed')).toBe(true);
      expect(element.querySelector('.section-chevron')?.textContent).toBe('▶');

      section.updateCollapsedState(false);

      expect(element.classList.contains('collapsed')).toBe(false);
      expect(element.querySelector('.section-chevron')?.textContent).toBe('▼');
    });
  });

  describe('Control Buttons', () => {
    it('should call onMoveUp when move up button is clicked', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();
      const moveUpBtn = element.querySelector('[data-action="move-up"]') as HTMLElement;

      moveUpBtn.click();

      expect(mockConfig.onMoveUp).toHaveBeenCalledTimes(1);
    });

    it('should call onMoveDown when move down button is clicked', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();
      const moveDownBtn = element.querySelector('[data-action="move-down"]') as HTMLElement;

      moveDownBtn.click();

      expect(mockConfig.onMoveDown).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete when delete button is clicked', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();
      const deleteBtn = element.querySelector('[data-action="delete"]') as HTMLElement;

      deleteBtn.click();

      expect(mockConfig.onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Drag and Drop', () => {
    it('should add drag-over class on dragover', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      const dragOverEvent = new Event('dragover', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(dragOverEvent, 'preventDefault', {
        value: vi.fn(),
      });

      element.dispatchEvent(dragOverEvent);

      expect(element.classList.contains('drag-over')).toBe(true);
    });

    it('should remove drag-over class on dragleave', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      element.classList.add('drag-over');

      const dragLeaveEvent = new Event('dragleave', {
        bubbles: true,
      });

      element.dispatchEvent(dragLeaveEvent);

      expect(element.classList.contains('drag-over')).toBe(false);
    });

    it('should call onItemDrop with correct data on drop', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      const dragData = {
        itemId: 'item-123',
        sourceSectionId: 'section-456',
      };

      const mockDataTransfer = {
        getData: vi.fn().mockReturnValue(JSON.stringify(dragData)),
      };

      const dropEvent = new Event('drop', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: mockDataTransfer,
      });
      Object.defineProperty(dropEvent, 'preventDefault', {
        value: vi.fn(),
      });

      element.dispatchEvent(dropEvent);

      expect(mockConfig.onItemDrop).toHaveBeenCalledWith('item-123', 'section-456');
      expect(element.classList.contains('drag-over')).toBe(false);
    });
  });

  describe('Update Methods', () => {
    it('should update section name', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      section.updateName('Dairy');

      const titleSpan = element.querySelector('.section-title span:not(.section-chevron)');
      expect(titleSpan?.textContent).toBe('Dairy');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on control buttons', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      const moveUpBtn = element.querySelector('[data-action="move-up"]');
      const moveDownBtn = element.querySelector('[data-action="move-down"]');
      const deleteBtn = element.querySelector('[data-action="delete"]');

      expect(moveUpBtn?.getAttribute('aria-label')).toBe('Move section up');
      expect(moveDownBtn?.getAttribute('aria-label')).toBe('Move section down');
      expect(deleteBtn?.getAttribute('aria-label')).toBe('Delete section');
    });

    it('should have aria-hidden on chevron icon', () => {
      const section = new Section(mockConfig);
      const element = section.getElement();

      const chevron = element.querySelector('.section-chevron');

      expect(chevron?.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
