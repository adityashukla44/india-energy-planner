import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { ResourceIcon } from '../components/ui/extras';
import { annualWindCF, hydroAllowed, mean } from '../engine/resource';
import type { District } from '../engine/types';
import { useStaticMotion, useThemeColors } from '../lib/hooks';
import { SceneShell } from './core';
import { BiomassUnit, GeoVent, HydroTurbine, SolarArray, Stream, WindTurbine } from './models';

export function dioramaItems(d: District) {
  const items: ('solar' | 'wind' | 'hydro' | 'biomass' | 'geothermal')[] = ['solar'];
  if (annualWindCF(d) >= 0.06) items.push('wind');
  if (hydroAllowed(d)) items.push('hydro');
  if (d.biomass_potential === 'med' || d.biomass_potential === 'high') items.push('biomass');
  if (d.geothermal_potential === 'potential') items.push('geothermal');
  return items;
}

function Scene({ d }: { d: District }) {
  const tk = useThemeColors();
  const staticMotion = useStaticMotion();
  const spin = useRef<THREE.Group>(null);
  const items = useMemo(() => dioramaItems(d), [d]);
  const wind = mean(d.wind50m_monthly);
  useFrame((_, dt) => {
    if (spin.current && !staticMotion) spin.current.rotation.y += dt * 0.18;
  });
  const n = items.length;
  const R = n > 1 ? 1.55 : 0;
  return (
    <>
      <color attach="background" args={[tk.dark ? '#120c1e' : '#efe9fb']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[-4, 8, 5]} intensity={2} color="#fff4dd" />
      <hemisphereLight args={['#e0d4ff', '#160d26', 0.4]} />
      <group ref={spin} rotation-y={0.6}>
        <mesh position={[0, -0.12, 0]} receiveShadow>
          <cylinderGeometry args={[2.9, 3.0, 0.24, 48]} />
          <meshStandardMaterial color={tk.dark ? '#2a1f3f' : '#ddd3f0'} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.002, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[2.82, 2.9, 64]} />
          <meshBasicMaterial color={tk.cyan} toneMapped={false} />
        </mesh>
        {items.map((k, i) => {
          const a = (i / n) * Math.PI * 2;
          const p: [number, number, number] = [Math.cos(a) * R, 0, Math.sin(a) * R];
          const rot: [number, number, number] = [0, -a + Math.PI / 2, 0];
          switch (k) {
            case 'solar':
              return <SolarArray key={k} rows={2} panels={3} position={[p[0], 0, p[2] - 0.4]} spacing={0.8} />;
            case 'wind':
              return <WindTurbine key={k} position={p} height={2.2} speed={wind} scale={0.9} />;
            case 'hydro':
              return (
                <group key={k} position={p} rotation={rot}>
                  <Stream position={[0, 0, 0.75]} length={2.4} width={0.45} />
                  <HydroTurbine scale={0.75} />
                </group>
              );
            case 'biomass':
              return <BiomassUnit key={k} position={p} rotation={rot} scale={0.75} />;
            case 'geothermal':
              return <GeoVent key={k} position={p} scale={0.9} />;
          }
        })}
      </group>
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.6} radius={0.5} />
      </EffectComposer>
    </>
  );
}

export default function DistrictDiorama({ district, className }: { district: District; className?: string }) {
  const { t } = useTranslation();
  const items = dioramaItems(district);
  return (
    <SceneShell
      className={className}
      label={t('map.dioramaAria', { name: district.name, items: items.map((k) => t(`res.${k}`)).join(', ') })}
      canvas={{ camera: { position: [0, 4.2, 6.4], fov: 38 } }}
      toggle={false}
      fallback={
        <ul className="flex h-full flex-wrap content-center items-center justify-center gap-2 p-4">
          {items.map((k) => (
            <li key={k} className="chip border-line/50 text-text">
              <ResourceIcon kind={k} size={14} /> {t(`res.${k}`)}
            </li>
          ))}
        </ul>
      }
    >
      <Scene d={district} />
    </SceneShell>
  );
}
