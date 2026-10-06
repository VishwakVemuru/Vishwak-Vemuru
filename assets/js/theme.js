// Light/dark toggle. The new theme is revealed by a circle that grows out of the
// toggle, so its curved edge sweeps across the page instead of everything
// flipping at once. Falls back to an instant switch without View Transitions or
// when reduced motion is requested.
const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function label(btn) {
  btn.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

function apply(theme, btn) {
  root.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* storage unavailable: theme lasts this visit */ }
  label(btn);
  document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

for (const btn of document.querySelectorAll('.theme-toggle')) {
  label(btn);
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || reducedMotion) return apply(next, btn);

    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    // Marks this transition as the theme sweep, so the page-navigation animation stays out of it
    root.classList.add('theme-vt');
    let vt;
    try {
      vt = document.startViewTransition({ update: () => apply(next, btn), types: ['theme'] });
    } catch {
      vt = document.startViewTransition(() => apply(next, btn));
    }
    vt.finished.finally(() => root.classList.remove('theme-vt'));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 1100, easing: 'cubic-bezier(.7, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' }
      );
    });
  });
}
