// The encrypted drive: the archive's card, built as a small precision assembly after the way
// RhineLabUI builds its cassette (MIT, github.com/LBEILC/RhineLabUI): an ivory carrier frame,
// frosted polymer windows front and back, and an internal ceramic board whose etched circuit and
// packages read through the frost; titanium fasteners and a champagne index inlay. The geometry,
// etch and meaning (an encrypted storage module) are our own, procedural.
//
// A tone-on-tone circuit is etched into the face and continues over the top edge, the part the
// archive's telephoto camera sees. Readable drives carry champagne light along the traces; on
// open, light leaves the LED, runs along the top traces, spills over the edge and spreads across
// the face to the die. The LED slit is the permission: olive = readable, off = sealed, red = shredded.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const CARD = { W: 5, H: 3.7, T: 0.376 } as const
const { W, H, T } = CARD
/** the ivory end caps' width; the frosted shell runs between them */
const CAP = 0.16
/** the etched face lies on the internal diffuser board, behind the frosted shell */
export const BOARD_Z = (T - 0.16) / 2 + 0.002
export const LED_X = -1.3
export const LABEL = { W: 1.6, H: 0.8, x: -W / 2 + 0.3 + 0.8, y: H - 0.66 }
/** Where the top traces drop onto the face, in face UV. The reveal spreads from here. */
const ENTRY_UV = new THREE.Vector2(0.28, 1.0)

type Canvas = HTMLCanvasElement
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

function rng(seed: number) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647 }

// face: orthogonal buses with 45° doglegs ending in vias, one die, and trunks that run to the top edge
function faceTraces(): Canvas {
  const c = canvas(1024, 760), g = c.getContext('2d')!
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'square'
  const rnd = rng(11), grid = 24, snap = (v: number) => Math.round(v / grid) * grid
  const via = (x: number, y: number) => { g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); g.fillStyle = '#fff' }
  // trunks from the top edge (continuing the top-strip traces) down toward the die
  g.lineWidth = 5
  for (const [x0, x1, y1] of [[288, 288, 312], [336, 600, 360], [384, 600, 408]] as const) {
    g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0, y1 - 48); g.lineTo(x0 + 48, y1); g.lineTo(x1, y1); g.stroke()
  }
  for (let i = 0; i < 14; i++) {
    let x = snap(60 + rnd() * 900), y = snap(60 + rnd() * 640); g.lineWidth = 2.5
    g.beginPath(); g.moveTo(x, y)
    for (let k = 0; k < 4; k++) {
      const len = snap(60 + rnd() * 260), dir = Math.floor(rnd() * 4)
      if (rnd() < 0.35) { const d = snap(40 + rnd() * 60); x += d * (dir % 2 ? 1 : -1); y += d * (dir < 2 ? 1 : -1) }
      else if (dir < 2) x += dir ? len : -len; else y += dir === 3 ? len : -len
      x = Math.max(36, Math.min(988, x)); y = Math.max(36, Math.min(724, y)); g.lineTo(x, y)
    }
    g.stroke(); via(x, y)
  }
  g.lineWidth = 4; g.strokeRect(600, 264, 216, 168)
  for (let k = 0; k < 7; k++) { g.fillRect(582, 282 + k * 20, 12, 5); g.fillRect(822, 282 + k * 20, 12, 5) }
  return c
}
// top edge strip (x along the drive, y across its thickness): three traces from the LED to the edge
function topTraces(): Canvas {
  const c = canvas(1024, 80), g = c.getContext('2d')!
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 80); g.strokeStyle = '#fff'; g.lineCap = 'square'; g.lineWidth = 4
  // LED sits near x = 0.24; traces run from it toward the front edge (y = 80) where they wrap onto the face
  for (const [x, y] of [[290, 18], [340, 40], [390, 62]] as const) { g.beginPath(); g.moveTo(250, y); g.lineTo(x - 12, y); g.lineTo(x, y + 12); g.lineTo(x, 80); g.stroke() }
  g.lineWidth = 2.5
  for (const [a, b, y] of [[520, 900, 24], [560, 820, 52], [120, 230, 40]] as const) { g.beginPath(); g.moveTo(a, y); g.lineTo(b, y); g.stroke() }
  return c
}

