/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable dark mode with a class
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      maxWidth: {
        '4xl': '56rem', // 896px
        '5xl': '64rem', // 1024px
        '6xl': '72rem', // 1152px
      },
    },
  },
  plugins: [],
}



