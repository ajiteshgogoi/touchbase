export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',   // Lightest blue - for backgrounds
          100: '#e0f2fe',  // Very light blue - for subtle highlights
          200: '#bae6fd',  // Light blue - for secondary elements
          300: '#7dd3fc',  // Mid-light blue - for active states
          400: '#38bdf8',  // Medium blue - for base button states
          500: '#0ea5e9',  // Main brand blue - primary actions
          600: '#0284c7',  // Darker blue - for hover states
          700: '#0369a1',  // Deep blue - for text
          800: '#075985',  // Very dark blue - for headers
          900: '#0c4a6e',  // Darkest blue - for emphasis
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
        'lg': '0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.01)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        },
        'float-delayed': {
          '0%, 100%': { transform: 'translateY(0) scale(1.05)' },
          '50%': { transform: 'translateY(-20px) scale(1)' },
        }
      },
      animation: {
        'float': 'float 8s ease-in-out infinite',
        'float-delayed': 'float-delayed 8s ease-in-out infinite 4s',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}