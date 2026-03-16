import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListSelector, ListSelectorConfig } from '../src/components/ListSelector';

function makeConfig(overrides: Partial<ListSelectorConfig> = {}): ListSelectorConfig {
  return {
    lists: [
      { id: 'list-1', name: 'Groceries' },
      { id: 'list-2', name: 'Hardware' },
    ],
    activeListId: 'list-1',
    onSelect: vi.fn(),
    onNew: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

/** Helper: open the dropdown by clicking the trigger */
function openDropdown(el: HTMLElement): void {
  const trigger = el.querySelector('.list-selector__trigger') as HTMLElement;
  trigger.click();
}

describe('ListSelector', () => {
  let config: ListSelectorConfig;
  let selector: ListSelector;
  let el: HTMLElement;

  beforeEach(() => {
    config = makeConfig();
    selector = new ListSelector(config);
    el = selector.getElement();
    document.body.innerHTML = '';
    document.body.appendChild(el);
  });

  describe('rendering', () => {
    it('renders a trigger button showing the active list name', () => {
      const trigger = el.querySelector('.list-selector__trigger');
      expect(trigger).not.toBeNull();
      expect(trigger!.textContent).toContain('Groceries');
    });

    it('has the list-selector class', () => {
      expect(el.classList.contains('list-selector')).toBe(true);
    });

    it('dropdown is closed by default', () => {
      expect(el.querySelector('.list-selector__dropdown')).toBeNull();
    });

    it('opens dropdown on trigger click', () => {
      openDropdown(el);
      expect(el.querySelector('.list-selector__dropdown')).not.toBeNull();
    });

    it('shows all lists in the dropdown', () => {
      openDropdown(el);
      const items = el.querySelectorAll('.list-selector__item');
      expect(items.length).toBe(2);
    });

    it('marks the active list item', () => {
      openDropdown(el);
      const active = el.querySelectorAll('.list-selector__item--active');
      expect(active.length).toBe(1);
      expect(active[0].getAttribute('data-list-id')).toBe('list-1');
    });

    it('displays list names in dropdown', () => {
      openDropdown(el);
      const names = el.querySelectorAll('.list-selector__item-name');
      expect(names[0].textContent).toBe('Groceries');
      expect(names[1].textContent).toBe('Hardware');
    });

    it('shows add button in dropdown', () => {
      openDropdown(el);
      const addBtn = el.querySelector('.list-selector__add');
      expect(addBtn).not.toBeNull();
      expect(addBtn!.textContent).toContain('New list');
    });
  });

  describe('select callback', () => {
    it('calls onSelect when a list item is clicked', () => {
      openDropdown(el);
      const items = el.querySelectorAll('.list-selector__item');
      (items[1] as HTMLElement).click();
      expect(config.onSelect).toHaveBeenCalledWith('list-2');
    });
  });

  describe('new list', () => {
    it('calls onNew when the add button is clicked', () => {
      openDropdown(el);
      const addBtn = el.querySelector('.list-selector__add') as HTMLElement;
      addBtn.click();
      expect(config.onNew).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('shows delete button when multiple lists exist', () => {
      openDropdown(el);
      const deleteBtns = el.querySelectorAll('.list-selector__delete-btn');
      expect(deleteBtns.length).toBe(2);
    });

    it('hides delete button when only one list exists', () => {
      const singleConfig = makeConfig({
        lists: [{ id: 'list-1', name: 'Only List' }],
      });
      const s = new ListSelector(singleConfig);
      const sEl = s.getElement();
      document.body.appendChild(sEl);
      // Open dropdown
      (sEl.querySelector('.list-selector__trigger') as HTMLElement).click();
      expect(sEl.querySelectorAll('.list-selector__delete-btn').length).toBe(0);
    });

    it('calls onDelete when delete button is clicked', () => {
      openDropdown(el);
      const deleteBtn = el.querySelector('.list-selector__delete-btn') as HTMLElement;
      deleteBtn.click();
      expect(config.onDelete).toHaveBeenCalledWith('list-1');
    });

    it('does not trigger onSelect when delete is clicked', () => {
      openDropdown(el);
      const deleteBtn = el.querySelector('.list-selector__delete-btn') as HTMLElement;
      deleteBtn.click();
      expect(config.onSelect).not.toHaveBeenCalled();
    });
  });

  describe('rename mode', () => {
    it('enters rename mode on rename button click', () => {
      openDropdown(el);
      const renameBtn = el.querySelector('.list-selector__rename-btn') as HTMLElement;
      renameBtn.click();
      const input = el.querySelector('.list-selector__rename-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('Groceries');
    });

    it('commits rename on Enter', () => {
      openDropdown(el);
      const renameBtn = el.querySelector('.list-selector__rename-btn') as HTMLElement;
      renameBtn.click();
      const input = el.querySelector('.list-selector__rename-input') as HTMLInputElement;
      input.value = 'New Name';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(config.onRename).toHaveBeenCalledWith('list-1', 'New Name');
    });

    it('cancels rename on Escape without calling onRename', () => {
      openDropdown(el);
      const renameBtn = el.querySelector('.list-selector__rename-btn') as HTMLElement;
      renameBtn.click();
      const input = el.querySelector('.list-selector__rename-input') as HTMLInputElement;
      input.value = 'Changed';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(config.onRename).not.toHaveBeenCalled();
    });

    it('reverts to original name if input is empty on commit', () => {
      openDropdown(el);
      const renameBtn = el.querySelector('.list-selector__rename-btn') as HTMLElement;
      renameBtn.click();
      const input = el.querySelector('.list-selector__rename-input') as HTMLInputElement;
      input.value = '   ';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(config.onRename).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('re-renders trigger with new active list name', () => {
      selector.update(makeConfig({
        lists: [
          { id: 'list-1', name: 'Groceries' },
          { id: 'list-2', name: 'Hardware' },
          { id: 'list-3', name: 'Party' },
        ],
        activeListId: 'list-3',
      }));
      const trigger = el.querySelector('.list-selector__trigger');
      expect(trigger!.textContent).toContain('Party');
    });
  });
});
