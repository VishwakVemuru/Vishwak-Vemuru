import { aeroState, isa, layerName, liftFigPoint } from './aero.js';
import './theme.js';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
if (!reducedMotion) root.classList.add('motion');

// Shared with the 3D scene
const state = { alpha: 5, s: 0, px: 0, py: 0 };
let scene = null;
const invalidate = () => scene && scene.invalidate();

/* ───────── Hero HUD: angle of attack → C_L, C_D, L/D ───────── */
const slider = document.getElementById('alpha');
const hud = Object.fromEntries([...document.querySelectorAll('[data-hud]')].map((el) => [el.dataset.hud, el]));
const liftDot = document.querySelector('.lift-dot');
let userSetAlpha = false;

function setAlpha(a, fromSlider = false) {
  a = Math.round(Math.min(20, Math.max(-4, a)) * 2) / 2;
  if (a === state.alpha && !fromSlider) return;
  state.alpha = a;
  if (!fromSlider) slider.value = a;
  const r = aeroState(a);
  hud.alpha.textContent = `${a.toFixed(1)}°`;
  hud.cl.textContent = r.cl.toFixed(2);
  hud.cd.textContent = r.cd.toFixed(3);
  hud.ld.textContent = r.ld.toFixed(1);
  hud.stall.hidden = !r.stalled;
  const [x, y] = liftFigPoint(a);
  liftDot.setAttribute('cx', x.toFixed(1));
  liftDot.setAttribute('cy', y.toFixed(1));
  invalidate();
}
slider.addEventListener('input', () => { userSetAlpha = true; setAlpha(parseFloat(slider.value), true); });
setAlpha(5);

const heroEl = document.querySelector('.hero');
window.addEventListener('pointermove', (e) => {
  state.px = (e.clientX / innerWidth) * 2 - 1;
  state.py = (e.clientY / innerHeight) * 2 - 1;
  if (!finePointer || userSetAlpha) return;
  if (scrollY > innerHeight * 0.5 || e.target.closest('.hud, .nav')) return;
  const rect = heroEl.getBoundingClientRect();
  const v = 1 - (e.clientY - rect.top) / rect.height; // 0 bottom → 1 top
  setAlpha(-2 + v * 20);
}, { passive: true });

// Touch devices: let the wing breathe through its range until someone uses the slider
if (!finePointer && !reducedMotion) {
  const t0 = performance.now();
  const breathe = () => {
    if (userSetAlpha) return;
    if (scrollY < innerHeight) setAlpha(6 + 6 * Math.sin((performance.now() - t0) / 1600));
    setTimeout(breathe, 120);
  };
  setTimeout(breathe, 1200);
}

/* ───────── Altimeter: scroll → altitude (log-interpolated between sections) ───────── */
const sections = [...document.querySelectorAll('main > section[data-alt]')];
const LOG_TOP = Math.log(409);
const sOf = (km) => Math.log(1 + km) / LOG_TOP;
const altRead = {
  alt: document.querySelector('[data-alt-read]'),
  temp: document.querySelector('[data-temp]'),
  press: document.querySelector('[data-press]'),
  layer: document.querySelector('[data-layer]'),
};
const alti = document.querySelector('.alti');
const navLinks = [...document.querySelectorAll('.nav nav a')];
let anchors = [];

function measure() {
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  anchors = sections.map((sec, i) => ({
    y: i === 0 ? 0 : Math.min(sec.offsetTop - innerHeight * 0.4, maxScroll - (sections.length - 1 - i) * 2),
    s: sOf(parseFloat(sec.dataset.alt)),
    id: sec.id,
  }));
}

const SKY = {
  dark: { top: ['0a1a33', '03050b'], mid: ['133056', '060a14'], glow: '255,110,50', glowA: 0.22 },
  light: { top: ['c4d9ef', '86a9d1'], mid: ['ecf3f9', 'b3cae3'], glow: '255,160,90', glowA: 0.28 },
};
const lerp = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
};

