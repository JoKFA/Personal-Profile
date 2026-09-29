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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LANES, ROWS } from '../motion/grid'
import { bodyMaterial, driveParts, etchMaterial, etchUniforms, hardwareMaterials, LED } from './drive'
import type { Quality } from './quality'

export const BG = 0xebe6de
export const FLOOR_Y = -4.63
/** drawn columns: the six drawers plus one wrapped copy each side, so the field never ends in view */
export const COLS = LANES + 2
/** drawn rows: the 32-row ring plus wrapped copies at both far ends, for the same reason */
export const DROWS = ROWS + 12
const N = COLS * DROWS
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
const DARK = new THREE.Color(0x2a2b2f), WHITE = new THREE.Color(1, 1, 1), CORE_DARK = new THREE.Color(0x3a3b40).multiplyScalar(1 / 0.89)

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
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.Fog(BG, 145, 165)
  const camera = new THREE.PerspectiveCamera(3, innerWidth / innerHeight, 5, 400)

  scene.environmentIntensity = 0.5
  scene.add(new THREE.HemisphereLight(0xfffaf5, 0xb4a18c, 0.55))
  const key = new THREE.DirectionalLight(0xfff5ea, 1.75); key.position.set(-9, 11, 4)
  key.castShadow = quality.shadows > 0
  Object.assign(key.shadow.camera, { left: -16, right: 16, top: 15, bottom: -15, near: 0.1, far: 50 })
  key.shadow.mapSize.set(quality.shadows || 1, quality.shadows || 1); key.shadow.normalBias = 0.035; key.shadow.bias = -0.0003; key.shadow.radius = 4
  const fill = new THREE.DirectionalLight(0xe9eef5, 0.45); fill.position.set(8, 6, -8)
  const back = new THREE.DirectionalLight(0xfff8ef, 0.9); back.position.set(3, 7, -12)
  scene.add(key, fill, back)
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
  cellAttr.setUsage(THREE.DynamicDrawUsage); glowAttr.setUsage(THREE.DynamicDrawUsage)
  P.label.setAttribute('aCell', cellAttr); P.face.setAttribute('aGlow', glowAttr); P.top.setAttribute('aGlow', glowAttr)
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, N); m.castShadow = shadow && quality.shadows > 0; m.receiveShadow = true; m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m
  }
  const bodyMat = bodyMaterial()
  if (!quality.transmission) { bodyMat.transmission = 0; bodyMat.color.set(0xf6f2ec) }
  const faceEtch = etchMaterial({ part: 'face', instanced: true }), topEtch = etchMaterial({ part: 'top', instanced: true })
  const core = mk(P.core, HW.core, false), body = mk(P.body, bodyMat), face = mk(P.face, faceEtch, false), top = mk(P.top, topEtch, false)
  const hard = mk(mergeGeometries([P.tab, ...P.grips]), HW.tab), labels = mk(P.label, labelMat, false)
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  const ledSets = { long: mk(P.led, ledMat, false), double: mk(P.ledDouble, ledMat, false), dot: mk(P.ledDot, ledMat, false) }
  const leds = ledSets.long
  for (const m of [core, face, top, hard, labels]) m.instanceMatrix = body.instanceMatrix
  for (let i = 0; i < N; i++) { body.setColorAt(i, WHITE); face.setColorAt(i, WHITE); top.setColorAt(i, WHITE); core.setColorAt(i, WHITE); for (const l of Object.values(ledSets)) l.setColorAt(i, LED.off) }
  void leds
  const tinted = [body, face, top, core, ...Object.values(ledSets)]

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  if (quality.ao) {
    const ao = new GTAOPass(scene, camera, innerWidth, innerHeight)
    ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 0.6, scale: 1, samples: 16 }); ao.blendIntensity = 0.6
    composer.addPass(ao)
  }
  // bloom only while a drive is being read: the threshold sits above the lit cream surfaces, so
  // only the trace light (emissive ×4) blooms; the pass is disabled whenever strength is 0
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0, 0.55, 1.35)
  bloom.enabled = false
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth / 2, innerHeight / 2); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix() }
  addEventListener('resize', resize)

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3()
  return {
    renderer, scene, camera, composer, atlas, pick: body, N,
    /** led: null = off · glow 0/1 · dark = X-000 */
    set(i: number, x: number, y: number, z: number, tilt: number, labelCell: number, led: THREE.Color | null, hidden: boolean, glow: number, dark: boolean, ledKind: 'long' | 'double' | 'dot' = 'long') {
      e.set(tilt, 0, 0); q.setFromEuler(e); p.set(x, y, z)
      m4.compose(p, q, hidden ? zero : one); body.setMatrixAt(i, m4)
      for (const [k, l] of Object.entries(ledSets)) l.setMatrixAt(i, k === ledKind ? m4 : ZERO)
      body.setColorAt(i, dark ? DARK : WHITE); face.setColorAt(i, dark ? DARK : WHITE); top.setColorAt(i, dark ? DARK : WHITE); core.setColorAt(i, dark ? CORE_DARK : WHITE)
      ledSets[ledKind].setColorAt(i, led ?? LED.off)
      cellAttr.setX(i, labelCell); glowAttr.setX(i, glow)
    },
    commit(time: number) {
      body.instanceMatrix.needsUpdate = true
      for (const l of Object.values(ledSets)) l.instanceMatrix.needsUpdate = true
      for (const m of tinted) m.instanceColor!.needsUpdate = true
      cellAttr.needsUpdate = glowAttr.needsUpdate = true
      etchUniforms(faceEtch).uTime.value = etchUniforms(topEtch).uTime.value = time
    },
    /** trace-light bloom (0 = off) and scene exposure, both animated by the read */
    setBloom(strength: number) { bloom.strength = strength; bloom.enabled = strength > 0.01 },
    setExposure(x: number) { renderer.toneMappingExposure = x },
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
        out.material.defines = { SRGB_TRANSFER: '', ...(renderer.toneMapping === THREE.NeutralToneMapping ? { NEUTRAL_TONE_MAPPING: '' } : {}) }
        out.material.needsUpdate = true
        out._outputColorSpace = renderer.outputColorSpace; out._toneMapping = renderer.toneMapping
        const screen = new THREE.Scene(); screen.add(new THREE.Mesh(quad, out.material)); jobs.push(renderer.compileAsync(screen, camera))
      }
      await Promise.all(jobs)
      quad.dispose()
    },
    render() { composer.render() },
    dispose() {
      removeEventListener('resize', resize)
      renderer.dispose(); composer.dispose()
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()) })
    },
  }
}
export type Stage = ReturnType<typeof createStage>
