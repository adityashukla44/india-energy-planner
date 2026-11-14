import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** Diesel generator: greyed when not part of the design, glowing amber with smoke when running. */
export function DieselGen({ used, running, ghost, position = [0, 0, 0], rotation = [0, 0, 0] }: ModelProps & { used: boolean; running: boolean }) {
  const m = mats(ghost);
  const smoke = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (body.current) body.current.position.x = running ? Math.sin(clock.getElapsedTime() * 60) * 0.006 : 0;
    smoke.current?.children.forEach((c, i) => {
      c.visible = running;
      c.position.y += dt * 0.5;
      const s = 0.12 + (c.position.y - 0.9) * 0.25;
      c.scale.setScalar(Math.max(0.05, s));
      if (c.position.y > 2.0) c.position.y = 0.9 + (i % 3) * 0.05;
    });
  });
  const shell = used ? (running ? m.gensetHot : m.genset) : m.gensetOff;
  return (
    <group position={position} rotation={rotation}>
      <group ref={body}>
        <Part g={G.box} m={m.concrete} p={[0, 0.04, 0]} s={[1.05, 0.08, 0.65]} />
        <Part g={G.box} m={shell} p={[0, 0.36, 0]} s={[0.95, 0.56, 0.55]} />
        <Part g={G.box} m={m.dark} p={[0.2, 0.36, 0.28]} s={[0.36, 0.3, 0.01]} />
        <Part g={G.cyl8} m={m.metal} p={[-0.32, 0.8, -0.12]} s={[0.07, 0.36, 0.07]} />
      </group>
      <group ref={smoke}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Part key={i} g={G.sphere} m={m.smoke} p={[-0.32, 0.9 + i * 0.22, -0.12]} s={0.12} visible={running} castShadow={false} />
        ))}
      </group>
    </group>
  );
}
