import type { Config } from 'tailwindcss'

const config: Config = {
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
        'border': 'var(--color-border)',
        'accent': {
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
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-sm)', // Shadcn default
        'card': 'var(--radius-card)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-card)', // Shadcn default
        '2xl': 'var(--radius-lg)', // Shadcn default
        'full': 'var(--radius-pill)',
      },
      boxShadow: {
        'sm': 'var(--shadow-card)',
        'md': 'var(--shadow-raised)',
        'lg': 'var(--shadow-overlay)',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
