/**
 * Share controller for sharing grocery lists via Web Share API or clipboard fallback.
 * Dependencies are injected for testability — no global browser API access.
 */

/** Injected browser API dependencies */
export interface ShareDeps {
  navigatorShare?: (data: ShareData) => Promise<void>;
  clipboardWriteText?: (text: string) => Promise<void>;
}

/** Result of a share attempt */
export type ShareResult =
  | { status: 'shared' }
  | { status: 'copied' }
  | { status: 'unsupported' };

/**
 * Share a list URL using the best available browser API.
 *
 * 1. If `navigator.share` is available, invoke it with { url, title }.
 *    - On success or AbortError (user cancelled the share sheet): return { status: 'shared' }.
 *    - On any other error: fall through to clipboard.
 * 2. If clipboard API is available, copy the URL and return { status: 'copied' }.
 * 3. If neither API is available, return { status: 'unsupported' }.
 */
export async function shareList(
  url: string,
  title: string,
  deps: ShareDeps,
): Promise<ShareResult> {
  if (deps.navigatorShare) {
    try {
      await deps.navigatorShare({ url, title });
      return { status: 'shared' };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { status: 'shared' };
      }
      // Non-AbortError — fall through to clipboard
    }
  }

  if (deps.clipboardWriteText) {
    await deps.clipboardWriteText(url);
    return { status: 'copied' };
  }

  return { status: 'unsupported' };
}
