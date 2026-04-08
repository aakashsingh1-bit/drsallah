/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        /* Brand — Udemy-style orange */
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        /* Surface */
        surface: {
          0:    '#ffffff',
          50:   '#fafafa',
          100:  '#f5f5f5',
          200:  '#eeeeee',
          300:  '#e0e0e0',
          400:  '#bdbdbd',
          500:  '#9e9e9e',
          600:  '#757575',
          700:  '#616161',
          800:  '#424242',
          900:  '#212121',
        },
      },
      boxShadow: {
        'soft':   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card':   '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md':'0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'card-lg':'0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        'brand':  '0 4px 14px rgba(249,115,22,0.30)',
        'inset':  'inset 0 1px 2px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'xl2': '16px',
        'xl3': '20px',
      },
      animation: {
        'fade-up':   'fadeUp .2s cubic-bezier(.16,1,.3,1) both',
        'scale-in':  'scaleIn .18s cubic-bezier(.16,1,.3,1) both',
        'slide-in':  'slideIn .22s cubic-bezier(.16,1,.3,1) both',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeUp:  { '0%':{ opacity:0, transform:'translateY(10px)'}, '100%':{ opacity:1, transform:'translateY(0)' } },
        scaleIn: { '0%':{ opacity:0, transform:'scale(.97)'}, '100%':{ opacity:1, transform:'scale(1)' } },
        slideIn: { '0%':{ opacity:0, transform:'translateX(12px)'}, '100%':{ opacity:1, transform:'translateX(0)' } },
      },
      opacity: {
        12: '0.12',
      }
    },
  },
  plugins: [],
};
