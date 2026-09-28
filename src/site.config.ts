// Site-wide settings. Page content lives in src/data/.
export const site = {
  name: 'Liangbing (Liam) Zhao',
  shortName: 'Liam Zhao',
  // Words spelled out by the 3D letters in the hero (A–Z only).
  heroWords: ['LIANGBING', 'ZHAO'],
  // Colour scheme: 'spring' | 'velvet' (see src/scripts/hero/palettes.ts).
  palette: 'velvet',
  // Used to highlight your name in author lists.
  self: { first: 'Liangbing', last: 'Zhao' },
  description:
    'Liangbing (Liam) Zhao — PhD student at KAUST working on generative models and unified models.',
  url: 'https://liangbingzhao.github.io',
  email: 'zhaolbben@gmail.com',
  cvPdf: '/assets/pdf/visioncair_cv.pdf',
  contactNote: 'feel free to contact me!',
  socials: {
    github: 'liangbingzhao',
    scholar: '1xzCu0wAAAAJ',
    orcid: '0009-0006-7162-236X',
  },
  nav: [
    { href: '/', label: 'about' },
    { href: '/publications/', label: 'publications' },
    { href: '/cv/', label: 'cv' },
  ],
};
