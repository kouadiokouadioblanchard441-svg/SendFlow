/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#2c2539',
    tint: '#6334c4',

    // Core surfaces
    background: '#f8f5ff',
    foreground: '#2c2539',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#2c2539',

    // Primary action color (buttons, links, active states)
    primary: '#6334c4',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#f0ebfb',
    secondaryForeground: '#3d2a61',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#f0edf5',
    mutedForeground: '#776e82',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f3c94f',
    accentForeground: '#2c2539',

    // Destructive actions (delete, error states)
    destructive: '#d94e63',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#e2dced',
    input: '#d8d0e5',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
