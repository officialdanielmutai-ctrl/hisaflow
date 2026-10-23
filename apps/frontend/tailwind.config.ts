import type { Config } from 'tailwindcss'

const config: Config = {
  // Named themes are applied via `data-theme` on <html> and generated CSS
  // custom properties. `.dark` is still mirrored for legacy utility bridges.
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': 'var(--color-bg-base)',
        'bg-surface': 'var(--color-bg-surface)',
        'bg-elevated': 'var(--color-bg-elevated)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        border: 'var(--color-border)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          blue: 'var(--color-accent-blue)', // Secondary accent
        },
        'status-success': 'var(--color-status-success)',
        'status-warning': 'var(--color-status-warning)',
        'status-critical': 'var(--color-status-critical)',
        'status-info': 'var(--color-status-info)',
        'status-neutral': 'var(--color-status-neutral)',
      },
      borderRadius: {
        sm: 'var(--hf-radius-sm)',
        md: 'var(--hf-radius-md)',
        card: 'var(--hf-radius-card)',
        lg: 'var(--hf-radius-lg)',
        xl: 'var(--hf-radius-xl)',
        '2xl': 'var(--hf-radius-card)',
        '3xl': 'var(--hf-radius-xl)',
        full: 'var(--hf-radius-pill)',
      },
      boxShadow: {
        sm: 'var(--hf-shadow-card)',
        md: 'var(--hf-shadow-raised)',
        lg: 'var(--hf-shadow-overlay)',
        xl: 'var(--hf-shadow-overlay)',
        '2xl': 'var(--hf-shadow-overlay)',
      },
      // Rem-based so the theme's density/font-size token scales spacing and
      // type together. Ivory resolves to the same 4/8/12/16/24/32/48 values
      // the app shipped with.
      spacing: {
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '6': '1.5rem',
        '8': '2rem',
        '12': '3rem',
      },
      fontFamily: {
        sans: ['var(--hf-font-family, var(--font-sans))', 'sans-serif'],
      },
      transitionDuration: {
        fast: 'var(--hf-motion-duration-fast)',
        base: 'var(--hf-motion-duration-base)',
        slow: 'var(--hf-motion-duration-slow)',
      },
      transitionTimingFunction: {
        theme: 'var(--hf-motion-ease)',
        spring: 'var(--hf-motion-spring)',
      },
    },
  },
  plugins: [],
}
export default config
