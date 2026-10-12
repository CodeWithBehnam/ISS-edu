/** One URL path segment: letters, digits and the unreserved punctuation of RFC 3986. */
const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;
const DOT_SEGMENTS = new Set(['.', '..']);

/**
 * Turns the `BASE_PATH` environment variable into the `base` Vite expects: a leading and a trailing
 * slash, for example `/ISS-edu/`. Unset or empty means the site is served from the domain root.
 *
 * Only plain path prefixes are accepted. Full URLs and relative bases (`./`) are rejected on purpose:
 * the router prefix in `src/App.tsx` is derived from this value, and a typo here would otherwise
 * surface as a blank page after deployment instead of a failed build.
 */
export function normaliseBasePath(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  const segments = trimmed.split('/').filter((segment) => segment !== '');
  const invalid = segments.find((segment) => DOT_SEGMENTS.has(segment) || !SAFE_SEGMENT.test(segment));
  if (invalid !== undefined) {
    throw new Error(
      `BASE_PATH must be a path prefix such as "/" or "/ISS-edu/", but it contains "${invalid}" (received "${trimmed}").`,
    );
  }
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
}
