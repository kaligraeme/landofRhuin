import metrics from './equipment/metrics.json';

const urls = import.meta.glob<string>('./equipment/*.png', {
  eager: true, import: 'default', query: '?url',
});

/** Equipment art uses the same world scale as the 92-pixel hero bodies. */
export const WEAPON_PIXEL = 2.08 / 92;

interface WeaponMetrics {
  w: number;
  h: number;
  gx: number;
  gy: number;
  glow?: { x: number; y: number; r: number; color: string };
}

export interface WeaponArt extends WeaponMetrics {
  url: string;
}

const catalog: Readonly<Record<string, WeaponMetrics>> = metrics;
export const WEAPON_IDS = Object.keys(catalog).filter((id) => id !== 'shield');

export function equipmentArt(id: string): WeaponArt | null {
  const url = urls[`./equipment/${id}.png`];
  const art = catalog[id];
  return url && art ? { ...art, url } : null;
}
