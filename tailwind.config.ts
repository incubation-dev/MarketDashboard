import type { Config } from 'tailwindcss'
import daisyui from 'daisyui'

const config: Config = {
  content: [
    './src/client/**/*.{ts,tsx}',
    './src/server/**/*.{ts,tsx}',
    './src/index.ts',
    './public/**/*.{html,js}'
  ],
  theme: {
    extend: {
      colors: {
        brand: '#aa0000'
      },
      fontFamily: {
        sans: ['"SF Pro Display"', '"SF Pro Text"', 'Inter', 'sans-serif']
      },
      boxShadow: {
        soft: '0 20px 40px -20px rgba(0, 0, 0, 0.35)'
      }
    }
  },
  plugins: [
    daisyui
  ],
  daisyui: {
    themes: [
      {
        brand: {
          primary: '#aa0000',
          'primary-focus': '#900000',
          'primary-content': '#ffffff',
          secondary: '#1f2933',
          accent: '#2563eb',
          neutral: '#111827',
          'neutral-content': '#f9fafb',
          'base-100': '#0f0f10',
          'base-200': '#161617',
          'base-300': '#1f1f22',
          info: '#0ea5e9',
          success: '#22c55e',
          warning: '#facc15',
          error: '#ef4444'
        }
      },
      'light'
    ],
    darkTheme: 'brand'
  }
}

export default config
