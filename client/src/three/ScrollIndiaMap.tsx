import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import type { MotionValue } from 'framer-motion';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import type { District } from '../engine/types';
import { useStaticMotion, useThemeColors } from '../lib/hooks';
import { arcPoints, FlowTube, IndiaSlab, makePillarMaterial, SceneShell, useBoundary } from './core';
import { demandHeight, districtWorld } from './geo';
import { heroArcs } from './IndiaHero';
import { Map2D } from './Map2D';

const DEPTH = 0.32;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

/**
 * Scroll stages (0..1): the hero sits over a distant, glowing India; scrolling zooms the camera in,
 * switches the district lights on south → north, draws the power arcs, then dives closer.
 */
export const STAGES = { intro: [0, 0.22], lights: [-0.05, 0.26], arcs: [0.24, 0.55], dive: [0.55, 1] } as const;
/** Progress used when motion is reduced: lights and arcs on, mid zoom. */
const STATIC_P = 0.82;

// Camera keyframes: [progress, position, look-at target]
const KEYS: [number, THREE.Vector3, THREE.Vector3][] = [
  [0, new THREE.Vector3(0, 25, 19), new THREE.Vector3(0, 0, 0.6)],
  [0.22, new THREE.Vector3(0, 19.5, 14), new THREE.Vector3(0, 0, 0.4)],
  [0.62, new THREE.Vector3(0, 15.5, 11), new THREE.Vector3(0, 0, 0.3)],
  [1, new THREE.Vector3(0.6, 8.2, 6.4), new THREE.Vector3(0.3, 0, -0.9)],
];
const ease = (x: number) => x * x * (3 - 2 * x);
function cameraAt(p: number, pos: THREE.Vector3, look: THREE.Vector3) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const [p0, a0, l0] = KEYS[i];
  const [p1, a1, l1] = KEYS[i + 1];
  const k = ease(THREE.MathUtils.clamp((p - p0) / (p1 - p0), 0, 1));
  pos.copy(a0).lerp(a1, k);
  look.copy(l0).lerp(l1, k);
}

