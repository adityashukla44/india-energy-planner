import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** A stream with moving ripples. */
export function Stream({ length = 6, width = 0.7, position = [0, 0, 0], rotation = [0, 0, 0], flow = 1 }: ModelProps & { length?: number; width?: number; flow?: number }) {
  const m = mats();
  const ripples = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    ripples.current?.children.forEach((c) => {
      c.position.x += dt * 0.6 * flow;
      if (c.position.x > length / 2) c.position.x -= length;
    });
  });
  return (
    <group position={position} rotation={rotation}>
      <Part g={G.box} m={m.water} p={[0, 0.02, 0]} s={[length, 0.04, width]} />
      <group ref={ripples}>
        {Array.from({ length: 7 }, (_, i) => (
          <Part key={i} g={G.box} m={m.steam} p={[-length / 2 + (i * length) / 7, 0.05, ((i % 3) - 1) * width * 0.25]} s={[0.35, 0.01, 0.04]} />
        ))}
      </group>
    </group>
  );
}

/** Micro-hydro powerhouse with penstock and spinning turbine wheel. */
export function HydroTurbine({ ghost, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, running = true }: ModelProps & { running?: boolean }) {
  const m = mats(ghost);
  const wheel = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (wheel.current && running && !ghost) wheel.current.rotation.x += dt * 2.2;
  });
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Part g={G.box} m={m.concrete} p={[0, 0.3, 0]} s={[0.9, 0.6, 0.7]} />
      <Part g={G.prism} m={m.roofTeal} p={[0, 0.6, 0]} s={[1.0, 0.6, 0.8]} />
      <Part g={G.cyl8} m={m.metal} p={[-0.65, 0.55, 0]} s={[0.12, 0.9, 0.12]} r={[0, 0, 0.9]} />
      <group ref={wheel} position={[0.55, 0.25, 0]}>
        <Part g={G.cyl} m={m.metal} s={[0.4, 0.08, 0.4]} r={[0, 0, Math.PI / 2]} />
        {[0, 1, 2, 3].map((i) => (
          <Part key={i} g={G.box} m={m.dark} s={[0.06, 0.42, 0.06]} r={[(i * Math.PI) / 4, 0, 0]} />
        ))}
      </group>
    </group>
  );
}
