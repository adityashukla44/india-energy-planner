import { Html, OrbitControls, RoundedBox, Stars } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { ResourceIcon } from '../components/ui/extras';
import type { DemandResult, LoadKind, SystemSpec } from '../engine/types';
import { fmtNum } from '../lib/format';
import { useThemeColors } from '../lib/hooks';
import { arcPoints, FlowTube, SceneShell } from './core';
import { BatteryRack, Clinic, DieselGen, House, HydroTurbine, Pump, School, SolarArray, Stream, StreetLight, WindTurbine } from './models';

export interface BuildState {
  /** 0..1 share of generation + storage built */
  gen: number;
  loads: Partial<Record<LoadKind, number>>;
  /** 0..1 share of homes connected */
  homes: number;
}

export interface SystemSceneProps {
  spec: SystemSpec;
  demand: DemandResult;
  night: boolean;
  windMean: number;
  build?: BuildState;
  label?: string;
  className?: string;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clampInt = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(x)));

export function sceneCounts(spec: SystemSpec, demand: DemandResult) {
  const homes = demand.loads.find((l) => l.kind === 'homes')?.count ?? 0;
  const pumps = demand.loads.find((l) => l.kind === 'pumps')?.count ?? 0;
  return {
    rows: spec.pvKwp > 0 ? clampInt(Math.ceil(spec.pvKwp / 14), 1, 12) : 0,
    modules: spec.batteryKwh > 0 ? clampInt(Math.ceil(spec.batteryKwh / 30), 1, 18) : 0,
    turbines: spec.windKw > 0 ? clampInt(Math.ceil(spec.windKw / 15), 1, 3) : 0,
    houses: homes > 0 ? clampInt(Math.ceil(homes / 10), 1, 12) : 0,
    homes,
    pumps: Math.min(3, pumps),
    clinic: demand.loads.some((l) => l.kind === 'clinic'),
    school: demand.loads.some((l) => l.kind === 'school'),
    lights: demand.loads.some((l) => l.kind === 'streetlights'),
  };
}

function Label({ position, children, tone = 'aqua' }: { position: [number, number, number]; children: ReactNode; tone?: 'aqua' | 'amber' | 'muted' }) {
  return (
    <Html position={position} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div
        className={clsx(
          'glass whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[11px] font-medium',
          tone === 'amber' ? 'text-amber' : tone === 'muted' ? 'text-muted' : 'text-aqua',
        )}
      >
        {children}
      </div>
    </Html>
  );
}

