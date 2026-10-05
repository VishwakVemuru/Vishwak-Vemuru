// Small finite-wing aerodynamics model behind the hero HUD and the 3D flow field.
// Deliberately simple, but real equations.

const DEG = Math.PI / 180;

// A high-aspect-ratio wing of the kind high-altitude aircraft like the Global Hawk
// use. Representative numbers, not a published spec for any one aircraft.
export const WING = (() => {
  const AR = 25;
  const e = 0.9; // Oswald efficiency
  const a0 = 2 * Math.PI; // thin-airfoil lift slope, per radian
  const a = a0 / (1 + a0 / (Math.PI * e * AR)); // finite-wing correction
  return { AR, e, a, alpha0: -2, alphaStall: 13, cd0: 0.018 };
})();

export function liftCoefficient(alphaDeg) {
  const { a, alpha0, alphaStall } = WING;
  const linear = (al) => a * (al - alpha0) * DEG;
  if (alphaDeg <= alphaStall) return linear(alphaDeg);
  const clMax = linear(alphaStall);
  // Smooth post-stall drop towards ~60 % of CLmax.
  return clMax * (1 - 0.4 * (1 - Math.exp(-(alphaDeg - alphaStall) / 2.5)));
}

export function dragCoefficient(alphaDeg) {
  const { AR, e, cd0, alphaStall } = WING;
  const cl = liftCoefficient(alphaDeg);
  const separation = alphaDeg > alphaStall ? 0.018 * (alphaDeg - alphaStall) : 0;
  return cd0 + (cl * cl) / (Math.PI * e * AR) + separation;
}

export function aeroState(alphaDeg) {
  const cl = liftCoefficient(alphaDeg);
  const cd = dragCoefficient(alphaDeg);
  return { alpha: alphaDeg, cl, cd, ld: cl / cd, stalled: alphaDeg > WING.alphaStall };
}
