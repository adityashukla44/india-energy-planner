import { Canvas, useFrame, type CanvasProps } from '@react-three/fiber';
import clsx from 'clsx';
import { Box, Square } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { ErrorBoundary } from '../components/ui/extras';
import { hasWebGL, useInView, useStaticMotion } from '../lib/hooks';
import { useAppStore } from '../store/useAppStore';
import { loadBoundary, type BoundaryGeo } from './geo';

/**
 * Canvas wrapper: caps DPR at 1.75, pauses when off-screen, renders a single static frame under
 * reduced motion / low power, and falls back to an equivalent 2D view (no WebGL, error, or user toggle).
 */
export function SceneShell({
  children,
  fallback,
  label,
  className,
  canvas,
  toggle = true,
  toggleClassName,
}: {
  children: ReactNode;
  fallback: ReactNode;
  label: string;
  className?: string;
  canvas?: Partial<CanvasProps>;
  toggle?: boolean;
  toggleClassName?: string;
}) {
  const prefer2D = useAppStore((s) => s.prefer2D);
  const staticMotion = useStaticMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [ok] = useState(() => hasWebGL());
  const show3D = ok && !prefer2D;
  return (
    <div ref={ref} className={clsx(!/\b(absolute|fixed)\b/.test(className ?? '') && 'relative', className)}>
      {show3D ? (
        <ErrorBoundary fallback={fallback}>
          <div className="absolute inset-0" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
            <Canvas
              dpr={[1, 1.75]}
              frameloop={!inView ? 'never' : staticMotion ? 'demand' : 'always'}
              gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
              {...canvas}
            >
              <Suspense fallback={null}>{children}</Suspense>
            </Canvas>
          </div>
        </ErrorBoundary>
      ) : (
        fallback
      )}
      {toggle && ok && <ViewToggle className={toggleClassName} />}
    </div>
  );
}

export function ViewToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const prefer2D = useAppStore((s) => s.prefer2D);
  const set = useAppStore((s) => s.setPrefer2D);
  return (
    <button
      type="button"
      onClick={() => set(!prefer2D)}
      className={clsx('glass absolute z-10 flex h-10 items-center gap-1.5 rounded-btn px-3 text-xs font-medium text-text hover:border-aqua/60', className ?? 'bottom-3 right-3')}
      aria-pressed={prefer2D}
    >
      {prefer2D ? <Box size={14} aria-hidden /> : <Square size={14} aria-hidden />}
      {prefer2D ? t('scene.view3d') : t('scene.view2d')}
    </button>
  );
}

export function useBoundary(): BoundaryGeo | null {
  const [g, setG] = useState<BoundaryGeo | null>(null);
  useEffect(() => {
    let alive = true;
    loadBoundary().then((x) => alive && setG(x));
    return () => {
      alive = false;
    };
  }, []);
  return g;
}

/** India extruded as a dark glossy slab, with glowing edge and faint raised state outlines. */
export function IndiaSlab({
  geo,
  depth = 0.32,
  dark = true,
  stateOpacity = 0.3,
  edgeColor = '#C484FC',
  stateColor = '#A78BFA',
}: {
  geo: BoundaryGeo;
  depth?: number;
  dark?: boolean;
  stateOpacity?: number;
  edgeColor?: string;
  stateColor?: string;
}) {
  const geom = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(geo.shapes, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 1, curveSegments: 1 });
    g.computeVertexNormals();
    return g;
  }, [geo, depth]);
  const stateGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(geo.stateSegments, 3));
    return g;
  }, [geo]);
  const edgeGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(geo.countrySegments, 3));
    return g;
  }, [geo]);
  const mats = useMemo(
    () => [
      new THREE.MeshPhysicalMaterial({
        color: dark ? '#1a1230' : '#2a1d4a',
        roughness: 0.42,
        metalness: 0.15,
        clearcoat: 0.9,
        clearcoatRoughness: 0.28,
        emissive: '#0d0618',
        emissiveIntensity: 0.4,
      }),
      new THREE.MeshStandardMaterial({ color: '#5b21b6', roughness: 0.6, metalness: 0.2, emissive: '#5b21b6', emissiveIntensity: dark ? 0.55 : 0.35 }),
    ],
    [dark],
  );
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <group rotation-x={-Math.PI / 2}>
      <mesh geometry={geom} material={mats} receiveShadow />
      <lineSegments geometry={stateGeom} position-z={depth + 0.032}>
        <lineBasicMaterial color={stateColor} transparent opacity={stateOpacity} toneMapped={false} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={edgeGeom} position-z={depth + 0.034}>
        <lineBasicMaterial color={edgeColor} transparent opacity={0.95} toneMapped={false} />
      </lineSegments>
      <lineSegments geometry={edgeGeom} position-z={-0.01}>
        <lineBasicMaterial color={edgeColor} transparent opacity={0.35} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

