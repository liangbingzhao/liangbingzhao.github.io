# liangbingzhao.github.io

Personal homepage of Liangbing (Liam) Zhao — <https://liangbingzhao.github.io>

Built with [Astro](https://astro.build) and [three.js](https://threejs.org). The hero is a small
interactive scene that follows a diffusion model: particles are denoised from Gaussian noise into
the name (`t = 1000 → 0`), then the letters turn into rigid bodies ([cannon-es](https://github.com/pmndrs/cannon-es))
that you can push around or drop balls on. "re-generate" adds the noise back and samples again.
Light and dark themes are both supported. The colour scheme is `palette` in `src/site.config.ts`
(`velvet` in use, `spring` as an alternative; colours live in `src/scripts/hero/palettes.ts` and
`src/styles/global.css`). In `npm run dev` a small switcher in the bottom-left corner compares them.

## Editing content

Everything you normally edit lives in `src/data/`:

| What | Where |
| --- | --- |
| Bio, position, research interests, optional notice | `src/data/about.md` |
| Publications | `src/data/papers.bib` — same fields as al-folio (`selected`, `preview`, `html`, `pdf`, `code`, `abbr`, …) |
| News | `src/data/news/*.md` — one file per item, with a `date` |
| CV | `src/data/cv.yml` (al-folio format) and `public/assets/pdf/visioncair_cv.pdf` |
| Name, email, social links, navigation | `src/site.config.ts` |
| Profile photo, publication previews | `src/assets/`, `src/assets/publication_preview/` |

## Local development

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev     # http://localhost:4321
npm run build   # static site in dist/
```

## Deployment

`.github/workflows/deploy.yml` builds the site and publishes `dist/` to a branch that GitHub Pages
can serve (Settings → Pages → Deploy from a branch):

- push to `master` → `gh-pages`
- push to `redesign-3d` → `gh-pages-redesign`

Pull requests only run the build.

## Hero font

The 3D letters use Space Grotesk Bold (SIL Open Font License 1.1).
`src/scripts/hero/font.typeface.json` is generated with `node scripts/build-hero-font.mjs`.