function FitOrtho() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.min(size.width / 17.5, size.height / 12);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Diorama({ spec, demand, night, windMean, build }: SystemSceneProps) {
  const { t } = useTranslation();
  const tk = useThemeColors();
  const c = useMemo(() => sceneCounts(spec, demand), [spec, demand]);
  const gen = build ? build.gen : 1;
  const loadP = (k: LoadKind) => (build ? build.loads[k] ?? 0 : 1);
  const homesBuilt = build ? Math.floor(c.houses * build.homes + 1e-6) : c.houses;
  const genOn = gen > 0;
  const usesDiesel = spec.dieselKva > 0;
  const dieselRunning = usesDiesel && night && gen >= 0.3;
  const loadColor = dieselRunning ? tk.amber : tk.cyan;

  const twoCols = c.rows > 6;
  const arrayX = twoCols ? -4.75 : -3.2;
  const arrayZ = -4.0;
  const battery = V(0.95, 0, -1.9);
  const hub = V(2.6, 0.06, -0.3);
  const solarC = V(twoCols ? -2.95 : -3.2, 0.45, -1.8);
  const windP = V(-4.4, 0.3, 2.5);
  const hydroP = V(-1.4, 0.5, 3.3);
  const dieselP = V(1.15, 0, 1.3);
  const houseCenter = V(4.9, 0.3, 0.1);
  const lift = 0.22;

  const sky = night ? (tk.dark ? '#05040a' : '#1c1430') : tk.dark ? '#140e22' : '#efe9fb';
  const groundColor = tk.dark ? (night ? '#151021' : '#2a2040') : night ? '#4a3f63' : '#ddd3f0';

  const pvActive = genOn && !night && c.rows > 0;
  const battActive = genOn && c.modules > 0;
  const loadActive = (p: number) => p >= 1 && genOn;

  return (
    <>
      <color attach="background" args={[sky]} />
      <FitOrtho />
      <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={0.55} maxPolarAngle={1.1} minAzimuthAngle={Math.PI / 4 - 0.7} maxAzimuthAngle={Math.PI / 4 + 0.7} enableDamping />
      <ambientLight intensity={night ? 0.22 : 0.75} color={night ? '#7fa8ff' : '#ffffff'} />
      <directionalLight position={night ? [6, 10, -4] : [-6, 12, 7]} intensity={night ? 0.35 : 2.1} color={night ? '#9db8ff' : '#fff4dd'} />
      <hemisphereLight args={[night ? '#2a1f5a' : '#e0d4ff', groundColor, night ? 0.25 : 0.4]} />
      {night && <Stars radius={40} depth={20} count={900} factor={2.5} fade speed={0.4} />}

      <RoundedBox args={[14.6, 0.3, 9.6]} radius={0.14} smoothness={3} position={[0, -0.15, 0]}>
        <meshStandardMaterial color={groundColor} roughness={0.95} />
      </RoundedBox>
      <mesh position={[2.6, 0.005, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.55, 9.2]} />
        <meshStandardMaterial color={tk.dark ? '#3a2d55' : '#c4b6e0'} roughness={1} />
      </mesh>

      {/* Generation */}
      {c.rows > 0 && <SolarArray rows={c.rows} columns={twoCols ? 2 : 1} built={build ? Math.round(c.rows * gen) : undefined} position={[arrayX, 0, arrayZ]} />}
      {Array.from({ length: c.turbines }, (_, i) => (
        <WindTurbine key={i} position={[-5.8 + i * 1.4, 0, 2.4 + (i % 2) * 0.4]} speed={windMean} ghost={build ? gen < 0.6 : false} />
      ))}
      {spec.hydroKw > 0 && (
        <>
          <Stream position={[-3.0, 0, 4.15]} length={7} width={0.75} />
          <HydroTurbine position={[hydroP.x, 0, hydroP.z]} rotation={[0, -0.2, 0]} ghost={build ? gen < 0.6 : false} />
        </>
      )}
      {c.modules > 0 && <BatteryRack modules={c.modules} built={build ? Math.round(c.modules * gen) : undefined} active={battActive} position={[battery.x - 0.6, 0, battery.z]} />}
      <DieselGen used={usesDiesel} running={dieselRunning} ghost={build && usesDiesel ? gen < 0.3 : false} position={[dieselP.x, 0, dieselP.z]} />

      {/* Loads */}
      {c.clinic && <Clinic position={[4.0, 0, -3.4]} lit={loadActive(loadP('clinic'))} ghost={loadP('clinic') <= 0} />}
      {c.school && <School position={[6.05, 0, -3.4]} lit={loadActive(loadP('school')) && night} ghost={loadP('school') <= 0} />}
      {Array.from({ length: c.houses }, (_, i) => (
        <House key={i} variant={i} position={[3.8 + (i % 3) * 1.1, 0, -1.6 + Math.floor(i / 3) * 1.1]} lit={i < homesBuilt && genOn && night} ghost={i >= homesBuilt} />
      ))}
      {Array.from({ length: c.pumps }, (_, i) => (
        <Pump key={i} position={[6.4 - i * 1.0, 0, 3.45]} running={loadActive(loadP('pumps')) && !night} ghost={loadP('pumps') <= 0} />
      ))}
      {c.lights &&
        [-3.6, -1.8, 0, 1.8, 3.6].map((z) => <StreetLight key={z} position={[2.95, 0, z]} lit={night && loadActive(loadP('streetlights'))} ghost={loadP('streetlights') <= 0} />)}

      {/* Energy flows */}
      {c.rows > 0 && c.modules > 0 && <FlowTube points={arcPoints(solarC, V(battery.x, 0.9, battery.z), lift)} from={tk.amber} to={tk.mint} active={pvActive} />}
      {c.turbines > 0 && <FlowTube points={arcPoints(windP, V(battery.x, 0.8, battery.z), lift)} from={tk.aqua} to={tk.mint} active={genOn && gen >= 0.6} offset={0.3} />}
      {spec.hydroKw > 0 && <FlowTube points={arcPoints(hydroP, V(battery.x, 0.8, battery.z), lift)} from={tk.hydro} to={tk.mint} active={genOn && gen >= 0.6} offset={0.6} />}
      {c.modules > 0 && <FlowTube points={arcPoints(V(battery.x + 0.3, 0.9, battery.z), hub, lift)} from={tk.mint} to={loadColor} active={battActive && (night || !pvActive)} offset={0.2} />}
      {c.rows > 0 && <FlowTube points={arcPoints(solarC, hub, 0.12)} from={tk.amber} to={tk.cyan} active={pvActive} offset={0.5} />}
      {usesDiesel && <FlowTube points={arcPoints(V(dieselP.x, 0.6, dieselP.z), hub, lift)} from={tk.amber} to={tk.amber} active={dieselRunning} />}
      {c.clinic && <FlowTube points={arcPoints(hub, V(4.0, 0.8, -3.4), lift)} from={loadColor} to={loadColor} active={loadActive(loadP('clinic'))} offset={0.1} />}
      {c.school && <FlowTube points={arcPoints(hub, V(6.05, 0.7, -3.4), lift)} from={loadColor} to={loadColor} active={loadActive(loadP('school')) && !night} offset={0.4} />}
      {c.houses > 0 && <FlowTube points={arcPoints(hub, houseCenter, lift)} from={loadColor} to={loadColor} active={homesBuilt > 0 && genOn} offset={0.7} />}
      {c.pumps > 0 && <FlowTube points={arcPoints(hub, V(5.9, 1.0, 3.45), lift)} from={loadColor} to={tk.hydro} active={loadActive(loadP('pumps')) && !night} offset={0.25} />}

      {/* Labels */}
      {c.rows > 0 && <Label position={[solarC.x, 1.4, arrayZ - 0.2]}>{t('scene.pv', { v: fmtNum(spec.pvKwp, 1) })}</Label>}
      {c.modules > 0 && <Label position={[battery.x, 1.9, battery.z]}>{t('scene.battery', { v: fmtNum(spec.batteryKwh, 0) })}</Label>}
      {c.turbines > 0 && <Label position={[-4.4, 3.7, 2.5]}>{t('scene.wind', { v: fmtNum(spec.windKw, 1) })}</Label>}
      {spec.hydroKw > 0 && <Label position={[hydroP.x, 1.5, hydroP.z]}>{t('scene.hydro', { v: fmtNum(spec.hydroKw, 1) })}</Label>}
      <Label position={[dieselP.x, 1.25, dieselP.z]} tone={usesDiesel ? 'amber' : 'muted'}>
        {usesDiesel ? t('scene.diesel', { v: fmtNum(spec.dieselKva, 1) }) : t('scene.dieselOff')}
      </Label>
      {c.houses > 0 && <Label position={[4.9, 1.2, 2.3]}>{t('scene.homes', { n: fmtNum(c.homes) })}</Label>}

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={night ? 1.1 : 0.7} luminanceThreshold={0.55} luminanceSmoothing={0.25} radius={0.6} />
      </EffectComposer>
    </>
  );
}

