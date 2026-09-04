/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Trebuchet MS"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'banner': {
          '0%': { transform: 'translateY(-24px)', opacity: '0' },
          '15%,80%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-24px)', opacity: '0' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.18s ease-out',
        'slide-up': 'slide-up 0.22s ease-out',
        'banner': 'banner 2.6s ease-in-out forwards',
        'shimmer': 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
}
