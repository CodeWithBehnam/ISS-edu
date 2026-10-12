import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { normaliseBasePath } from './base-path';
import { buildCsp, CSP_DIRECTIVES, cspMetaPlugin, cspMetaTags } from './csp';

describe('normaliseBasePath', () => {
  it('serves from the domain root when unset or empty', () => {
    expect(normaliseBasePath(undefined)).toBe('/');
    expect(normaliseBasePath('')).toBe('/');
    expect(normaliseBasePath('   ')).toBe('/');
    expect(normaliseBasePath('/')).toBe('/');
  });

  it('adds the missing leading and trailing slashes', () => {
    expect(normaliseBasePath('/ISS-edu/')).toBe('/ISS-edu/');
    expect(normaliseBasePath('/ISS-edu')).toBe('/ISS-edu/');
    expect(normaliseBasePath('ISS-edu')).toBe('/ISS-edu/');
    expect(normaliseBasePath('/apps//iss.edu/')).toBe('/apps/iss.edu/');
  });

  it.each(['https://example.com/', './', '/../', '/a/./b/', '/iss edu/', '/iss?x=1', '/<script>/'])(
    'rejects %s instead of producing a broken deployment',
    (value) => {
      expect(() => normaliseBasePath(value)).toThrow(/BASE_PATH/);
    },
  );
});

describe('buildCsp', () => {
  const policy = buildCsp();
  const directive = (name: string): string[] =>
    (policy.split('; ').find((part) => part.startsWith(`${name} `)) ?? '').split(' ').slice(1);

  it('serialises every directive once, separated by semicolons', () => {
    expect(policy.split('; ')).toHaveLength(Object.keys(CSP_DIRECTIVES).length);
    expect(policy).not.toMatch(/;;|; $/);
  });

  it('keeps scripts strict: same origin plus WebAssembly only', () => {
    expect(directive('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it('closes plugins and base-tag injection', () => {
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'self'"]);
    expect(directive('form-action')).toEqual(["'self'"]);
  });

  it('allows only the three data hosts the app fetches from', () => {
    expect(directive('connect-src')).toEqual([
      "'self'",
      'https://celestrak.org',
      'https://api.wheretheiss.at',
      'https://corquaid.github.io',
    ]);
  });

  it('leaves out directives that break plain http://localhost or are ignored in meta tags', () => {
    expect(policy).not.toContain('upgrade-insecure-requests');
    expect(policy).not.toContain('frame-ancestors');
  });
});

describe('cspMetaPlugin', () => {
  it('only applies to production builds', () => {
    expect(cspMetaPlugin().apply).toBe('build');
  });

  it('prepends one meta tag carrying the policy', () => {
    expect(cspMetaTags()).toEqual([
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp() },
        injectTo: 'head-prepend',
      },
    ]);
  });
});

describe('nginx security headers', () => {
  const conf = readFileSync(new URL('../deploy/nginx/security-headers.conf', import.meta.url), 'utf8');

  it('send the same policy as the meta tag, plus frame-ancestors', () => {
    const header = /add_header\s+Content-Security-Policy\s+"([^"]+)"/.exec(conf)?.[1];
    expect(header).toBe(`${buildCsp()}; frame-ancestors 'none'`);
  });
});
