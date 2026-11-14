import * as THREE from 'three';
import { loadJson } from '../lib/data';
import type { District } from '../engine/types';

/** Equirectangular projection centred on India, x = east, y = north (world units). */
export const LON0 = 82.8;
export const LAT0 = 22.2;
export const SCALE = 0.36;
const KX = Math.cos((LAT0 * Math.PI) / 180);

export const project = (lon: number, lat: number): [number, number] => [(lon - LON0) * KX * SCALE, (lat - LAT0) * SCALE];

/** Ground-plane world position (x east, z south, y up). */
export function toWorld(lon: number, lat: number, y = 0): THREE.Vector3 {
  const [x, py] = project(lon, lat);
  return new THREE.Vector3(x, y, -py);
}
export const districtWorld = (d: Pick<District, 'lon' | 'lat'>, y = 0) => toWorld(d.lon, d.lat, y);

type Ring = number[][];
interface Feature {
  type: 'Feature';
  properties: { kind: 'country' | 'state'; name: string };
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
}
interface FC {
  type: 'FeatureCollection';
  features: Feature[];
}

export interface BoundaryGeo {
  shapes: THREE.Shape[];
  /** pairs of xy points for LineSegments: state borders */
  stateSegments: Float32Array;
  /** pairs of xy points: country outline */
  countrySegments: Float32Array;
  /** projected polygons for the 2D SVG fallback */
  countryRings: [number, number][][];
  states: { name: string; rings: [number, number][][] }[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

const polys = (f: Feature): Ring[][] => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
const projRing = (r: Ring): [number, number][] => r.map(([lon, lat]) => project(lon, lat));

function segments(rings: [number, number][][]): Float32Array {
  let n = 0;
  for (const r of rings) n += r.length - 1;
  const out = new Float32Array(n * 6);
  let i = 0;
  for (const r of rings) {
    for (let k = 0; k < r.length - 1; k++) {
      out[i++] = r[k][0];
      out[i++] = r[k][1];
      out[i++] = 0;
      out[i++] = r[k + 1][0];
      out[i++] = r[k + 1][1];
      out[i++] = 0;
    }
  }
  return out;
}

let cached: Promise<BoundaryGeo> | null = null;

/** Loads india-boundary.geojson (official Survey of India outline, see README) and builds geometry inputs. */
export function loadBoundary(): Promise<BoundaryGeo> {
  if (!cached) {
    cached = loadJson<FC>('india-boundary.geojson').then((fc) => {
      const shapes: THREE.Shape[] = [];
      const countryRings: [number, number][][] = [];
      const states: BoundaryGeo['states'] = [];
      const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      for (const f of fc.features) {
        if (f.properties.kind === 'country') {
          for (const poly of polys(f)) {
            const [outer, ...holes] = poly.map(projRing);
            for (const [x, y] of outer) {
              b.minX = Math.min(b.minX, x);
              b.maxX = Math.max(b.maxX, x);
              b.minY = Math.min(b.minY, y);
              b.maxY = Math.max(b.maxY, y);
            }
            const s = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
            for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
            shapes.push(s);
            countryRings.push(outer, ...holes);
          }
        } else {
          const rings = polys(f).flatMap((p) => p.map(projRing));
          states.push({ name: f.properties.name, rings });
        }
      }
      return {
        shapes,
        stateSegments: segments(states.flatMap((s) => s.rings)),
        countrySegments: segments(countryRings),
        countryRings,
        states,
        bounds: b,
      };
    });
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

/** SVG path for projected rings (y flipped for screen space). */
export function ringsToPath(rings: [number, number][][], k = 1): string {
  return rings
    .map((r) => 'M' + r.map(([x, y]) => `${(x * k).toFixed(2)},${(-y * k).toFixed(2)}`).join('L') + 'Z')
    .join('');
}

export const demandHeight = (mwh: number, min = 0.25, span = 2.2) => {
  const l = Math.log10(Math.max(1, mwh));
  return min + span * Math.min(1, Math.max(0, (l - 4.3) / 3.3));
};
