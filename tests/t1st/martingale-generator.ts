export interface MartingaleConfig {
  seed: number;
  p0: number;
  sigma: number;
  dt: number;
  n: number;
}

class SeededPRNG {
  private s: number;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x12345678;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextNormal(): number {
    let u1 = this.next();
    while (u1 <= 1e-15) {
      u1 = this.next();
    }
    const u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

export function generateMartingale(config: MartingaleConfig): number[] {
  const { seed, p0, sigma, dt, n } = config;
  const rng = new SeededPRNG(seed);
  const mu = -0.5 * sigma * sigma * dt;
  const std = sigma * Math.sqrt(dt);

  const prices: number[] = new Array(n + 1);
  prices[0] = p0;

  for (let i = 0; i < n; i++) {
    const z = rng.nextNormal();
    const r = mu + std * z;
    prices[i + 1] = prices[i] * Math.exp(r);
  }

  return prices;
}
