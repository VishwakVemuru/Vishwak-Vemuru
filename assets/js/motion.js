// Scroll motion: Lenis smooth scrolling + GSAP SplitText/ScrollTrigger text reveals.
//   data-split="chars"        headings: characters rise out of a line mask
//   data-split="lines"        paragraphs: lines slide up out of a mask, staggered
//   data-split="words-scrub"  statement: words light up as you scroll through
//   data-reveal="up"          blocks rise and fade in
//   data-reveal="image"       screenshots unclip and settle from a zoom
//   data-intro                plays on load instead of on scroll
// Nothing here runs with reduced motion, and the page stays readable without it.
(function () {
  const root = document.documentElement;
  const done = () => root.classList.remove('motion-pending');
  if (!root.classList.contains('motion') || !window.gsap || !window.ScrollTrigger || !window.SplitText) return done();

  const { gsap, ScrollTrigger, SplitText } = window;
  gsap.registerPlugin(ScrollTrigger, SplitText);

  if (window.Lenis) {
    const lenis = new window.Lenis({ autoRaf: false, lerp: 0.1, anchors: true });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const onScrollIn = (el, start = 'top 88%') => (el.hasAttribute('data-intro') ? undefined : { trigger: el, start, once: true });
  const ease = 'expo.out';

  function init() {
    // Headings: characters rise and un-tilt out of a mask, line by line
    document.querySelectorAll('[data-split="chars"]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines,words,chars', mask: 'lines', linesClass: 'split-mask', wordsClass: 'split-word', autoSplit: true,
        onSplit(self) {
          if (el.dataset.played) return;
          return gsap.from(self.chars, {
            yPercent: 115, rotateX: -70, opacity: 0, transformOrigin: '50% 100%',
            duration: 1.25, ease, stagger: el.hasAttribute('data-intro') ? 0.035 : 0.018,
            delay: el.hasAttribute('data-intro') ? 0.15 : 0,
            scrollTrigger: onScrollIn(el), onComplete: () => { el.dataset.played = '1'; },
          });
        },
      });
    });

    // Paragraphs: lines slide up from behind a mask
    document.querySelectorAll('[data-split="lines"]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines', mask: 'lines', linesClass: 'split-mask', autoSplit: true,
        onSplit(self) {
          if (el.dataset.played) return;
          const intro = !!el.closest('.hero, .page-hero');
          return gsap.from(self.lines, {
            yPercent: 105, duration: 1.1, ease, stagger: 0.09, delay: intro ? 0.45 : 0,
            scrollTrigger: intro ? undefined : { trigger: el, start: 'top 90%', once: true },
            onComplete: () => { el.dataset.played = '1'; },
          });
        },
      });
    });

    // Statement: each word lights up as it scrolls through the viewport
    document.querySelectorAll('[data-split="words-scrub"]').forEach((el) => {
      const split = SplitText.create(el, { type: 'words' });
      gsap.fromTo(split.words, { opacity: 0.14 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 45%', scrub: 0.4 },
      });
    });

    // Blocks rise in
    gsap.utils.toArray('[data-reveal="up"]').forEach((el) => {
      const intro = !!el.closest('.hero, .page-hero');
      gsap.from(el, {
        y: 56, opacity: 0, duration: 1.2, ease, delay: intro ? 0.6 : 0,
        scrollTrigger: intro ? undefined : { trigger: el, start: 'top 92%', once: true },
      });
    });

    // Screenshots: unclip from the middle while the image settles from a zoom
    gsap.utils.toArray('[data-reveal="image"]').forEach((el) => {
      const img = el.querySelector('img');
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      tl.fromTo(el, { clipPath: 'inset(14% 8% 14% 8%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' });
      if (img) tl.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.8, ease }, 0);
    });

    // Kinetic strip drifts sideways with scroll
    gsap.utils.toArray('.marquee-track').forEach((track) => {
      gsap.fromTo(track, { xPercent: 0 }, {
        xPercent: -35, ease: 'none',
        scrollTrigger: { trigger: track.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    });

    // Page titles drift slightly slower than the page
    gsap.utils.toArray('.page-title').forEach((el) => {
      gsap.to(el, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true } });
    });

    // The space backdrop moves at a fraction of scroll speed
    const space = document.querySelector('.space-bg');
    if (space) {
      gsap.fromTo(space, { yPercent: -2, scale: 1.1 }, {
        yPercent: 2, scale: 1.02, ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: true },
      });
    }

    done();
    ScrollTrigger.refresh();
  }

  // Line breaks depend on the web fonts, so split once they're in (or after a short wait)
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1200))]).then(init, init);
})();
