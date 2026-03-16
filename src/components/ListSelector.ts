/**
 * ListSelector component — dropdown-based list switcher
 * Shows active list name as a tappable dropdown trigger.
 * Dropdown contains all lists with rename/delete, plus "New list" button.
 */

export interface ListSelectorConfig {
  lists: { id: string; name: string }[];
  activeListId: string;
  onSelect: (listId: string) => void;
  onNew: () => void;
  onRename: (listId: string, name: string) => void;
  onDelete: (listId: string) => void;
}

export class ListSelector {
  private element: HTMLElement;
  private config: ListSelectorConfig;
  private isOpen = false;

  constructor(config: ListSelectorConfig) {
    this.config = config;
    this.element = document.createElement('div');
    this.element.className = 'list-selector';
    this.element.setAttribute('role', 'combobox');
    this.element.setAttribute('aria-label', 'Grocery lists');
    this.render();
    this.setupOutsideClick();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  update(config: ListSelectorConfig): void {
    this.config = config;
    this.render();
  }

  private setupOutsideClick(): void {
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.element.contains(e.target as Node)) {
        this.close();
      }
    });
  }

  private close(): void {
    this.isOpen = false;
    this.render();
  }

  private toggle(): void {
    this.isOpen = !this.isOpen;
    this.render();
  }

  private getActiveList(): { id: string; name: string } | undefined {
    return this.config.lists.find(l => l.id === this.config.activeListId);
  }

  private render(): void {
    this.element.innerHTML = '';

    const active = this.getActiveList();
    const triggerName = active ? active.name : 'Select list';

    // Trigger button
    const trigger = document.createElement('button');
    trigger.className = 'list-selector__trigger';
    trigger.setAttribute('aria-expanded', String(this.isOpen));
    trigger.innerHTML = `<span class="list-selector__name">${this.escapeHtml(triggerName)}</span><span class="list-selector__arrow">${this.isOpen ? '▲' : '▼'}</span>`;
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    this.element.appendChild(trigger);

    if (!this.isOpen) return;

    // Dropdown panel
    const dropdown = document.createElement('div');
    dropdown.className = 'list-selector__dropdown';
    dropdown.setAttribute('role', 'listbox');

    const singleList = this.config.lists.length <= 1;

    for (const list of this.config.lists) {
      const row = this.createRow(list, list.id === this.config.activeListId, singleList);
      dropdown.appendChild(row);
    }

    // New list button
    const addBtn = document.createElement('button');
    addBtn.className = 'list-selector__add';
    addBtn.textContent = '+ New list';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.config.onNew();
      this.close();
    });
    dropdown.appendChild(addBtn);

    this.element.appendChild(dropdown);
  }

  private createRow(
    list: { id: string; name: string },
    isActive: boolean,
    singleList: boolean
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = `list-selector__item${isActive ? ' list-selector__item--active' : ''}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(isActive));
    row.setAttribute('data-list-id', list.id);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'list-selector__item-name';
    nameSpan.textContent = list.name;
    row.appendChild(nameSpan);

    const controls = document.createElement('span');
    controls.className = 'list-selector__item-controls';

    // Rename button
    const renameBtn = document.createElement('button');
    renameBtn.className = 'list-selector__rename-btn';
    renameBtn.textContent = '✎';
    renameBtn.setAttribute('aria-label', `Rename ${list.name}`);
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.enterRenameMode(row, list);
    });
    controls.appendChild(renameBtn);

    if (!singleList) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'list-selector__delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.setAttribute('aria-label', `Delete ${list.name}`);
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.config.onDelete(list.id);
      });
      controls.appendChild(deleteBtn);
    }

    row.appendChild(controls);

    // Click to select
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
      this.config.onSelect(list.id);
      this.close();
    });

    return row;
  }

  private enterRenameMode(row: HTMLElement, list: { id: string; name: string }): void {
    const nameSpan = row.querySelector('.list-selector__item-name') as HTMLElement;
    if (!nameSpan || row.querySelector('input')) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'list-selector__rename-input';
    input.value = list.name;
    input.maxLength = 50;
    input.setAttribute('aria-label', `Rename ${list.name}`);

    const commit = () => {
      const trimmed = input.value.trim();
      const newName = trimmed.length > 0 ? trimmed : list.name;
      if (newName !== list.name) {
        this.config.onRename(list.id, newName);
      }
      input.replaceWith(nameSpan);
      nameSpan.textContent = newName;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); input.replaceWith(nameSpan); }
    });
    input.addEventListener('blur', () => { if (input.parentElement) commit(); });
    input.addEventListener('click', (e) => e.stopPropagation());

    nameSpan.replaceWith(input);
    input.focus();
    input.select();
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
