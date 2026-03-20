/**
 * Clipboard helper — copies text to the clipboard with a fallback for
 * environments where the Clipboard API is unavailable.
 *
 * Dependencies are injected for testability (same pattern as install-prompt.ts).
 */

// ---------------------------------------------------------------------------
// Dependency interface
// ---------------------------------------------------------------------------

export interface ClipboardDeps {
  clipboardWriteText?: (text: string) => Promise<void>;
  document: {
    createElement: (tag: string) => HTMLElement;
    body: {
      appendChild: (el: HTMLElement) => void;
      removeChild: (el: HTMLElement) => void;
    };
    execCommand: (cmd: string) => boolean;
  };
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type CopyResult =
  | { status: 'copied' }
  | { status: 'failed'; message: string };

// ---------------------------------------------------------------------------
// Copy function
// ---------------------------------------------------------------------------

/**
 * Copy `text` to the clipboard using the best available method.
 *
 * 1. If `deps.clipboardWriteText` is provided, use the Clipboard API.
 * 2. Otherwise fall back to a temporary `<textarea>` + `execCommand('copy')`.
 * 3. Returns `{ status: 'copied' }` on success or `{ status: 'failed', message }`.
 */
export async function copyToClipboard(
  text: string,
  deps: ClipboardDeps,
): Promise<CopyResult> {
  // --- Clipboard API path ---
  if (deps.clipboardWriteText) {
    try {
      await deps.clipboardWriteText(text);
      return { status: 'copied' };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Clipboard API failed';
      return { status: 'failed', message };
    }
  }

  // --- execCommand fallback ---
  try {
    const textarea = deps.document.createElement('textarea') as HTMLTextAreaElement;
    textarea.value = text;
    // Prevent scrolling to bottom on iOS
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    deps.document.body.appendChild(textarea);
    textarea.select();
    const ok = deps.document.execCommand('copy');
    deps.document.body.removeChild(textarea);
    return ok
      ? { status: 'copied' }
      : { status: 'failed', message: 'execCommand copy returned false' };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Fallback copy failed';
    return { status: 'failed', message };
  }
}
