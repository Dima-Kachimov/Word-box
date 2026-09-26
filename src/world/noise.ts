// Детермінований псевдо-шум (value noise + fbm) для генерації рельєфу/температури/вологості.

export function hash(x: number, y: number, s: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453123;
  return v - Math.floor(v);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export const rnd: () => number = Math.random;

/** Білінійний value-noise зі згладжуванням (smootherstep). */
export function vn(x: number, y: number, s: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(
    lerp(hash(x0, y0, s), hash(x0 + 1, y0, s), sx),
    lerp(hash(x0, y0 + 1, s), hash(x0 + 1, y0 + 1, s), sx),
    sy
  );
}

/** Фрактальний броунівський рух — сума октав value-noise. */
export function fbm(x: number, y: number, s: number, o: number): number {
  let t = 0, f = 1, a = 1, m = 0;
  for (let i = 0; i < o; i++) {
    t += vn(x * f, y * f, s + i * 17.3) * a;
    m += a; f *= 2.03; a *= 0.5;
  }
  return t / m;
}
