// Renderer, light and the instanced archive. Lighting after RhineLabUI's archive-lighting
// (MIT, github.com/LBEILC/RhineLabUI), with a raking key for the etch and a back light that
// glows through the frosted drives.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LANES, ROWS } from '../motion/grid'
import { bodyMaterial, driveParts, ENTRY_IVORY, etchMaterial, etchUniforms, frameMaterial, hardwareMaterials, LED, TRANSLUCENCY } from './drive'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import type { DriveModel } from './model'
import type { Quality } from './quality'
import { LOOK } from './look'

export const BG = 0xebe6de
export const FLOOR_Y = -4.63
/** drawn columns: the six drawers plus one wrapped copy each side, so the field never ends in view */
export const COLS = LANES + 2
/** drawn rows: the 32-row ring plus wrapped copies at both far ends, for the same reason */
export const DROWS = ROWS + 12
const N = COLS * DROWS
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
// X-000, the one black drive, in RhineLabUI's dark register: cool slate shell, darker caps, an ink core
const DARK = new THREE.Color(0x58616a), DARK_CAP = new THREE.Color(0x3b4247), WHITE = new THREE.Color(1, 1, 1), SHADE = new THREE.Color(), CORE_DARK = new THREE.Color(0x1d272c).multiplyScalar(1 / 0.5)

/** what kind of record a drive holds, told by its shape and end caps: sx = length, ox = shift, cap = end-cap tint */
export interface Form { sx: number; ox: number; cap: THREE.Color | null }
export const PLAIN: Form = { sx: 1, ox: 0, cap: null }
export interface Atlas { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; cell: (i: number) => { x: number; y: number; w: number; h: number } }
/** Label atlas: 8 × 16 cells, transparent; only the printed ID sits on the drive. 0–55 cipher IDs, 64+ records. */
export const CIPHER_CELLS = 56
export const RECORD_CELL0 = 64

