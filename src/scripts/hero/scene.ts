// Hero scene: "from noise to structure, from statics to dynamics".
//
//   denoise      particles flow from Gaussian noise onto the letter surfaces (t: 1000 → 0)
//   materialize  particles hand over to solid clay letters
//   solid        letters are rigid bodies: push them with the cursor, drop balls on them
//   noising      "re-generate": letters dissolve back into noise (t: 0 → 1000), then denoise again
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import fontData from './font.typeface.json';

type ThemeName = 'light' | 'dark';
type Phase = 'denoise' | 'materialize' | 'solid' | 'noising';

export interface HeroOptions {
  words: string[];
  content: HTMLElement | null;
  status: HTMLElement | null;
  ballButton: HTMLButtonElement | null;
  regenButton: HTMLButtonElement | null;
}

interface Letter {
  mesh: THREE.Mesh<TextGeometry, THREE.MeshPhysicalMaterial>;
  body: CANNON.Body;
  home: THREE.Vector3;
  /** Position along the name, 0..1, used for the colour gradient. */
  t: number;
}

interface Ball {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>;
  body: CANNON.Body;
}

const SIZE = 1;
const DEPTH = 0.44;
const BEVEL = 0.055;
const TRACKING = 0.07;
const WORD_GAP = 0.5;
const ROW_GAP = 2.6;
const GRAVITY = -24;
const MAX_BALLS = 6;
const HOLD_TIME = 0.35;
const DENOISE_TIME = 2.8;
const MATERIALIZE_TIME = 0.7;
const NOISE_TIME = 1.25;
const PUSHER_RADIUS = 0.42;
const PUSH_HEIGHT = 0.42;
const PUSH_MAX_SPEED = 16;

const PALETTE: Record<ThemeName, string[]> = {
  light: ['#ff7a4d', '#f2557f', '#b15ee6', '#6246ea'],
  dark: ['#ffb86b', '#ff7eb6', '#a78bfa', '#5eead4'],
};

const LOOK = {
  light: {
    env: 0.9,
    hemi: 0.55,
    ground: 0xd9c7ae,
    key: 2.4,
    rim: 0,
    shadow: 0.17,
    roughness: 0.4,
    clearcoat: 0.45,
    additive: false,
    pointSize: 0.036,
    pusher: '#5b3fe0',
  },
  dark: {
    env: 0.45,
    hemi: 0.22,
    ground: 0x1a1530,
    key: 1.5,
    rim: 26,
    shadow: 0.62,
    roughness: 0.32,
    clearcoat: 0.7,
    additive: true,
    pointSize: 0.032,
    pusher: '#a595ff',
  },
} satisfies Record<ThemeName, unknown>;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t: number) => t * t * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};

