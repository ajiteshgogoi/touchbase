export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',   // Lightest blue - for backgrounds (unchanged)
          100: '#e0f2fe',  // Very light blue - for hover states (unchanged)
          200: '#bae6fd',  // Light blue - for secondary elements (unchanged)
          300: '#38bdf8',  // Mid-light blue - darker for better contrast
          400: '#0284c7',  // Medium blue - darker for buttons and links
          500: '#0369a1',  // Main brand blue - darker for primary actions
          600: '#075985',  // Darker blue - for hover states and text
          700: '#0c4a6e',  // Deep blue - for important text
          800: '#0c3d5c',  // Very dark blue - for headers
          900: '#082f4b',  // Darkest blue - for emphasis
        },
        accent: {
          50: '#fff7ed',   // Warmest orange - for highlights
          100: '#ffedd5',  // Very light orange - for accents
          200: '#fed7aa',  // Light orange - for secondary elements
          300: '#fdba74',  // Mid-light orange - for notifications
          400: '#fb923c',  // Medium orange - for important elements
          500: '#f97316',  // Main orange - for CTAs
        }
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}