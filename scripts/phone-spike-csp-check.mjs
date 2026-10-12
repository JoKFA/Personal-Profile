// can the CSP check fail? an inline style attribute must raise securitypolicyviolation under the preview's headers
import { chromium } from '@playwright/test'
const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext()).newPage()
await p.goto('http://127.0.0.1:4196/?phone-spike'); await p.waitForFunction(() => window.__spike && window.__spike.ready)
const r = await p.evaluate(async () => { const got = []; document.addEventListener('securitypolicyviolation', (e) => got.push(e.violatedDirective)); const el = document.createElement('div'); el.setAttribute('style', 'color:red'); document.body.appendChild(el); const st = document.createElement('style'); st.textContent = 'b{}'; document.head.appendChild(st); el.style.color = 'blue'; await new Promise((r) => setTimeout(r, 300)); return got })
console.log('violations raised by a setAttribute(style) and an injected <style>:', r, '(CSSOM el.style.color = ... raised none beyond these)')
await b.close()
