import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** Primary health clinic with a red cross; windows glow when powered. */
export function Clinic({ lit, ghost, position = [0, 0, 0], rotation = [0, 0, 0] }: ModelProps & { lit: boolean }) {
  const m = mats(ghost);
  return (
    <group position={position} rotation={rotation}>
      <Part g={G.box} m={m.white} p={[0, 0.36, 0]} s={[1.3, 0.72, 0.95]} />
      <Part g={G.box} m={m.concrete} p={[0, 0.75, 0]} s={[1.38, 0.06, 1.02]} />
      <Part g={G.box} m={m.red} p={[0, 0.98, 0]} s={[0.12, 0.38, 0.12]} />
      <Part g={G.box} m={m.red} p={[0, 0.98, 0]} s={[0.38, 0.12, 0.12]} />
      <Part g={G.box} m={m.red} p={[0.42, 0.5, 0.48]} s={[0.07, 0.24, 0.02]} />
      <Part g={G.box} m={m.red} p={[0.42, 0.5, 0.48]} s={[0.24, 0.07, 0.02]} />
      {[-0.4, -0.1].map((x) => (
        <Part key={x} g={G.box} m={lit ? m.windowLit : m.windowOff} p={[x, 0.42, 0.48]} s={[0.18, 0.2, 0.02]} />
      ))}
      <Part g={G.box} m={m.dark} p={[0.15, 0.2, 0.48]} s={[0.2, 0.36, 0.02]} />
    </group>
  );
}
