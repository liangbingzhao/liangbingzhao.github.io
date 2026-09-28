// Loads the three.js hero after the page text has painted.
// If WebGL is missing or anything fails, the plain-text hero stays visible.
const root = document.documentElement;
const stage = document.querySelector<HTMLElement>('[data-hero-stage]');

function disable(err: unknown) {
  console.warn('[hero] 3D scene disabled:', err);
  root.classList.remove('has-3d');
}

async function start() {
  if (!stage || !root.classList.contains('has-3d')) return;
  try {
    const { createHero } = await import('./scene');
    createHero(stage, {
      words: (stage.dataset.words ?? '').split(/\s+/).filter(Boolean),
      content: document.querySelector<HTMLElement>('[data-hero-content]'),
      status: document.querySelector<HTMLElement>('[data-hero-status] span'),
      ballButton: document.querySelector<HTMLButtonElement>('[data-hero-ball]'),
      regenButton: document.querySelector<HTMLButtonElement>('[data-hero-regen]'),
    });
  } catch (err) {
    disable(err);
  }
}

if (stage) {
  if ('requestIdleCallback' in window) requestIdleCallback(() => start(), { timeout: 500 });
  else setTimeout(start, 50);
}
