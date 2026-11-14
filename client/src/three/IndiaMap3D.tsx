import { Html, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { District } from '../engine/types';
import { useThemeColors } from '../lib/hooks';
import type { LayerValue } from '../lib/layers';
import { IndiaSlab, useBoundary } from './core';
import { DistrictColumns } from './DistrictColumns';
import { districtWorld } from './geo';

const DEPTH = 0.3;
const HOME_CAM = new THREE.Vector3(0, 15.5, 11.5);
const HOME_TARGET = new THREE.Vector3(0, 0, 0.4);

/** Flies the camera to the selected district; user interaction cancels the flight. */
function CameraRig({ target }: { target: THREE.Vector3 | null }) {
  const { camera, controls, size } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null; size: { width: number; height: number } };
  const wide = size.width >= 768;
  const flight = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (target) {
      // Aim a little beside the district so it sits left of the side panel (desktop) or above the bottom sheet (phone).
      const look = target.clone().add(wide ? new THREE.Vector3(1.9, 0, 0.3) : new THREE.Vector3(0, 0, 2.6));
      flight.current = { pos: look.clone().add(new THREE.Vector3(0.6, 10.5, 8.2)), look };
    }
    else flight.current = { pos: HOME_CAM.clone(), look: HOME_TARGET.clone() };
  }, [target, wide]);
  useEffect(() => {
    if (!controls) return;
    const stop = () => (flight.current = null);
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [controls]);
  useFrame((_, dt) => {
    const f = flight.current;
    if (!controls) return;
    if (f) {
      const k = 1 - Math.pow(0.0015, dt);
      camera.position.lerp(f.pos, k);
      controls.target.lerp(f.look, k);
      if (camera.position.distanceTo(f.pos) < 0.02 && controls.target.distanceTo(f.look) < 0.02) flight.current = null;
    }
    // clamp pan inside India's bounds
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -5.2, 5.2);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -5.6, 6);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 1.5);
    controls.update();
  });
  return null;
}

export default function IndiaMap3D({
  districts,
  values,
  selectedId,
  onSelect,
  tooltip,
}: {
  districts: District[];
  values: Map<string, LayerValue>;
  selectedId: string | null;
  onSelect: (d: District) => void;
  tooltip: (d: District, v?: LayerValue) => React.ReactNode;
}) {
  const geo = useBoundary();
  const tk = useThemeColors();
  const [hover, setHover] = useState<string | null>(null);
  const selected = districts.find((d) => d.id === selectedId) ?? null;
  const target = useMemo(() => (selected ? districtWorld(selected, DEPTH) : null), [selected]);
  const hovered = districts.find((d) => d.id === hover) ?? null;
  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover]);
  return (
    <>
      <color attach="background" args={[tk.bg]} />
      <fog attach="fog" args={[tk.bg, 22, 46]} />
      <ambientLight intensity={tk.dark ? 0.45 : 0.9} />
      <directionalLight position={[-6, 14, 8]} intensity={tk.dark ? 1.2 : 1.6} />
      <hemisphereLight args={[tk.cyan, tk.bg, tk.dark ? 0.35 : 0.2]} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={24}
        minPolarAngle={0.15}
        maxPolarAngle={1.2}
        target={HOME_TARGET.toArray() as [number, number, number]}
        screenSpacePanning={false}
      />
      <CameraRig target={target} />
      {geo && <IndiaSlab geo={geo} depth={DEPTH} dark={tk.dark} edgeColor={tk.cyan} stateColor={tk.aqua} stateOpacity={tk.dark ? 0.34 : 0.55} />}
      <DistrictColumns
        districts={districts}
        values={values}
        baseY={DEPTH + 0.02}
        hoverId={hover}
        selectedId={selectedId}
        onHover={setHover}
        onSelect={onSelect}
        ringColor={tk.cyan}
      />
      {hovered && (
        <Html position={districtWorld(hovered, DEPTH + 0.4 + (values.get(hovered.id)?.v01 ?? 0) * 1.5)} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="glass -translate-y-6 whitespace-nowrap rounded-btn px-3 py-2 text-xs text-text">{tooltip(hovered, values.get(hovered.id))}</div>
        </Html>
      )}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={tk.dark ? 0.8 : 0.35} luminanceThreshold={tk.dark ? 0.3 : 0.65} luminanceSmoothing={0.3} radius={0.65} />
      </EffectComposer>
    </>
  );
}
