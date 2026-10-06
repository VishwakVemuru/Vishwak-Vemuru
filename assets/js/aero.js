// Finite-wing numbers behind the hero's 3D flow field.

// A high-aspect-ratio wing of the kind high-altitude aircraft like the Global Hawk
// use. Representative numbers, not a published spec for any one aircraft.
export const WING = (() => {
  const AR = 25;
  const e = 0.9; // Oswald efficiency
  const a0 = 2 * Math.PI; // thin-airfoil lift slope, per radian
  const a = a0 / (1 + a0 / (Math.PI * e * AR)); // finite-wing correction
  return { AR, e, a, alpha0: -2, alphaStall: 13, cd0: 0.018 };
})();
