import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { StationDecoration } from '@/api/snowEvent';

// All placement coordinates are in the Blender world's metres. X is shared;
// Blender's Y (depth) becomes Three.js -Z. No screen-space stickers or offsets.
function placement(slot: number): [number, number] {
  const region = Math.min(3, Math.max(0, Math.floor(slot / 16)));
  const index = ((slot % 16) + 16) % 16;
  if (region === 0) {
    const angle = index * Math.PI / 8;
    const x = Math.cos(angle) * 5.85;
    const y = -.25 + Math.sin(angle) * 5.85;
    return [y < -4.5 && Math.abs(x) < 2.6 ? (x < 0 ? -3.4 : 3.4) : x, y];
  }
  if (region === 1) return [-11.2 + (index % 8) * 1.24, 2.7 - Math.floor(index / 8) * 1.1];
  if (region === 2) return [4.55 + (index % 8) * .72, 3.88 - Math.floor(index / 8) * 1.12];
  return [index < 8 ? -14.4 + (index % 4) * 1.6 : 9.6 + ((index - 8) % 4) * 1.6,
    -6.2 - Math.floor((index % 8) / 4) * 2.3];
}

function clearDecorationGroup(group: THREE.Group | null) {
  if (!group) return;
  group.removeFromParent();
  group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(m => m.dispose());
    }
  });
}

function buildDecorations(items: StationDecoration[]) {
  const group = new THREE.Group();
  group.name = 'Participant ornaments mounted on the station ground';
  const add = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    mesh.castShadow = true;
    parent.add(mesh);
  };
  for (const item of items) {
    if (item.slot < 0 || item.slot >= 64) continue;
    const [x, depth] = placement(item.slot);
    const base = new THREE.Group();
    base.position.set(x, .22, -depth);
    add(base,new THREE.CylinderGeometry(.31,.36,.15,12),
      new THREE.MeshStandardMaterial({color:'#665c72',roughness:.82}),0,0,0);
    const metal = () => new THREE.MeshStandardMaterial({color:'#d2a76b',metalness:.7,roughness:.25});
    const lavender = () => new THREE.MeshStandardMaterial({color:'#8c6dca',metalness:.22,roughness:.38});
    const glow = () => new THREE.MeshStandardMaterial({color:'#ffe1a1',emissive:'#f5aa55',emissiveIntensity:1.45});
    if (item.kind === 'lantern') {
      add(base,new THREE.CylinderGeometry(.035,.04,.69,10),metal(),0,.42,0);
      add(base,new THREE.BoxGeometry(.25,.27,.25),glow(),0,.84,0);
      add(base,new THREE.ConeGeometry(.19,.14,4),metal(),0,1.04,0);
    } else if (item.kind === 'gift') {
      add(base,new THREE.BoxGeometry(.48,.43,.45),lavender(),0,.32,0);
      add(base,new THREE.BoxGeometry(.49,.44,.075),metal(),0,.32,0);
      add(base,new THREE.BoxGeometry(.075,.44,.46),metal(),0,.32,0);
    } else if (item.kind === 'star') {
      add(base,new THREE.CylinderGeometry(.035,.035,.39,9),metal(),0,.36,0);
      add(base,new THREE.IcosahedronGeometry(.28,0),glow(),0,.74,0);
    } else if (item.kind === 'crystal') {
      add(base,new THREE.OctahedronGeometry(.35),new THREE.MeshPhysicalMaterial({color:'#9fddf2',roughness:.12,metalness:.16,clearcoat:1}),0,.48,0);
    } else {
      add(base,new THREE.CylinderGeometry(.032,.032,.39,9),metal(),0,.32,0);
      add(base,new THREE.SphereGeometry(.29,14,12),lavender(),0,.69,0);
      add(base,new THREE.SphereGeometry(.08,10,8),metal(),0,.98,0);
    }
    group.add(base);
  }
  return group;
}