function normalFromHeight(src: Canvas, depth = 2.1): Canvas {
  const w = src.width, h = src.height, blur = canvas(w, h), bg = blur.getContext('2d')!
  bg.filter = 'blur(1.4px)'; bg.drawImage(src, 0, 0)
  const b = bg.getImageData(0, 0, w, h).data, out = new ImageData(w, h), o = out.data
  const hgt = (x: number, y: number) => 1 - b[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) << 2] / 255
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * depth, dy = (hgt(x, y + 1) - hgt(x, y - 1)) * depth, l = Math.hypot(dx, dy, 1), i = (y * w + x) << 2
    o[i] = (-dx / l * 0.5 + 0.5) * 255; o[i + 1] = (dy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255
  }
  const c = canvas(w, h); c.getContext('2d')!.putImageData(out, 0, 0); return c
}
function metalRough(src: Canvas): Canvas {   // G = roughness, B = metalness: polished groove floor, satin elsewhere
  const w = src.width, h = src.height, d = src.getContext('2d')!.getImageData(0, 0, w, h).data, out = new ImageData(w, h), o = out.data
  for (let i = 0; i < d.length; i += 4) { const k = d[i] / 255; o[i + 1] = 128 * (1 - k) + 72 * k; o[i + 2] = 170 * k; o[i + 3] = 255 }
  const c = canvas(w, h); c.getContext('2d')!.putImageData(out, 0, 0); return c
}
function lip(src: Canvas): Canvas { const c = canvas(src.width, src.height), g = c.getContext('2d')!; g.filter = 'blur(2.5px)'; g.drawImage(src, 0, 0); g.drawImage(src, 0, 0); return c }
const tex = (c: Canvas) => { const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t }
interface EtchMaps { normal: THREE.Texture; mr: THREE.Texture; mask: THREE.Texture; lip: THREE.Texture }
let maps: { face: EtchMaps; top: EtchMaps } | null = null
function etchMaps() {
  if (maps) return maps
  const build = (c: Canvas): EtchMaps => ({ normal: tex(normalFromHeight(c)), mr: tex(metalRough(c)), mask: tex(c), lip: tex(lip(c)) })
  return (maps = { face: build(faceTraces()), top: build(topTraces()) })
}

const RIM = /* glsl */ `float fr = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);
      outgoingLight += uRimColor * fr * uRim;
      #include <opaque_fragment>`

/**
 * Backlit resin (after the Rhine Lab PV): the key light sits behind the field; where the eye looks
 * toward it through the polymer, or a face turns away from it, the material glows warm amber, as
 * light scattered through it would. A cheap translucency term on top of the transmission pass.
 * `TRANSLUCENCY.dir` is the key light's direction in view space, updated every frame.
 */
export const TRANSLUCENCY = { dir: { value: new THREE.Vector3(0, 1, 0) }, color: { value: new THREE.Color(0xf0b47a) }, amount: { value: 0.55 } }
const TRANS = /* glsl */ `{
        vec3 tV = normalize(vViewPosition), tN = normalize(vNormal), tL = normalize(uTransDir);
        float through = pow(saturate(dot(tV, -tL)), 2.5) * 0.7 + pow(saturate(dot(tN, -tL) * 0.5 + 0.5), 3.0) * 0.6;
        outgoingLight += uTransCol * through * uTransAmt * diffuseColor.rgb;
      }
      `

/**
 * In the packed archive a drive darkens toward its foot: light reaches the tops and dies warm in
 * the gaps (after RhineLabUI's array shell). The selected drive, lifted out, is not graded.
 */
