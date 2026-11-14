import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** Geothermal vent (potential only): rocks, a warm glow and rising steam. */
export function GeoVent({ position = [0, 0, 0], scale = 1 }: ModelProps) {
  const m = mats();
  const steam = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    steam.current?.children.forEach((c, i) => {
      c.position.y += dt * (0.35 + (i % 3) * 0.08);
      c.scale.setScalar(0.12 + c.position.y * 0.18);
      if (c.position.y > 1.6) c.position.y = 0.15;
    });
  });
  return (
    <group position={position} scale={scale}>
      {[
        [0.3, 0.1, 0.1, 0.35],
        [-0.25, 0.08, 0.2, 0.3],
        [0.05, 0.06, -0.3, 0.28],
        [-0.1, 0.12, -0.05, 0.22],
      ].map(([x, y, z, s], i) => (
        <Part key={i} g={G.dodeca} m={m.rock} p={[x, y, z]} s={s} r={[i, i * 2, 0]} />
      ))}
      <Part g={G.cyl} m={m.geoGlow} p={[0, 0.03, 0]} s={[0.25, 0.02, 0.25]} />
      <group ref={steam}>
        {Array.from({ length: 6 }, (_, i) => (
          <Part key={i} g={G.sphere} m={m.steam} p={[((i % 3) - 1) * 0.06, 0.15 + i * 0.24, 0]} s={0.15} castShadow={false} />
        ))}
      </group>
    </group>
  );
}
