import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { District } from '../engine/types';
import type { LayerValue } from '../lib/layers';
import { districtWorld } from './geo';

const hexGeom = (() => {
  const g = new THREE.CylinderGeometry(0.13, 0.13, 1, 6, 1, false);
  g.translate(0, 0.5, 0);
  return g;
})();
const ringGeom = new THREE.RingGeometry(0.19, 0.25, 6);

function Column({
  d,
  v,
  baseY,
  hovered,
  selected,
  onHover,
  onSelect,
  ringColor,
}: {
  d: District;
  v?: LayerValue;
  baseY: number;
  hovered: boolean;
  selected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (d: District) => void;
  ringColor: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const color = v?.color ?? '#C484FC';
  const height = 0.12 + (v?.v01 ?? 0.3) * 1.5;
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.95 }),
    [color],
  );
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.9, toneMapped: false, side: THREE.DoubleSide }), [ringColor]);
  const pos = useMemo(() => districtWorld(d, baseY), [d, baseY]);
  const h = useRef(0.01);
  useFrame(({ clock }, dt) => {
    const m = ref.current;
    if (!m) return;
    const k = Math.min(1, dt * 7);
    h.current += (height - h.current) * k;
    m.scale.y = h.current;
    const lift = hovered || selected ? 0.12 : 0;
    m.position.y += (pos.y + lift - m.position.y) * k;
    const e = hovered ? 1.4 : selected ? 1.1 : 0.45;
    mat.emissiveIntensity += (e - mat.emissiveIntensity) * k;
    if (ring.current) {
      ring.current.visible = selected;
      const s = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.08;
      ring.current.scale.setScalar(s);
    }
  });
  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(d.id);
  };
  return (
    <group>
      <mesh
        ref={ref}
        geometry={hexGeom}
        material={mat}
        position={[pos.x, pos.y, pos.z]}
        scale={[1, 0.01, 1]}
        onPointerOver={over}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(d);
        }}
      />
      <mesh ref={ring} geometry={ringGeom} material={ringMat} position={[pos.x, pos.y + 0.01, pos.z]} rotation-x={-Math.PI / 2} visible={false} />
    </group>
  );
}

/** Hexagonal 3D columns, one per district, coloured and sized by the active layer. */
export function DistrictColumns({
  districts,
  values,
  baseY,
  hoverId,
  selectedId,
  onHover,
  onSelect,
  ringColor,
}: {
  districts: District[];
  values: Map<string, LayerValue>;
  baseY: number;
  hoverId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (d: District) => void;
  ringColor: string;
}) {
  return (
    <group>
      {districts.map((d) => (
        <Column
          key={d.id}
          d={d}
          v={values.get(d.id)}
          baseY={baseY}
          hovered={hoverId === d.id}
          selected={selectedId === d.id}
          onHover={onHover}
          onSelect={onSelect}
          ringColor={ringColor}
        />
      ))}
    </group>
  );
}
