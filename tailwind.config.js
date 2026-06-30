/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'emma-black': '#1C1C1C',
        'emma-white': '#FAFAF8',
        'emma-gold': '#C9A870',
        'emma-gold-light': '#E5D4B0',
        'emma-gold-dark': '#A8875A',
        'emma-nude': '#F2E8DE',
        'emma-grey': '#8A7B70',
        'emma-grey-light': '#D6CDC6',
        'emma-grey-dark': '#5C5048',
        'emma-border': '#EBE3DB',
        'acc-positive': '#2E7D52',
        'acc-negative': '#C0392B',
      },
      fontFamily: {
        'playfair': ['"LINE Seed Sans TH"', 'system-ui', 'sans-serif'],
        'inter': ['"LINE Seed Sans TH"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'emma': '2px',
      },
      boxShadow: {
        'emma': '0 1px 3px rgba(28,28,28,0.06), 0 1px 2px rgba(28,28,28,0.04)',
        'emma-md': '0 4px 12px rgba(28,28,28,0.08), 0 2px 4px rgba(28,28,28,0.04)',
        'emma-lg': '0 8px 24px rgba(28,28,28,0.10), 0 4px 8px rgba(28,28,28,0.06)',
      },
    },
  },
  plugins: [],
}
