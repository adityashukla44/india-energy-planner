import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

export function House({ lit, ghost, position = [0, 0, 0], rotation = [0, 0, 0], variant = 0 }: ModelProps & { lit: boolean; variant?: number }) {
  const m = mats(ghost);
  return (
    <group position={position} rotation={rotation}>
      <Part g={G.box} m={m.white} p={[0, 0.2, 0]} s={[0.52, 0.4, 0.46]} />
      <Part g={G.pyramid} m={variant % 2 ? m.roofTeal : m.roof} p={[0, 0.55, 0]} s={[0.55, 0.32, 0.5]} />
      <Part g={G.box} m={lit ? m.windowLit : m.windowOff} p={[-0.11, 0.22, 0.235]} s={[0.12, 0.12, 0.01]} />
      <Part g={G.box} m={m.dark} p={[0.12, 0.15, 0.235]} s={[0.1, 0.24, 0.01]} />
    </group>
  );
}
