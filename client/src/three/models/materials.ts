import * as THREE from 'three';

/** Procedural solar-cell texture (no external downloads). */
function panelTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#14305e';
  g.fillRect(0, 0, 64, 96);
  g.strokeStyle = '#6f8fc0';
  g.lineWidth = 1;
  for (let x = 0; x <= 64; x += 16) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, 96);
    g.stroke();
  }
  for (let y = 0; y <= 96; y += 16) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(64, y + 0.5);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, ...o });

let real: ReturnType<typeof makeReal> | null = null;
function makeReal() {
  return {
    panel: std({ map: panelTexture(), metalness: 0.55, roughness: 0.25, emissive: '#0a2a55', emissiveIntensity: 0.35 }),
    frame: std({ color: '#c7d3d9', metalness: 0.7, roughness: 0.35 }),
    metal: std({ color: '#8fa3ad', metalness: 0.65, roughness: 0.35 }),
    white: std({ color: '#eef3f4', roughness: 0.55 }),
    concrete: std({ color: '#a4aeb2', roughness: 0.85 }),
    dark: std({ color: '#2b3a40', roughness: 0.7 }),
    roof: std({ color: '#b5583d', roughness: 0.75 }),
    roofTeal: std({ color: '#7C3AED', roughness: 0.6 }),
    red: std({ color: '#e0303f', emissive: '#e0303f', emissiveIntensity: 0.35 }),
    battery: std({ color: '#244752', metalness: 0.4, roughness: 0.4 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color('#45DFB1').multiplyScalar(2.2), toneMapped: false }),
    ledOff: new THREE.MeshBasicMaterial({ color: '#1d3a3a' }),
    water: std({ color: '#3B8BFF', emissive: '#1d5fd6', emissiveIntensity: 0.45, transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.1 }),
    windowLit: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(2.4), toneMapped: false }),
    windowOff: std({ color: '#2a3940', roughness: 0.3, metalness: 0.4 }),
    genset: std({ color: '#d9a43b', roughness: 0.5, metalness: 0.3 }),
    gensetOff: std({ color: '#6d7a80', roughness: 0.8, transparent: true, opacity: 0.55 }),
    gensetHot: std({ color: '#F5B544', emissive: '#F5B544', emissiveIntensity: 0.9 }),
    green: std({ color: '#4aa86a', roughness: 0.8 }),
    silo: std({ color: '#7fae6f', roughness: 0.6, metalness: 0.2 }),
    rock: std({ color: '#6b5a52', roughness: 0.95, flatShading: true }),
    steam: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }),
    smoke: new THREE.MeshBasicMaterial({ color: '#9aa4a8', transparent: true, opacity: 0.4, depthWrite: false }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1c2').multiplyScalar(3), toneMapped: false }),
    bulbOff: std({ color: '#5b666b' }),
    flag: std({ color: '#F5B544', side: THREE.DoubleSide }),
    geoGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color('#FF7A59').multiplyScalar(2), toneMapped: false }),
  };
}

export type Mats = ReturnType<typeof makeReal>;

let ghost: Mats | null = null;
const ghostMaterial = () =>
  new THREE.MeshBasicMaterial({ color: '#C484FC', wireframe: true, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false });

/** Shared materials; `ghost` returns a wireframe set used for parts not yet built (rollout). */
export function mats(isGhost = false): Mats {
  if (!real) real = makeReal();
  if (!isGhost) return real;
  if (!ghost) {
    const g = ghostMaterial();
    ghost = Object.fromEntries(Object.keys(real).map((k) => [k, g])) as unknown as Mats;
  }
  return ghost;
}

/** Shared geometries. */
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  sphere: new THREE.SphereGeometry(0.5, 16, 12),
  pyramid: (() => {
    const g = new THREE.ConeGeometry(0.72, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    return g;
  })(),
  prism: (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0);
    s.lineTo(0.5, 0);
    s.lineTo(0, 0.5);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    g.translate(0, 0, -0.5);
    return g;
  })(),
  dodeca: new THREE.DodecahedronGeometry(0.5, 0),
};
