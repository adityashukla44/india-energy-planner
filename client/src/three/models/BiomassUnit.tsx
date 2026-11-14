import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** Biomass gasifier: silo with dome, feed shed and stack. */
export function BiomassUnit({ ghost, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: ModelProps) {
  const m = mats(ghost);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Part g={G.cyl} m={m.silo} p={[0, 0.5, 0]} s={[0.55, 1, 0.55]} />
      <Part g={G.sphere} m={m.silo} p={[0, 1.0, 0]} s={[0.55, 0.32, 0.55]} />
      <Part g={G.box} m={m.green} p={[0.6, 0.22, 0.1]} s={[0.55, 0.44, 0.5]} />
      <Part g={G.cyl8} m={m.metal} p={[-0.35, 0.8, -0.2]} s={[0.07, 1.6, 0.07]} />
      {[0, 1, 2].map((i) => (
        <Part key={i} g={G.cyl8} m={m.green} p={[0.95 + i * 0.12, 0.08, 0.5]} s={[0.1, 0.5, 0.1]} r={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
}
