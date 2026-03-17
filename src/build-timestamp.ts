/**
 * Derives a short-format timestamp from the full build timestamp.
 *
 * Strips the 4-digit year and lowercases "Built" to "built" for inline use.
 *
 * @example
 * toShortTimestamp("Built Mar 16, 2026 9:45 PM") // "built Mar 16, 9:45 PM"
 * toShortTimestamp("Built dev")                   // "built dev"
 */
export function toShortTimestamp(full: string): string {
  // Remove ", YYYY" (comma, space, 4-digit year) from the full timestamp
  const short = full.replace(/,\s*\d{4}/, '');

  // Lowercase "Built" → "built" for inline sentence use
  return short.replace(/^Built/, 'built');
}
