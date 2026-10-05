// The fixed WebGL backdrop. Sea level: NASA's Global Hawk in a live flow field.
// Climbing: stars fade in. Orbit: a photoreal day/night Earth with the ISS.
// Models: NASA 3D Resources (public domain). Earth textures: Solar System Scope (CC BY 4.0).
import * as THREE from 'three';
import { GLTFLoader } from '/assets/vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '/assets/vendor/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from '/assets/vendor/addons/environments/RoomEnvironment.js';
import { WING } from './aero.js';

const DEG = Math.PI / 180;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SUN = new THREE.Vector3(-0.75, 0.45, 0.5).normalize();

export function startScene(canvas, state, { lowPower, reducedMotion, theme }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  camera.position.set(0, 0, 12);

  const sun = new THREE.DirectionalLight(0xfff4e6, 2.6);
  sun.position.copy(SUN).multiplyScalar(20);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9cc4ff, 1.2);
  rim.position.set(6, -3, -8);
  scene.add(rim);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let needsFrame = true;

  // ───────── Flight: Global Hawk + streamlines ─────────
  const flight = new THREE.Group();
  const pitch = new THREE.Group();
  flight.add(pitch);
  flight.rotation.set(0.32, -0.62, 0.05);
  scene.add(flight);
  const SEMI_SPAN = 3;
  const flow = buildFlow(lowPower ? 380 : 950, SEMI_SPAN);
  flight.add(flow.lines);

  loader.load('/assets/models/global-hawk.glb', (gltf) => {
    const model = gltf.scene;
    // Gear up, it's flying: keep the airframe (the largest mesh), hide wheels, struts and doors
    let airframe = null;
    model.traverse((m) => { if (m.isMesh && (!airframe || m.geometry.attributes.position.count > airframe.geometry.attributes.position.count)) airframe = m; });
    model.traverse((m) => { if (m.isMesh && m !== airframe) m.visible = false; });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar((SEMI_SPAN * 2) / size.x); // span runs along x in the file
    holder.rotation.y = Math.PI / 2; // nose (+z in the file) → +x, into the flow
    holder.position.y = 0.15;
    pitch.add(holder);
    needsFrame = true;
  }, undefined, (err) => console.warn('Aircraft model failed to load:', err));

  // ───────── Stars ─────────
  const stars = buildStars(lowPower ? 900 : 2400);
  scene.add(stars);

  // ───────── Earth + ISS ─────────
  const earth = buildEarth(renderer, loader, () => { needsFrame = true; });
  scene.add(earth.group);

  // ───────── Theme ─────────
  let dark = theme !== 'light';
  function setTheme(t) {
    dark = t !== 'light';
    flow.setTheme(dark);
    earth.setTheme(dark);
    renderer.toneMappingExposure = dark ? 1.05 : 1.15;
    needsFrame = true;
  }
  setTheme(theme);

  // ───────── Layout ─────────
  let mobile = false;
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    mobile = w / h < 0.9;
    needsFrame = true;
  }
  resize();
  window.addEventListener('resize', resize);

  // ───────── Loop ─────────
  const clock = new THREE.Clock();
  let alpha = state.alpha, t = 0, running = true;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reducedMotion) t += dt;
    const s = state.s; // 0 at sea level, 1 in orbit (log-altitude)

    alpha += (state.alpha - alpha) * (reducedMotion ? 1 : Math.min(1, dt * 5));
    pitch.rotation.z = alpha * DEG;
    pitch.position.y = reducedMotion ? 0 : Math.sin(t * 0.8) * 0.06; // gentle turbulence

    const climb = smooth(0.02, 0.6, s);
    const baseX = mobile ? 0.1 : 2.7, baseY = mobile ? 2.2 : 1.4;
    flight.scale.setScalar(mobile ? 0.55 : 0.85);
    flight.position.set(baseX + climb * 2.5, baseY + climb * climb * 11, -climb * 5);
    flight.rotation.y = -0.62 + state.px * 0.1;
    flight.rotation.x = 0.32 + state.py * 0.05;
    flight.visible = climb < 0.999;
    if (flight.visible) flow.update(reducedMotion ? 0 : dt, t, alpha);
    flow.setOpacity(1 - smooth(0.25, 0.55, s));

    stars.material.opacity = dark ? smooth(0.15, 0.65, s) : 0;
    stars.rotation.y = t * 0.003;

    if (s > 0.25) earth.loadTextures();
    const rise = smooth(0.48, 1, s);
    earth.group.position.set(mobile ? 0 : 1.2, -27 + rise * (mobile ? 18.4 : 17.8), -5);
    earth.group.visible = rise > 0.001;
    if (earth.group.visible) earth.update(t);

    camera.position.x += (state.px * 0.35 - camera.position.x) * 0.05;
    camera.position.y += (-state.py * 0.25 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  function loop() {
    if (!running) return;
    if (!reducedMotion || needsFrame) { needsFrame = false; frame(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  document.addEventListener('visibilitychange', () => {
    const was = running;
    running = !document.hidden;
    if (running && !was) { clock.getDelta(); requestAnimationFrame(loop); }
  });

  return { invalidate() { needsFrame = true; }, setTheme };
}

// Streamlines: short polylines advected along -x past the wing. The deflection
// field is hand-built: thickness bump, upwash ahead, downwash behind, tip
// vortices that roll up with lift, and separated (noisy) flow after the stall.
function buildFlow(count, h) {
  const xMax = 5.5, xMin = -6.5, SEG = 5, step = 0.26;
  const lanes = new Float32Array(count * 4); // y0, z0, x, speed
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let z0, y0;
    if (r < 0.3) { // around the wingtips, where the vortices roll up
      z0 = (Math.random() < 0.5 ? -1 : 1) * (h + (Math.random() - 0.5) * 1.0);
      y0 = (Math.random() - 0.5) * 1.0;
    } else if (r < 0.88) { // over and under the wing
      z0 = (Math.random() * 2 - 1) * (h + 0.3);
      y0 = (Math.random() - 0.5) * 1.4;
    } else { // a few far-field lines for depth
      z0 = (Math.random() * 2 - 1) * (h + 2);
      y0 = (Math.random() - 0.5) * 3.4;
    }
    lanes.set([y0, z0, xMin + Math.random() * (xMax - xMin), 2.4 + Math.random() * 1.2], i * 4);
  }

  const V = SEG * 2;
  const pos = new Float32Array(count * V * 3);
  const fade = new Float32Array(count * V);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < SEG; k++) {
      fade[i * V + k * 2] = 1 - k / SEG;
      fade[i * V + k * 2 + 1] = 1 - (k + 1) / SEG;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0.5 } },
    vertexShader: `attribute float aFade; varying float vFade;
      void main(){ vFade = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vFade;
      void main(){ gl_FragColor = vec4(uColor, vFade * vFade * uOpacity); }`,
    transparent: true, depthWrite: false, toneMapped: false,
  });
  const lines = new THREE.LineSegments(geo, material);
  lines.frustumCulled = false;
  let baseOpacity = 0.5;

  const out = [0, 0, 0];
  function field(x, y0, z0, liftK, stall, t, seed) {
    const xr = x + 0.1;
    const az = Math.abs(z0);
    const sz = az < h ? 1 : Math.exp(-((az - h) ** 2) / 0.25);
    const near = Math.exp(-(y0 * y0) / 0.6) * sz;
    let y = y0;
    y += Math.sign(y0 || 1) * 0.16 * Math.exp(-(xr * xr) / 0.25) * near;
    y += liftK * 0.7 * near * (0.4 * Math.exp(-((xr - 0.8) ** 2) / 0.45) - 1 / (1 + Math.exp(2.4 * xr)));
    let z = z0;
    if (stall > 0 && y0 > -0.1) {
      const behind = 1 / (1 + Math.exp(4 * xr));
      const n = Math.sin(t * 4 + seed * 37 + x * 1.8) + 0.5 * Math.sin(t * 6 + seed * 11 - x * 2.6);
      y += stall * near * behind * (0.12 * n + 0.28);
      z += stall * near * behind * 0.06 * Math.cos(t * 3 + seed * 23 + x * 1.5);
    }
    const tz = Math.sign(z0) * h;
    const r = Math.hypot(z0 - tz, y0);
    if (r < 0.8 && xr < 0.3) {
      const ang = Math.min(0.3 - xr, 6) * 2.6 * liftK * (1 - r / 0.8) * Math.sign(z0);
      const c = Math.cos(ang), s = Math.sin(ang), zz = z - tz;
      const ny = y * c - zz * s;
      z = tz + y * s + zz * c;
      y = ny;
    }
    out[0] = x; out[1] = y; out[2] = z;
    return out;
  }

  function update(dt, t, alphaDeg) {
    const cl = Math.max(-0.3, (alphaDeg - WING.alpha0) * WING.a * DEG);
    const liftK = Math.min(cl, 1.6) / 1.5;
    const stall = alphaDeg > WING.alphaStall ? Math.min(1, (alphaDeg - WING.alphaStall) / 3) : 0;
    for (let i = 0; i < count; i++) {
      const o = i * 4;
      let x = lanes[o + 2] - lanes[o + 3] * dt;
      if (x < xMin) x = xMax + Math.random() * 0.5;
      lanes[o + 2] = x;
      const y0 = lanes[o], z0 = lanes[o + 1], seed = (i * 0.618) % 1;
      let base = i * V * 3;
      let p = field(x, y0, z0, liftK, stall, t, seed);
      let px = p[0], py = p[1], pz = p[2];
      for (let k = 0; k < SEG; k++) {
        pos[base] = px; pos[base + 1] = py; pos[base + 2] = pz;
        p = field(x + (k + 1) * step, y0, z0, liftK, stall, t, seed);
        px = p[0]; py = p[1]; pz = p[2];
        pos[base + 3] = px; pos[base + 4] = py; pos[base + 5] = pz;
        base += 6;
      }
    }
    geo.attributes.position.needsUpdate = true;
  }
  function setTheme(dark) {
    material.uniforms.uColor.value.set(dark ? 0xbcd2f2 : 0x1d3a63);
    material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    baseOpacity = dark ? 0.55 : 0.3;
    material.needsUpdate = true;
  }
  function setOpacity(k) { material.uniforms.uOpacity.value = baseOpacity * k; }
  return { lines, update, setTheme, setOpacity };
}

