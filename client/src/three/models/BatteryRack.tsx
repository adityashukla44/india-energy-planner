import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** LFP battery cabinets: `modules` stacked units across racks; LEDs glow when charging/discharging. */
export function BatteryRack({ modules, built, active = true, ghost, position = [0, 0, 0], perRack = 6, rotation = [0, 0, 0] }: ModelProps & { modules: number; built?: number; active?: boolean; perRack?: number }) {
  const racks = Math.max(1, Math.ceil(modules / perRack));
  const base = mats(ghost);
  return (
    <group position={position} rotation={rotation}>
      <Part g={G.box} m={base.concrete} p={[((racks - 1) * 0.62) / 2, 0.03, 0]} s={[racks * 0.62 + 0.2, 0.06, 0.62]} />
      {Array.from({ length: racks }, (_, r) => {
        const count = Math.min(perRack, modules - r * perRack);
        return (
          <group key={r} position={[r * 0.62, 0.06, 0]}>
            <Part g={G.box} m={base.dark} p={[-0.27, (perRack * 0.2) / 2, 0]} s={[0.03, perRack * 0.2 + 0.05, 0.45]} />
            <Part g={G.box} m={base.dark} p={[0.27, (perRack * 0.2) / 2, 0]} s={[0.03, perRack * 0.2 + 0.05, 0.45]} />
            {Array.from({ length: count }, (_, i) => {
              const idx = r * perRack + i;
              const gm = mats(ghost || (built !== undefined && idx >= built));
              return (
                <group key={i} position={[0, 0.11 + i * 0.2, 0]}>
                  <Part g={G.box} m={gm.battery} s={[0.5, 0.17, 0.42]} />
                  <Part g={G.box} m={active ? gm.led : gm.ledOff} p={[0.12, 0, 0.215]} s={[0.18, 0.025, 0.01]} />
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
