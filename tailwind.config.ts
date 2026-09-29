import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 500: '#4f63d2',
          600: '#3b4cb8', 700: '#2f3d99', 800: '#26317a', 900: '#1c2559',
        },
        ink: { DEFAULT: '#1a2033', soft: '#5b6478', faint: '#8a92a6' },
        paper: '#f6f7fb',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(20,28,56,.05), 0 4px 16px rgba(20,28,56,.04)' },
    },
  },
  plugins: [],
};
export default config;
