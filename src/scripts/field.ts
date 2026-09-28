// Lightweight 2D particle field behind the inner-page headers.
// Particles start noisy and settle into a calm drift (a small nod to the hero).
interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tone: 0 | 1 | 2;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function palette() {
  const cs = getComputedStyle(document.documentElement);
  return [cs.getPropertyValue('--text-3'), cs.getPropertyValue('--accent'), cs.getPropertyValue('--accent-2')].map((c) =>
    c.trim(),
  );
}

function start(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let w = 0;
  let h = 0;
  let dots: Dot[] = [];
  let colors = palette();
  let running = false;
  const born = performance.now();
  const mouse = { x: -1e4, y: -1e4 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(700, (w * h) / 1600));
    dots = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0,
      vy: 0,
      r: 0.6 + Math.random() * 1.3,
      tone: Math.random() < 0.1 ? 1 : Math.random() < 0.06 ? 2 : 0,
    }));
    if (!running) draw();
  }

  function step(t: number) {
    const calm = reduceMotion ? 1 : Math.min(1, (performance.now() - born) / 1600);
    const jitter = (1 - calm) * 2.5;
    for (const d of dots) {
      const a = Math.sin(d.x * 0.004 + t * 0.2) + Math.cos(d.y * 0.005 - t * 0.15);
      d.vx += Math.cos(a * 2) * 0.012 + (Math.random() - 0.5) * jitter;
      d.vy += Math.sin(a * 2) * 0.012 + (Math.random() - 0.5) * jitter;
      const dx = d.x - mouse.x;
      const dy = d.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 14000) {
        const f = ((1 - d2 / 14000) * 0.5) / Math.sqrt(d2 + 1);
        d.vx += dx * f;
        d.vy += dy * f;
      }
      d.vx *= 0.92;
      d.vy *= 0.92;
      d.x = (d.x + d.vx + w) % w;
      d.y = (d.y + d.vy + h) % h;
    }
  }

  function draw() {
    ctx!.clearRect(0, 0, w, h);
    const alpha = [0.45, 0.8, 0.8];
    for (let tone = 0; tone < 3; tone++) {
      ctx!.globalAlpha = alpha[tone];
      ctx!.fillStyle = colors[tone];
      ctx!.beginPath();
      for (const d of dots) {
        if (d.tone !== tone) continue;
        ctx!.moveTo(d.x + d.r, d.y);
        ctx!.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      }
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  function frame(now: number) {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = now / 1000;
    step(t);
    draw();
  }

  function setRunning(on: boolean) {
    if (reduceMotion || on === running) return;
    running = on;
    if (on) requestAnimationFrame(frame);
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    },
    { passive: true },
  );
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((entries) => setRunning(entries[0]?.isIntersecting ?? false)).observe(canvas);
  new MutationObserver(() => {
    colors = palette();
    if (!running) draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  resize();
}

document.querySelectorAll<HTMLCanvasElement>('canvas[data-field]').forEach(start);
