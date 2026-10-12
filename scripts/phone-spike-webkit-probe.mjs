// does Playwright's WebKit (Windows) decode and present our H.264 mp4 at all?
import { webkit } from '@playwright/test'
const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 866 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage()
await p.goto('http://127.0.0.1:5194/phone-spike/manifest.json')
const r = await p.evaluate(async () => {
  const out = { ua: navigator.userAgent, canPlay: { h264: document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"'), vp9: document.createElement('video').canPlayType('video/webm; codecs="vp9"') }, rvfc: 'requestVideoFrameCallback' in HTMLVideoElement.prototype }
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.style.cssText = 'position:fixed;left:0;top:0;width:195px;height:433px'
  v.src = '/phone-spike/pan-YW-000-X-001.mp4'; document.body.appendChild(v)
  await new Promise((res) => { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', res, { once: true }); setTimeout(res, 8000) })
  out.afterLoad = { readyState: v.readyState, w: v.videoWidth, h: v.videoHeight, duration: v.duration, error: v.error && v.error.code }
  try { await v.play(); out.played = true } catch (e) { out.playError = String(e) }
  await new Promise((r) => setTimeout(r, 2500))
  const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : null
  out.afterPlay = { currentTime: v.currentTime, paused: v.paused, ended: v.ended, readyState: v.readyState, decoded: q && q.totalVideoFrames, dropped: q && q.droppedVideoFrames, webkitDecoded: v.webkitDecodedFrameCount }
  const c = document.createElement('canvas'); c.width = 48; c.height = 108; const g = c.getContext('2d'); g.drawImage(v, 0, 0, 48, 108)
  const d = g.getImageData(0, 0, 48, 108).data; let s = 0, mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; s += l; mn = Math.min(mn, l); mx = Math.max(mx, l) }
  out.canvas = { mean: s / (d.length / 4), min: mn, max: mx }
  return out
})
console.log(JSON.stringify(r, null, 1)); await b.close()