/** Text/diagram equivalent of the 3D scene. */
export function SystemFallback({ spec, demand }: { spec: SystemSpec; demand: DemandResult }) {
  const { t } = useTranslation();
  const gen = [
    spec.pvKwp > 0 && { k: 'solar' as const, v: t('scene.pv', { v: fmtNum(spec.pvKwp, 1) }) },
    spec.windKw > 0 && { k: 'wind' as const, v: t('scene.wind', { v: fmtNum(spec.windKw, 1) }) },
    spec.hydroKw > 0 && { k: 'hydro' as const, v: t('scene.hydro', { v: fmtNum(spec.hydroKw, 1) }) },
    spec.dieselKva > 0 && { k: 'diesel' as const, v: t('scene.diesel', { v: fmtNum(spec.dieselKva, 1) }) },
  ].filter(Boolean) as { k: 'solar' | 'wind' | 'hydro' | 'diesel'; v: string }[];
  const loads = demand.loads;
  return (
    <div className="flex h-full flex-col items-stretch justify-center gap-3 p-5 sm:flex-row sm:items-center">
      <ul className="flex flex-1 flex-col gap-2" aria-label={t('scene.generation')}>
        {gen.map((g) => (
          <li key={g.k} className="flex items-center gap-2 rounded-btn border border-line/40 px-3 py-2 text-sm">
            <ResourceIcon kind={g.k} className="text-aqua" /> {g.v}
          </li>
        ))}
      </ul>
      <ArrowRight className="mx-auto shrink-0 rotate-90 text-cyan sm:rotate-0" aria-hidden />
      <div className="flex flex-1 items-center gap-2 rounded-btn border border-mint/40 px-3 py-3 text-sm">
        <ResourceIcon kind="battery" className="text-mint" /> {t('scene.battery', { v: fmtNum(spec.batteryKwh, 0) })}
      </div>
      <ArrowRight className="mx-auto shrink-0 rotate-90 text-cyan sm:rotate-0" aria-hidden />
      <ul className="flex flex-1 flex-col gap-2" aria-label={t('scene.loads')}>
        {loads.map((l) => (
          <li key={l.kind} className="flex items-center justify-between gap-2 rounded-btn border border-line/40 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <ResourceIcon kind={l.kind === 'pumps' ? 'pump' : l.kind} className="text-aqua" />
              {t(`loads.${l.kind}`)}
            </span>
            <span className="num text-xs text-muted">{fmtNum(l.kwhDay, 1)} kWh/d</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SystemScene(props: SystemSceneProps) {
  const { t } = useTranslation();
  return (
    <SceneShell
      className={clsx('overflow-hidden rounded-card', props.className)}
      label={props.label ?? t('scene.aria')}
      canvas={{ orthographic: true, camera: { position: [11, 10, 11], zoom: 40, near: 0.1, far: 100 } }}
      fallback={<SystemFallback spec={props.spec} demand={props.demand} />}
    >
      <Diorama {...props} />
    </SceneShell>
  );
}
