/**
 * Property-based tests for InputField debounce behavior
 * Uses fast-check for property-based testing with Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { InputField } from '../src/components/InputField';

// Feature: debounce-filter-input, Property 1: Debounce coalesces keystrokes into a single delayed callback
describe('Property 1: Debounce coalesces keystrokes into a single delayed callback', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   *
   * For any sequence of N keystrokes (N >= 1) typed into the InputField where each
   * keystroke occurs less than 300ms after the previous one, the onInput filter callback
   * should be invoked exactly once, with the final input value, exactly 300ms after the
   * last keystroke. No intermediate values should be emitted.
   */
  let onInputMock: ReturnType<typeof vi.fn>;
  let onSubmitMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onInputMock = vi.fn();
    onSubmitMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces any sequence of keystrokes into a single onInput call with the final value after 300ms', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 1 }), { minLength: 1, maxLength: 20 }),
        (chars: string[]) => {
          // Reset mocks for each iteration
          onInputMock.mockClear();
          onSubmitMock.mockClear();

          const inputField = new InputField({
            placeholder: 'Test',
            onInput: onInputMock as (text: string) => void,
            onSubmit: onSubmitMock as (text: string) => void,
          });

          const el = inputField.getInputElement();

          // Simulate typing one character at a time, accumulating the string
          let accumulated = '';
          for (const char of chars) {
            accumulated += char;
            el.value = accumulated;
            el.dispatchEvent(new Event('input'));

            // Advance less than 300ms between keystrokes to keep them within debounce window
            vi.advanceTimersByTime(50);
          }

          // At this point, no onInput should have been called (all within debounce window)
          // unless the accumulated string became empty at some point (which won't happen
          // since we only append chars)
          expect(onInputMock).not.toHaveBeenCalled();

          // Advance the remaining time to trigger the debounce (300ms from last keystroke)
          // We already advanced 50ms after the last keystroke, so advance 250 more
          vi.advanceTimersByTime(250);

          // onInput should be called exactly once with the final accumulated value
          const finalValue = chars.join('');
          expect(onInputMock).toHaveBeenCalledTimes(1);
          expect(onInputMock).toHaveBeenCalledWith(finalValue);

          // Cleanup
          inputField.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: debounce-filter-input, Property 2: Submit immediately fires and cancels pending debounce
describe('Property 2: Submit immediately fires and cancels pending debounce', () => {
  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * For any non-empty, non-whitespace-only input string where a debounce timer is pending,
   * pressing Enter should: (a) invoke onSubmit with the trimmed value immediately,
   * (b) cancel the pending debounce timer so it never fires with the typed text,
   * (c) clear the input field, and (d) invoke onInput with an empty string immediately.
   */
  let onInputMock: ReturnType<typeof vi.fn>;
  let onSubmitMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onInputMock = vi.fn();
    onSubmitMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submit immediately fires onSubmit and cancels pending debounce for any non-empty string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        (text: string) => {
          // Reset mocks for each iteration
          onInputMock.mockClear();
          onSubmitMock.mockClear();

          const inputField = new InputField({
            placeholder: 'Test',
            onInput: onInputMock as (text: string) => void,
            onSubmit: onSubmitMock as (text: string) => void,
          });

          const el = inputField.getInputElement();

          // Type the string into InputField to start a debounce timer
          el.value = text;
          el.dispatchEvent(new Event('input'));

          // No onInput should have been called yet (debounce pending)
          expect(onInputMock).not.toHaveBeenCalled();

          // Press Enter to submit
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

          // (a) onSubmit called with trimmed value
          expect(onSubmitMock).toHaveBeenCalledTimes(1);
          expect(onSubmitMock).toHaveBeenCalledWith(text.trim());

          // (d) onInput("") called immediately (from the clear after submit)
          expect(onInputMock).toHaveBeenCalledTimes(1);
          expect(onInputMock).toHaveBeenCalledWith('');

          // Reset to check that no further calls happen
          onInputMock.mockClear();

          // (b) Pending debounce cancelled — advance 300ms, no extra onInput call with the typed text
          vi.advanceTimersByTime(300);
          expect(onInputMock).not.toHaveBeenCalled();

          // Cleanup
          inputField.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: debounce-filter-input, Property 3: Empty input bypasses debounce
describe('Property 3: Empty input bypasses debounce', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any input sequence where the user has typed characters (starting a debounce timer)
   * and then clears the field to an empty string, the onInput callback should be invoked
   * immediately with "", and the previously pending debounce timer should be cancelled so
   * it never fires.
   */
  let onInputMock: ReturnType<typeof vi.fn>;
  let onSubmitMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onInputMock = vi.fn();
    onSubmitMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('clearing input to empty invokes onInput("") immediately and cancels pending debounce for any typed string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (text: string) => {
          // Reset mocks for each iteration
          onInputMock.mockClear();
          onSubmitMock.mockClear();

          const inputField = new InputField({
            placeholder: 'Test',
            onInput: onInputMock as (text: string) => void,
            onSubmit: onSubmitMock as (text: string) => void,
          });

          const el = inputField.getInputElement();

          // Type the string into InputField to start a debounce timer
          el.value = text;
          el.dispatchEvent(new Event('input'));

          // No onInput should have been called yet (debounce pending)
          expect(onInputMock).not.toHaveBeenCalled();

          // Clear the input (set value to "" and dispatch input event)
          el.value = '';
          el.dispatchEvent(new Event('input'));

          // onInput("") should be called immediately
          expect(onInputMock).toHaveBeenCalledTimes(1);
          expect(onInputMock).toHaveBeenCalledWith('');

          // Reset to check that no further calls happen
          onInputMock.mockClear();

          // Pending debounce cancelled — advance 300ms, no extra onInput call with the typed text
          vi.advanceTimersByTime(300);
          expect(onInputMock).not.toHaveBeenCalled();

          // Cleanup
          inputField.destroy();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: debounce-filter-input, Property 4: Destroy prevents stale callbacks
describe('Property 4: Destroy prevents stale callbacks', () => {
  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * For any InputField instance with a pending debounce timer, calling destroy()
   * should prevent the onInput callback from being invoked when the timer would
   * have fired. After destruction, no further filter callbacks occur.
   */
  let onInputMock: ReturnType<typeof vi.fn>;
  let onSubmitMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onInputMock = vi.fn();
    onSubmitMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('destroy() prevents pending debounce from invoking onInput for any typed string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (text: string) => {
          // Reset mocks for each iteration
          onInputMock.mockClear();
          onSubmitMock.mockClear();

          const inputField = new InputField({
            placeholder: 'Test',
            onInput: onInputMock as (text: string) => void,
            onSubmit: onSubmitMock as (text: string) => void,
          });

          const el = inputField.getInputElement();

          // Type the string into InputField to start a debounce timer
          el.value = text;
          el.dispatchEvent(new Event('input'));

          // No onInput should have been called yet (debounce pending)
          expect(onInputMock).not.toHaveBeenCalled();

          // Destroy the InputField to cancel the pending debounce
          inputField.destroy();

          // Advance timers well past the debounce delay
          vi.advanceTimersByTime(500);

          // onInput should never have been called — destroy cancelled the pending timer
          expect(onInputMock).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
