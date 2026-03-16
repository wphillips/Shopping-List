/**
 * Section component for organizing grocery items
 * Provides collapsible sections with reordering and drag-and-drop support
 */

export interface SectionConfig {
  id: string;
  name: string;
  isCollapsed: boolean;
  initialRenameMode?: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onRename: (id: string, newName: string) => void;
  onItemDrop: (itemId: string, sourceSectionId: string) => void;
  onAddItem: (name: string) => void;
}

export class Section {
  private element: HTMLElement;
  private config: SectionConfig;
  private contentElement: HTMLElement;
  private addInputElement!: HTMLInputElement;
  private isRenaming: boolean = false;
  private originalName: string = '';

  constructor(config: SectionConfig) {
    this.config = config;
    this.element = this.createElement();
    this.contentElement = this.element.querySelector('.section-content') as HTMLElement;
    this.attachEventListeners();

    if (config.initialRenameMode) {
      this.enterRenameMode();
    }
  }

  /**
   * Create the section element with header and content area
   */
  private createElement(): HTMLElement {
    const section = document.createElement('div');
    section.className = `section${this.config.isCollapsed ? ' collapsed' : ''}`;
    section.setAttribute('data-section-id', this.config.id);

    // Create section header
    const header = document.createElement('div');
    header.className = 'section-header';

    // Section title with collapse/expand chevron
    const titleContainer = document.createElement('div');
    titleContainer.className = 'section-title';
    titleContainer.style.display = 'flex';
    titleContainer.style.alignItems = 'center';
    titleContainer.style.gap = '0.5rem';

    const chevron = document.createElement('span');
    chevron.className = 'section-chevron';
    chevron.textContent = this.config.isCollapsed ? '▶' : '▼';
    chevron.setAttribute('aria-hidden', 'true');

    const title = document.createElement('span');
    title.textContent = this.config.name;

    titleContainer.appendChild(chevron);
    titleContainer.appendChild(title);

    // Section controls
    const controls = document.createElement('div');
    controls.className = 'section-controls';

    const renameBtn = document.createElement('button');
    renameBtn.className = 'icon-only';
    renameBtn.textContent = '✏️';
    renameBtn.setAttribute('aria-label', 'Rename section');
    renameBtn.setAttribute('data-action', 'rename');

    const moveUpBtn = document.createElement('button');
    moveUpBtn.className = 'icon-only';
    moveUpBtn.textContent = '↑';
    moveUpBtn.setAttribute('aria-label', 'Move section up');
    moveUpBtn.setAttribute('data-action', 'move-up');

    const moveDownBtn = document.createElement('button');
    moveDownBtn.className = 'icon-only';
    moveDownBtn.textContent = '↓';
    moveDownBtn.setAttribute('aria-label', 'Move section down');
    moveDownBtn.setAttribute('data-action', 'move-down');

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-only danger';
    deleteBtn.textContent = '×';
    deleteBtn.setAttribute('aria-label', 'Delete section');
    deleteBtn.setAttribute('data-action', 'delete');

    controls.appendChild(renameBtn);
    controls.appendChild(moveUpBtn);
    controls.appendChild(moveDownBtn);
    controls.appendChild(deleteBtn);

    header.appendChild(titleContainer);
    header.appendChild(controls);

    // Create content area for items
    const content = document.createElement('div');
    content.className = 'section-content';

    // Create inline add input
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'section-add-input';
    addInput.placeholder = `Add to ${this.config.name}...`;
    addInput.setAttribute('aria-label', `Add item to ${this.config.name}`);

    addInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const value = addInput.value.trim();
        if (value !== '') {
          this.config.onAddItem(value);
          addInput.value = '';
        }
      }
      if (event.key === 'Escape') {
        addInput.value = '';
        addInput.blur();
      }
    });

    this.addInputElement = addInput;
    content.appendChild(addInput);

    section.appendChild(header);
    section.appendChild(content);

    return section;
  }

  /**
   * Attach event listeners for user interactions
   */
  private attachEventListeners(): void {
    const header = this.element.querySelector('.section-header') as HTMLElement;
    const controls = this.element.querySelector('.section-controls') as HTMLElement;

    // Toggle collapse/expand when clicking header (but not controls or rename input)
    header.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      // Don't toggle if clicking on a button or input
      if (!target.closest('button') && !target.closest('input')) {
        this.config.onToggle();
      }
    });

    // Double-click on title span to enter rename mode
    const titleContainer = this.element.querySelector('.section-title') as HTMLElement;
    titleContainer.addEventListener('dblclick', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'SPAN' && !target.classList.contains('section-chevron')) {
        this.enterRenameMode();
      }
    });

    // Handle control button clicks
    controls.addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent header click from firing
      const target = event.target as HTMLElement;
      const button = target.closest('button');
      
      if (!button) return;

      const action = button.getAttribute('data-action');
      
      switch (action) {
        case 'rename':
          this.enterRenameMode();
          break;
        case 'move-up':
          this.config.onMoveUp();
          break;
        case 'move-down':
          this.config.onMoveDown();
          break;
        case 'delete':
          this.config.onDelete();
          break;
      }
    });

    // Drag and drop support
    this.element.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.element.classList.add('drag-over');
    });

    this.element.addEventListener('dragleave', () => {
      this.element.classList.remove('drag-over');
    });

    this.element.addEventListener('drop', (event) => {
      event.preventDefault();
      this.element.classList.remove('drag-over');

      try {
        const dragData = event.dataTransfer?.getData('application/json');
        if (dragData) {
          const { itemId, sourceSectionId } = JSON.parse(dragData);
          this.config.onItemDrop(itemId, sourceSectionId);
        }
      } catch (error) {
        console.error('Failed to parse drag data:', error);
      }
    });
  }

  /**
   * Enter inline rename mode: swap title span for an input
   */
  enterRenameMode(): void {
    if (this.isRenaming) return;

    this.isRenaming = true;
    this.originalName = this.config.name;

    const titleContainer = this.element.querySelector('.section-title') as HTMLElement;
    const titleSpan = titleContainer.querySelector('span:not(.section-chevron)') as HTMLElement;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 50;
    input.value = this.config.name;
    input.setAttribute('aria-label', 'Rename section');

    // Stop propagation on click to prevent header collapse toggle
    input.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.commitRename();
      } else if (event.key === 'Escape') {
        this.cancelRename();
      }
    });

    input.addEventListener('blur', () => {
      this.commitRename();
    });

    titleContainer.replaceChild(input, titleSpan);
    input.focus();
    input.select();
  }

  /**
   * Commit the rename: trim input, revert if empty, otherwise call onRename
   */
  private commitRename(): void {
    if (!this.isRenaming) return;

    const titleContainer = this.element.querySelector('.section-title') as HTMLElement;
    const input = titleContainer.querySelector('input') as HTMLInputElement;
    if (!input) return;

    const trimmedName = input.value.trim();

    this.isRenaming = false;

    const titleSpan = document.createElement('span');

    if (trimmedName.length === 0) {
      // Revert to original name
      titleSpan.textContent = this.originalName;
      this.config.name = this.originalName;
    } else {
      titleSpan.textContent = trimmedName;
      this.config.name = trimmedName;
      this.config.onRename(this.config.id, trimmedName);
    }

    titleContainer.replaceChild(titleSpan, input);
  }

  /**
   * Cancel the rename: restore original name without calling onRename
   */
  private cancelRename(): void {
    if (!this.isRenaming) return;

    this.isRenaming = false;

    const titleContainer = this.element.querySelector('.section-title') as HTMLElement;
    const input = titleContainer.querySelector('input') as HTMLInputElement;
    if (!input) return;

    const titleSpan = document.createElement('span');
    titleSpan.textContent = this.originalName;
    this.config.name = this.originalName;

    titleContainer.replaceChild(titleSpan, input);
  }

  /**
   * Update the collapsed state
   */
  updateCollapsedState(isCollapsed: boolean): void {
    this.config.isCollapsed = isCollapsed;
    
    if (isCollapsed) {
      this.element.classList.add('collapsed');
    } else {
      this.element.classList.remove('collapsed');
    }

    // Update chevron
    const chevron = this.element.querySelector('.section-chevron');
    if (chevron) {
      chevron.textContent = isCollapsed ? '▶' : '▼';
    }
  }

  /**
   * Get the content container for adding items
   */
  getContentElement(): HTMLElement {
    return this.contentElement;
  }

  /**
   * Get the DOM element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Update section name
   */
  updateName(name: string): void {
    this.config.name = name;
    const titleContainer = this.element.querySelector('.section-title');
    const titleSpan = titleContainer?.querySelector('span:not(.section-chevron)');
    if (titleSpan) {
      titleSpan.textContent = name;
    }
  }

  /**
   * Get the inline add input element
   */
  getAddInputElement(): HTMLInputElement {
    return this.addInputElement;
  }
}
