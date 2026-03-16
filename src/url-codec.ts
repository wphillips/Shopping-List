import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

/**
 * Compresses a serialized JSON string using lz-string and returns a shareable URL.
 * Uses a query parameter (?list=...) instead of a hash fragment so the data
 * survives sharing across messaging apps (iMessage, etc. strip # fragments).
 * @param serializedJson - The JSON string to compress
 * @param origin - The origin (e.g., "https://example.com")
 * @returns A URL in the format `${origin}/?list=${encoded}`
 */
export function encodeListUrl(serializedJson: string, origin: string): string {
  const encoded = compressToEncodedURIComponent(serializedJson);
  return `${origin}/?list=${encoded}`;
}

/**
 * Extracts and decompresses the `list=` parameter from a URL query string or hash fragment.
 * Supports both `?list=...` (preferred) and legacy `#list=...` formats.
 * @param searchOrHash - The search string (e.g., "?list=encoded_data") or hash string (e.g., "#list=encoded_data")
 * @returns The decompressed JSON string, `null` if no `list=` parameter, or `{ error: string }` on failure
 */
export function decodeListFragment(searchOrHash: string): string | null | { error: string } {
  const stripped = (searchOrHash.startsWith('?') || searchOrHash.startsWith('#'))
    ? searchOrHash.slice(1)
    : searchOrHash;

  if (!stripped) {
    return null;
  }

  const params = stripped.split('&');
  const listParam = params.find((p) => p.startsWith('list='));

  if (!listParam) {
    return null;
  }

  const encoded = listParam.slice('list='.length);

  if (!encoded) {
    return { error: 'Decompression failed' };
  }

  try {
    // Try decompressing the raw value first
    let decompressed = decompressFromEncodedURIComponent(encoded);

    // If that fails, try decoding percent-encoding that messaging apps may add
    if (decompressed === null || decompressed === '') {
      try {
        const decoded = decodeURIComponent(encoded);
        decompressed = decompressFromEncodedURIComponent(decoded);
      } catch {
        // decodeURIComponent failed, stick with null
      }
    }

    if (decompressed === null || decompressed === '') {
      return { error: 'Decompression failed' };
    }

    return decompressed;
  } catch {
    return { error: 'Decompression failed' };
  }
}
