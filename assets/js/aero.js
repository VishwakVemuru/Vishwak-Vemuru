// Small aerodynamics + atmosphere models shared by the hero HUD, the altimeter
// and the lift-curve figure. Deliberately simple, but real equations.

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

// 1976 US Standard Atmosphere (ISA) up to 86 km. Altitudes are geopotential.
const LAYERS = [
  // base altitude (m), base temperature (K), lapse rate (K/m)
  [0, 288.15, -0.0065],
  [11000, 216.65, 0],
  [20000, 216.65, 0.001],
  [32000, 228.65, 0.0028],
  [47000, 270.65, 0],
  [51000, 270.65, -0.0028],
  [71000, 214.65, -0.002],
  [84852, 186.946, 0],
];
const G0 = 9.80665, R = 287.053;
const BASE_P = (() => {
  const p = [101325];
  for (let i = 1; i < LAYERS.length; i++) p.push(pressureInLayer(i - 1, LAYERS[i][0], p[i - 1]));
  return p;
})();

function pressureInLayer(i, h, pBase) {
  const [hb, Tb, L] = LAYERS[i];
  if (L === 0) return pBase * Math.exp((-G0 * (h - hb)) / (R * Tb));
  const T = Tb + L * (h - hb);
  return pBase * Math.pow(T / Tb, -G0 / (L * R));
}

// Returns { T (K), p (Pa) } or null above the model's 86 km ceiling.
export function isa(altMeters) {
  if (altMeters > 86000) return null;
  let i = LAYERS.length - 1;
  while (i > 0 && altMeters < LAYERS[i][0]) i--;
  const [hb, Tb, L] = LAYERS[i];
  return { T: Tb + L * (altMeters - hb), p: pressureInLayer(i, altMeters, BASE_P[i]) };
}

export function layerName(altKm) {
  if (altKm < 11) return 'Troposphere';
  if (altKm < 50) return 'Stratosphere';
  if (altKm < 85) return 'Mesosphere';
  if (altKm < 97) return 'Thermosphere';
  if (altKm < 105) return 'Kármán line';
  if (altKm < 300) return 'Thermosphere';
  return 'Low Earth orbit';
}

// Maps a point on the lift curve into the project figure's 320 × 180 viewBox.
export const LIFT_FIG = { w: 320, h: 180, pad: 28, aMin: -4, aMax: 20, clMin: -0.4, clMax: 1.8 };
export function liftFigPoint(alphaDeg) {
  const f = LIFT_FIG;
  const x = f.pad + ((alphaDeg - f.aMin) / (f.aMax - f.aMin)) * (f.w - f.pad * 1.5);
  const y = f.h - f.pad - ((liftCoefficient(alphaDeg) - f.clMin) / (f.clMax - f.clMin)) * (f.h - f.pad * 1.6);
  return [x, y];
}
