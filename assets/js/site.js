// Shared by every page: theme toggle, the phone menu and the contact form.
import './theme.js';

/* ───────── Phone menu ───────── */
const menuBtn = document.querySelector('.menu-btn');
const menu = document.getElementById('menu');
if (menuBtn && menu) {
  const setOpen = (open) => {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? 'Close' : 'Menu';
    document.body.style.overflow = open ? 'hidden' : '';
    if (window.lenis) open ? window.lenis.stop() : window.lenis.start();
    if (open) {
      menu.querySelector('a').focus();
      if (window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.gsap.from(menu.querySelectorAll('a'), { yPercent: 60, opacity: 0, stagger: 0.06, duration: 0.7, ease: 'expo.out' });
      }
    }
  };
  menuBtn.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setOpen(false); menuBtn.focus(); }
  });
  matchMedia('(min-width: 761px)').addEventListener('change', (e) => { if (e.matches && !menu.hidden) setOpen(false); });
}

/* ───────── Contact form: Netlify Forms, submitted in place ───────── */
for (const form of document.querySelectorAll('form[name="contact"]')) {
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
      status.textContent = 'Message received. I\'ll reply by email.';
    } catch {
      status.innerHTML = 'That didn\'t send. Please email <a href="mailto:vishwakvemuru4u@gmail.com">vishwakvemuru4u@gmail.com</a> instead.';
    }
  });
}
