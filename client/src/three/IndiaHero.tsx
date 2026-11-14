import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { annualGhi, annualWindCF } from '../engine/resource';
import type { District } from '../engine/types';
import { useStaticMotion, useThemeColors } from '../lib/hooks';
import { arcPoints, FlowTube, IndiaSlab, makePillarMaterial, SceneShell, useBoundary } from './core';
import { demandHeight, districtWorld } from './geo';
import { Map2D } from './Map2D';

const DEPTH = 0.32;

/** Demand centres → nearest high-solar / high-wind districts. */
export function heroArcs(districts: District[]): [string, string, 'solar' | 'wind'][] {
  const centres = [...districts].sort((a, b) => b.demand_mwh_yr_est - a.demand_mwh_yr_est).slice(0, 12);
  const sources = districts
    .map((d) => ({ d, kind: annualWindCF(d) >= 0.15 ? ('wind' as const) : annualGhi(d) >= 5.8 ? ('solar' as const) : null }))
    .filter((x): x is { d: District; kind: 'solar' | 'wind' } => !!x.kind);
  const out: [string, string, 'solar' | 'wind'][] = [];
  for (const c of centres) {
    const near = sources
      .filter((s) => s.d.id !== c.id)
      .map((s) => ({ ...s, dist: Math.hypot(s.d.lon - c.lon, s.d.lat - c.lat) }))
      .filter((s) => s.dist < 11)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);
    for (const s of near) out.push([s.d.id, c.id, s.kind]);
  }
  return out;
}

function HeroContent({ districts }: { districts: District[] }) {
  const geo = useBoundary();
  const tk = useThemeColors();
  const staticMotion = useStaticMotion();
  const group = useRef<THREE.Group>(null);
  const { size } = useThree();
  const wide = size.width > 900;
  const pillarMat = useMemo(() => makePillarMaterial(tk.cyan, tk.dark ? 0.7 : 0.9), [tk.cyan, tk.dark]);
  const dotMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(tk.cyan).multiplyScalar(tk.dark ? 2.2 : 1.2), toneMapped: false }), [tk.cyan, tk.dark]);
  const arcs = useMemo(() => heroArcs(districts), [districts]);
  const byId = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);

  useFrame(({ clock }) => {
    if (!group.current || staticMotion) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = Math.sin(t * 0.12) * 0.08;
    group.current.position.y = Math.sin(t * 0.5) * 0.04;
  });

  const offsetX = wide ? 2.4 : 0;
  return (
    <>
      <color attach="background" args={[tk.bg]} />
      <fog attach="fog" args={[tk.bg, 20, 42]} />
      <ambientLight intensity={tk.dark ? 0.35 : 0.8} />
      <directionalLight position={[-6, 14, 8]} intensity={tk.dark ? 1.1 : 1.6} />
      <pointLight position={[6, 3, -6]} intensity={30} color={tk.cyan} distance={20} />
      <hemisphereLight args={[tk.cyan, tk.bg, tk.dark ? 0.35 : 0.2]} />
      <group position={[offsetX, 0, wide ? 0.2 : 0.6]}>
        <group ref={group}>
          {geo && <IndiaSlab geo={geo} depth={DEPTH} dark={tk.dark} edgeColor={tk.cyan} stateColor={tk.aqua} stateOpacity={tk.dark ? 0.32 : 0.5} />}
          {districts.map((d) => {
            const p = districtWorld(d, DEPTH + 0.04);
            const h = demandHeight(d.demand_mwh_yr_est, 0.3, 2.4);
            return (
              <group key={d.id} position={p}>
                <mesh material={dotMat}>
                  <sphereGeometry args={[0.055, 12, 12]} />
                </mesh>
                <mesh material={pillarMat} position-y={h / 2}>
                  <cylinderGeometry args={[0.05, 0.075, h, 16, 1, true]} />
                </mesh>
              </group>
            );
          })}
          {arcs.map(([a, b, kind], i) => {
            const da = byId.get(a)!;
            const db = byId.get(b)!;
            return (
              <FlowTube
                key={a + b}
                points={arcPoints(districtWorld(da, DEPTH + 0.05), districtWorld(db, DEPTH + 0.05), 0.28)}
                from={kind === 'solar' ? tk.amber : tk.aqua}
                to={tk.cyan}
                radius={0.018}
                speed={0.45}
                dash={1}
                offset={i * 0.17}
              />
            );
          })}
        </group>
      </group>
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={tk.dark ? 0.95 : 0.4} luminanceThreshold={tk.dark ? 0.25 : 0.6} luminanceSmoothing={0.3} radius={0.72} />
      </EffectComposer>
    </>
  );
}

export default function IndiaHero({ districts, className }: { districts: District[]; className?: string }) {
  const { t } = useTranslation();
  const arcs = useMemo(() => heroArcs(districts).map(([a, b]) => [a, b] as [string, string]), [districts]);
  return (
    <SceneShell
      className={className}
      label={t('home.heroAria')}
      canvas={{ camera: { position: [0, 18.2, 12.8], fov: 34, near: 0.1, far: 80 } }}
      toggleClassName="right-4 top-4 lg:bottom-6 lg:top-auto"
      fallback={
        <div className="absolute inset-0 flex items-center justify-center p-6 lg:justify-end lg:pr-[8%]">
          <Map2D districts={districts} showArcs={arcs} compact className="max-h-full w-auto max-w-[560px]" />
        </div>
      }
    >
      <HeroContent districts={districts} />
    </SceneShell>
  );
}
