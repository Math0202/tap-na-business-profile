/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#f9f9f9',
        surface: {
          DEFAULT: '#f9f9f9',
          dim: '#dadada',
          bright: '#f9f9f9',
          variant: '#e2e2e2',
          charcoal: '#1A1A1A',
          tint: '#5e5e5e',
          container: {
            DEFAULT: '#eeeeee',
            lowest: '#ffffff',
            low: '#f3f3f3',
            high: '#e8e8e8',
            highest: '#e2e2e2',
          },
        },
        primary: {
          DEFAULT: '#000000',
          fixed: '#e2e2e2',
          'fixed-dim': '#c6c6c6',
          container: '#1b1b1b',
        },
        secondary: {
          DEFAULT: '#5e5e5e',
          fixed: '#e4e2e2',
          'fixed-dim': '#c7c6c6',
          container: '#e1dfdf',
        },
        tertiary: {
          DEFAULT: '#000000',
          fixed: '#e2e2e2',
          'fixed-dim': '#c6c6c6',
          container: '#1b1b1b',
        },
        on: {
          background: '#1a1c1c',
          surface: {
            DEFAULT: '#1a1c1c',
            variant: '#4c4546',
          },
          primary: {
            DEFAULT: '#ffffff',
            fixed: '#1b1b1b',
            'fixed-variant': '#474747',
            container: '#848484',
          },
          secondary: {
            DEFAULT: '#ffffff',
            fixed: '#1b1c1c',
            'fixed-variant': '#464747',
            container: '#626262',
          },
          tertiary: {
            DEFAULT: '#ffffff',
            fixed: '#1b1b1b',
            'fixed-variant': '#474747',
            container: '#848484',
          },
          error: {
            DEFAULT: '#ffffff',
            container: '#93000a',
          },
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        outline: {
          DEFAULT: '#7e7576',
          variant: '#cfc4c5',
        },
        inverse: {
          surface: '#2f3131',
          'on-surface': '#f1f1f1',
          primary: '#c6c6c6',
        },
        'border-subtle': '#E5E5E5',
        'ink-muted': '#8E8E93',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        'stack-md': '16px',
        gutter: '24px',
        'stack-lg': '48px',
        'margin-mobile': '20px',
        'margin-desktop': '64px',
        'stack-sm': '8px',
      },
      fontFamily: {
        'label-caps': ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        'display-lg': ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        'button-text': ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        'headline-lg': ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        'headline-lg-mobile': ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        'body-md': ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'label-caps': [
          '12px',
          { lineHeight: '16px', letterSpacing: '0.1em', fontWeight: '500' },
        ],
        'display-lg': [
          '64px',
          { lineHeight: '72px', letterSpacing: '-0.02em', fontWeight: '600' },
        ],
        'button-text': [
          '14px',
          { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '600' },
        ],
        'headline-lg': [
          '32px',
          { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        'headline-lg-mobile': [
          '28px',
          { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '500' },
        ],
        'body-md': [
          '16px',
          { lineHeight: '24px', letterSpacing: '0em', fontWeight: '400' },
        ],
      },
    },
  },
  plugins: [],
}
