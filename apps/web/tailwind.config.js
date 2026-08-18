/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        surface: {
          page:     'var(--surface-page)',
          base:     'var(--surface-base)',
          subtle:   'var(--surface-subtle)',
          muted:    'var(--surface-muted)',
          elevated: 'var(--surface-floating)',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        border: 'var(--border)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
      },
      borderRadius: {
        'ds-sm':  '0.375rem',
        'ds-md':  '0.5rem',
        'ds-lg':  '0.75rem',
        'ds-xl':  '1rem',
        'ds-2xl': '1.25rem',
      },
      boxShadow: {
        'ds-xs':    '0 1px 2px 0 rgba(0,0,0,0.05)',
        'ds-sm':    '0 1px 3px 0 rgba(0,0,0,0.07),0 1px 2px -1px rgba(0,0,0,0.04)',
        'ds-md':    '0 4px 6px -1px rgba(0,0,0,0.07),0 2px 4px -2px rgba(0,0,0,0.04)',
        'ds-lg':    '0 10px 15px -3px rgba(0,0,0,0.07),0 4px 6px -4px rgba(0,0,0,0.04)',
        'ds-brand': '0 0 0 3px rgba(79,70,229,0.15)',
        'ds-focus': '0 0 0 2px rgba(79,70,229,0.32)',
        'ds-glow': 'var(--shadow-glow)',

      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      transitionDuration: {
        'fast':   '100ms',
        'base':   '150ms',
        'slow':   '250ms',
        'slower': '350ms',
      },
    },
  },
  plugins: [],
}

