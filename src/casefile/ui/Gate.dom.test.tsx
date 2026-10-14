// The desktop entry's markup must not change when the phone's hold-to-verify mode is added to Gate (plan M1 P4, E8).
// The golden file was written from the Gate of commit 105ef53 (before the phone mode); a change to the desktop's DOM fails here.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Visitor } from '../visitor'
import { Gate } from './Gate'

const GOLDEN = join(__dirname, 'Gate.dom.golden.html')
const visitor = { id: 'V-TEST', ms: 7, os: 'Windows', browser: 'Chrome 145', city: 'Vancouver', time: '2:22 AM', screen: '1280 × 720', tz: 'America/Vancouver', langs: 'en-US', hash: 1, cores: 8, gpu: null, referrer: null, scheme: 'light', facts: [], rows: [] } as Visitor
const markup = (reduced: boolean) => renderToStaticMarkup(<Gate visitor={visitor} reduced={reduced} sceneReady onBuild={() => {}} onReveal={() => {}} onStrike={() => {}} onDone={() => {}} />)

describe('Gate (desktop): markup', () => {
  it('is the golden markup, in both motion modes', () => {
    const now = `${markup(false)}\n---\n${markup(true)}\n`
    if (process.env.UPDATE_GOLDEN === '1' || !existsSync(GOLDEN)) writeFileSync(GOLDEN, now)
    const golden = readFileSync(GOLDEN, 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10))   // (a Windows checkout may have CRLF in it)
    expect(now).toBe(golden)
    expect(golden.length).toBeGreaterThan(2000)
    expect(golden).toContain('fp-canvas'); expect(golden).toContain('I keep it <b>sealed.</b>'); expect(golden).not.toContain('fp-hold')
  })
})

describe('Gate (phone): the hold line and the phone class exist only when asked for', () => {
  it('has the hold line under the print and the phone page class', () => {
    const html = renderToStaticMarkup(<Gate visitor={visitor} reduced={false} sceneReady onBuild={() => {}} onReveal={() => {}} onStrike={() => {}} onDone={() => {}} phone={{ label: 'Hold to verify', onPress: () => {}, onSealed: () => {} }} />)
    expect(html).toContain('class="fp-hold lbl">Hold to verify<')
    expect(html).toContain('class="gate gz fp ph-gate"')
    expect(html).toContain('Skip ↵')
  })
})
