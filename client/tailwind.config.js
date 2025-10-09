/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yin: {
          100: '#f0f4f8',
          200: '#d9e2ec', 
          400: '#9fb3c8',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43'
        },
        yang: {
          100: '#fffbe6',
          200: '#fff1b8',
          400: '#ffd666',
          600: '#faad14', 
          700: '#d48806',
          800: '#ad6800',
          900: '#874d00'
        }
      }
    },
  },
  plugins: [],
}