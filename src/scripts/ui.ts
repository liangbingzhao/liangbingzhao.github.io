// Site-wide behaviour: theme toggle, nav background, scroll reveal, card tilt.
const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
root.classList.add('ui-ready');

// Theme -----------------------------------------------------------------------
function storedTheme(): string | null {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}

document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* private mode: the choice just isn't remembered */
  }
  root.dataset.theme = next;
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const saved = storedTheme();
  if (saved !== 'light' && saved !== 'dark') root.dataset.theme = e.matches ? 'dark' : 'light';
});

// Nav gets a background once the page scrolls ---------------------------------
const nav = document.querySelector('[data-nav]');
const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Reveal on scroll ------------------------------------------------------------
const revealEls = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window && !reduceMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-in'));
}

// Subtle 3D tilt on publication cards -----------------------------------------
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.classList.add('is-tilting');
      el.style.setProperty('--rx', `${(-y * 3).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(x * 4).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
}
