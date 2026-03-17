/**
 * Debounce unit tests for InputField component
 * Tests Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.2, 4.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InputField } from '../src/components/InputField';

describe('InputField Debounce Behavior', () => {
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

  it('typing a single character and advancing 300ms fires onInput once', () => {
    const el = inputField.getElement();

    el.value = 'a';
    el.dispatchEvent(new Event('input'));

    vi.advanceTimersByTime(300);

    expect(onInputMock).toHaveBeenCalledTimes(1);
    expect(onInputMock).toHaveBeenCalledWith('a');
  });

  it('rapid keystrokes within 300ms coalesce into a single onInput call with final value', () => {
    const el = inputField.getElement();

    el.value = 'a';
    el.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(100);

    el.value = 'ab';
    el.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(100);

    el.value = 'abc';
    el.dispatchEvent(new Event('input'));

    // No calls yet — debounce still pending
    expect(onInputMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(onInputMock).toHaveBeenCalledTimes(1);
    expect(onInputMock).toHaveBeenCalledWith('abc');
  });

  it('pressing Enter before 300ms fires onSubmit immediately and cancels pending debounce', () => {
    const el = inputField.getElement();

    el.value = 'milk';
    el.dispatchEvent(new Event('input'));

    // Enter before debounce fires
    vi.advanceTimersByTime(100);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onSubmitMock).toHaveBeenCalledTimes(1);
    expect(onSubmitMock).toHaveBeenCalledWith('milk');

    // Reset to track only post-Enter calls
    onInputMock.mockClear();

    // Advance past original debounce window — the debounced call should NOT fire
    vi.advanceTimersByTime(300);

    // onInput should only have been called with '' from the clear after submit
    // (that call happened before mockClear, so after clear we expect no extra calls)
    expect(onInputMock).not.toHaveBeenCalled();
  });

  it('pressing Enter clears input and fires onInput("") immediately', () => {
    const el = inputField.getElement();

    el.value = 'eggs';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(el.value).toBe('');
    expect(onInputMock).toHaveBeenCalledWith('');
  });

  it('clearing input to empty fires onInput("") immediately and cancels pending debounce', () => {
    const el = inputField.getElement();

    // Type something to start a debounce timer
    el.value = 'bread';
    el.dispatchEvent(new Event('input'));

    expect(onInputMock).not.toHaveBeenCalled();

    // Clear the input
    el.value = '';
    el.dispatchEvent(new Event('input'));

    // onInput("") should fire immediately
    expect(onInputMock).toHaveBeenCalledTimes(1);
    expect(onInputMock).toHaveBeenCalledWith('');

    // Advance past debounce — no extra call for 'bread'
    vi.advanceTimersByTime(300);
    expect(onInputMock).toHaveBeenCalledTimes(1);
  });

  it('destroy() cancels pending timer so onInput is never called', () => {
    const el = inputField.getElement();

    el.value = 'test';
    el.dispatchEvent(new Event('input'));

    inputField.destroy();

    vi.advanceTimersByTime(300);

    expect(onInputMock).not.toHaveBeenCalled();
  });

  it('debounce delay is exactly 300ms (fires at 300, not at 299)', () => {
    const el = inputField.getElement();

    el.value = 'x';
    el.dispatchEvent(new Event('input'));

    vi.advanceTimersByTime(299);
    expect(onInputMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // now at 300ms
    expect(onInputMock).toHaveBeenCalledTimes(1);
    expect(onInputMock).toHaveBeenCalledWith('x');
  });

  it('multiple destroy() calls are safe (no errors)', () => {
    const el = inputField.getElement();

    el.value = 'hello';
    el.dispatchEvent(new Event('input'));

    expect(() => {
      inputField.destroy();
      inputField.destroy();
      inputField.destroy();
    }).not.toThrow();

    vi.advanceTimersByTime(300);
    expect(onInputMock).not.toHaveBeenCalled();
  });
});