const GRADE_V = 'varying float vGrade;\n'
/** Entrance-only material direction; zero restores the existing archive and file materials. */
export const ENTRY_IVORY = { value: 0 }
function grade(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.uniforms.uEntryIvory = ENTRY_IVORY
  sh.vertexShader = GRADE_V + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrade = position.y / 3.7;')
  sh.fragmentShader = GRADE_V + 'uniform float uEntryIvory;\n' + sh.fragmentShader.replace('#include <color_fragment>',
    '#include <color_fragment>\ndiffuseColor.rgb *= mix(mix(vec3(0.34, 0.24, 0.15), vec3(1.0, 0.97, 0.92), smoothstep(0.05, 1.0, vGrade)), mix(vec3(0.68, 0.66, 0.62), vec3(1.0), smoothstep(0.0, 1.0, vGrade)), uEntryIvory);')
}

/** The ivory carrier frame: opaque, satin, a soft clearcoat on the radiused edge. */
export function frameMaterial(dark = false, graded = false) {
  const m = new THREE.MeshPhysicalMaterial({
    color: dark ? 0x353c40 : graded ? 0xfff5e9 : 0xf3e7d5, roughness: graded ? 0.38 : 0.34, clearcoat: dark ? 0.5 : 0.2, clearcoatRoughness: 0.35,
    sheen: 0.15, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.6,
  })
  if (graded) { m.onBeforeCompile = grade; m.customProgramCacheKey = () => 'frame-graded' }
  return m
}

/** Frosted polymer after the reference: transmissive, rough, warm attenuation, a lit rim. */
export function bodyMaterial(dark = false, graded = false) {
  const m = new THREE.MeshPhysicalMaterial({
    color: dark ? 0x3c444a : graded ? 0xf6e2c8 : 0xfffdfa, roughness: graded ? 0.28 : 0.27, transmission: dark ? 0 : graded ? 0.78 : 0.9, thickness: 0.12, ior: 1.46,
    attenuationColor: new THREE.Color(dark ? 0x141518 : 0xd9a873), attenuationDistance: dark ? 0.6 : 0.6,
    clearcoat: dark ? 0.12 : 0.3, clearcoatRoughness: dark ? 0.4 : 0.25, envMapIntensity: dark ? 0.22 : 0.6,
  })
  if (dark) m.roughness = 0.5   // slate reads as a solid, not a mirror for the bright room
  const u = { uRim: { value: dark ? 0.3 : 0.28 }, uRimColor: { value: new THREE.Color(dark ? 0x6a6f78 : 0xfffaf2) } }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, { uTransDir: TRANSLUCENCY.dir, uTransCol: TRANSLUCENCY.color, uTransAmt: TRANSLUCENCY.amount })
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRim; uniform vec3 uRimColor; uniform vec3 uTransDir, uTransCol; uniform float uTransAmt;')
      .replace('#include <opaque_fragment>', dark ? RIM : TRANS + RIM)
    if (graded) {
      grade(sh)
      // a dark-tinted instance (X-000) is solid: no light through it
      sh.fragmentShader = sh.fragmentShader.replace('#include <transmission_fragment>',
        THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;', 'material.transmission = transmission * step(0.5, vColor.r + vColor.g);'))
      // a decrypted drive's shell clears: the frost (roughness) falls away and the inside shows
      sh.vertexShader = 'attribute float aClear, aLamp; varying float vClear, vLamp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvClear = aClear; vLamp = aLamp;')
      // the shell itself carries a record's light: a broad surface stays steady where a thin bright gap shimmers
      sh.fragmentShader = 'varying float vClear, vLamp;\n' + sh.fragmentShader
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.04, vClear);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.62, 0.30) * 0.075 * vLamp;')
    }
  }
  if (graded) m.customProgramCacheKey = () => 'glass-graded'
  return m
}

export interface EtchUniforms {
  uReveal: { value: number }; uGlow: { value: number }; uTime: { value: number }; uDie: { value: number }; uCol: { value: THREE.Color }
}
/**
 * The etched layer. `part` picks the face or the top strip. Instanced drives read per-instance
 * glow from `aGlow`; the selected drive uses uniforms. uReveal ∈ [0,1] is the light front:
 * 0–0.25 runs along the top strip from the LED, 0.25–1 spreads over the face from the entry point.
 */