/** One exported 3D world. No generated frame patches or floating HTML decorations. */
export default function SnowDiorama3D({ stage, label, compact = false, decorations = [] }: {
  stage: number; label: string; compact?: boolean; decorations?: StationDecoration[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<THREE.Object3D | null>(null);
  const decorationGroup = useRef<THREE.Group | null>(null);
  const draw = useRef<(() => void) | null>(null);
  const latestStage = useRef(stage);
  const latestDecorations = useRef(decorations);
  latestStage.current = stage;
  latestDecorations.current = decorations;
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let cancelled = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let observer: ResizeObserver | null = null;
    let scene: THREE.Scene | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.4;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute('aria-label', `Трёхмерная станция XSG: ${label}`);
      element.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      scene.background = new THREE.Color('#372b55');
      scene.fog = new THREE.Fog('#3d325c', 40, 115);
      scene.add(new THREE.HemisphereLight(0xd9d7ff, 0x3a3653, 2.7));
      const sun = new THREE.DirectionalLight(0xffe6c5, 2.4);
      sun.position.set(-11, 20, 13);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
      sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
      sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 65;
      sun.shadow.bias = -0.00025;
      scene.add(sun);
      for (const [x, y, z, color, strength] of [
        [-7, 5, -1.8, 0xffbb80, 95],
        [7, 5, -3.5, 0xffba81, 100],
        [0, 6, 2, 0xc3a7ff, 115],
      ] as const) {
        const light = new THREE.PointLight(color, strength, 13, 1.7);
        light.position.set(x, y, z);
        scene.add(light);
      }

      const camera = new THREE.OrthographicCamera(-17,17,10.625,-10.625,.1,125);
      camera.position.set(0,16.5,27.8);
      camera.lookAt(0,2.25,-1.3);
      const render = () => renderer?.render(scene!, camera);
      draw.current = render;
      const resize = () => {
        if (!renderer) return;
        const width = Math.max(1,element.clientWidth);
        const height = Math.max(1,element.clientHeight);
        const aspect = width/height;
        // Fixed composition at every event stage; mobile sees the entire world.
        const halfWidth = 17;
        camera.left = -halfWidth;
        camera.right = halfWidth;
        camera.top = halfWidth/aspect;
        camera.bottom = -halfWidth/aspect;
        camera.updateProjectionMatrix();
        renderer.setSize(width,height,false);
        render();
      };
      observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      const loader = new GLTFLoader();
      loader.load('/xsg-snow-assets/snow-station-3d.glb', (gltf) => {
        if (cancelled || !scene) {
          gltf.scene.traverse(object => {
            if (object instanceof THREE.Mesh) { object.geometry.dispose(); }
          });
          return;
        }
        world.current = gltf.scene;
        gltf.scene.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            const cutoff = Number(object.userData.snow_stage ?? 0);
            object.visible = cutoff <= latestStage.current;
          }
        });
        scene.add(gltf.scene);
        decorationGroup.current = buildDecorations(latestDecorations.current);
        gltf.scene.add(decorationGroup.current);
        setStatus('ready');
        resize();
      }, undefined, () => { if (!cancelled) setStatus('fallback'); });
    } catch {
      setStatus('fallback');
    }
    return () => {
      cancelled = true;
      observer?.disconnect();
      draw.current = null;
      clearDecorationGroup(decorationGroup.current);
      decorationGroup.current = null;
      world.current?.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(material => material.dispose());
        }
      });
      world.current = null;
      renderer?.dispose();
      if (renderer?.domElement.parentElement === element) element.removeChild(renderer.domElement);
    };
  // The stage is changed independently below; never recreate the whole GPU scene.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    world.current?.traverse(object => {
      if (object instanceof THREE.Mesh) object.visible = Number(object.userData.snow_stage ?? 0) <= stage;
    });
    draw.current?.();
  }, [stage]);

  useEffect(() => {
    if (!world.current) return;
    clearDecorationGroup(decorationGroup.current);
    decorationGroup.current = buildDecorations(decorations);
    world.current.add(decorationGroup.current);
    draw.current?.();
  }, [decorations]);

  return <figure className={`sd-scene ${compact ? 'sd-scene--compact' : ''}`}>
    <div ref={host} className="sd-scene-canvas" />
    {status !== 'ready' && <div className="sd-scene-poster">
      <img src="/xsg-snow-assets/snow-diorama-fallback.webp" width="1600" height="1024" alt="Зимний дата-центр XSG, украшенная площадь и мастерская" />
      {status === 'loading' && <span className="sd-loading">Готовим зимнюю станцию…</span>}
    </div>}
    <figcaption><span><i /> Зимняя станция XSG</span><strong>{stage} / 25</strong></figcaption>
  </figure>;
}
