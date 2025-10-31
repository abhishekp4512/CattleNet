/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3498db',
          hover: '#2980b9',
          active: '#1f6aa1',
          light: 'rgba(52, 152, 219, 0.15)',
        },
        success: {
          DEFAULT: '#2ecc71',
          hover: '#27ae60',
          active: '#219653',
          light: 'rgba(46, 204, 113, 0.15)',
        },
        secondary: {
          DEFAULT: '#9b59b6',
          hover: '#8e44ad',
          active: '#6c3483',
          light: 'rgba(155, 89, 182, 0.15)',
        },
        warning: {
          DEFAULT: '#f39c12',
          hover: '#d35400',
          active: '#a04000',
          light: 'rgba(243, 156, 18, 0.15)',
        },
        danger: {
          DEFAULT: '#e74c3c',
          hover: '#c0392b',
          active: '#962d22',
          light: 'rgba(231, 76, 60, 0.15)',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s infinite',
      },
      boxShadow: {
        'card': '0 4px 12px rgba(0, 0, 0, 0.05)',
        'hover': '0 6px 16px rgba(0, 0, 0, 0.1)',
        'button': '0 2px 4px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}