export function createStage(canvas: HTMLCanvasElement, quality: Quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  // shader error checks read every program's info logs on first use: synchronous round trips to
  // the GPU process that cost ~3 s at boot in Chrome/ANGLE. Kept in development only.
  renderer.debug.checkShaderErrors = import.meta.env.DEV
  renderer.setPixelRatio(Math.min(quality.dpr, devicePixelRatio || 1))
  renderer.setSize(innerWidth, innerHeight, false)
  renderer.shadowMap.enabled = quality.shadows > 0
  // PCFSoft is deprecated in r183 and rewritten to PCF at the first shadow render, which changes
  // every lit program's key after it was precompiled; ask for PCF directly
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  TRANSLUCENCY.amount.value = LOOK.trans
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.Fog(BG, 145, 165)
  // near/far hug the scene (camera 72–140 units away, the archive ±30 around it): the depth buffer,
  // and the depth-of-field pass that reads it at half precision, keep ~0.2-unit resolution instead of
  // ~2 units, so the focused drive is actually sharp
  const camera = new THREE.PerspectiveCamera(3, innerWidth / innerHeight, 40, 220)

  scene.environmentIntensity = 0.34
  const hemi = new THREE.HemisphereLight(0xfff1e2, 0xc4b29b, 0.24)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xfff0dc, 1.25 * LOOK.keyMul); key.position.set(9, 13, -9)   // behind the field: faces read in shade, the resin glows
  key.castShadow = quality.shadows > 0
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 15, bottom: -15, near: 0.1, far: 50 })
  key.shadow.mapSize.set(quality.shadows || 1, quality.shadows || 1); key.shadow.normalBias = 0.035; key.shadow.bias = -0.0003; key.shadow.radius = 4
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(7, 8, -10)
  // a reading light on the camera side, only while a file is open
  const reading = new THREE.DirectionalLight(0xfff4e6, 0); reading.position.set(-9, 6, 8)
  // the selection is told by light (after the PV): a warm, low spot rakes along the selected drive's
  // row; everything else sits in the warm shade of the field. It follows the selection.
  // A panel of light the drive's own shape, standing in the gap in front of the selected drive and
  // facing it: the light leaks out of the slot around it, the way the PV lights its file.
  RectAreaLightUniformsLib.init()
  // two thin strips of light just under the top edge, one in the slot on each side of the drive,
  // each facing it: the slot glows and lights the edges near it, rather than one flat light on the face
  const slots = [new THREE.RectAreaLight(0xffbe7a, 0, 4.6, 0.45), new THREE.RectAreaLight(0xffbe7a, 0, 4.6, 0.45)]
  scene.add(...slots)
  // a low warm light along the lanes: every column's end faces catch a soft side light
  const side = new THREE.DirectionalLight(0xffd2a2, 0.75); side.position.set(-14, 4, 3)
  scene.add(side)
  scene.add(key, fill, reading)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xddd3c6, roughness: 0.95 }))
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; scene.add(floor)

  // ── label atlas ──
  const ac = document.createElement('canvas'); ac.width = 2048; ac.height = 2048
  const ag = ac.getContext('2d')!
  const cell = (i: number) => ({ x: (i % 8) * 256, y: Math.floor(i / 8) * 128, w: 256, h: 128 })
  const HEX = '0123456789abcdef', hex = (n: number) => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('')
  const drawCipher = () => {
    for (let i = 0; i < CIPHER_CELLS; i++) {
      const r = cell(i); ag.clearRect(r.x, r.y, r.w, r.h)
      ag.fillStyle = 'rgba(60,57,50,.55)'; ag.textBaseline = 'middle'; ag.font = '600 34px "JetBrains Mono", monospace'
      ag.fillText(`0x${hex(4)}`, r.x + 10, r.y + 48)
    }
  }
  drawCipher()
  const atlasTex = new THREE.CanvasTexture(ac); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8
  const atlas: Atlas = { canvas: ac, texture: atlasTex, cell }
  const labelMat = new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false })
  labelMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vec2((vMapUv.x + mod(aCell, 8.0)) / 8.0, (vMapUv.y + (15.0 - floor(aCell / 8.0))) / 16.0);\n#endif')
  }

  // ── instanced archive: one rigid transform buffer shared by every part ──
  const P = driveParts(), HW = hardwareMaterials()
  const cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1)
  const glowAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1)
  // per drive: how lit its top edge is, and how clear (decrypted) its shell reads
  const topGlowAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1), clearAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1)
  topGlowAttr.setUsage(THREE.DynamicDrawUsage); clearAttr.setUsage(THREE.DynamicDrawUsage)
  cellAttr.setUsage(THREE.DynamicDrawUsage); glowAttr.setUsage(THREE.DynamicDrawUsage)
  P.label.setAttribute('aCell', cellAttr); P.face.setAttribute('aGlow', glowAttr); P.top.setAttribute('aGlow', topGlowAttr); P.body.setAttribute('aClear', clearAttr)
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, N); m.castShadow = shadow && quality.shadows > 0; m.receiveShadow = true; m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m
  }
  const bodyMat = bodyMaterial(false, true), capMat = frameMaterial(false, true)
  if (!quality.transmission) { bodyMat.transmission = 0; bodyMat.color.set(0xefe4d6) }
  const faceEtch = etchMaterial({ part: 'face', instanced: true }), topEtch = etchMaterial({ part: 'top', instanced: true })
  // the lantern: a drive that holds a record glows from its diffuser plate, softly, through the frost
  const lampAttr = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); lampAttr.setUsage(THREE.DynamicDrawUsage)
  P.core.setAttribute('aLamp', lampAttr); P.face.setAttribute('aLamp', lampAttr); P.top.setAttribute('aLamp', lampAttr); P.body.setAttribute('aLamp', lampAttr)
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xb8a58e, roughness: 0.7, envMapIntensity: 0.6 })
  const lampCol = { value: new THREE.Color(0xffa95c).multiplyScalar(1.3 * LOOK.lamp) }
  coreMat.onBeforeCompile = (sh) => {
    sh.uniforms.uLampCol = lampCol
    sh.vertexShader = 'attribute float aLamp; varying float vLamp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLamp = aLamp;')
    sh.fragmentShader = 'uniform vec3 uLampCol; varying float vLamp;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uLampCol * vLamp;')
  }
  coreMat.customProgramCacheKey = () => 'core-lamp'
  const core = mk(P.core, coreMat, false), body = mk(P.body, bodyMat), face = mk(P.face, faceEtch, false), top = mk(P.top, topEtch, false)
  const baseBody = bodyMat.color.clone(), baseCore = coreMat.color.clone(), baseFace = faceEtch.color.clone()
  const ivoryBody = new THREE.Color(0xf8f3ec), ivoryCore = new THREE.Color(0xb9b1a5), ivoryFace = new THREE.Color(0xc1b8a9)
  // the packed field stays quiet (after RhineLabUI's array): no tabs, grips or printed labels;
  // the selected drive carries all of them
  const hard = mk(mergeGeometries([P.tab, ...P.grips]), HW.tab), labels = mk(P.label, labelMat, false)
  hard.visible = false; labels.visible = false
  const glass = mk(P.caps, capMat), screws = mk(P.screws, HW.metal, false), inlay = mk(P.inlay, HW.gold, false)
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  const ledSets = { long: mk(P.led, ledMat, false), double: mk(P.ledDouble, ledMat, false), dot: mk(P.ledDot, ledMat, false) }
  const leds = ledSets.long
  for (const m of [core, face, top, hard, labels, glass, screws, inlay]) m.instanceMatrix = body.instanceMatrix
  for (let i = 0; i < N; i++) { body.setColorAt(i, WHITE); glass.setColorAt(i, WHITE); face.setColorAt(i, WHITE); top.setColorAt(i, WHITE); core.setColorAt(i, WHITE); for (const l of Object.values(ledSets)) l.setColorAt(i, LED.off) }
  void leds
  const tinted = [body, glass, face, top, core, ...Object.values(ledSets)]

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  let aoPass: GTAOPass | null = null
  if (quality.ao) {
    const ao = aoPass = new GTAOPass(scene, camera, innerWidth, innerHeight)
    ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 0.6, scale: 1, samples: 16 }); ao.blendIntensity = LOOK.ao
    composer.addPass(ao)
  }
  // depth of field (after RhineLabUI and the Arknights UI it comes from): the eye goes where the
  // focus is. The archive keeps a shallow band around the selected drive; opening a file pulls
  // focus onto it and lets the rest fall away. Off on the low tier.
  const dof = quality.name === 'low' ? null : new BokehPass(scene, camera, { focus: 140, aperture: 0.0004, maxblur: 0.004 })
  if (dof) composer.addPass(dof)
  // camera-speed blur (after the PV's whip into the archive): samples along the screen-space motion
  // of the field; off whenever the camera is still
  const motion = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uDelta: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDelta; varying vec2 vUv;
      void main() { vec4 c = vec4(0.0); for (int i = 0; i < 12; i++) { float k = float(i) / 11.0 - 0.5; c += texture2D(tDiffuse, vUv + uDelta * k); } gl_FragColor = c / 12.0; }`,
  })
  motion.enabled = false
  composer.addPass(motion)
  // focus (after the PV): sharp around the selected drive, softening with distance from it on screen.
  // Screen-space and centred on the drive itself, so it never misses the way a depth focus can
  // with a telephoto camera whose whole field sits within a few units of depth.
  const focus = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uRadius: { value: new THREE.Vector2(0.2, 0.2) }, uMax: { value: 0 }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uCenter, uRadius, uRes; uniform float uMax; varying vec2 vUv;
      void main() {
        float d = length((vUv - uCenter) / uRadius);
        float r = uMax * smoothstep(0.8, 1.9, d);
        vec4 c = texture2D(tDiffuse, vUv);
        if (r < 0.4) { gl_FragColor = c; return; }
        vec4 acc = c; float n = 1.0;
        for (int i = 0; i < 56; i++) {
          float a = float(i) * 2.39996, rr = sqrt((float(i) + 0.5) / 56.0) * r;
          acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr / uRes); n += 1.0;
        }
        gl_FragColor = acc / n;
      }`,
  })
  focus.enabled = quality.name !== 'low'
  composer.addPass(focus)
  // bloom only while a drive is being read: the threshold sits above the lit cream surfaces, so
  // only the trace light (emissive ×4) blooms; the pass is disabled whenever strength is 0
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0, LOOK.haloRadius, LOOK.haloThreshold)
  bloom.enabled = false
  composer.addPass(bloom)
  const smaa = new SMAAPass(); composer.addPass(smaa)
  composer.addPass(new OutputPass())
  // the display-space grade, after the output transform: a touch of warm gain, contrast, a soft vignette,
  // and a light unsharp mask so edges read machined
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uGain: { value: new THREE.Vector3(...LOOK.gain) }, uCon: { value: LOOK.contrast }, uSharp: { value: LOOK.sharpen }, uVig: { value: LOOK.vignette }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 uGain; uniform float uCon, uSharp, uVig; uniform vec2 uRes; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 px = 1.0 / uRes;
        vec3 blur = (texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb) * 0.25;
        vec3 col = uGain * (c.rgb + (c.rgb - blur) * uSharp);
        col = max((col - 0.5) * uCon + 0.5, vec3(0.0));
        vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
        col *= mix(1.0 - uVig, 1.0, smoothstep(0.98, 0.32, length(q)));
        gl_FragColor = vec4(col, c.a);
      }`,
  })
  composer.addPass(grade)
  const gradeRes = () => grade.uniforms.uRes.value.set(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio())
  gradeRes()
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth / 2, innerHeight / 2); gradeRes(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix() }
  addEventListener('resize', resize)

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), zero = new THREE.Vector3(), CAPC = new THREE.Color()
  return {
    renderer, scene, camera, composer, atlas, pick: body, N,
    /** swap the procedural stand-ins for the precision model's coarse groups */
    useModel(g: DriveModel) {
      const swap = (m: THREE.InstancedMesh, k: keyof DriveModel) => { const x = g[k]; if (x) { m.geometry.dispose(); m.geometry = x.geometry } }
      swap(body, 'Frosted_Shell'); body.geometry.setAttribute('aClear', clearAttr); body.geometry.setAttribute('aLamp', lampAttr); swap(glass, 'Ivory_Frame'); swap(core, 'Diffuser'); core.geometry.setAttribute('aLamp', lampAttr); swap(screws, 'Titanium'); swap(inlay, 'Champagne')
    },
    /** led: null = off · glow 0/1 · dark = X-000 */
    set(i: number, x: number, y: number, z: number, tilt: number, labelCell: number, led: THREE.Color | null, hidden: boolean, glow: number, dark: boolean, ledKind: 'long' | 'double' | 'dot' = 'long', shade = 1, topGlow = glow, clear = 0, lamp = 0, form: Form = PLAIN) {
      e.set(tilt, 0, 0); q.setFromEuler(e); p.set(x + form.ox, y, z); sc.set(form.sx, 1, 1)
      m4.compose(p, q, hidden ? zero : sc); body.setMatrixAt(i, m4)
      for (const [k, l] of Object.entries(ledSets)) l.setMatrixAt(i, k === ledKind && led ? m4 : ZERO)   // an unlit slit is not drawn
      const w = shade < 1 ? SHADE.setScalar(shade) : WHITE
      body.setColorAt(i, dark ? DARK : w); glass.setColorAt(i, dark ? DARK_CAP : form.cap ? CAPC.copy(form.cap).multiplyScalar(shade) : w); face.setColorAt(i, dark ? DARK : w); top.setColorAt(i, dark ? DARK : form.cap ? CAPC : w); core.setColorAt(i, dark ? CORE_DARK : w)
      ledSets[ledKind].setColorAt(i, led ?? LED.off)
      cellAttr.setX(i, labelCell); glowAttr.setX(i, glow); topGlowAttr.setX(i, topGlow); clearAttr.setX(i, clear); lampAttr.setX(i, lamp)
    },
    commit(time: number) {
      body.instanceMatrix.needsUpdate = true
      for (const l of Object.values(ledSets)) l.instanceMatrix.needsUpdate = true
      for (const m of tinted) m.instanceColor!.needsUpdate = true
      cellAttr.needsUpdate = glowAttr.needsUpdate = topGlowAttr.needsUpdate = clearAttr.needsUpdate = lampAttr.needsUpdate = true
      etchUniforms(faceEtch).uTime.value = etchUniforms(topEtch).uTime.value = time
    },
    /** trace-light bloom (0 = off) and scene exposure, both animated by the read */
    /** contact shading on or off (it is off while the camera closes in on the drive: its depth range no longer fits) */
    setAo(on: boolean) { if (aoPass) aoPass.enabled = on },
    setBloom(strength: number) {
      // the threshold falls as the strength rises, so only the trace light blooms while a drive is read
      const k = THREE.MathUtils.clamp(strength / 0.95, 0, 1)
      bloom.strength = strength; bloom.threshold = LOOK.haloThreshold + (1 - LOOK.haloThreshold) * k
      bloom.enabled = strength > 0.01
    },
    /**
     * Shadows off for this scene (the renderer's own switch is shared with the interior and is left alone).
     * The light keeps its shadow switch: flipping it changes the shader of every lit material, and the
     * whole scene would recompile on the main thread (seconds, on a phone, at the moment it is struggling).
     * Instead nothing casts any more, and the shadow map is cleared once and left alone (one way: the
     * archive only ever steps down).
     */
    setShadows(on: boolean) {
      if (on) { key.castShadow = true; return }
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = false })   // (meshes only: a light's own castShadow is the shader switch)
      key.shadow.autoUpdate = false; key.shadow.needsUpdate = true
    },
    setExposure(x: number) { renderer.toneMappingExposure = x * LOOK.exposure },
    /** Optical ivory while searching; the file exhibition keeps its own original lighting. */
    setEntranceLight(k: number) {
      k = Math.max(k, LOOK.ivoryMin)
      ENTRY_IVORY.value = k
      bodyMat.color.copy(baseBody).lerp(ivoryBody, k)
      coreMat.color.copy(baseCore).lerp(ivoryCore, k)
      faceEtch.color.copy(baseFace).lerp(ivoryFace, k)
      hemi.intensity = (0.24 + 0.2 * k) * LOOK.hemiMul; fill.intensity = (0.6 + 0.18 * k) * LOOK.fillMul; side.intensity = (0.75 - 0.42 * k) * LOOK.sideMul
    },
    /** the key light sits behind the field so faces read in shade; an open file gets a reading light on its face */
    /** the selection light: where it stands, what it looks at, how bright */
    /** the selection light: a drive-shaped panel at (x, y, z) facing (tx, ty, tz) */
    setSlotLight(x: number, y: number, z: number, gap: number, intensity: number, width = 4.6) {
      slots[0].width = slots[1].width = width
      slots[0].position.set(x, y, z + gap); slots[0].lookAt(x, y, z)
      slots[1].position.set(x, y, z - gap); slots[1].lookAt(x, y, z)
      for (const s of slots) s.intensity = intensity
    },
    setFaceLight(k: number) { reading.intensity = 1.35 * k },
    /** focus distance (world units from the camera), aperture (blur per unit of defocus), max blur */
    /** screen-space blur vector in UV units; below a hair it switches off */
    setMotion(dx: number, dy: number) { motion.uniforms.uDelta.value.set(dx, dy); motion.enabled = Math.hypot(dx, dy) > 0.0015 },
    /** screen focus: centre (uv), radii (uv) of the sharp region, max blur radius (px) */
    setFocus(cx: number, cy: number, rx: number, ry: number, max: number) {
      // a phone shows the field small: skip the cost there
      rx *= LOOK.focusRadius; ry *= LOOK.focusRadius; max *= LOOK.focusMax
      focus.enabled = quality.name !== 'low' && innerWidth >= 900 && max > 0.4
      focus.uniforms.uCenter.value.set(cx, cy); focus.uniforms.uRadius.value.set(rx, ry); focus.uniforms.uMax.value = max; focus.uniforms.uRes.value.set(innerWidth, innerHeight)
    },
    setDof(focus: number, aperture: number, maxblur: number) {
      if (!dof) return
      const u = (dof as unknown as { uniforms: Record<string, { value: number }> }).uniforms
      u.focus.value = focus; u.aperture.value = aperture; u.maxblur.value = maxblur
      dof.enabled = aperture > 0
    },
    /**
     * Build the environment and compile every program the first frames will use, without blocking
     * the main thread (KHR_parallel_shader_compile). Two things make a plain compileAsync(scene)
     * miss most of them: the composer renders into a render target, where three picks linear /
     * no-tone-mapping variants; and the shadow, GTAO and post passes use materials that are not in
     * the scene. Both are covered here, so the first frame does not compile anything.
     */
    async prepare(extra: [THREE.BufferGeometry, THREE.Material][] = []) {
      const rt = composer.readBuffer
      const asTarget = <T,>(f: () => T) => { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); try { return f() } finally { renderer.setRenderTarget(prev) } }
      // the environment: precompile the room, then filter it (only PMREM's own blur runs synchronously)
      const room = new RoomEnvironment(), cube = new THREE.PerspectiveCamera(90, 1, 0.1, 100)
      await asTarget(() => renderer.compileAsync(room, cube))
      const pmrem = new THREE.PMREMGenerator(renderer)
      try { scene.environment = pmrem.fromScene(room, 0.04).texture } finally { room.dispose(); pmrem.dispose() }
      // stand-ins that carry every other material the first frames need
      const proxies = new THREE.Scene(), quad = new THREE.PlaneGeometry(2, 2)
      const meshes: THREE.Mesh[] = []
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
      const like = (src: THREE.Mesh, m: THREE.Material) => {
        if ((src as THREE.InstancedMesh).isInstancedMesh) { const im = src as THREE.InstancedMesh, x = new THREE.InstancedMesh(im.geometry, m, 1); x.instanceColor = im.instanceColor; return x }
        return new THREE.Mesh(src.geometry, m)
      }
      const overrides: THREE.Material[] = [new THREE.MeshDepthMaterial()]
      for (const pass of composer.passes) for (const v of Object.values(pass)) {
        for (const m of (Array.isArray(v) ? v : [v]) as unknown[]) {
          if (!(m instanceof THREE.Material)) continue
          if ((m as THREE.ShaderMaterial).isShaderMaterial) proxies.add(new THREE.Mesh(quad, m)); else overrides.push(m)
        }
      }
      for (const m of overrides) for (const src of meshes) if (src.castShadow || !(m as THREE.MeshDepthMaterial).isMeshDepthMaterial) proxies.add(like(src, m))
      for (const [g, m] of extra) proxies.add(new THREE.Mesh(g, m))
      // shadow depth and full-screen passes render outside the scene: with its lights but no fog, or
      // with neither; compile the stand-ins in every one of those contexts (duplicates are cached)
      const fog = scene.fog
      const jobs = asTarget(() => {
        const out = [renderer.compileAsync(scene, camera), renderer.compileAsync(proxies, camera, scene), renderer.compileAsync(proxies, camera)]
        scene.fog = null; out.push(renderer.compileAsync(proxies, camera, scene)); scene.fog = fog
        return out
      })
      // the output pass sets its defines on first render; set them now, the way it would
      const out = composer.passes.find((x) => x instanceof OutputPass) as (OutputPass & { _outputColorSpace: string | null; _toneMapping: number | null }) | undefined
      if (out) {
        out.material.defines = { SRGB_TRANSFER: '', ...(renderer.toneMapping === THREE.ACESFilmicToneMapping ? { ACES_FILMIC_TONE_MAPPING: '' } : {}) }
        out.material.needsUpdate = true
        out._outputColorSpace = renderer.outputColorSpace; out._toneMapping = renderer.toneMapping
        const screen = new THREE.Scene(); screen.add(new THREE.Mesh(quad, out.material)); jobs.push(renderer.compileAsync(screen, camera))
      }
      await Promise.all(jobs)
      quad.dispose()
    },
    render() { TRANSLUCENCY.dir.value.copy(key.position).normalize().transformDirection(camera.matrixWorldInverse); composer.render() },
    dispose() {
      removeEventListener('resize', resize)
      renderer.dispose(); composer.dispose()
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()) })
    },
  }
}
export type Stage = ReturnType<typeof createStage>
