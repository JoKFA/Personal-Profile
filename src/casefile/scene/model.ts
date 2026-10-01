// The precision drive model (art/build_drive.py → public/assets/drive-module.glb): one mesh per
// material. The packed archive instances the five coarse groups; the selected drive carries every
// group, including the detail behind the frost. Until it loads, the procedural parts stand in.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type ModelGroup = 'Frosted_Shell' | 'Ivory_Frame' | 'Diffuser' | 'Ceramic' | 'Titanium' | 'Champagne' | 'Moulded_Edge' | 'Engraving'
export type DriveModel = Partial<Record<ModelGroup, { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }>>

let loading: Promise<DriveModel> | null = null
export function loadDriveModel(): Promise<DriveModel> {
  return (loading ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/drive-module.glb`).then((gltf) => {
    const out: DriveModel = {}
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const material = m.material as THREE.MeshStandardMaterial
      const name = material.name.replace(/\.\d+$/, '') as ModelGroup
      material.envMapIntensity = 0.6
      out[name] = { geometry: m.geometry.clone().applyMatrix4(m.matrixWorld), material }
    })
    return out
  }))
}
