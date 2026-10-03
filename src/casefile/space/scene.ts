// The interior. It draws on the archive's own renderer and canvas (a cut is a change of which scene
// draws, not a second picture laid over the first), with its own scene and composer; the archive stops
// drawing while we are inside. It renders whatever the clock says: a frame is a pure description
// (where in the intro, which station, how far through its sequence, whether a flight is under way), so
// the same code serves the first-visit tour, a visitor's own pick, a replay and a station held on its result.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { Quality } from '../scene/quality'
import { COLOR, createKit } from './kit'
import { AREAS, DIE, fogFor, STATION_AT, STATION_RADIUS, STATION_YAW } from './layout'
import { clonePose, flightPose, hubPose, INTRO, introBlend, introPose, stationPose, type Pose, type Region } from './shots'
import { loadDriveModel } from '../scene/model'
import { BUILDERS } from './stations'
import type { Station } from './station'
import { createWorld } from './world'

/** one frame of the show, as the clock describes it */
export interface SpaceFrame {
  /** seconds since the cut; the intro plays while this is under INTRO.dur */
  intro: number
  area: number
  /** the station the intro runs on into (−1: it ends at the hub) */
  into: number
  /** progress through the current station's sequence */
  p: number
  travel: { to: number; k: number } | null
  /** per station: its result exists, so it shows its final state when it is not the current one */
  retained: boolean[]
  /** 0 = the subject centred (the cut), 1 = composed into its region (left of the file column on desktop, the top on a phone) */
  compose: number
}
/** The canvas, and the region the subject is composed into: its centre and size as fractions of the canvas. */
export interface SpaceLayout { width: number; height: number; cx: number; cy: number; rw: number; rh: number }
/** What the exterior's last frame looked like, so the interior's first frame can be the same picture. */
const mix01 = (a: number, b: number, k: number) => a + (b - a) * k
const smooth01 = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }
export interface Handoff { glow: number; fov: number; /** the die's width as a fraction of the screen */ dieFrac: number }
/** What the interior borrows from the archive: its renderer (and canvas) and its environment map. */
export interface Host { renderer: THREE.WebGLRenderer; environment: THREE.Texture | null }

/**
 * `idle` is awaited between the heavy steps. The interior is built while the archive is already on
 * screen, so the caller hands in a function that yields to the browser (a frame, an idle slot) and the
 * build never holds the main thread for more than one step.
 */
