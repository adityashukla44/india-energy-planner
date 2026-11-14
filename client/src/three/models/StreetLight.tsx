import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

export function StreetLight({ lit, ghost, position = [0, 0, 0] }: ModelProps & { lit: boolean }) {
  const m = mats(ghost);
  return (
    <group position={position}>
      <Part g={G.cyl8} m={m.metal} p={[0, 0.45, 0]} s={[0.03, 0.9, 0.03]} />
      <Part g={G.box} m={m.metal} p={[0.08, 0.9, 0]} s={[0.18, 0.03, 0.05]} />
      <Part g={G.sphere} m={lit ? m.bulb : m.bulbOff} p={[0.16, 0.87, 0]} s={0.07} />
    </group>
  );
}