function buildStars(count) {
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 80 + Math.random() * 80;
    const k = Math.sqrt(1 - u * u);
    p.set([r * k * Math.cos(th), r * u, r * k * Math.sin(th) - 60], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ color: 0xdbe6ff, size: 0.4, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  return new THREE.Points(geo, mat);
}

function buildEarth(renderer, loader, onReady) {
  const group = new THREE.Group();
  group.rotation.x = -0.6; // tip the northern hemisphere towards the viewer
  const R = 7;

  const tl = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  // Textures (~1.2 MB) load only once the page has scrolled far enough to need them
  const blank = new THREE.DataTexture(new Uint8Array([4, 9, 18, 255]), 1, 1);
  blank.needsUpdate = true;
  const uniforms = {
    dayTex: { value: blank },
    nightTex: { value: blank },
    cloudTex: { value: blank },
    sunDir: { value: SUN.clone() },
    time: { value: 0 },
  };

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 96),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */`
        varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
        void main() {
          vUv = uv;
          vWN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWP = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D dayTex, nightTex, cloudTex; uniform vec3 sunDir; uniform float time;
        varying vec2 vUv; varying vec3 vWN; varying vec3 vWP;
        void main() {
          vec3 n = normalize(vWN);
          vec3 v = normalize(cameraPosition - vWP);
          float sunO = dot(n, sunDir);
          float dayMix = smoothstep(-0.2, 0.35, sunO);

          vec3 day = texture2D(dayTex, vUv).rgb;
          vec3 night = texture2D(nightTex, vUv).rgb * vec3(1.0, 0.82, 0.55) * 2.2;
          vec4 bump = texture2D(cloudTex, vUv + vec2(time * 0.0015, 0.0));
          float clouds = smoothstep(0.15, 0.9, bump.b);
          float ocean = 1.0 - smoothstep(0.2, 0.6, bump.g);

          vec3 col = mix(night * (1.0 - clouds * 0.9), day * (0.25 + 0.95 * max(sunO, 0.0)), dayMix);
          col = mix(col, vec3(1.0) * (0.15 + 0.95 * max(sunO, 0.0)), clouds * 0.85 * dayMix);

          vec3 h = normalize(sunDir + v);
          col += vec3(1.0, 0.92, 0.8) * pow(max(dot(n, h), 0.0), 60.0) * ocean * (1.0 - clouds) * dayMix * 0.9;

          float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);
          vec3 atmo = mix(vec3(1.0, 0.42, 0.18), vec3(0.32, 0.6, 1.0), smoothstep(-0.15, 0.6, sunO));
          col = mix(col, atmo, fres * smoothstep(-0.35, 0.9, sunO) * 0.85);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  );
  globe.rotation.y = -2.94; // India towards the viewer
  group.add(globe);

  const atmoMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { sunDir: uniforms.sunDir, strength: { value: 1 } },
    vertexShader: `varying vec3 vWN; varying vec3 vWP;
      void main(){ vWN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 sunDir; uniform float strength; varying vec3 vWN; varying vec3 vWP;
      void main(){
        vec3 n = normalize(vWN); vec3 v = normalize(cameraPosition - vWP);
        float rim = pow(clamp(1.0 + dot(v, n) - 0.05, 0.0, 1.0), 3.0);
        float lit = smoothstep(-0.4, 0.6, dot(n, sunDir));
        vec3 c = mix(vec3(1.0, 0.45, 0.2), vec3(0.35, 0.62, 1.0), smoothstep(-0.2, 0.5, dot(n, sunDir)));
        float a = rim * lit * strength;
        gl_FragColor = vec4(c * a, a);
      }`,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 96, 64), atmoMat));

  // ISS on an inclined orbit (altitude exaggerated so it reads at this scale)
  const orbit = new THREE.Group();
  orbit.rotation.set(0.9, 0, 0.35);
  group.add(orbit);
  const iss = new THREE.Group();
  orbit.add(iss);
  const orbitR = R * 1.13;
  loader.load('/assets/models/iss.glb', (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    model.traverse((m) => { if (m.isMesh) { m.material.metalness = 0.6; m.material.roughness = 0.35; } });
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(1.5 / Math.max(size.x, size.y, size.z));
    iss.add(holder);
    onReady();
  }, undefined, (err) => console.warn('ISS model failed to load:', err));

  let texturesRequested = false;
  function loadTextures() {
    if (texturesRequested) return;
    texturesRequested = true;
    const load = (key, url, srgb) => tl.load(url, (t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = Math.min(8, aniso);
      uniforms[key].value = t;
      onReady();
    }, undefined, (err) => console.warn('Earth texture failed to load:', url, err));
    load('dayTex', '/assets/img/earth-day.jpg', true);
    load('nightTex', '/assets/img/earth-night.jpg', true);
    load('cloudTex', '/assets/img/earth-clouds.jpg', false);
  }

  function update(t) {
    globe.rotation.y = -2.94 + t * 0.008;
    uniforms.time.value = t;
    const a = -t * 0.05 + 2.1;
    iss.position.set(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
    iss.rotation.set(0.3, -a, 0.2);
  }
  function setTheme(dark) {
    atmoMat.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    atmoMat.uniforms.strength.value = dark ? 1.1 : 0.7;
    atmoMat.needsUpdate = true;
  }
  return { group, update, setTheme, loadTextures };
}
