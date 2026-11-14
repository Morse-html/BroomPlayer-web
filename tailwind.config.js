/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark, consistent palette — single accent color (green) used sparingly.
        spotify: {
          black: '#000000',
          surface: '#0D0D0D', // elevated panel background
          dark: '#121212',
          card: '#1A1A1A',
          gray: '#282828',
          border: '#2A2A2A',
          muted: '#535353',
          lightGray: '#B3B3B3',
          white: '#FFFFFF',
          green: '#1DB954', // accent only
        },
      },
    },
  },
  plugins: [],
}