/* ---------- Shaders ---------- */
const pillarVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const pillarFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
  void main() {
    float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.7) * uOpacity;
    gl_FragColor = vec4(uColor * 1.8, a);
  }
`;
export function makePillarMaterial(color: string, opacity = 0.75) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: pillarVert,
    fragmentShader: pillarFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

const flowVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const flowFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uActive; uniform float uSpeed; uniform float uOffset; uniform float uDash;
  varying vec2 vUv;
  void main() {
    float d = fract(vUv.x * uDash - uTime * uSpeed + uOffset);
    float pulse = smoothstep(0.55, 1.0, d) ;
    float base = mix(0.08, 0.28, uActive);
    float a = base + uActive * pulse * 0.9;
    vec3 c = mix(uA, uB, vUv.x) * (1.0 + pulse * uActive * 1.6);
    gl_FragColor = vec4(c, a);
  }
`;

/** Glowing tube with pulses travelling from start to end (energy flow). */
export function FlowTube({
  points,
  from = '#F5B544',
  to = '#C484FC',
  active = true,
  radius = 0.03,
  speed = 0.6,
  dash = 2,
  offset = 0,
  segments = 48,
}: {
  points: THREE.Vector3[];
  from?: string;
  to?: string;
  active?: boolean;
  radius?: number;
  speed?: number;
  dash?: number;
  offset?: number;
  segments?: number;
}) {
  const key = points.map((p) => p.toArray().map((x) => x.toFixed(3)).join(',')).join('|');
  const geom = useMemo(() => {
    const curve = points.length === 3 ? new THREE.QuadraticBezierCurve3(points[0], points[1], points[2]) : new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, segments, radius, 6, false);
  }, [key, radius, segments]); // eslint-disable-line react-hooks/exhaustive-deps
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uA: { value: new THREE.Color(from) },
          uB: { value: new THREE.Color(to) },
          uActive: { value: active ? 1 : 0 },
          uSpeed: { value: speed },
          uOffset: { value: offset },
          uDash: { value: dash },
        },
        vertexShader: flowVert,
        fragmentShader: flowFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    mat.uniforms.uA.value.set(from);
    mat.uniforms.uB.value.set(to);
    mat.uniforms.uSpeed.value = speed;
    mat.uniforms.uDash.value = dash;
    mat.uniforms.uOffset.value = offset;
  }, [from, to, speed, dash, offset, mat]);
  const target = useRef(active ? 1 : 0);
  target.current = active ? 1 : 0;
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
    const u = mat.uniforms.uActive;
    u.value += (target.current - u.value) * Math.min(1, dt * 4);
  });
  useEffect(() => {
    mat.uniforms.uActive.value = active ? 1 : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={geom} material={mat} />;
}

/** Raised arc between two ground points. */
export function arcPoints(a: THREE.Vector3, b: THREE.Vector3, lift = 0.35): THREE.Vector3[] {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += a.distanceTo(b) * lift + 0.2;
  return [a, mid, b];
}