function gauss(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

function currentTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function paletteColor(stops: string[], t: number, out = new THREE.Color()): THREE.Color {
  const x = clamp01(t) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return out.set(stops[i]).lerp(new THREE.Color(stops[i + 1]), x - i);
}

function surfaceArea(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const index = geo.getIndex();
  const count = index ? index.count : pos.count;
  const tri = new THREE.Triangle();
  let area = 0;
  for (let i = 0; i < count; i += 3) {
    const a = index ? index.getX(i) : i;
    const b = index ? index.getX(i + 1) : i + 1;
    const c = index ? index.getX(i + 2) : i + 2;
    tri.a.fromBufferAttribute(pos, a);
    tri.b.fromBufferAttribute(pos, b);
    tri.c.fromBufferAttribute(pos, c);
    area += tri.getArea();
  }
  return area;
}

const particleVertex = /* glsl */ `
  uniform float uMix;
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  uniform float uJitter;
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aColor;
  attribute float aSeed;
  varying vec3 vColor;
  void main() {
    vec3 p = mix(aFrom, aTo, uMix);
    float k = uMix * (1.0 - uMix) * 4.0;
    float ph = aSeed * 6.2831853;
    vec3 wobble = vec3(
      sin(uTime * 1.9 + ph * 7.0),
      sin(uTime * 1.4 + ph * 3.0),
      cos(uTime * 1.6 + ph * 5.0)
    );
    p += wobble * (0.16 * k + 0.04 * uJitter);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale / -mv.z * (0.7 + 0.6 * aSeed);
    vColor = aColor;
  }
`;

const particleFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.15, d) * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createHero(stage: HTMLElement, opts: HeroOptions): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const fineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let theme = currentTheme();
  document.documentElement.classList.add('has-3d', 'hero-ready');

  // ---------------------------------------------------------------- renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xffffff, LOOK[theme].ground, LOOK[theme].hemi);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, LOOK[theme].key);
  key.position.set(-6, 11, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 40 });
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);

  const rim = new THREE.PointLight(0xa78bfa, LOOK[theme].rim, 30, 1.6);
  rim.position.set(0, 3.5, -5);
  scene.add(rim);

  const floorMat = new THREE.ShadowMaterial({ opacity: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ----------------------------------------------------------------- physics
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0), allowSleep: true });
  world.broadphase = new CANNON.SAPBroadphase(world);
  (world.solver as CANNON.GSSolver).iterations = 12;
  world.defaultContactMaterial.friction = 0.4;
  world.defaultContactMaterial.restitution = 0.12;

  const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  const pusherBody = new CANNON.Body({
    type: CANNON.Body.KINEMATIC,
    shape: new CANNON.Sphere(PUSHER_RADIUS),
    position: new CANNON.Vec3(0, -30, 0),
  });
  pusherBody.allowSleep = false;
  world.addBody(pusherBody);

  const pusher = new THREE.Mesh(
    new THREE.SphereGeometry(PUSHER_RADIUS, 32, 16),
    new THREE.MeshPhysicalMaterial({
      color: LOOK[theme].pusher,
      roughness: 0.15,
      clearcoat: 1,
      transparent: true,
      opacity: 0,
    }),
  );
  pusher.visible = false;
  scene.add(pusher);

  // ----------------------------------------------------------------- letters
  const font = new Font(fontData as any);
  const glyphs = font.data.glyphs as Record<string, { ha: number }>;
  const unit = SIZE / font.data.resolution;

  let letters: Letter[] = [];
  let walls: CANNON.Body[] = [];
  let bounds = { halfX: 8, zBack: -3, zFront: 3, width: 12, depth: 0, centerY: 0.42 };
  let twoRows = false;

  function buildLetters(rowsOfText: string[]) {
    for (const l of letters) {
      scene.remove(l.mesh);
      l.mesh.geometry.dispose();
      l.mesh.material.dispose();
      world.removeBody(l.body);
    }
    letters = [];
    const zs = rowsOfText.map((_, i) => (i - (rowsOfText.length - 1) / 2) * ROW_GAP);
    const total = rowsOfText.join('').replace(/ /g, '').length;
    let width = 0;
    let n = 0;
    rowsOfText.forEach((row, r) => {
      const placed: { geo: TextGeometry; x: number; size: THREE.Vector3 }[] = [];
      let pen = 0;
      for (const ch of row) {
        if (ch === ' ' || !glyphs[ch]) {
          pen += WORD_GAP;
          continue;
        }
        const geo = new TextGeometry(ch, {
          font,
          size: SIZE,
          depth: DEPTH,
          curveSegments: 10,
          bevelEnabled: true,
          bevelThickness: BEVEL,
          bevelSize: BEVEL * 0.8,
          bevelSegments: 4,
        });
        geo.computeBoundingBox();
        const box = geo.boundingBox!;
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        geo.translate(-center.x, -center.y, -center.z);
        placed.push({ geo, x: pen + center.x, size });
        pen += glyphs[ch].ha * unit + TRACKING;
      }
      const rowWidth = pen - TRACKING;
      width = Math.max(width, rowWidth);
      for (const p of placed) {
        const t = total > 1 ? n / (total - 1) : 0;
        const home = new THREE.Vector3(p.x - rowWidth / 2, p.size.y / 2, zs[r]);
        const mesh = new THREE.Mesh(
          p.geo,
          new THREE.MeshPhysicalMaterial({
            color: paletteColor(PALETTE[theme], t),
            roughness: LOOK[theme].roughness,
            metalness: 0,
            clearcoat: LOOK[theme].clearcoat,
            clearcoatRoughness: 0.35,
            transparent: true,
            opacity: 0,
          }),
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.copy(home);
        scene.add(mesh);
        const half = new CANNON.Vec3(p.size.x / 2 - BEVEL * 0.4, p.size.y / 2, p.size.z / 2);
        const body = new CANNON.Body({
          mass: 1,
          shape: new CANNON.Box(half),
          position: new CANNON.Vec3(home.x, home.y, home.z),
          linearDamping: 0.04,
          angularDamping: 0.06,
          allowSleep: true,
          sleepSpeedLimit: 0.12,
          sleepTimeLimit: 0.8,
        });
        letters.push({ mesh, body, home, t });
        n++;
      }
    });

    const zMin = Math.min(...zs);
    const zMax = Math.max(...zs);
    bounds = {
      halfX: width / 2 + 1.2,
      zBack: zMin - 2.2,
      zFront: zMax + 2.8,
      width,
      depth: zMax - zMin,
      centerY: letters.reduce((s, l) => s + l.home.y, 0) / Math.max(1, letters.length),
    };

    for (const w of walls) world.removeBody(w);
    walls = [];
    const h = 6;
    const thick = 0.5;
    const cz = (bounds.zBack + bounds.zFront) / 2;
    const halfZ = (bounds.zFront - bounds.zBack) / 2;
    const addWall = (half: CANNON.Vec3, pos: CANNON.Vec3) => {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(half), position: pos });
      world.addBody(body);
      walls.push(body);
    };
    addWall(new CANNON.Vec3(thick, h, halfZ + thick), new CANNON.Vec3(-bounds.halfX - thick, h, cz));
    addWall(new CANNON.Vec3(thick, h, halfZ + thick), new CANNON.Vec3(bounds.halfX + thick, h, cz));
    addWall(new CANNON.Vec3(bounds.halfX + thick, h, thick), new CANNON.Vec3(0, h, bounds.zBack - thick));
    addWall(new CANNON.Vec3(bounds.halfX + thick, h, thick), new CANNON.Vec3(0, h, bounds.zFront + thick));
  }

  function resetBodies() {
    for (const l of letters) {
      if (!world.bodies.includes(l.body)) world.addBody(l.body);
      l.body.position.set(l.home.x, l.home.y, l.home.z);
      l.body.quaternion.set(0, 0, 0, 1);
      l.body.velocity.setZero();
      l.body.angularVelocity.setZero();
      l.body.wakeUp();
      l.mesh.position.copy(l.home);
      l.mesh.quaternion.identity();
    }
  }

  function setLetterOpacity(a: number) {
    for (const l of letters) {
      const m = l.mesh.material;
      const transparent = a < 0.999;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = a;
      l.mesh.visible = a > 0.001;
    }
  }

  // --------------------------------------------------------------- particles
  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: LOOK[theme].pointSize },
      uScale: { value: 1000 },
      uJitter: { value: 1 },
      uOpacity: { value: 1 },
    },
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    transparent: true,
    depthWrite: false,
    blending: LOOK[theme].additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  let points: THREE.Points | null = null;
  let local = new Float32Array(0);
  let owner = new Uint16Array(0);
  let homeWorld = new Float32Array(0);
  let noise = new Float32Array(0);

  function buildParticles() {
    if (points) {
      scene.remove(points);
      points.geometry.dispose();
    }
    const target = coarse || stage.clientWidth < 700 ? 9000 : 20000;
    const areas = letters.map((l) => surfaceArea(l.mesh.geometry));
    const sum = areas.reduce((s, a) => s + a, 0) || 1;
    const counts = areas.map((a) => Math.max(60, Math.round((target * a) / sum)));
    const count = counts.reduce((s, c) => s + c, 0);
    local = new Float32Array(count * 3);
    owner = new Uint16Array(count);
    homeWorld = new Float32Array(count * 3);
    noise = new Float32Array(count * 3);
    const tmp = new THREE.Vector3();
    let k = 0;
    letters.forEach((l, li) => {
      const sampler = new MeshSurfaceSampler(l.mesh).build();
      for (let j = 0; j < counts[li]; j++, k++) {
        sampler.sample(tmp);
        local.set([tmp.x, tmp.y, tmp.z], k * 3);
        owner[k] = li;
        homeWorld.set([tmp.x + l.home.x, tmp.y + l.home.y, tmp.z + l.home.z], k * 3);
      }
    });
    const seeds = new Float32Array(count).map(() => Math.random());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(homeWorld), 3));
    geo.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aTo', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    points = new THREE.Points(geo, pMat);
    points.frustumCulled = false;
    points.renderOrder = 2;
    scene.add(points);
    colorParticles();
  }

  function colorParticles() {
    if (!points) return;
    const attr = points.geometry.getAttribute('aColor') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const letterColors = letters.map((l) => paletteColor(PALETTE[theme], l.t));
    const c = new THREE.Color();
    for (let i = 0; i < owner.length; i++) {
      c.copy(letterColors[owner[i]]).multiplyScalar(0.9 + Math.random() * 0.2);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    attr.needsUpdate = true;
  }

  function sampleNoise() {
    const sx = Math.max(2.2, bounds.width * 0.3);
    const sz = 1.3 + bounds.depth * 0.4;
    for (let i = 0; i < owner.length; i++) {
      noise[i * 3] = gauss() * sx;
      noise[i * 3 + 1] = 1.3 + gauss() * 1.0;
      noise[i * 3 + 2] = gauss() * sz;
    }
  }

  function setPath(from: Float32Array, to: Float32Array) {
    if (!points) return;
    const a = points.geometry.getAttribute('aFrom') as THREE.BufferAttribute;
    const b = points.geometry.getAttribute('aTo') as THREE.BufferAttribute;
    (a.array as Float32Array).set(from);
    (b.array as Float32Array).set(to);
    a.needsUpdate = true;
    b.needsUpdate = true;
  }

  function currentSurface(): Float32Array {
    const out = new Float32Array(owner.length * 3);
    const v = new THREE.Vector3();
    for (const l of letters) l.mesh.updateMatrixWorld();
    for (let i = 0; i < owner.length; i++) {
      v.fromArray(local, i * 3).applyMatrix4(letters[owner[i]].mesh.matrixWorld);
      v.toArray(out, i * 3);
    }
    return out;
  }

  // ------------------------------------------------------------------- balls
  const balls: Ball[] = [];
  const ballGeo = new THREE.SphereGeometry(0.5, 40, 24);

  function removeBall(ball: Ball) {
    scene.remove(ball.mesh);
    ball.mesh.material.dispose();
    world.removeBody(ball.body);
  }

  function dropBall() {
    if (!letters.length) return;
    const target = letters[Math.floor(Math.random() * letters.length)];
    const mesh = new THREE.Mesh(
      ballGeo,
      new THREE.MeshPhysicalMaterial({ color: '#17171d', roughness: 0.16, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.06 }),
    );
    mesh.castShadow = true;
    scene.add(mesh);
    const body = new CANNON.Body({
      mass: 5,
      shape: new CANNON.Sphere(0.5),
      position: new CANNON.Vec3(
        target.body.position.x + (Math.random() - 0.5) * 0.3,
        7 + Math.random(),
        target.body.position.z + (Math.random() - 0.5) * 0.3,
      ),
      linearDamping: 0.02,
      angularDamping: 0.05,
    });
    body.angularVelocity.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    world.addBody(body);
    balls.push({ mesh, body });
    while (balls.length > MAX_BALLS) removeBall(balls.shift()!);
  }

  function clearBalls() {
    while (balls.length) removeBall(balls.pop()!);
  }

  // ------------------------------------------------------------------ camera
  const view = { dist: 16, pitch: 0.22, target: new THREE.Vector3() };
  const cam = { yaw: 0, pitch: 0 };
  let navHeight = 64;

  function frameCamera() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const contentH = opts.content?.offsetHeight ?? h * 0.3;
    navHeight = document.querySelector<HTMLElement>('[data-nav]')?.offsetHeight ?? 64;
    const vHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const hHalf = vHalf * camera.aspect;
    const availH = Math.max(h * 0.28, h - contentH - navHeight);
    view.pitch = twoRows ? 0.52 : 0.3;
    const halfW = bounds.width / 2 + 0.6;
    const distH = halfW / (hHalf * (twoRows ? 0.92 : 0.86));
    const extentV = (bounds.depth * Math.sin(view.pitch) + 2 * bounds.centerY * Math.cos(view.pitch)) / 2 + 0.3;
    const distV = extentV / (vHalf * (availH / h) * 0.85);
    view.dist = Math.max(8, distH, distV);
    // Centre the letters in the free space above the text block.
    const ndcY = (contentH - navHeight) / h;
    const lift = (ndcY * view.dist * vHalf) / Math.cos(view.pitch);
    view.target.set(0, bounds.centerY - lift, 0);
  }

  function updateCamera(dt: number, time: number) {
    const parallax = fineHover && pointer.inside && !reduceMotion;
    const yaw = (parallax ? pointer.ndc.x * 0.06 : 0) + (reduceMotion ? 0 : Math.sin(time * 0.23) * 0.03);
    const pitch = parallax ? pointer.ndc.y * 0.025 : 0;
    const k = Math.min(1, dt * 3);
    cam.yaw += (yaw - cam.yaw) * k;
    cam.pitch += (pitch - cam.pitch) * k;
    const p = view.pitch + cam.pitch;
    camera.position.set(
      view.target.x + Math.sin(cam.yaw) * Math.cos(p) * view.dist,
      view.target.y + Math.sin(p) * view.dist,
      view.target.z + Math.cos(cam.yaw) * Math.cos(p) * view.dist,
    );
    camera.lookAt(view.target);
  }

  // ----------------------------------------------------------------- pointer
  const pointer = { ndc: new THREE.Vector2(), inside: false, pushing: false };
  const ray = new THREE.Raycaster();
  const pushPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PUSH_HEIGHT);
  const hit = new THREE.Vector3();
  let pusherOn = false;
  let pusherVis = 0;

  function setPointer(e: PointerEvent) {
    const r = stage.getBoundingClientRect();
    pointer.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  stage.addEventListener('pointermove', (e) => {
    setPointer(e);
    pointer.inside = true;
    pointer.pushing = e.pointerType === 'mouse' || e.buttons > 0;
  });
  stage.addEventListener('pointerdown', (e) => {
    setPointer(e);
    pointer.inside = true;
    pointer.pushing = true;
  });
  const release = (e: PointerEvent) => {
    if (e.type !== 'pointerup' || e.pointerType !== 'mouse') {
      pointer.pushing = false;
      pointer.inside = e.type === 'pointerup' && e.pointerType === 'mouse';
    }
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('pointerleave', () => {
    pointer.inside = false;
    pointer.pushing = false;
  });

  function updatePusher(dt: number) {
    const want = phase === 'solid' && pointer.pushing;
    if (want) {
      ray.setFromCamera(pointer.ndc, camera);
      if (ray.ray.intersectPlane(pushPlane, hit)) {
        hit.x = THREE.MathUtils.clamp(hit.x, -bounds.halfX + 0.5, bounds.halfX - 0.5);
        hit.z = THREE.MathUtils.clamp(hit.z, bounds.zBack + 0.5, bounds.zFront - 0.5);
        if (!pusherOn) {
          pusherBody.position.set(hit.x, PUSH_HEIGHT, hit.z);
          pusherBody.velocity.setZero();
          pusherOn = true;
        } else {
          const inv = 1 / Math.max(dt, 1 / 120);
          const v = new CANNON.Vec3((hit.x - pusherBody.position.x) * inv, 0, (hit.z - pusherBody.position.z) * inv);
          const speed = v.length();
          if (speed > PUSH_MAX_SPEED) v.scale(PUSH_MAX_SPEED / speed, v);
          pusherBody.velocity.copy(v);
        }
      }
    } else if (pusherOn) {
      pusherOn = false;
      pusherBody.velocity.setZero();
      pusherBody.position.set(0, -30, 0);
    }
    pusherVis += ((want ? 1 : 0) - pusherVis) * Math.min(1, dt * 10);
    pusher.visible = pusherVis > 0.01;
    pusher.material.opacity = pusherVis * 0.92;
    pusher.castShadow = pusherVis > 0.5;
    pusher.scale.setScalar(0.4 + 0.6 * pusherVis);
    if (pusherOn) pusher.position.set(pusherBody.position.x, pusherBody.position.y, pusherBody.position.z);
  }

  // ------------------------------------------------------------------ phases
  let phase: Phase = 'denoise';
  let phaseT = 0;
  let queuedBall = false;
  let statusText = '';

  function setStatus(text: string) {
    if (text === statusText || !opts.status) return;
    statusText = text;
    opts.status.textContent = text;
  }

  function setBusy(busy: boolean) {
    opts.ballButton?.setAttribute('aria-busy', String(busy));
    opts.regenButton?.setAttribute('aria-busy', String(busy));
  }

  const steps = (t: number) => String(Math.round(t * 1000)).padStart(4, ' ');

  function enter(next: Phase) {
    phase = next;
    phaseT = 0;
    if (next === 'denoise') {
      if (points) points.visible = true;
      pMat.uniforms.uOpacity.value = 1;
      pMat.uniforms.uMix.value = 0;
      setLetterOpacity(0);
      setBusy(true);
    } else if (next === 'solid') {
      if (points) points.visible = false;
      setLetterOpacity(1);
      resetBodies();
      setBusy(false);
      setStatus(coarse ? 'simulating · drag to push' : 'simulating · move to push');
      if (queuedBall) {
        queuedBall = false;
        dropBall();
      }
    } else if (next === 'noising') {
      clearBalls();
      pusherOn = false;
      pusherBody.position.set(0, -30, 0);
      sampleNoise();
      setPath(currentSurface(), noise);
      pMat.uniforms.uMix.value = 0;
      pMat.uniforms.uOpacity.value = 0;
      if (points) points.visible = true;
      setBusy(true);
    }
  }

  function syncBodies() {
    for (const l of letters) {
      l.mesh.position.set(l.body.position.x, l.body.position.y, l.body.position.z);
      l.mesh.quaternion.set(l.body.quaternion.x, l.body.quaternion.y, l.body.quaternion.z, l.body.quaternion.w);
      if (l.body.position.y < -4) {
        l.body.position.set(l.home.x, l.home.y + 2, l.home.z);
        l.body.velocity.setZero();
      }
    }
    for (const b of balls) {
      b.mesh.position.set(b.body.position.x, b.body.position.y, b.body.position.z);
      b.mesh.quaternion.set(b.body.quaternion.x, b.body.quaternion.y, b.body.quaternion.z, b.body.quaternion.w);
    }
  }

  function update(dt: number, time: number) {
    phaseT += dt;
    const u = pMat.uniforms;
    u.uTime.value = time;
    const shadowTarget = LOOK[theme].shadow;

    if (phase === 'denoise') {
      const p = reduceMotion ? 1 : clamp01((phaseT - HOLD_TIME) / DENOISE_TIME);
      const e = easeInOut(p);
      u.uMix.value = e;
      u.uJitter.value = 1 - e;
      floorMat.opacity = 0;
      setStatus(`sampling · t = ${steps(1 - e)}`);
      if (p >= 1) enter('materialize');
    } else if (phase === 'materialize') {
      const p = reduceMotion ? 1 : clamp01(phaseT / MATERIALIZE_TIME);
      setLetterOpacity(p);
      u.uOpacity.value = 1 - p;
      floorMat.opacity = p * shadowTarget;
      setStatus(`sampling · t = ${steps(0)}`);
      if (p >= 1) enter('solid');
    } else if (phase === 'solid') {
      floorMat.opacity += (shadowTarget - floorMat.opacity) * Math.min(1, dt * 4);
      updatePusher(dt);
      world.step(1 / 60, dt, 4);
      syncBodies();
    } else if (phase === 'noising') {
      const p = reduceMotion ? 1 : clamp01(phaseT / NOISE_TIME);
      const e = easeIn(p);
      u.uMix.value = e;
      u.uJitter.value = e;
      u.uOpacity.value = smooth(0, 0.2, p);
      setLetterOpacity(1 - smooth(0, 0.35, p));
      floorMat.opacity = (1 - smooth(0, 0.35, p)) * shadowTarget;
      setStatus(`adding noise · t = ${steps(e)}`);
      if (p >= 1) {
        resetBodies();
        setPath(noise, homeWorld);
        enter('denoise');
        phaseT = HOLD_TIME;
      }
    }
    if (phase !== 'solid') updatePusher(dt);
    updateCamera(dt, time);
  }

  // ------------------------------------------------------------------- theme
  function applyTheme(next: ThemeName) {
    theme = next;
    const look = LOOK[next];
    scene.environmentIntensity = look.env;
    hemi.intensity = look.hemi;
    hemi.groundColor.set(look.ground);
    key.intensity = look.key;
    rim.intensity = look.rim;
    pusher.material.color.set(look.pusher);
    for (const l of letters) {
      paletteColor(PALETTE[next], l.t, l.mesh.material.color);
      l.mesh.material.roughness = look.roughness;
      l.mesh.material.clearcoat = look.clearcoat;
    }
    pMat.uniforms.uSize.value = look.pointSize;
    pMat.blending = look.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    pMat.needsUpdate = true;
    colorParticles();
    if (phase === 'solid') floorMat.opacity = look.shadow;
  }
  new MutationObserver(() => {
    const next = currentTheme();
    if (next !== theme) applyTheme(next);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ------------------------------------------------------------------ layout
  function rowsFor(width: number, height: number): string[] {
    return width / height < 0.95 && opts.words.length > 1 ? opts.words : [opts.words.join(' ')];
  }

  function rebuild() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    twoRows = rowsFor(w, h).length > 1;
    clearBalls();
    buildLetters(rowsFor(w, h));
    buildParticles();
    applyTheme(theme);
    sampleNoise();
    setPath(noise, homeWorld);
    enter('denoise');
    frameCamera();
  }

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pMat.uniforms.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const wantTwoRows = rowsFor(w, h).length > 1;
    if (!letters.length || wantTwoRows !== twoRows) rebuild();
    else frameCamera();
  }

  // -------------------------------------------------------------------- loop
  const timer = new THREE.Timer();
  timer.connect(document);
  let running = false;
  let visible = true;
  let slowFrames = 0;
  let sampledFrames = 0;

  function loop(now: number) {
    if (!running) return;
    requestAnimationFrame(loop);
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 1 / 20);
    update(dt, timer.getElapsed());
    renderer.render(scene, camera);
    // Drop resolution once if this device struggles.
    if (pixelRatio > 1 && sampledFrames < 240) {
      sampledFrames++;
      if (dt > 1 / 32) slowFrames++;
      if (sampledFrames === 240 && slowFrames > 90) {
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        resize();
      }
    }
  }

  function setRunning(on: boolean) {
    if (on === running) return;
    running = on;
    if (on) {
      timer.reset();
      requestAnimationFrame(loop);
    }
  }

  const syncRunning = () => setRunning(visible && document.visibilityState === 'visible');
  new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    syncRunning();
  }).observe(stage);
  document.addEventListener('visibilitychange', syncRunning);
  new ResizeObserver(() => resize()).observe(stage);

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    setRunning(false);
    document.documentElement.classList.remove('has-3d');
  });

  opts.ballButton?.addEventListener('click', () => {
    if (phase === 'solid') dropBall();
    else queuedBall = true;
  });
  opts.regenButton?.addEventListener('click', () => {
    if (phase === 'solid') enter('noising');
  });

  resize();
  updateCamera(0, 0);
  syncRunning();

  // Dev-only handle for stepping the scene by hand (stripped from production builds).
  if (import.meta.env.DEV) {
    let simTime = 0;
    Object.assign(window, {
      __hero: {
        advance(frames = 60, dt = 1 / 60) {
          for (let i = 0; i < frames; i++) update(dt, (simTime += dt));
          renderer.render(scene, camera);
          return { phase, status: statusText };
        },
        regenerate: () => phase === 'solid' && enter('noising'),
        drop: () => phase === 'solid' && dropBall(),
      },
    });
  }
}