export async function createSpace(host: Host, quality: Quality, idle: () => Promise<void> = () => Promise.resolve()) {
  const timing: [string, number][] = [], t0 = performance.now(), mark = (n: string) => timing.push([n, +(performance.now() - t0).toFixed(0)])
  const { renderer } = host, canvas = renderer.domElement
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLOR.haze)
  scene.fog = new THREE.Fog(COLOR.haze, 60, 120)
  scene.environment = host.environment; scene.environmentIntensity = 0.32
  const camera = new THREE.PerspectiveCamera(30, 1, 0.6, 420)
  let exposure = 0.78, grade = 1, introExposure = 0.76

  // light: one set for everything (R7). A high, soft key from the front-left casts the contact shadows; a cool fill opposite;
  // a warm rim from behind lifts edges and thickness off the ivory.
  const hemi = new THREE.HemisphereLight(0xfffaf3, 0xb8b3ab, 0.3); scene.add(hemi)
  const key = new THREE.DirectionalLight(0xfff2e2, 2.7); key.castShadow = quality.shadows > 0
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 })
  key.shadow.mapSize.set(quality.shadows || 1, quality.shadows || 1); key.shadow.normalBias = 0.04; key.shadow.bias = -0.0004; key.shadow.radius = 3
  const fill = new THREE.DirectionalLight(0xe8eef2, 0.35)
  const rim = new THREE.DirectionalLight(0xffe6c4, 0.7)
  scene.add(key, key.target, fill, fill.target, rim, rim.target)
  mark('lights')

  const kit = createKit(quality.transmission)
  const world = createWorld(kit, await loadDriveModel().catch(() => ({})))
  scene.add(world.group)
  mark('world')
  await idle()
  const stations: Station[] = []
  for (const build of BUILDERS) {
    const s = build(kit, quality), i = stations.length
    s.group.position.set(STATION_AT[i].x, 0, STATION_AT[i].z); s.group.rotation.y = STATION_YAW[i]; scene.add(s.group); stations.push(s)
    await idle()
  }
  mark('stations')

  // ── post: contact shading, a shallow focus, a touch of bloom on lit lines, anti-aliasing ──
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  let gtao: GTAOPass | null = null
  if (quality.ao) {
    gtao = new GTAOPass(scene, camera, 2, 2)
    gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 12 }); gtao.blendIntensity = 0.7
    composer.addPass(gtao)
  }
  const dof = quality.name === 'low' ? null : new BokehPass(scene, camera, { focus: 40, aperture: 0.00012, maxblur: 0.006 })
  if (dof) composer.addPass(dof)
  const motion = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uDelta: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uDelta; varying vec2 vUv;
      void main() { vec4 c = vec4(0.0); for (int i = 0; i < 12; i++) { float k = float(i) / 11.0 - 0.5; c += texture2D(tDiffuse, vUv + uDelta * k); } gl_FragColor = c / 12.0; }`,
  })
  motion.enabled = false; composer.addPass(motion)
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.0, 0.5, 1.2)
  bloom.enabled = false; composer.addPass(bloom)
  composer.addPass(new SMAAPass())
  composer.addPass(new OutputPass())
  mark('post')

  let layout: SpaceLayout = { width: 2, height: 2, cx: 0.29, cy: 0.5, rw: 0.58, rh: 1 }
  let pose: Pose = hubPose({ aspect: 1, rh: 1 }), prevPose: Pose | null = null
  let travelFrom: Pose | null = null, travelTo = -1, handoff: Handoff = { glow: 0.28, fov: 24.5, dieFrac: 0.7 }
  let last: SpaceFrame | null = null
  const tuned = { aperture: -1 }
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), tmp = new THREE.Vector3()
  /** the aspect of the region the subject is framed in: the whole canvas at the cut, the composed region once the show begins */
  const region = (compose: number): Region => { const rw = 1 - compose + compose * layout.rw, rh = 1 - compose + compose * layout.rh; return { aspect: (layout.width * rw) / (layout.height * rh), rh } }

  /** match size and pixel ratio to the archive's renderer (it follows the window; we follow it) */
  function resize(l: SpaceLayout) {
    layout = l
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(l.width, l.height)
    bloom.setSize(l.width / 2, l.height / 2)
    camera.aspect = l.width / l.height
  }

  function apply(p: Pose, compose: number) {
    camera.position.copy(p.pos); camera.fov = p.fov
    camera.up.set(0, 1, 0).lerp(tmp.set(0, 0, -1), p.top).normalize()
    camera.lookAt(p.target)
    // composing the subject into its region is a lens shift, not a pan: the world slides, nothing re-frames
    const ox = (0.5 - layout.cx) * layout.width * compose, oy = (0.5 - layout.cy) * layout.height * compose
    if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) camera.setViewOffset(layout.width, layout.height, ox, oy, layout.width, layout.height); else camera.clearViewOffset()
    camera.updateProjectionMatrix(); camera.updateMatrixWorld()
    key.position.copy(p.target).add(tmp.set(-16, 30, 20)); key.target.position.copy(p.target)
    fill.position.copy(p.target).add(tmp.set(22, 12, 10)); fill.target.position.copy(p.target)
    rim.position.copy(p.target).add(tmp.set(6, 14, -26)); rim.target.position.copy(p.target)
  }

  /** the interior's camera height for the first frame: the die as wide on screen as it was on the drive */
  const startHeight = () => (DIE.w / handoff.dieFrac / (layout.width / layout.height)) / 2 / Math.tan(THREE.MathUtils.degToRad(handoff.fov) / 2)

  function update(f: SpaceFrame, dt: number, time: number) {
    last = f
    const reg = region(f.compose)
    if (f.intro < INTRO.dur) {
      pose = introPose(f.intro, reg, { fov: handoff.fov, height: startHeight() }, f.into)
      world.extrude((f.intro - INTRO.extrudeFrom) / (INTRO.extrudeTo - INTRO.extrudeFrom))
      world.settle(Math.min(1, f.intro / (INTRO.dur * 0.9)))
      world.tint(1 - Math.min(1, f.intro / 1.3)); grade = mix01(introExposure, 1, Math.min(1, f.intro / 1.3))
      world.etch(handoff.glow * (1 - Math.min(1, f.intro / 1.0)) + 0.12, time)
      travelFrom = null
    } else {
      world.extrude(1); world.settle(1); world.tint(0); world.etch(0.12, time); grade = 1
      if (f.travel) {
        if (travelFrom === null || travelTo !== f.travel.to) { travelFrom = clonePose(prevPose ?? pose); travelTo = f.travel.to }
        // to < 0 is the way out: back to the hub shot the intro ends on
        pose = flightPose(travelFrom, f.travel.to < 0 ? hubPose(reg) : stationPose(f.travel.to, 0, reg), f.travel.k)
      } else { pose = stationPose(f.area, f.p, reg); travelFrom = null; travelTo = -1 }
    }
    world.tick(time)
    const fog = fogFor(pose.pos.distanceTo(pose.target)), haze = scene.fog as THREE.Fog
    haze.near = fog.near; haze.far = fog.far
    stations.forEach((s, i) => {
      // the station being flown to is put together as the camera comes in; the current one is whole; a finished one is whole and at its result
      let sp = 0, sa = f.retained[i] ? 1 : 0
      if (f.intro < INTRO.dur) { if (i === f.into) sa = smooth01((introBlend(f.intro) - 0.3) / 0.6); else if (f.retained[i]) sp = 1 }
      else if (!f.travel && i === f.area) { sp = f.p; sa = 1 } else if (f.travel && i === f.travel.to) sa = smooth01((f.travel.k - 0.3) / 0.6); else if (f.retained[i]) sp = 1
      // a station out of the picture is neither updated nor walked by the renderer (its matrices stay as they were until it is back)
      const shown = pose.pos.distanceTo(s.group.position) < fog.far + STATION_RADIUS + 40
      if (shown && !s.group.visible) { s.group.matrixWorldAutoUpdate = true; s.group.updateMatrixWorld(true) }
      s.group.visible = shown
      if (shown) s.set(sp, time, sa); else s.group.matrixWorldAutoUpdate = false
    })
    // the flight blurs along its motion; a held shot is sharp, the floor and the far haze soft
    motion.enabled = false
    if (prevPose && dt > 0) {
      const v = pose.pos.distanceTo(prevPose.pos) / dt
      const k = Math.min(1, Math.max(0, (v - 14) / 90)), dir = new THREE.Vector3().subVectors(pose.pos, prevPose.pos).applyQuaternion(camera.quaternion.clone().invert())
      motion.enabled = k > 0.02
      motion.uniforms.uDelta.value.set(-dir.x * 0.0011 * k, dir.y * 0.0011 * k).clampLength(0, 0.04)
    }
    prevPose = clonePose(pose)
    apply(pose, f.compose)
    if (dof) { const u = (dof as unknown as { uniforms: Record<string, { value: number }> }).uniforms; u.focus.value = pose.pos.distanceTo(pose.target); u.aperture.value = tuned.aperture >= 0 ? tuned.aperture : f.intro < INTRO.dur ? 0.00008 + 0.00006 * (f.into >= 0 ? introBlend(f.intro) : 0) : 0.00014; u.maxblur.value = 0.006 }
  }

  /**
   * Compile every program the first frames will use without blocking: the composer renders into a
   * render target (three then picks linear / no-tone-mapping variants), and the depth, GTAO and post
   * passes use materials that are not in the scene. Stand-ins for both are compiled here, so the first
   * frame of each station compiles nothing (the same recipe as the archive's stage.prepare).
   */
  async function prepare() {
    const rt = composer.readBuffer
    const asTarget = <T,>(f: () => T) => { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); try { return f() } finally { renderer.setRenderTarget(prev) } }
    const proxies = new THREE.Scene(), quad = new THREE.PlaneGeometry(2, 2), meshes: THREE.Mesh[] = []
    scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    const overrides: THREE.Material[] = [new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })]
    for (const pass of composer.passes) for (const v of Object.values(pass)) {
      for (const m of (Array.isArray(v) ? v : [v]) as unknown[]) {
        if (!(m instanceof THREE.Material)) continue
        if ((m as THREE.ShaderMaterial).isShaderMaterial) proxies.add(new THREE.Mesh(quad, m)); else overrides.push(m)
      }
    }
    for (const m of overrides) for (const src of meshes) proxies.add(new THREE.Mesh(src.geometry, m))
    const jobs = asTarget(() => [renderer.compileAsync(scene, camera), renderer.compileAsync(proxies, camera, scene), renderer.compileAsync(proxies, camera)])
    const out = composer.passes.find((x) => x instanceof OutputPass) as (OutputPass & { _outputColorSpace: string | null; _toneMapping: number | null }) | undefined
    if (out) {
      out.material.defines = { SRGB_TRANSFER: '', ...(renderer.toneMapping === THREE.ACESFilmicToneMapping ? { ACES_FILMIC_TONE_MAPPING: '' } : {}) }
      out.material.needsUpdate = true; out._outputColorSpace = renderer.outputColorSpace; out._toneMapping = renderer.toneMapping
      const screen = new THREE.Scene(); screen.add(new THREE.Mesh(quad, out.material)); jobs.push(renderer.compileAsync(screen, camera))
    }
    await Promise.all(jobs.map((j) => j.catch(() => undefined)))
    quad.dispose()
  }

  function render() {
    renderer.toneMappingExposure = exposure * grade
    // every pass of the composer renders the scene again (depth, normals, colour): the matrices are brought up to date once, not once per pass
    scene.updateMatrixWorld(); scene.matrixWorldAutoUpdate = false
    try { composer.render() } finally { scene.matrixWorldAutoUpdate = true }
  }

  /** screen positions of a station's anchors (css px in the canvas) and whether each is in front of the camera */
  function anchors(i: number) {
    const s = stations[i], out: Record<string, { x: number; y: number; on: boolean }> = {}
    s.group.updateWorldMatrix(true, false)   // (the station does not move: only its parents' matrices could be stale)
    for (const [k, a] of Object.entries(s.anchors)) {
      const v = new THREE.Vector3(...a).applyMatrix4(s.group.matrixWorld).project(camera)
      out[k] = { x: (v.x + 1) / 2 * layout.width, y: (1 - v.y) / 2 * layout.height, on: v.z > -1 && v.z < 1 }
    }
    return out
  }

  /** where a station's evidence plate is on screen (css px in the canvas) */
  function plateScreen(i: number) {
    const o = stations[i].plate; o.updateWorldMatrix(true, false)
    const v = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).project(camera)
    return { x: (v.x + 1) / 2 * layout.width, y: (1 - v.y) / 2 * layout.height }
  }

  /** which stations are actually in the picture: in the frustum, and not lost in the haze */
  function visibleAreas() {
    pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv)
    return AREAS.flatMap((_, i) => {
      const c = new THREE.Vector3(STATION_AT[i].x, 3, STATION_AT[i].z)
      return frustum.intersectsSphere(new THREE.Sphere(c, STATION_RADIUS)) && camera.position.distanceTo(c) - STATION_RADIUS < (scene.fog as THREE.Fog).far ? [i] : []
    })
  }

  function frameResult(i: number, reg: Region): Pose {
    const r = stations[i].result, s = STATION_AT[i], yaw = STATION_YAW[i] + r.yaw, t = Math.tan(THREE.MathUtils.degToRad(30) / 2)
    const dist = Math.max(r.halfH, r.halfH * 1.5 / reg.aspect) / t
    const at = new THREE.Vector3(...r.at).applyAxisAngle(new THREE.Vector3(0, 1, 0), STATION_YAW[i]).add(new THREE.Vector3(s.x, 0, s.z))
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(r.elev), Math.sin(r.elev), Math.cos(yaw) * Math.cos(r.elev))
    return { pos: at.clone().addScaledVector(dir, dist), target: at, fov: 30, top: 0 }
  }
  /**
   * The evidence thumbnail: the result's own framing of the live scene, drawn by the same renderer
   * through the same chain, so it can never be a different picture from the one on screen.
   */
  function thumbnail(i: number, size: [number, number] = [360, 225]) {
    if (!last) return ''
    const frame = last, saved = pose
    // only that station is in the picture (it may be one that is out of it right now, and so not drawn or updated)
    const was = stations.map((st) => st.group.visible)
    stations.forEach((st, n) => { st.group.visible = n === i; if (n === i) { st.group.matrixWorldAutoUpdate = true; st.group.updateMatrixWorld(true); st.set(1, 0, 1) } })
    apply(frameResult(i, { aspect: size[0] / size[1], rh: 1 }), 0)
    motion.enabled = false; render()
    stations.forEach((st, n) => { st.group.visible = was[n]; if (!was[n]) st.group.matrixWorldAutoUpdate = false })
    const c = document.createElement('canvas'); c.width = size[0]; c.height = size[1]
    const sw = canvas.width, sh = canvas.height, ar = size[0] / size[1], cw = Math.min(sw, sh * ar), ch = cw / ar
    c.getContext('2d')!.drawImage(canvas, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, size[0], size[1])
    apply(saved, frame.compose)
    return c.toDataURL('image/webp', 0.82)
  }

  const debug = () => ({
    camera: camera.position.toArray(), target: pose.target.toArray(), fov: camera.fov, visibleAreas: visibleAreas(),
    triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, meshes: (() => { let n = 0; scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++ }); return n })(),
  })

  await prepare()
  mark('compile')
  return {
    scene, camera, stations, world, kit, canvas,
    timing, resize, update, render, anchors, plateScreen, thumbnail, visibleAreas, debug,
    handoff(h: Handoff) { handoff = h },
    /** the gain that matches the interior's first frame to the exterior's last (set by measurement) */
    get pose() { return pose },
    /** lab only: adjust the light without a rebuild */
    tune(o: { exposure?: number; key?: number; hemi?: number; env?: number; fill?: number; rim?: number; bloom?: number; floor?: number; aperture?: number; haze?: number; introExposure?: number; warmR?: number; warmG?: number; warmB?: number }) {
      if (o.haze !== undefined) { (scene.background as THREE.Color).set(o.haze); (scene.fog as THREE.Fog).color.set(o.haze) }
      if (o.exposure !== undefined) exposure = o.exposure
      if (o.key !== undefined) key.intensity = o.key
      if (o.hemi !== undefined) hemi.intensity = o.hemi
      if (o.env !== undefined) scene.environmentIntensity = o.env
      if (o.fill !== undefined) fill.intensity = o.fill
      if (o.rim !== undefined) rim.intensity = o.rim
      if (o.bloom !== undefined) { bloom.strength = o.bloom; bloom.enabled = o.bloom > 0 }
      if (o.floor !== undefined) ((world.group.getObjectByName('floor') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(o.floor)
      if (o.aperture !== undefined) tuned.aperture = o.aperture
      if (o.introExposure !== undefined) introExposure = o.introExposure
      if (o.warmR !== undefined) world.warm.set(o.warmR, o.warmG ?? 1, o.warmB ?? 1)
    },
    dispose() {
      composer.dispose(); world.dispose(); kit.all.forEach((m) => m.dispose()); stations.forEach((s) => s.dispose())
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose() })
    },
  }
}
export type Space = Awaited<ReturnType<typeof createSpace>>
