// Home page: the 3D backdrop and what drives it.

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// Shared with the 3D scene: angle of attack (degrees), scroll progress (0 top → 1 bottom), pointer
const state = { alpha: 5, s: 0, px: 0, py: 0 };
let scene = null;
const invalidate = () => scene && scene.invalidate();

/* ───────── The wing pitches with the pointer (or gently by itself on touch screens) ───────── */
const setAlpha = (a) => {
  state.alpha = Math.min(16, Math.max(-2, a));
  invalidate();
};

const heroEl = document.querySelector('.hero');
window.addEventListener('pointermove', (e) => {
  state.px = (e.clientX / innerWidth) * 2 - 1;
  state.py = (e.clientY / innerHeight) * 2 - 1;
  if (!finePointer) return;
  // Only the open sky steers the wing, not the buttons or header
  if (scrollY > innerHeight * 0.5 || e.target.closest('a, button, .nav')) return;
  const rect = heroEl.getBoundingClientRect();
  const v = 1 - (e.clientY - rect.top) / rect.height; // 0 bottom → 1 top
  setAlpha(-1 + v * 15);
}, { passive: true });

if (!finePointer && !reducedMotion) {
  const t0 = performance.now();
  const breathe = () => {
    if (scrollY < innerHeight) setAlpha(6 + 5 * Math.sin((performance.now() - t0) / 1600));
    setTimeout(breathe, 150);
  };
  setTimeout(breathe, 1500);
}

/* ───────── Scroll progress drives the scene and the sky tint ───────── */
const SKY = {
  dark: { top: ['0a1a33', '03050b'], mid: ['133056', '060a14'], glow: '255,110,50', glowA: 0.2 },
  light: { top: ['c9dcf0', 'bcd1e9'], mid: ['eef4fa', 'd6e3f1'], glow: '255,160,90', glowA: 0.22 },
};
const lerp = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
};

function onScroll() {
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const s = Math.min(1, Math.max(0, scrollY / max));
  state.s = s;
  const k = Math.min(1, s / 0.75);
  const sky = SKY[root.dataset.theme === 'light' ? 'light' : 'dark'];
  root.style.setProperty('--sky-top', mixHex(sky.top[0], sky.top[1], k));
  root.style.setProperty('--sky-mid', mixHex(sky.mid[0], sky.mid[1], k));
  root.style.setProperty('--sky-glow', `rgba(${sky.glow},${(sky.glowA * (1 - Math.min(1, s / 0.45))).toFixed(3)})`);
  invalidate();
}
onScroll();
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);

document.addEventListener('themechange', (e) => {
  onScroll();
  if (scene) scene.setTheme(e.detail);
});

/* ───────── 3D scene (progressive: the page works without it) ───────── */
const saveData = navigator.connection && navigator.connection.saveData;
const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || innerWidth < 700;
if (saveData) {
  root.classList.add('no-webgl');
} else {
  import('./scene.js')
    .then(({ startScene }) => { scene = startScene(document.getElementById('sky'), state, { lowPower, reducedMotion, theme: root.dataset.theme }); })
    .catch((err) => { console.warn('3D scene unavailable:', err); root.classList.add('no-webgl'); });
}
