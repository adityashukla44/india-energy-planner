import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** Water pump with an overhead tank; water glows when powered. */
export function Pump({ running, ghost, position = [0, 0, 0], rotation = [0, 0, 0] }: ModelProps & { running: boolean }) {
  const m = mats(ghost);
  return (
    <group position={position} rotation={rotation}>
      {[-0.18, 0.18].flatMap((x) => [-0.18, 0.18].map((z) => <Part key={`${x}${z}`} g={G.box} m={m.metal} p={[x, 0.45, z]} s={[0.04, 0.9, 0.04]} />))}
      <Part g={G.cyl} m={m.roofTeal} p={[0, 1.05, 0]} s={[0.55, 0.36, 0.55]} />
      <Part g={G.cyl} m={running ? m.water : m.windowOff} p={[0, 1.25, 0]} s={[0.5, 0.04, 0.5]} />
      <Part g={G.box} m={m.dark} p={[0.42, 0.12, 0.1]} s={[0.24, 0.24, 0.2]} />
      <Part g={G.cyl8} m={m.metal} p={[0.42, 0.65, 0.1]} s={[0.04, 0.85, 0.04]} />
    </group>
  );
}
