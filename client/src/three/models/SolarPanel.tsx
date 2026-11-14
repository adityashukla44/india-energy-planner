import { G, mats } from './materials';
import { Part, type ModelProps } from './Part';

/** One rack of tilted PV modules facing the sun (+z, south). */
export function SolarRow({ panels = 6, ghost, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: ModelProps & { panels?: number }) {
  const m = mats(ghost);
  const w = 0.5;
  const gap = 0.05;
  const len = panels * (w + gap) - gap;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {Array.from({ length: panels }, (_, i) => (
        <Part key={i} g={G.box} m={m.panel} p={[-len / 2 + w / 2 + i * (w + gap), 0.42, 0]} s={[w, 0.03, 0.72]} r={[-0.5, 0, 0]} />
      ))}
      <Part g={G.box} m={m.frame} p={[0, 0.2, -0.18]} s={[len, 0.04, 0.04]} />
      <Part g={G.box} m={m.frame} p={[0, 0.12, 0.18]} s={[len, 0.04, 0.04]} />
      {[-len / 2 + 0.05, 0, len / 2 - 0.05].map((x) => (
        <group key={x}>
          <Part g={G.box} m={m.metal} p={[x, 0.27, -0.18]} s={[0.04, 0.54, 0.04]} />
          <Part g={G.box} m={m.metal} p={[x, 0.15, 0.18]} s={[0.04, 0.3, 0.04]} />
        </group>
      ))}
    </group>
  );
}

/** Grid of rows; `built` rows are solid, the rest are wireframe ghosts. */
export function SolarArray({ rows, panels = 6, built, position = [0, 0, 0], spacing = 0.85, columns = 1, columnGap = 3.6 }: { rows: number; panels?: number; built?: number; position?: [number, number, number]; spacing?: number; columns?: number; columnGap?: number }) {
  const perCol = Math.ceil(rows / columns);
  return (
    <group position={position}>
      {Array.from({ length: rows }, (_, i) => {
        const c = Math.floor(i / perCol);
        const r = i % perCol;
        return <SolarRow key={i} panels={panels} ghost={built !== undefined && i >= built} position={[c * columnGap, 0, r * spacing]} />;
      })}
    </group>
  );
}
