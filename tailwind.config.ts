import type { Config } from 'tailwindcss';

// Pastel toy-diorama tokens. Hex values mirror PALETTE in
// src/components/scene/scene-constants.ts so the DOM and the WebGL scene
// share one colour story.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8EE',
        paper: '#FFFDF8',
        peach: '#FFD8BE',
        blush: '#FFB4A2',
        coral: '#FF8C7A',
        // Darker edge colours for the "pressed toy" bottom lip of coloured buttons.
        'coral-deep': '#E5705D',
        sky: '#BDE0FE',
        ocean: '#7CC6E8',
        'ocean-deep': '#4FA3D1',
        mint: '#B9F3C9',
        leaf: '#7CC56B',
        butter: '#FFE29A',
        'butter-deep': '#F0C45E',
        lavender: '#CDB4DB',
        grape: '#8E7DBE',
        night: '#6C6FA8',
        ink: '#2B2D42',
        'ink-soft': '#5C5F7A',
        line: '#EADFD3',
      },
      fontFamily: {
        display: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'ui-rounded', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        toy: '0 6px 0 #EADFD3, 0 18px 40px -18px rgba(43, 45, 66, 0.25)',
        'toy-pressed': '0 2px 0 #EADFD3, 0 6px 14px -10px rgba(43, 45, 66, 0.25)',
        'toy-sm': '0 4px 0 #EADFD3, 0 10px 20px -12px rgba(43, 45, 66, 0.28)',
      },
      borderRadius: {
        card: '28px',
      },
      keyframes: {
        'ping-soft': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '75%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        'ping-soft': 'ping-soft 1.8s cubic-bezier(0, 0, 0.2, 1) infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        bob: 'bob 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
