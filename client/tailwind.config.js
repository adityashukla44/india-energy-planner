/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        'teal-deep': v('teal-deep'),
        teal: v('teal'),
        aqua: v('aqua'),
        cyan: v('cyan'),
        mint: v('mint'),
        green: v('green'),
        amber: v('amber'),
        critical: v('critical'),
        warning: v('warning'),
        text: v('text'),
        muted: v('muted'),
        hydro: v('hydro'),
        geo: v('geo'),
        line: v('line'),
        'on-accent': v('on-accent'),
      },
      fontFamily: {
        display: ['Sora', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'Noto Sans Devanagari', 'Noto Sans Tamil', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['12px', '16px'],
        sm: ['14px', '20px'],
        base: ['16px', '24px'],
        lg: ['20px', '28px'],
        xl: ['28px', '34px'],
        '2xl': ['40px', '46px'],
        '3xl': ['56px', '60px'],
      },
      borderRadius: { card: '18px', btn: '12px' },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--cyan) / 0.55), 0 0 24px -4px rgb(var(--cyan) / 0.45)',
        card: 'var(--card-shadow)',
      },
    },
  },
  plugins: [],
};
