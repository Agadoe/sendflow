module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFFDF7',
        amber: {
          DEFAULT: '#E8961C',
          dark: '#C4770F',
          light: '#FEF3C7',
        },
        slate: {
          DEFAULT: '#2D3748',
          light: '#718096',
        },
        surface: '#FFFFFF',
      },
      fontFamily: {
        heading: ['"DM Serif Display"', 'serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        pill: '24px',
      },
    },
  },
  plugins: [],
};
