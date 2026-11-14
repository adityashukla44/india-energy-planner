import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

export function School({ lit, ghost, position = [0, 0, 0], rotation = [0, 0, 0] }: ModelProps & { lit: boolean }) {
  const m = mats(ghost);
  return (
    <group position={position} rotation={rotation}>
      <Part g={G.box} m={m.white} p={[0, 0.3, 0]} s={[1.6, 0.6, 0.72]} />
      <Part g={G.prism} m={m.roof} p={[0, 0.6, 0]} s={[1.68, 0.5, 0.82]} r={[0, Math.PI / 2, 0]} />
      {[-0.55, -0.25, 0.25, 0.55].map((x) => (
        <Part key={x} g={G.box} m={lit ? m.windowLit : m.windowOff} p={[x, 0.32, 0.365]} s={[0.18, 0.18, 0.01]} />
      ))}
      <Part g={G.box} m={m.dark} p={[0, 0.2, 0.365]} s={[0.2, 0.36, 0.01]} />
      <Part g={G.cyl8} m={m.metal} p={[0.95, 0.6, 0.3]} s={[0.025, 1.2, 0.025]} />
      <Part g={G.box} m={m.flag} p={[1.08, 1.08, 0.3]} s={[0.24, 0.15, 0.01]} />
    </group>
  );
}
