// probe: how long a stop takes to settle, and whether anything idles (frames after a stop, every 5th)
import path from 'node:path'
import { session } from './phone-spike-lib.mjs'
const dir = process.argv[2], dpr = Number(process.argv[3] || 2), from = process.argv[4] || 'YW-000', to = process.argv[5] || 'X-001'
await session(dpr, async (s) => {
  await s.warmRun([['stop', from, 2500], ['stop', to, 2500], ['open', undefined, 3000], ['stop', from, 2500]])
  await s.manual()
  for (let i = 0; i < 100; i++) await s.step()
  await s.ph('stop', to)
  let ready = -1
  for (let i = 0; i < 300; i++) {
    await s.step()
    if (ready < 0 && await s.p.evaluate(() => window.__ph.ready)) ready = i
    if (i % 5 === 4) await s.shot(path.join(dir, `s-${String(i + 1).padStart(4, '0')}.png`))
  }
  console.log('ready at step', ready)
})
