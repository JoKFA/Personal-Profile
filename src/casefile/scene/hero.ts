// The selected drive, as real meshes so it can glow, lift and decrypt on its own.
import * as THREE from 'three'
import { bodyMaterial, CARD, driveParts, etchMaterial, etchUniforms, hardwareMaterials, LED } from './drive'

export function createHero(transmission: boolean) {
  const P = driveParts(), HW = hardwareMaterials()
  const group = new THREE.Group()
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; group.add(m); return m }
  const skins = {
    white: { body: bodyMaterial(), face: etchMaterial({ part: 'face' }), top: etchMaterial({ part: 'top' }) },
    black: { body: bodyMaterial(true), face: etchMaterial({ part: 'face', dark: true }), top: etchMaterial({ part: 'top', dark: true }) },
  }
  if (!transmission) for (const s of Object.values(skins)) s.body.transmission = 0
  const core = mk(P.core, HW.core, false), body = mk(P.body, skins.white.body)
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
  return {
    group, labelCanvas, labelTex,
    /** materials not on screen at first (the black skin) with the geometry they go on, for precompiling */
    spare: [[P.body, skins.black.body], [P.face, skins.black.face], [P.top, skins.black.top], [P.core, HW.coreDark]] as [THREE.BufferGeometry, THREE.Material][],
    /** the printed label hides while a demo is projected onto the face */
    setLabel(visible: boolean) { label.visible = visible },
    setDark(d: boolean) {
      if (d === dark) return; dark = d
      const s = d ? skins.black : skins.white
      body.material = s.body; face.material = s.face; top.material = s.top; core.material = d ? HW.coreDark : HW.core
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
