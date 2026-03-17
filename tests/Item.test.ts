/**
 * Unit tests for Item component
 * Covers rendering, checkbox toggle, quantity controls, delete, drag-and-drop, and state updates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Item, ItemConfig } from '../src/components/Item';

function createConfig(overrides: Partial<ItemConfig> = {}): ItemConfig {
  return {
    id: 'item-1',
    name: 'Milk',
    quantity: 1,
    isChecked: false,
    sectionId: 'section-1',
    onToggleCheck: vi.fn(),
    onIncrement: vi.fn(),
    onDecrement: vi.fn(),
    onDelete: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    ...overrides,
  };
}

describe('Item Component', () => {
  let config: ItemConfig;
  let item: Item;

  beforeEach(() => {
    config = createConfig();
    item = new Item(config);
  });

  describe('Rendering', () => {
    it('creates an element with the item class', () => {
      const el = item.getElement();
      expect(el.classList.contains('item')).toBe(true);
    });

    it('sets data-item-id attribute', () => {
      expect(item.getElement().getAttribute('data-item-id')).toBe('item-1');
    });

    it('sets draggable attribute to true', () => {
      expect(item.getElement().getAttribute('draggable')).toBe('true');
    });

    it('renders a checkbox with correct aria-label', () => {
      const checkbox = item.getElement().querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.checked).toBe(false);
      expect(checkbox.getAttribute('aria-label')).toBe('Check off Milk');
    });

    it('renders the item name', () => {
      const name = item.getElement().querySelector('.item-name');
      expect(name?.textContent).toBe('Milk');
    });

    it('renders quantity value', () => {
      const qty = item.getElement().querySelector('.item-quantity-value');
      expect(qty?.textContent).toBe('1');
    });

    it('renders increment, decrement, and delete buttons', () => {
      const el = item.getElement();
      expect(el.querySelector('[data-action="increment"]')).toBeTruthy();
      expect(el.querySelector('[data-action="decrement"]')).toBeTruthy();
      expect(el.querySelector('[data-action="delete"]')).toBeTruthy();
    });

    it('buttons have correct aria-labels', () => {
      const el = item.getElement();
      expect(el.querySelector('[data-action="increment"]')?.getAttribute('aria-label')).toBe('Increase quantity');
      expect(el.querySelector('[data-action="decrement"]')?.getAttribute('aria-label')).toBe('Decrease quantity');
      expect(el.querySelector('[data-action="delete"]')?.getAttribute('aria-label')).toBe('Delete item');
    });
  });

  describe('Checked state rendering', () => {
    it('does not have checked class when unchecked', () => {
      expect(item.getElement().classList.contains('checked')).toBe(false);
    });

    it('has checked class when created as checked', () => {
      const checked = new Item(createConfig({ isChecked: true }));
      expect(checked.getElement().classList.contains('checked')).toBe(true);
      const checkbox = checked.getElement().querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Display name with quantity', () => {
    it('shows plain name when quantity is 1', () => {
      const name = item.getElement().querySelector('.item-name');
      expect(name?.textContent).toBe('Milk');
    });

    it('shows quantity prefix when quantity >= 2', () => {
      const multi = new Item(createConfig({ quantity: 3 }));
      const name = multi.getElement().querySelector('.item-name');
      expect(name?.textContent).toBe('3x Milk');
    });
  });

  describe('Checkbox interaction', () => {
    it('calls onToggleCheck when checkbox changes', () => {
      const checkbox = item.getElement().querySelector('input[type="checkbox"]') as HTMLInputElement;
      checkbox.dispatchEvent(new Event('change'));
      expect(config.onToggleCheck).toHaveBeenCalledOnce();
    });
  });

  describe('Button interactions', () => {
    it('calls onIncrement when increment button is clicked', () => {
      const btn = item.getElement().querySelector('[data-action="increment"]') as HTMLButtonElement;
      btn.click();
      expect(config.onIncrement).toHaveBeenCalledOnce();
    });

    it('calls onDecrement when decrement button is clicked', () => {
      const btn = item.getElement().querySelector('[data-action="decrement"]') as HTMLButtonElement;
      btn.click();
      expect(config.onDecrement).toHaveBeenCalledOnce();
    });

    it('calls onDelete when delete button is clicked', () => {
      const btn = item.getElement().querySelector('[data-action="delete"]') as HTMLButtonElement;
      btn.click();
      expect(config.onDelete).toHaveBeenCalledOnce();
    });

    it('does not call any handler when clicking non-button area', () => {
      const name = item.getElement().querySelector('.item-name') as HTMLElement;
      name.click();
      expect(config.onIncrement).not.toHaveBeenCalled();
      expect(config.onDecrement).not.toHaveBeenCalled();
      expect(config.onDelete).not.toHaveBeenCalled();
    });
  });

  describe('Drag and drop', () => {
    it('adds dragging class on dragstart and calls onDragStart', () => {
      const el = item.getElement();
      const event = new Event('dragstart', { bubbles: true }) as any;
      event.dataTransfer = { setData: vi.fn(), effectAllowed: '' };
      el.dispatchEvent(event);

      expect(el.classList.contains('dragging')).toBe(true);
      expect(config.onDragStart).toHaveBeenCalledWith('item-1', 'section-1');
    });

    it('removes dragging class on dragend and calls onDragEnd', () => {
      const el = item.getElement();
      el.classList.add('dragging');
      el.dispatchEvent(new Event('dragend', { bubbles: true }));

      expect(el.classList.contains('dragging')).toBe(false);
      expect(config.onDragEnd).toHaveBeenCalledOnce();
    });
  });

  describe('State updates', () => {
    it('updateCheckedState adds checked class and updates checkbox', () => {
      item.updateCheckedState(true);
      expect(item.getElement().classList.contains('checked')).toBe(true);
      const checkbox = item.getElement().querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('updateCheckedState removes checked class when unchecked', () => {
      item.updateCheckedState(true);
      item.updateCheckedState(false);
      expect(item.getElement().classList.contains('checked')).toBe(false);
    });

    it('updateQuantity updates the quantity display and name prefix', () => {
      item.updateQuantity(5);
      expect(item.getElement().querySelector('.item-quantity-value')?.textContent).toBe('5');
      expect(item.getElement().querySelector('.item-name')?.textContent).toBe('5x Milk');
    });

    it('updateQuantity to 1 removes the quantity prefix from name', () => {
      item.updateQuantity(3);
      item.updateQuantity(1);
      expect(item.getElement().querySelector('.item-name')?.textContent).toBe('Milk');
    });

    it('updateName updates the displayed name', () => {
      item.updateName('Eggs');
      expect(item.getElement().querySelector('.item-name')?.textContent).toBe('Eggs');
    });

    it('updateName respects current quantity prefix', () => {
      item.updateQuantity(2);
      item.updateName('Bread');
      expect(item.getElement().querySelector('.item-name')?.textContent).toBe('2x Bread');
    });
  });

  describe('Getters', () => {
    it('getId returns the item id', () => {
      expect(item.getId()).toBe('item-1');
    });

    it('getSectionId returns the section id', () => {
      expect(item.getSectionId()).toBe('section-1');
    });
  });
});
