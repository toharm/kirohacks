import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS v4 Configuration
 * 
 * Note: Tailwind CSS v4 uses CSS-based configuration via @theme directive.
 * The full design system (colors, fonts, spacing, shadows, animations) is defined
 * in src/index.css using the @theme block.
 * 
 * This config file is primarily used for:
 * - Content paths for class detection
 * - Plugin configuration (if needed)
 * 
 * Design tokens defined in src/index.css:
 * - Surface colors: base, raised, overlay, border, hover
 * - Fire spectrum: low, medium, high, extreme, active
 * - Route colors: safe, caution, danger
 * - Zone colors: safe, warning, critical
 * - Elevation colors: low, mid, high, peak
 * - Accent colors: primary, primary-hover, success, warning, error
 * - Font families: ui (Inter), mono (JetBrains Mono)
 * - Custom spacing: header, control-panel, results-panel
 * - Box shadows: glow-fire, glow-safe
 * - Animations: pulse-slow, fade-in, glow
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
