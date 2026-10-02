/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#ffffff',
          100: '#fcfcfc',
          200: '#f5f5f5',
          300: '#e0e0e0',
          400: '#999999',
          500: '#888888',
          600: '#777777',
          700: '#666666',
          800: '#555555',
          900: '#333333',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
