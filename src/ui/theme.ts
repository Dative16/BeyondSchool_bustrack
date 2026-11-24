// src/ui/theme.ts — design tokens taken from "Bus App — UI UX.html".
// RN note: there is no CSS. Styles are JS objects; shared values live here.
export const colors = {
  ground: '#ECECEE', // page background
  card: '#FFFFFF', // cards and sheets
  muted: '#F2F2F4', // secondary buttons, inner panels
  ink: '#000000', // text and primary buttons — driver mode wants true black
  secondary: '#6B6B76', // quiet text
  accent: '#22C55E', // "boarded" confirmation only — not the route
  ok: '#15803D', // success text
  warn: '#B45309', // needs-attention text

  // Extra tokens used by the map-style responsive screens.
  paper: '#E6E6EB', // map background (light, milky)
  line: '#DCDCE2', // dividers and upcoming dots
  chip: '#F7F7F9', // inner panels on top of the map
  route: '#1A73E8', // normal Google-blue road route and drop markers
  routeSoft: 'rgba(26, 115, 232, 0.20)', // halo around the next drop point
  accentSoft: 'rgba(34, 197, 94, 0.20)', // kept for boarded chips
  warningChip: '#FEF3C7', // "hayupo" chip
  warningInk: '#78350F',

  // Driver-mode overlays: a dark, high-contrast banner like Google Maps'
  // navigation header, sitting above the normal-coloured map.
  banner: '#0B3B3C',
  bannerSoft: '#125A5B',
  bannerInk: '#FFFFFF',
  bannerMuted: 'rgba(255, 255, 255, 0.72)',
};

// Layout breakpoints. Design mock-ups are 960x600 (tablet) and 390x844 (phone).
export const layout = {
  tabletWidth: 700, // >= this uses the side-panel layout
  panelWidth: 340,
  gutter: 12,
};
