/**
 * Unit tests for InputField component
 * Tests Requirements 4.1, 4.2, 4.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputField } from '../src/components/InputField';

describe('InputField Component', () => {
  let inputField: InputField;
  let onInputMock: ReturnType<typeof vi.fn>;
  let onSubmitMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onInputMock = vi.fn();
    onSubmitMock = vi.fn();
    
    inputField = new InputField({
      placeholder: 'Add item or search...',
      onInput: onInputMock as (text: string) => void,
      onSubmit: onSubmitMock as (text: string) => void,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should create an input element with correct attributes', () => {
      const element = inputField.getInputElement();
      
      expect(element.tagName).toBe('INPUT');
      expect(element.type).toBe('text');
      expect(element.placeholder).toBe('Add item or search...');
      expect(element.getAttribute('aria-label')).toBe('Add or search items');
    });

    it('should return a DIV wrapper from getElement()', () => {
      const wrapper = inputField.getElement();
      expect(wrapper.tagName).toBe('DIV');
    });
  });

  describe('Input Filtering (Requirement 4.2)', () => {
    it('should trigger onInput callback when user types', () => {
      const element = inputField.getInputElement();
      
      // Simulate typing
      element.value = 'apples';
      element.dispatchEvent(new Event('input'));
      
      // Advance past the 300ms debounce delay
      vi.advanceTimersByTime(300);
      
      expect(onInputMock).toHaveBeenCalledWith('apples');
    });

    it('should trigger onInput callback with empty string when cleared', () => {
      const element = inputField.getInputElement();
      
      // Type something first
      element.value = 'apples';
      element.dispatchEvent(new Event('input'));
      
      // Clear it
      element.value = '';
      element.dispatchEvent(new Event('input'));
      
      expect(onInputMock).toHaveBeenLastCalledWith('');
    });
  });

  describe('Item Submission (Requirement 4.5)', () => {
    it('should submit valid text when Enter is pressed', () => {
      const element = inputField.getInputElement();
      
      element.value = 'Bananas';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      
      expect(onSubmitMock).toHaveBeenCalledWith('Bananas');
    });

    it('should trim whitespace before submission', () => {
      const element = inputField.getInputElement();
      
      element.value = '  Milk  ';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      
      expect(onSubmitMock).toHaveBeenCalledWith('Milk');
    });

    it('should clear input field after successful submission', () => {
      const element = inputField.getInputElement();
      
      element.value = 'Bread';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      
      expect(element.value).toBe('');
    });

    it('should trigger onInput with empty string after clearing', () => {
      const element = inputField.getInputElement();
      
      element.value = 'Eggs';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      
      // onInput should be called with empty string after clear
      expect(onInputMock).toHaveBeenLastCalledWith('');
    });
  });

  describe('Input Validation (Requirement 4.1)', () => {
    it('should reject empty input submission', () => {
      const element = inputField.getInputElement();
      
      element.value = '';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      
      expect(onSubmitMock).not.toHaveBeenCalled();
    });

    it('should reject whitespace-only input submission', () => {
      const element = inputField.getInputElement();
      
      element.value = '   ';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      
      expect(onSubmitMock).not.toHaveBeenCalled();
    });

    it('should reject tabs and newlines only', () => {
      const element = inputField.getInputElement();
      
      element.value = '\t\n  \t';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      
      expect(onSubmitMock).not.toHaveBeenCalled();
    });
  });

  describe('Public Methods', () => {
    it('should return current value via getValue()', () => {
      const element = inputField.getInputElement();
      
      element.value = 'Test Value';
      
      expect(inputField.getValue()).toBe('Test Value');
    });

    it('should clear input via clear() method', () => {
      const element = inputField.getInputElement();
      
      element.value = 'Something';
      inputField.clear();
      
      expect(element.value).toBe('');
    });

    it('should trigger onInput when clear() is called', () => {
      const element = inputField.getInputElement();
      
      element.value = 'Something';
      onInputMock.mockClear(); // Clear previous calls
      
      inputField.clear();
      
      expect(onInputMock).toHaveBeenCalledWith('');
    });

    it('should focus input via focus() method', () => {
      const wrapper = inputField.getElement();
      const element = inputField.getInputElement();
      document.body.appendChild(wrapper); // Must be in DOM to focus
      
      inputField.focus();
      
      expect(document.activeElement).toBe(element);
      
      document.body.removeChild(wrapper); // Cleanup
    });
  });

  describe('Edge Cases', () => {
    it('should not submit when other keys are pressed', () => {
      const element = inputField.getInputElement();
      
      element.value = 'Test';
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
      element.dispatchEvent(tabEvent);
      
      expect(onSubmitMock).not.toHaveBeenCalled();
    });

    it('should handle rapid input changes', () => {
      const element = inputField.getInputElement();
      
      element.value = 'a';
      element.dispatchEvent(new Event('input'));
      
      element.value = 'ap';
      element.dispatchEvent(new Event('input'));
      
      element.value = 'app';
      element.dispatchEvent(new Event('input'));
      
      // With debounce, rapid inputs coalesce into a single call after 300ms
      vi.advanceTimersByTime(300);
      
      expect(onInputMock).toHaveBeenCalledTimes(1);
      expect(onInputMock).toHaveBeenCalledWith('app');
    });

    it('should handle special characters in input', () => {
      const element = inputField.getInputElement();
      
      element.value = 'Café & Crème';
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      element.dispatchEvent(enterEvent);
      
      expect(onSubmitMock).toHaveBeenCalledWith('Café & Crème');
    });
  });
});
