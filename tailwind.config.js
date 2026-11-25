/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        veldora: {
          50: '#f5f7fa',
          100: '#eaedf3',
          200: '#d5dce6',
          300: '#b3c1d4',
          400: '#8ca1bf',
          500: '#647ea7',
          600: '#4e6488',
          700: '#3e4f6d',
          800: '#2b364a',
          900: '#171e2b',
          950: '#0c1017',
        },
        dark: {
          bg: '#0f1115',
          card: '#16181e',
          cardHover: '#1c1f26',
          border: '#262933',
          toolbar: '#14161b',
          sidebar: '#121317',
        },
        brand: {
          purple: '#7c3aed',
          violet: '#8b5cf6',
          blue: '#3b82f6',
          cyan: '#06b6d4',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

