import type { HtmlTagDescriptor, Plugin } from 'vite';

type Directives = Readonly<Record<string, readonly string[]>>;

/**
 * Content Security Policy for the production build. Every source is there because the app uses it:
 *
 * - `'wasm-unsafe-eval'`: three-stdlib's MeshoptDecoder instantiates WebAssembly to unpack the GLB models.
 *   It permits WebAssembly only, not eval() of strings, so there is no `'unsafe-eval'`.
 * - `'unsafe-inline'` for styles: React and three.js set inline style attributes. Scripts stay strict.
 * - Google Fonts: the stylesheet comes from fonts.googleapis.com and the font files from fonts.gstatic.com.
 * - upload.wikimedia.org: crew portraits and the expedition patch from the crew feed.
 * - connect-src: the TLE and position APIs plus the crew feed, which are the only cross-origin fetches.
 *
 * nginx (deploy/nginx/default.conf) sends the same policy plus `frame-ancestors 'none'`, which browsers
 * ignore inside a meta tag. Keep the two in step.
 */
export const CSP_DIRECTIVES: Directives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'blob:', 'https://upload.wikimedia.org'],
  'connect-src': [
    "'self'",
    'https://celestrak.org',
    'https://api.wheretheiss.at',
    'https://corquaid.github.io',
  ],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/** Serialises directives into the `a b c; d e` form used by both the header and the meta tag. */
export function buildCsp(directives: Directives = CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([name, sources]) => [name, ...sources].join(' '))
    .join('; ');
}

/** The meta tag goes first in `<head>` because a policy only covers what is parsed after it. */
export function cspMetaTags(directives: Directives = CSP_DIRECTIVES): HtmlTagDescriptor[] {
  return [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp(directives) },
      injectTo: 'head-prepend',
    },
  ];
}

/**
 * Adds the policy to index.html in production builds only. The dev server needs inline scripts and a
 * websocket for hot reload, which this policy would block.
 */
export function cspMetaPlugin(): Plugin {
  return {
    name: 'iss-csp-meta',
    apply: 'build',
    transformIndexHtml: () => cspMetaTags(),
  };
}
