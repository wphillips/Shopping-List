/**
 * Item component for individual grocery items
 * Displays item with checkbox, quantity controls, and drag-and-drop support
 */

export interface ItemConfig {
  id: string;
  name: string;
  quantity: number;
  isChecked: boolean;
  sectionId: string;
  onToggleCheck: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onDelete: () => void;
  onDragStart: (itemId: string, sectionId: string) => void;
  onDragEnd: () => void;
}

export class Item {
  private element: HTMLElement;
  private config: ItemConfig;

  constructor(config: ItemConfig) {
    this.config = config;
    this.element = this.createElement();
    this.attachEventListeners();
  }

  /**
   * Create the item element with all controls
   */
  private createElement(): HTMLElement {
    const item = document.createElement('div');
    item.className = `item${this.config.isChecked ? ' checked' : ''}`;
    item.setAttribute('data-item-id', this.config.id);
    item.setAttribute('draggable', 'true');

    // Checkbox for check-off functionality
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'item-checkbox';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.config.isChecked;
    checkbox.setAttribute('aria-label', `Check off ${this.config.name}`);

    checkboxContainer.appendChild(checkbox);

    // Item name with quantity prefix
    const nameElement = document.createElement('div');
    nameElement.className = 'item-name';
    nameElement.textContent = this.getDisplayName();

    // Quantity controls
    const quantityContainer = document.createElement('div');
    quantityContainer.className = 'item-quantity';

    const decrementBtn = document.createElement('button');
    decrementBtn.className = 'icon-only';
    decrementBtn.textContent = '−';
    decrementBtn.setAttribute('aria-label', 'Decrease quantity');
    decrementBtn.setAttribute('data-action', 'decrement');

    const quantityValue = document.createElement('span');
    quantityValue.className = 'item-quantity-value';
    quantityValue.textContent = this.config.quantity.toString();

    const incrementBtn = document.createElement('button');
    incrementBtn.className = 'icon-only';
    incrementBtn.textContent = '+';
    incrementBtn.setAttribute('aria-label', 'Increase quantity');
    incrementBtn.setAttribute('data-action', 'increment');

    quantityContainer.appendChild(decrementBtn);
    quantityContainer.appendChild(quantityValue);
    quantityContainer.appendChild(incrementBtn);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-only danger';
    deleteBtn.textContent = '×';
    deleteBtn.setAttribute('aria-label', 'Delete item');
    deleteBtn.setAttribute('data-action', 'delete');

    // Assemble the item
    item.appendChild(checkboxContainer);
    item.appendChild(nameElement);
    item.appendChild(quantityContainer);
    item.appendChild(deleteBtn);

    return item;
  }

  /**
   * Get the display name with quantity prefix if quantity >= 2
   */
  private getDisplayName(): string {
    if (this.config.quantity >= 2) {
      return `${this.config.quantity}x ${this.config.name}`;
    }
    return this.config.name;
  }

  /**
   * Attach event listeners for user interactions
   */
  private attachEventListeners(): void {
    // Checkbox toggle
    const checkbox = this.element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.addEventListener('change', () => {
      this.config.onToggleCheck();
    });

    // Button clicks
    this.element.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      
      if (!button) return;

      const action = button.getAttribute('data-action');
      
      switch (action) {
        case 'increment':
          this.config.onIncrement();
          break;
        case 'decrement':
          this.config.onDecrement();
          break;
        case 'delete':
          this.config.onDelete();
          break;
      }
    });

    // Drag and drop support
    this.element.addEventListener('dragstart', (event) => {
      this.element.classList.add('dragging');
      
      const dragData = {
        itemId: this.config.id,
        sourceSectionId: this.config.sectionId,
      };
      
      event.dataTransfer?.setData('application/json', JSON.stringify(dragData));
      event.dataTransfer!.effectAllowed = 'move';
      
      this.config.onDragStart(this.config.id, this.config.sectionId);
    });

    this.element.addEventListener('dragend', () => {
      this.element.classList.remove('dragging');
      this.config.onDragEnd();
    });
  }

  /**
   * Update the item's checked state
   */
  updateCheckedState(isChecked: boolean): void {
    this.config.isChecked = isChecked;
    
    const checkbox = this.element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = isChecked;
    
    if (isChecked) {
      this.element.classList.add('checked');
    } else {
      this.element.classList.remove('checked');
    }
  }

  /**
   * Update the item's quantity
   */
  updateQuantity(quantity: number): void {
    this.config.quantity = quantity;
    
    // Update quantity display
    const quantityValue = this.element.querySelector('.item-quantity-value');
    if (quantityValue) {
      quantityValue.textContent = quantity.toString();
    }
    
    // Update name with quantity prefix
    const nameElement = this.element.querySelector('.item-name');
    if (nameElement) {
      nameElement.textContent = this.getDisplayName();
    }
  }

  /**
   * Update the item's name
   */
  updateName(name: string): void {
    this.config.name = name;
    
    const nameElement = this.element.querySelector('.item-name');
    if (nameElement) {
      nameElement.textContent = this.getDisplayName();
    }
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Get the item ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * Get the section ID
   */
  getSectionId(): string {
    return this.config.sectionId;
  }
}
