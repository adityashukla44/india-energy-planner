import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** Three-blade small wind turbine; blade speed scales with `speed` (≈ wind m/s). */
export function WindTurbine({ height = 2.8, speed = 5, ghost, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, paused }: ModelProps & { height?: number; speed?: number; paused?: boolean }) {
  const m = mats(ghost);
  const rotor = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (rotor.current && !ghost && !paused) rotor.current.rotation.z -= dt * Math.max(0.2, speed) * 0.45;
  });
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Part g={G.cyl} m={m.white} p={[0, height / 2, 0]} s={[0.12, height, 0.12]} />
      <Part g={G.cyl} m={m.concrete} p={[0, 0.04, 0]} s={[0.4, 0.08, 0.4]} />
      <Part g={G.box} m={m.white} p={[0, height + 0.06, -0.05]} s={[0.16, 0.16, 0.42]} />
      <group ref={rotor} position={[0, height + 0.06, 0.2]}>
        <Part g={G.sphere} m={m.white} s={0.14} />
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <Part g={G.box} m={m.white} p={[0, 0.55, 0]} s={[0.08, 1.05, 0.025]} r={[0, 0.25, 0]} />
          </group>
        ))}
      </group>
    </group>
  );
}
