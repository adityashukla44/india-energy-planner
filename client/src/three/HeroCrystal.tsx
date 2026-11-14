import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStaticMotion } from '../lib/hooks';
import { SceneShell } from './core';

/** Faceted energy crystal with a glowing core and orbiting sparks; follows the pointer. */
function Crystal() {
  const group = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Mesh>(null);
  const cage = useRef<THREE.LineSegments>(null);
  const sparks = useRef<THREE.Group>(null);
  const staticMotion = useStaticMotion();
  const geom = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const cageGeom = useMemo(() => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.32, 0)), []);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#8b5cf6',
        emissive: '#3b0a8f',
        emissiveIntensity: 0.6,
        roughness: 0.18,
        metalness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        iridescence: 0.9,
        iridescenceIOR: 1.6,
        flatShading: true,
        transparent: true,
        opacity: 0.94,
      }),
    [],
  );
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#F5B544').multiplyScalar(1.6), toneMapped: false }), []);
  useFrame(({ clock, pointer }, dt) => {
    const t = clock.getElapsedTime();
    if (!group.current) return;
    if (!staticMotion) {
      group.current.rotation.y += dt * 0.35;
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -pointer.y * 0.5 + Math.sin(t * 0.6) * 0.1, 0.05);
      group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, pointer.x * 0.35, 0.05);
      group.current.position.y = Math.sin(t * 1.1) * 0.06;
      if (cage.current) cage.current.rotation.y -= dt * 0.6;
      if (sparks.current) sparks.current.rotation.y += dt * 1.2;
      if (shell.current) shell.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.015);
    }
  });
  return (
    <group ref={group}>
      <mesh ref={shell} geometry={geom} material={mat} />
      <mesh material={coreMat}>
        <icosahedronGeometry args={[0.34, 0]} />
      </mesh>
      <lineSegments ref={cage} geometry={cageGeom}>
        <lineBasicMaterial color="#c484fc" transparent opacity={0.55} toneMapped={false} />
      </lineSegments>
      <group ref={sparks} rotation={[0.5, 0, 0.3]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.55, Math.sin(a * 2) * 0.25, Math.sin(a) * 1.55]} material={coreMat}>
              <sphereGeometry args={[0.045, 10, 10]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export default function HeroCrystal({ className, label }: { className?: string; label: string }) {
  return (
    <SceneShell
      className={className}
      label={label}
      toggle={false}
      canvas={{ camera: { position: [0, 0, 4.6], fov: 40 }, gl: { antialias: true, alpha: true, powerPreference: 'high-performance' } }}
      fallback={<span className="absolute inset-0 grid place-items-center rounded-full bg-gradient-to-br from-aqua via-teal to-amber" aria-hidden />}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[3, 3, 4]} intensity={60} color="#ffffff" />
      <pointLight position={[-4, -1, 2]} intensity={45} color="#c484fc" />
      <pointLight position={[0, -3, 3]} intensity={30} color="#F5B544" />
      <pointLight position={[0, 0, 0]} intensity={6} color="#F5B544" distance={3} />
      <Crystal />
    </SceneShell>
  );
}
