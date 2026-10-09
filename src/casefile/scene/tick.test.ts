import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { drain, drainTicking } from './tick'
import { standIns } from './warm'

function* count(n: number): Generator<void, number> { let sum = 0; for (let i = 0; i < n; i++) { sum += i; yield } return sum }

describe('building a step at a time', () => {
  it('a generator of steps gives the same result drained at once or with the main thread given back between steps', async () => {
    expect(drain(count(5))).toBe(10)
    expect(await drainTicking(count(5))).toBe(10)
  })

  it('gives the main thread back between steps: a timer scheduled before it runs before the last step', async () => {
    const order: string[] = []
    setTimeout(() => order.push('timer'), 0)
    function* steps(): Generator<void, void> { order.push('step 1'); yield; order.push('step 2'); yield; order.push('step 3') }
    await drainTicking(steps())
    expect(order[0]).toBe('step 1')
    expect(order.indexOf('timer')).toBeGreaterThan(0)
    expect(order.indexOf('timer')).toBeLessThan(order.indexOf('step 3'))
  })

  it('files stand-in meshes in groups, so a compile call has a group to take, not one mesh at a time', () => {
    const scene = new THREE.Scene(), put = standIns(scene, 4)
    for (let i = 0; i < 10; i++) put(new THREE.Mesh())
    expect(scene.children.map((g) => g.children.length)).toEqual([4, 4, 2])
  })
})
