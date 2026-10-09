// Making a scene ready without holding the main thread. Compiling a shader is started on the main thread and
// finished in the background, but starting every one of them in a single call takes a few hundred milliseconds,
// and the first frame then pays for the uniform tables and the textures it has not seen. Each of those is done
// here in steps instead, the main thread given back whenever one has taken about a frame.
import * as THREE from 'three'
import { tick } from './tick'

/** a step ends, and the main thread is given back, once this many milliseconds of it have been spent */
const SLICE = 20
/** the way a step yields: `tick` by default; the interior, which builds frame by frame, passes its own */
export type Pause = () => Promise<void>

/**
 * A throwaway scene of stand-in meshes, filled in groups: each call to compile walks the whole target scene as
 * well as what it compiles, so a call per mesh would cost more than the compiling. Returns the way to add one.
 */
export function standIns(scene: THREE.Scene, size = 10) {
  let group: THREE.Group | null = null, n = 0
  return (m: THREE.Object3D) => { if (!group || n >= size) { group = new THREE.Group(); scene.add(group); n = 0 } group.add(m); n++ }
}

/**
 * Start compiling what `root` holds, one child at a time. Each call returns at once and the programs compile in
 * the background (three polls for them); `target` is the scene whose lights, fog and environment they compile
 * against, and `run` wraps each call (the composer renders into a render target, where three picks its own variants).
 * Returns the jobs, to be awaited.
 */
export async function compileInSteps(renderer: THREE.WebGLRenderer, root: THREE.Object3D, camera: THREE.Camera, target: THREE.Scene, run: <T>(f: () => T) => T = (f) => f(), pause: Pause = tick) {
  const jobs: Promise<unknown>[] = []
  let t = performance.now()
  for (const child of [...root.children]) {
    if ((child as THREE.Light).isLight) continue   // (a light holds nothing to compile; its being counted twice would only skew the lights this call sees)
    jobs.push(run(() => renderer.compileAsync(child, camera, target)))
    if (performance.now() - t > SLICE) { await pause(); t = performance.now() }
  }
  return jobs
}

/** The uniform and attribute tables of every program: three builds them when a program is first used, each one a round trip to the GPU process. */
export async function warmPrograms(renderer: THREE.WebGLRenderer, pause: Pause = tick) {
  let t = performance.now()
  for (const program of [...(renderer.info.programs ?? [])]) {
    program.getUniforms(); program.getAttributes()
    if (performance.now() - t > SLICE) { await pause(); t = performance.now() }
  }
}

/** Upload the textures the materials under `root` draw with. */
export async function warmTextures(renderer: THREE.WebGLRenderer, root: THREE.Object3D, pause: Pause = tick) {
  const seen = new Set<THREE.Texture>()
  root.traverse((o) => {
    const material = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    for (const m of Array.isArray(material) ? material : material ? [material] : []) for (const v of Object.values(m)) if ((v as THREE.Texture | null)?.isTexture) seen.add(v as THREE.Texture)
  })
  let t = performance.now()
  for (const texture of seen) {
    renderer.initTexture(texture)
    if (performance.now() - t > SLICE) { await pause(); t = performance.now() }
  }
}
