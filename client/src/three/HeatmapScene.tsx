import { Html, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { District } from '../engine/types';
import { useThemeColors } from '../lib/hooks';
import { IndiaSlab, useBoundary } from './core';
import { districtWorld } from './geo';

const DEPTH = 0.3;
const SEG = 0.26;
const geom = (() => {
  const g = new THREE.CylinderGeometry(0.12, 0.12, 1, 6);
  g.translate(0, 0.5, 0);
  return g;
})();

export type Counts = Map<string, Record<string, number>>;

export default function HeatmapScene({
  districts,
  counts,
  types,
  colors,
  selectedId,
  onSelect,
  label,
}: {
  districts: District[];
  counts: Counts;
  types: string[];
  colors: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  label: (d: District, c: Record<string, number>) => React.ReactNode;
}) {
  const geo = useBoundary();
  const tk = useThemeColors();
  const [hover, setHover] = useState<string | null>(null);
  const mats = useMemo(
    () => Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.8, roughness: 0.4, toneMapped: false })])),
    [colors],
  );
  const hovered = districts.find((d) => d.id === (hover ?? selectedId));
  return (
    <>
      <color attach="background" args={[tk.bg]} />
      <fog attach="fog" args={[tk.bg, 22, 46]} />
      <ambientLight intensity={tk.dark ? 0.45 : 0.9} />
      <directionalLight position={[-6, 14, 8]} intensity={1.2} />
      <OrbitControls makeDefault enableDamping minDistance={5} maxDistance={24} maxPolarAngle={1.2} target={[0, 0, 0.4]} />
      {geo && <IndiaSlab geo={geo} depth={DEPTH} dark={tk.dark} edgeColor={tk.cyan} stateColor={tk.aqua} stateOpacity={0.3} />}
      {districts.map((d) => {
        const c = counts.get(d.id);
        if (!c) return null;
        const p = districtWorld(d, DEPTH + 0.02);
        let y = 0;
        return (
          <group
            key={d.id}
            position={p}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(d.id);
            }}
            onPointerOut={() => setHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(d.id);
            }}
            scale={d.id === selectedId || d.id === hover ? 1.25 : 1}
          >
            {types.map((ty) => {
              const n = c[ty] ?? 0;
              if (!n) return null;
              const h = n * SEG;
              const m = <mesh key={ty} geometry={geom} material={mats[ty]} position-y={y} scale={[1, h - 0.015, 1]} />;
              y += h;
              return m;
            })}
          </group>
        );
      })}
      {hovered && counts.get(hovered.id) && (
        <Html position={districtWorld(hovered, DEPTH + 0.5 + Object.values(counts.get(hovered.id)!).reduce((a, b) => a + b, 0) * SEG)} center style={{ pointerEvents: 'none' }}>
          <div className="glass -translate-y-4 whitespace-nowrap rounded-btn px-3 py-2 text-xs">{label(hovered, counts.get(hovered.id)!)}</div>
        </Html>
      )}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={tk.dark ? 0.7 : 0.3} luminanceThreshold={0.4} radius={0.6} />
      </EffectComposer>
    </>
  );
}