function onScroll() {
  const y = scrollY;
  let i = 0;
  while (i < anchors.length - 2 && y > anchors[i + 1].y) i++;
  const a = anchors[i], b = anchors[i + 1];
  const t = Math.min(1, Math.max(0, (y - a.y) / Math.max(1, b.y - a.y)));
  const s = lerp(a.s, b.s, t);
  state.s = s;
  const km = Math.exp(s * LOG_TOP) - 1;

  alti.style.setProperty('--alt-frac', ((i + t) / (anchors.length - 1)).toFixed(4));
  altRead.alt.textContent = `${km < 100 ? km.toFixed(1) : Math.round(km)} km`;
  const air = isa(km * 1000);
  altRead.temp.textContent = air ? `${(air.T - 273.15).toFixed(1)} °C` : 'n/a';
  altRead.press.textContent = air ? formatPressure(air.p) : '≈ 0';
  altRead.layer.textContent = layerName(km);

  // Sky deepens with altitude: dusk blue → space at night, pale → deep blue by day
  const k = Math.min(1, s / 0.75);
  const sky = SKY[root.dataset.theme === 'light' ? 'light' : 'dark'];
  root.style.setProperty('--sky-top', mixHex(sky.top[0], sky.top[1], k));
  root.style.setProperty('--sky-mid', mixHex(sky.mid[0], sky.mid[1], k));
  root.style.setProperty('--sky-glow', `rgba(${sky.glow},${(sky.glowA * (1 - Math.min(1, s / 0.45))).toFixed(3)})`);

  // Current section in the nav
  let current = anchors[0].id;
  for (const an of anchors) if (y >= an.y - 4) current = an.id;
  navLinks.forEach((l) => (l.hash === `#${current}` ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
  invalidate();
}

function formatPressure(p) {
  if (p >= 1000) return `${(p / 1000).toFixed(1)} kPa`;
  if (p >= 1) return `${p.toFixed(1)} Pa`;
  return `${p.toFixed(2)} Pa`;
}

measure();
onScroll();
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { measure(); onScroll(); });
addEventListener('load', () => { measure(); onScroll(); });

/* ───────── Reveal on scroll ───────── */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('.reveal').forEach((el) => (reducedMotion ? el.classList.add('in') : io.observe(el)));

/* ───────── Project plates tilt in 3D under the pointer ───────── */
if (finePointer && !reducedMotion) {
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 6).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg'); });
  });
}

/* ───────── Exorbit figure: Kepler's equation, equal areas in equal times ───────── */
const orbitFig = document.querySelector('.orbit-fig');
if (orbitFig) {
  const ORB = { cx: 140, cy: 95, a: 118, b: 94.4, e: 0.6, slices: 12 };
  const fx = ORB.cx + ORB.a * ORB.e, fy = ORB.cy;
  const eccentric = (M) => { let E = M; for (let k = 0; k < 8; k++) E -= (E - ORB.e * Math.sin(E) - M) / (1 - ORB.e * Math.cos(E)); return E; };
  const at = (E) => [ORB.cx + ORB.a * Math.cos(E), ORB.cy - ORB.b * Math.sin(E)];
  const sweeps = orbitFig.querySelector('.orbit-sweeps');
  const NS = 'http://www.w3.org/2000/svg';
  const wedges = [];
  for (let k = 0; k < ORB.slices; k++) {
    const pts = [];
    for (let j = 0; j <= 16; j++) pts.push(at(eccentric(((k + j / 16) / ORB.slices) * Math.PI * 2)));
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${fx} ${fy} L${pts.map((q) => q.map((v) => v.toFixed(1)).join(' ')).join(' L')} Z`);
    p.dataset.fill = k % 2 ? 'rgba(184,199,219,0.04)' : 'rgba(184,199,219,0.09)';
    p.setAttribute('fill', p.dataset.fill);
    sweeps.appendChild(p);
    wedges.push(p);
  }
  const sat = orbitFig.querySelector('.orbit-sat');
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(orbitFig);
  const PERIOD = 9000;
  const tick = (now) => {
    if (visible) {
      const M = ((now % PERIOD) / PERIOD) * Math.PI * 2;
      const [x, y] = at(eccentric(M));
      sat.setAttribute('cx', x.toFixed(2));
      sat.setAttribute('cy', y.toFixed(2));
      const cur = Math.floor((M / (Math.PI * 2)) * ORB.slices);
      wedges.forEach((w, k) => w.setAttribute('fill', k === cur ? 'rgba(255,90,31,0.42)' : w.dataset.fill));
    }
    requestAnimationFrame(tick);
  };
  if (!reducedMotion) requestAnimationFrame(tick);
}

/* ───────── CricScore figure: an over, ball by ball ───────── */
const over = document.querySelector('.over');
if (over && !reducedMotion) {
  const balls = [...over.querySelectorAll('.over-balls li')];
  const runs = [1, 4, 1, 6, 0, 2, 1];
  const total = over.querySelector('[data-over-total]');
  const flag = over.querySelector('[data-over-flag]');
  let n = 0;
  const step = () => {
    if (n === 0) balls.forEach((b) => b.classList.remove('on'));
    if (n < balls.length) {
      balls[n].classList.add('on');
      const sum = runs.slice(0, n + 1).reduce((a, b) => a + b, 0);
      total.textContent = `${sum} run${sum === 1 ? '' : 's'}`;
      flag.textContent = balls[n].classList.contains('nb') ? 'No-ball — next delivery is a free hit' : balls[n].classList.contains('fh') ? 'Free hit — six' : '';
      n++;
      setTimeout(step, 900);
    } else { n = 0; flag.textContent = 'Over complete'; setTimeout(step, 2600); }
  };
  new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); step(); } }).observe(over);
}

/* ───────── Contact form: Netlify Forms, submitted in place ───────── */
const form = document.querySelector('form[name="contact"]');
if (form) {
  const status = form.querySelector('.form-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Sending…';
    try {
      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = 'Message received — I\'ll reply by email.';
    } catch {
      status.innerHTML = 'That didn\'t send. Please email <a href="mailto:vishwakvemuru4u@gmail.com">vishwakvemuru4u@gmail.com</a> instead.';
    }
  });
}

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

document.addEventListener('themechange', (e) => {
  onScroll();
  if (scene) scene.setTheme(e.detail);
});
