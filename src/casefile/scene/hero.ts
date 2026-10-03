// The selected drive, as real meshes so it can glow, lift and decrypt on its own.
import * as THREE from 'three'
import { bodyMaterial, CARD, driveParts, etchMaterial, etchUniforms, frameMaterial, hardwareMaterials, LED } from './drive'
import type { DriveModel } from './model'

export function createHero(transmission: boolean) {
  const P = driveParts(), HW = hardwareMaterials()
  const group = new THREE.Group()
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; group.add(m); return m }
  const skins = {
    white: { body: frameMaterial(), glass: bodyMaterial(), face: etchMaterial({ part: 'face' }), top: etchMaterial({ part: 'top' }) },
    black: { body: frameMaterial(true), glass: bodyMaterial(true), face: etchMaterial({ part: 'face', dark: true }), top: etchMaterial({ part: 'top', dark: true }) },
  }
  if (!transmission) for (const s of Object.values(skins)) s.glass.transmission = 0
  const core = mk(P.core, HW.core, false), body = mk(P.caps, skins.white.body), glass = mk(P.body, skins.white.glass)
  const screws = mk(P.screws, HW.metal, false), inlay = mk(P.inlay, HW.gold, false)
  const face = mk(P.face, skins.white.face, false), top = mk(P.top, skins.white.top, false)
  mk(P.tab, HW.tab); for (const g of P.grips) mk(g, HW.grip)
  const ledMat = new THREE.MeshBasicMaterial({ color: LED.off.clone(), toneMapped: false })
  const ledMeshes = { long: mk(P.led, ledMat, false), double: mk(P.ledDouble, ledMat, false), dot: mk(P.ledDot, ledMat, false) }
  // a hairline seam around the middle: lights up after the die, where the page comes out
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xfff3dc, transparent: true, opacity: 0, toneMapped: false })
  const seam = new THREE.Mesh(new THREE.BoxGeometry(CARD.W + 0.004, 0.012, CARD.T + 0.004), seamMat); seam.position.y = CARD.H * 0.5; group.add(seam)
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 512; labelCanvas.height = 256
  const labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = 8
  const label = mk(P.label, new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false }), false)

  let dark = false
  const ivory = skins.white.body.color.clone()
  return {
    group, labelCanvas, labelTex,
    /** materials not on screen at first (the black skin) with the geometry they go on, for precompiling */
    spare: [[P.caps, skins.black.body], [P.body, skins.black.glass], [P.face, skins.black.face], [P.top, skins.black.top], [P.core, HW.coreDark]] as [THREE.BufferGeometry, THREE.Material][],
    /** the precision model: shell, frame and core swap in; the detail groups join them */
    useModel(g: DriveModel) {
      const swap = (m: THREE.Mesh, k: keyof DriveModel) => { const x = g[k]; if (x) { m.geometry.dispose(); m.geometry = x.geometry } }
      swap(body, 'Ivory_Frame'); swap(glass, 'Frosted_Shell'); swap(core, 'Diffuser')
      for (const [m, k] of [[screws, 'Titanium'], [inlay, 'Champagne']] as const) { const x = g[k]; if (x) { m.geometry = x.geometry; m.material = x.material } }
      for (const k of ['Ceramic', 'Moulded_Edge', 'Engraving'] as const) { const x = g[k]; if (x) mk(x.geometry, x.material, false) }
    },
    /** decrypted: the frosted shell clears as the file opens, and the board inside shows */
    setClear(k: number) {
      skins.white.glass.roughness = 0.27 - 0.24 * k; skins.white.glass.clearcoatRoughness = 0.25 - 0.2 * k
      skins.black.glass.roughness = 0.5 - 0.3 * k
    },
    /** the end caps tell the kind of record (ink: a job, champagne: education); null = ivory */
    setCap(c: THREE.Color | null) { skins.white.body.color.copy(ivory); if (c) skins.white.body.color.multiply(c) },
    /** the printed label hides while a demo is projected onto the face */
    setLabel(visible: boolean) { label.visible = visible },
    setDark(d: boolean) {
      if (d === dark) return; dark = d
      const s = d ? skins.black : skins.white
      body.material = s.body; glass.material = s.glass; face.material = s.face; top.material = s.top; core.material = d ? HW.coreDark : HW.core
    },
    setLed(c: THREE.Color | null, kind: 'long' | 'double' | 'dot' = 'long') { ledMat.color.copy(c ?? LED.off); for (const [k, m] of Object.entries(ledMeshes)) m.visible = k === kind },
    /** reveal: light front 0→1 · glow: trace light · die: chip flash · seam: 0→1 */
    setLight(reveal: number, glow: number, die: number, seam: number, time: number) {
      for (const s of Object.values(skins)) for (const m of [s.face, s.top]) {
        const u = etchUniforms(m); u.uReveal.value = reveal; u.uGlow.value = glow; u.uDie.value = die; u.uTime.value = time
      }
      seamMat.opacity = seam
    },
    /** trace light colour: champagne normally, red while a drive is being shredded */
    setTraceColor(c: THREE.Color) { for (const s of Object.values(skins)) for (const m of [s.face, s.top]) etchUniforms(m).uCol.value.copy(c) },
  }
}
export type Hero = ReturnType<typeof createHero>
