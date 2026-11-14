import type { ThreeElements } from '@react-three/fiber';
import type * as THREE from 'three';

type V3 = [number, number, number];
/** Small helper: a mesh from a shared geometry + material with position/scale/rotation. */
export function Part({ g, m, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], ...rest }: { g: THREE.BufferGeometry; m: THREE.Material; p?: V3; s?: V3 | number; r?: V3 } & Omit<ThreeElements['mesh'], 'geometry' | 'material' | 'position' | 'scale' | 'rotation'>) {
  return <mesh geometry={g} material={m} position={p} scale={typeof s === 'number' ? [s, s, s] : s} rotation={r} castShadow receiveShadow {...rest} />;
}
export type ModelProps = { position?: V3; rotation?: V3; scale?: number; ghost?: boolean };
