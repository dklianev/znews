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
        zn: {
          // Newspaper paper tones
          bg: '#E8DFD0',
          'bg-warm': '#DDD3C2',
          paper: '#F2EDE5',
          surface: '#FFFFFF',
          'surface-2': '#EDE6DA',
          card: '#FFFFFF',
          border: '#C4B49A',
          'border-light': '#D9CEBC',

          // Tabloid reds
          hot: '#CC0A1A',
          'hot-dark': '#990813',
          'hot-light': '#E81228',

          // GTA purples
          purple: '#5B1A8C',
          'purple-light': '#7B35B5',
          'purple-dark': '#3A0F5C',
          'purple-deep': '#2D0845',

          // Gold / yellow
          gold: '#E8B830',
          'gold-bright': '#FFD700',
          'gold-warm': '#E8B830',

          // Accent colors
          orange: '#E87420',
          'orange-bright': '#FF7A20',
          navy: '#12123A',
          blue: '#2040A0',
          cyan: '#0088AA',
          green: '#1A7A42',

          // Text
          text: '#1C1428',
          'text-muted': '#524A62',
          'text-dim': '#8A7F98',
          white: '#FFFFFF',
          black: '#0A0812',

          // Comic extras
          'comic-black': '#1C1428',
          'comic-yellow': '#FFEC00',
          'comic-white': '#FFFDF5',

          // Sunset gradient stops
          'sunset-sky': '#120835',
          'sunset-purple': '#5B1A8C',
          'sunset-pink': '#C04080',
          'sunset-orange': '#E87420',
          'sunset-gold': '#F5C040',
        }
      },
      fontFamily: {
        display: ['"Oswald"', 'sans-serif'],
        comic: ['"Bangers"', '"Oswald"', 'sans-serif'],
        sans: ['"Nunito Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        headline: ['"Oswald"', 'Impact', 'sans-serif'],
      },
      animation: {
        'ticker': 'ticker 35s linear infinite',
        'hot-pulse': 'hotPulse 1.5s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'wiggle': 'wiggle 2s ease-in-out infinite',
        'stamp': 'stamp 0.4s cubic-bezier(.2,.8,.4,1.4) forwards',
        'wiggle-fast': 'wiggleFast 1s ease-in-out infinite',
        'pop-in': 'popIn 0.4s cubic-bezier(.2,.8,.4,1.4) forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        hotPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '25%': { transform: 'translateX(-4px) rotate(-1deg)' },
          '75%': { transform: 'translateX(4px) rotate(1deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        stamp: {
          '0%': { transform: 'scale(2) rotate(-10deg)', opacity: '0' },
          '100%': { transform: 'scale(1) rotate(-5deg)', opacity: '1' },
        },
        wiggleFast: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        popIn: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(204,10,26,0.2)' },
          '50%': { boxShadow: '0 0 25px rgba(204,10,26,0.5)' },
        },
      },
      backgroundImage: {
        'gradient-hot': 'linear-gradient(135deg, #CC0A1A 0%, #E06010 100%)',
        'gradient-purple': 'linear-gradient(135deg, #3A0F5C 0%, #7B35B5 100%)',
        'gradient-sunset': 'linear-gradient(180deg, #120835 0%, #5B1A8C 25%, #C04080 50%, #E87420 75%, #F5C040 95%)',
        'gradient-nav': 'linear-gradient(to right, #CC0A1A, #5B1A8C, #12123A)',
        'gradient-paper': 'linear-gradient(180deg, #F2EDE5 0%, #E8DFD0 100%)',
        'gradient-gold': 'linear-gradient(135deg, #D4A017 0%, #FFD700 50%, #E8B830 100%)',
        'gradient-comic': 'linear-gradient(135deg, #FFD700 0%, #FFEC80 50%, #FFD700 100%)',
      },
      boxShadow: {
        'polaroid': '4px 4px 0 rgba(0,0,0,0.25), 8px 8px 16px rgba(0,0,0,0.15)',
        'polaroid-hover': '6px 6px 0 rgba(0,0,0,0.3), 10px 10px 24px rgba(0,0,0,0.2)',
        'card': '2px 2px 0 rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '4px 4px 0 rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.12)',
        'headline': '3px 3px 0px rgba(0,0,0,0.2)',
        'comic': '3px 3px 0 #1C1428',
        'comic-heavy': '4px 4px 0 #1C1428',
        'comic-panel': '3px 3px 0 #1C1428',
        'comic-red': '4px 4px 0 #990813',
        'comic-purple': '3px 3px 0 #3A0F5C',
        'comic-glow': '0 0 20px rgba(204,10,26,0.3), 3px 3px 0 rgba(0,0,0,0.25)',
        'banner': '0 4px 0 rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.15)',
        'tape': '1px 1px 3px rgba(0,0,0,0.2)',
        'sticker': '2px 2px 0 rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        'comic': '2px',
      },
    },
  },
  plugins: [],
}
