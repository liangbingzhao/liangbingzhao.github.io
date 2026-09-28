// Colour schemes for the 3D hero. Each palette has a light and a dark look; the page colours
// that go with it live in src/styles/global.css under :root[data-palette='…'].
//
//   spring  soft pastel clay with in-letter gradients (after Leonardoworx, "Spring Collection 26")
//   klein   pastel pearl letters on an electric-blue stage (pastel-on-bold 3D type)
//   velvet  mid-century plush: burnt orange, mustard, teal, navy, dusty rose
export type ThemeName = 'light' | 'dark';
export type PaletteName = 'spring' | 'klein' | 'velvet';

export interface Look {
  /** Letter colours, cycled along the name. Each is [bottom, top] of a soft vertical gradient. */
  letters: [string, string][];
  roughness: number;
  clearcoat: number;
  coatRoughness: number;
  sheen: number;
  sheenRoughness: number;
  /** 0: white sheen, 1: sheen tinted with the letter colour (reads as velvet). */
  sheenTint: number;
  iridescence: number;
  letterEnv: number;
  env: number;
  hemi: number;
  ground: number;
  key: number;
  rim: number;
  rimColor: number;
  shadow: number;
  /** Particles take their letter's colour times this gain (lower for additive blending). */
  particleGain: number;
  additive: boolean;
  pointSize: number;
  ball: string;
  pusher: string;
}

const SPRING: [string, string][] = [
  ['#5b7cf0', '#a996f2'], // periwinkle → lilac
  ['#ff6a4a', '#ffbd4a'], // coral → butter
  ['#34b89b', '#7cc6ee'], // mint → sky
  ['#9b76ea', '#f09abb'], // lilac → pink
  ['#f2b02e', '#ff8f68'], // butter → peach
];

const PEARLS: [string, string][] = [
  ['#f6f3ff', '#f6f3ff'],
  ['#ffd4e5', '#ffd4e5'],
  ['#ffe2cc', '#ffe2cc'],
  ['#cff4e8', '#cff4e8'],
  ['#dcd3ff', '#dcd3ff'],
];

const solid = (hex: string): [string, string] => [hex, hex];

export const PALETTES: Record<PaletteName, Record<ThemeName, Look>> = {
  spring: {
    light: {
      letters: SPRING,
      roughness: 0.5,
      clearcoat: 0.08,
      coatRoughness: 0.4,
      sheen: 0.3,
      sheenRoughness: 0.6,
      sheenTint: 0,
      iridescence: 0,
      letterEnv: 1,
      env: 0.8,
      hemi: 0.45,
      ground: 0xe6e3ee,
      key: 2.2,
      rim: 0,
      rimColor: 0xffffff,
      shadow: 0.13,
      particleGain: 1,
      additive: false,
      pointSize: 0.034,
      ball: '#fbf8f2',
      pusher: '#4b63e6',
    },
    dark: {
      letters: SPRING,
      roughness: 0.5,
      clearcoat: 0.12,
      coatRoughness: 0.35,
      sheen: 0.5,
      sheenRoughness: 0.55,
      sheenTint: 0,
      iridescence: 0,
      letterEnv: 1,
      env: 0.75,
      hemi: 0.35,
      ground: 0x2a2d3a,
      key: 1.7,
      rim: 10,
      rimColor: 0xd6dcff,
      shadow: 0.38,
      particleGain: 0.62,
      additive: true,
      pointSize: 0.03,
      ball: '#2a2d35',
      pusher: '#8ea2ff',
    },
  },
  klein: {
    light: {
      letters: PEARLS,
      roughness: 0.22,
      clearcoat: 1,
      coatRoughness: 0.1,
      sheen: 0,
      sheenRoughness: 0.5,
      sheenTint: 0,
      iridescence: 0.75,
      letterEnv: 1,
      env: 0.95,
      hemi: 0.55,
      ground: 0x2238e0,
      key: 1.8,
      rim: 16,
      rimColor: 0xb8c4ff,
      shadow: 0.32,
      particleGain: 0.75,
      additive: true,
      pointSize: 0.03,
      ball: '#101c99',
      pusher: '#ffffff',
    },
    dark: {
      letters: PEARLS,
      roughness: 0.22,
      clearcoat: 1,
      coatRoughness: 0.1,
      sheen: 0,
      sheenRoughness: 0.5,
      sheenTint: 0,
      iridescence: 0.75,
      letterEnv: 1,
      env: 0.8,
      hemi: 0.4,
      ground: 0x101a80,
      key: 1.6,
      rim: 18,
      rimColor: 0xb8c4ff,
      shadow: 0.4,
      particleGain: 0.7,
      additive: true,
      pointSize: 0.03,
      ball: '#0b1466',
      pusher: '#ffffff',
    },
  },
  velvet: {
    light: {
      letters: ['#d5602a', '#e2a52b', '#1f7a78', '#2c4a7a', '#d98b8b'].map(solid),
      roughness: 0.85,
      clearcoat: 0,
      coatRoughness: 0.5,
      sheen: 1,
      sheenRoughness: 0.32,
      sheenTint: 1,
      iridescence: 0,
      letterEnv: 0.9,
      env: 0.9,
      hemi: 0.55,
      ground: 0xe7e0d4,
      key: 2.2,
      rim: 0,
      rimColor: 0xffffff,
      shadow: 0.16,
      particleGain: 1,
      additive: false,
      pointSize: 0.034,
      ball: '#f4f0e8',
      pusher: '#c4532a',
    },
    dark: {
      letters: ['#e6703a', '#edb43c', '#2e9894', '#4a6ca6', '#e6a0a0'].map(solid),
      roughness: 0.82,
      clearcoat: 0,
      coatRoughness: 0.5,
      sheen: 1,
      sheenRoughness: 0.3,
      sheenTint: 1,
      iridescence: 0,
      letterEnv: 0.9,
      env: 0.65,
      hemi: 0.35,
      ground: 0x2b2622,
      key: 1.8,
      rim: 8,
      rimColor: 0xffe0c4,
      shadow: 0.42,
      particleGain: 0.6,
      additive: true,
      pointSize: 0.03,
      ball: '#2b2926',
      pusher: '#ee7a45',
    },
  },
};

export const DEFAULT_PALETTE: PaletteName = 'spring';

export function isPalette(value: unknown): value is PaletteName {
  return typeof value === 'string' && value in PALETTES;
}
