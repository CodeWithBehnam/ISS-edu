import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
    './docs/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibmplexmono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