function Scene({ districts, progress }: { districts: District[]; progress: MotionValue<number> }) {
  const geo = useBoundary();
  const tk = useThemeColors();
  const staticMotion = useStaticMotion();
  const { size, camera } = useThree();
  const wide = size.width > 900;
  // Fit India to narrow (portrait) screens; full size from roughly square and wider.
  const fit = THREE.MathUtils.clamp(size.width / size.height / 0.95, 0.5, 1);
  const holder = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const p = useRef(staticMotion ? STATIC_P : 0);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const camLook = useMemo(() => new THREE.Vector3(), []);
  const order = useMemo(() => {
    const sorted = [...districts].sort((a, b) => a.lat - b.lat);
    return new Map(sorted.map((d, i) => [d.id, i / Math.max(1, sorted.length - 1)]));
  }, [districts]);
  const arcs = useMemo(() => heroArcs(districts), [districts]);
  const byId = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);
  const dotMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(tk.cyan).multiplyScalar(tk.dark ? 2.4 : 1.3), toneMapped: false }), [tk.cyan, tk.dark]);
  const pillarMat = useMemo(() => makePillarMaterial(tk.cyan, tk.dark ? 0.8 : 1), [tk.cyan, tk.dark]);
  const dots = useRef<(THREE.Group | null)[]>([]);
  const arcRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(({ clock }, dt) => {
    const target = staticMotion ? STATIC_P : progress.get();
    p.current += (target - p.current) * Math.min(1, dt * 5);
    const v = p.current;
    const t = clock.getElapsedTime();

    // Camera dolly along the keyframes.
    cameraAt(v, camPos, camLook);
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    // India starts off to the right behind the headline, then glides to centre as the text leaves.
    const intro = smooth(STAGES.intro[0], STAGES.intro[1], v);
    const dive = smooth(STAGES.dive[0], STAGES.dive[1], v);
    // On wide screens keep India clear of the captions on the left, sliding further right during the dive.
    if (holder.current) holder.current.position.x = wide ? THREE.MathUtils.lerp(3.4, 1.1, intro) + dive * 1.9 : 0;
    const g = group.current;
    if (g) {
      g.rotation.x = THREE.MathUtils.lerp(0.32, 0, intro);
      g.rotation.y = (staticMotion ? 0 : Math.sin(t * 0.12) * 0.05) + THREE.MathUtils.lerp(0.28, 0, intro);
      g.position.y = staticMotion ? 0 : Math.sin(t * 0.5) * 0.04;
    }
    districts.forEach((d, i) => {
      const node = dots.current[i];
      if (!node) return;
      const span = STAGES.lights[1] - STAGES.lights[0] - 0.07;
      const start = STAGES.lights[0] + (order.get(d.id) ?? 0) * span;
      const on = smooth(start, start + 0.07, v);
      node.scale.setScalar(Math.max(0.0001, on));
      node.visible = on > 0.001;
    });
    arcs.forEach((_, i) => {
      const node = arcRefs.current[i];
      if (!node) return;
      const start = STAGES.arcs[0] + (i / arcs.length) * (STAGES.arcs[1] - STAGES.arcs[0] - 0.05);
      const on = smooth(start, start + 0.05, v);
      node.visible = on > 0.01;
      node.scale.setScalar(Math.max(0.001, on));
    });
  });

  return (
    <>
      <color attach="background" args={[tk.bg]} />
      <fog attach="fog" args={[tk.bg, 16, 46]} />
      <ambientLight intensity={tk.dark ? 0.35 : 0.8} />
      <directionalLight position={[-6, 14, 8]} intensity={tk.dark ? 1.1 : 1.6} />
      <pointLight position={[6, 3, -6]} intensity={30} color={tk.cyan} distance={20} />
      <hemisphereLight args={[tk.cyan, tk.bg, 0.3]} />
      <group ref={holder} scale={fit} position-z={wide ? 0 : -1.2}>
        <group ref={group}>
          {geo && <IndiaSlab geo={geo} depth={DEPTH} dark={tk.dark} edgeColor={tk.cyan} stateColor={tk.aqua} stateOpacity={tk.dark ? 0.32 : 0.5} />}
          {districts.map((d, i) => {
            const h = demandHeight(d.demand_mwh_yr_est, 0.3, 2.4);
            return (
              <group key={d.id} ref={(el) => (dots.current[i] = el)} position={districtWorld(d, DEPTH + 0.04)} visible={false}>
                <mesh material={dotMat}>
                  <sphereGeometry args={[0.06, 12, 12]} />
                </mesh>
                <mesh material={pillarMat} position-y={h / 2}>
                  <cylinderGeometry args={[0.05, 0.08, h, 16, 1, true]} />
                </mesh>
              </group>
            );
          })}
          {arcs.map(([a, b, kind], i) => {
            const da = byId.get(a)!;
            const db = byId.get(b)!;
            const pa = districtWorld(da, DEPTH + 0.05);
            return (
              <group key={a + b} ref={(el) => (arcRefs.current[i] = el)} position={pa} visible={false}>
                <FlowTube
                  points={arcPoints(new THREE.Vector3(0, 0, 0), districtWorld(db, DEPTH + 0.05).sub(pa), 0.28)}
                  from={kind === 'solar' ? tk.amber : tk.aqua}
                  to={tk.cyan}
                  radius={0.02}
                  speed={0.45}
                  dash={1}
                  offset={i * 0.17}
                />
              </group>
            );
          })}
        </group>
      </group>
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={tk.dark ? 1.0 : 0.4} luminanceThreshold={tk.dark ? 0.25 : 0.6} luminanceSmoothing={0.3} radius={0.72} />
      </EffectComposer>
    </>
  );
}

export default function ScrollIndiaMap({ districts, progress, className }: { districts: District[]; progress: MotionValue<number>; className?: string }) {
  const { t } = useTranslation();
  const arcs = useMemo(() => heroArcs(districts).map(([a, b]) => [a, b] as [string, string]), [districts]);
  return (
    <SceneShell
      className={className}
      label={t('home.heroAria')}
      canvas={{ camera: { position: [0, 25, 19], fov: 34, near: 0.1, far: 90 } }}
      toggleClassName="bottom-6 right-4"
      fallback={
        <div className="absolute inset-0 flex items-center justify-center p-6 lg:justify-end lg:pr-[8%]">
          <Map2D districts={districts} showArcs={arcs} compact className="max-h-full w-auto max-w-[560px] opacity-70" />
        </div>
      }
    >
      <Scene districts={districts} progress={progress} />
    </SceneShell>
  );
}