export function etchMaterial({ part = 'face', dark = false, instanced = false }: { part?: 'face' | 'top'; dark?: boolean; instanced?: boolean } = {}) {
  const M = etchMaps()[part]
  const m = new THREE.MeshPhysicalMaterial({
    color: dark ? 0x1d1e21 : part === 'face' ? (instanced ? 0x8a6c4c : 0xb9aa96) : 0xf4f0ea, roughness: 1, metalness: 1, roughnessMap: M.mr, metalnessMap: M.mr,
    normalMap: M.normal, normalScale: new THREE.Vector2(1.1, 1.1), clearcoat: dark ? 0.6 : 0.35, clearcoatRoughness: dark ? 0.28 : 0.4,
    sheen: dark ? 0.15 : 0.4, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xffffff),
    emissive: 0xffffff, emissiveMap: M.mask, emissiveIntensity: 1, envMapIntensity: 0.6,
  })
  const u: EtchUniforms & Record<string, { value: unknown }> = {
    uReveal: { value: 1 }, uGlow: { value: 0 }, uTime: { value: 0 }, uDie: { value: 0 },
    uCol: { value: new THREE.Color(0xe6c98f) }, uHot: { value: new THREE.Color(0xffffff) },
    uRim: { value: 0.3 }, uRimColor: { value: new THREE.Color(0xfffaf2) }, uEntry: { value: ENTRY_UV },
    // the lantern: a record's whole plate glows warm behind the frost, and its top edge carries a line of it
    uLamp: { value: new THREE.Color(0xffa458).multiplyScalar(1.6) },
  }
  m.userData.u = u
  // the etched plane sits exactly on the precision model's board face (BOARD_Z): pull it forward in depth so it always
  // wins. Close in, the depth range changes and the board would otherwise cover the traces (z-fighting)
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -4
  const progress = part === 'top'
    ? 'clamp(uReveal / 0.25, 0.0, 1.0) * 1.1 - abs(x - 0.24) * 1.4'                 // outward from the LED
    : '(uReveal - 0.25) / 0.75 * 1.25 - distance(vEmissiveMapUv * vec2(1.35, 1.0), uEntry * vec2(1.35, 1.0))'   // from the entry point
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u)
    if (instanced) sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow, aLamp; varying float vGlow, vLamp;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvGlow = aGlow; vLamp = aLamp;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uReveal, uGlow, uTime, uDie, uRim; uniform vec3 uCol, uHot, uRimColor, uLamp; uniform vec2 uEntry;${instanced ? '\nvarying float vGlow, vLamp;' : ''}`)
      .replace('#include <opaque_fragment>', RIM)
      .replace('#include <emissivemap_fragment>', /* glsl */ `
      float mask = texture2D(emissiveMap, vEmissiveMapUv).r;
      float x = vEmissiveMapUv.x;
      float glow = ${instanced ? 'vGlow * 0.8' : 'uGlow'};
      float p = ${progress};
      float lit = smoothstep(0.0, 0.04, p);
      float front = exp(-pow(p / 0.035, 2.0)) * step(0.001, uReveal) * step(uReveal, 0.999);
      float flow = pow(0.5 + 0.5 * sin(x * 60.0 + vEmissiveMapUv.y * 23.0 - uTime * 5.0), 8.0);
      ${part === 'face' ? 'float die = uDie * smoothstep(0.1, 0.0, max(abs(x - 0.69) - 0.1, abs(vEmissiveMapUv.y - 0.54) - 0.11));' : 'float die = 0.0;'}
      totalEmissiveRadiance = mask * (uCol * lit * glow * (1.1 + 2.2 * flow) + uHot * (front * 4.0 + die * 2.5));
      ${instanced ? `totalEmissiveRadiance += uLamp * vLamp * ${part === 'top' ? '(0.35 + 0.9 * mask)' : '(0.55 + 0.6 * mask)'};` : ''}`)
  }
  return m
}
export const etchUniforms = (m: THREE.Material) => m.userData.u as EtchUniforms

const merge2 = (a: THREE.BufferGeometry, b: THREE.BufferGeometry) => mergeGeometries([a, b])
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g }

/** A drive standing on its bottom edge, faces toward ±z, y from 0 up. */
export function driveParts() {
  // the frosted shell runs between the two ivory end caps; light passes into it and comes back warm
  // from the diffuser inside, so the packed drives read as tinted polymer rather than white plastic
  const inner = W - 2 * CAP
  const body = new RoundedBoxGeometry(inner + 0.02, H, T, 4, 0.04); body.translate(0, H / 2, 0)
  const cap = (x: number) => { const g = new RoundedBoxGeometry(CAP, H + 0.02, T + 0.03, 4, 0.035); g.translate(x, H / 2, 0); return g }
  const caps = mergeGeometries([cap(-(W / 2 - CAP / 2)), cap(W / 2 - CAP / 2)])
  // the diffuser board inside, and two packages on it (lower left, clear of the etched die)
  const core = mergeGeometries([box(inner - 0.2, H - 0.25, T - 0.16, 0, H / 2, 0),
    box(0.62, 0.42, 0.03, -1.05, H / 2 - 0.62, BOARD_Z + 0.014), box(0.42, 0.42, 0.03, -0.28, H / 2 - 0.62, BOARD_Z + 0.014)])
  const face = new THREE.PlaneGeometry(inner - 0.3, H - 0.4); face.translate(0, H / 2, BOARD_Z)
  const top = new THREE.PlaneGeometry(inner - 0.3, T - 0.12); top.rotateX(-Math.PI / 2); top.translate(0, H + 0.0015, 0)
  // titanium fasteners on the caps, both faces, and a champagne index inlay on the right cap
  const cz = T / 2 + 0.015, cx = W / 2 - CAP / 2
  const screw = (x: number, y: number, z: number) => { const g = new THREE.CylinderGeometry(0.035, 0.035, 0.012, 20); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g }
  const screws = mergeGeometries([cx, -cx].flatMap((x) => [0.32, H - 0.32].flatMap((y) => [screw(x, y, cz + 0.004), screw(x, y, -cz - 0.004)])))
  const inlay = mergeGeometries([box(0.03, 0.9, 0.01, cx, H / 2, cz + 0.003), box(0.03, 0.9, 0.01, cx, H / 2, -cz - 0.003)])
  // the LED says what kind of drive this is: one long slit = file, two short = service record, a dot = skill
  const led = box(1.2, 0.03, 0.09, LED_X, H + 0.006, 0)
  const ledDouble = merge2(box(0.5, 0.03, 0.09, LED_X - 0.33, H + 0.006, 0), box(0.5, 0.03, 0.09, LED_X + 0.33, H + 0.006, 0))
  const ledDot = box(0.22, 0.03, 0.09, LED_X - 0.49, H + 0.006, 0)
  const tab = box(0.34, 0.08, 0.07, W / 2 - 0.75, H + 0.02, 0)
  const grips = Array.from({ length: 5 }, (_, i) => box(0.012, 0.045, T * 0.55, -W / 2 - 0.002, H - 0.55 - i * 0.11, 0))
  const label = new THREE.PlaneGeometry(LABEL.W, LABEL.H); label.translate(LABEL.x, LABEL.y, T / 2 + 0.003)
  return { body, caps, face, top, core, screws, inlay, led, ledDouble, ledDot, tab, grips, label }
}

export function hardwareMaterials() {
  return {
    core: new THREE.MeshStandardMaterial({ color: 0xcdc3b6, roughness: 0.6, metalness: 0.05 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xd2d0c9, roughness: 0.34, metalness: 0.55 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xa47a4a, roughness: 0.33, metalness: 0.6 }),
    coreDark: new THREE.MeshStandardMaterial({ color: 0x1d272c, roughness: 0.5 }),
    // tone-on-tone hardware: from a distance only a lit LED stands out
    tab: new THREE.MeshStandardMaterial({ color: 0xf1eadf, roughness: 0.5, metalness: 0.05 }),
    grip: new THREE.MeshStandardMaterial({ color: 0xebe5dc, roughness: 0.5 }),
  }
}

export const LED = { off: new THREE.Color(0xf1eadf), on: new THREE.Color(0x9bb03a), shredded: new THREE.Color(0xe0502a) }
