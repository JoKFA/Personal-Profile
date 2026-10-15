import { defineConfig } from '@playwright/test'

// E2E runs against production builds served by `vite preview` (which serves vercel.json's headers, so the real CSP applies) on a real GPU through ANGLE,
// so the frame-rate checks measure the machine, not a software rasteriser.
//   · PROD  (default 4173): the production build, exactly what is deployed: no test hooks. The phone specs and the CSP specs run against it.
//   · HOOKS (default 4174): the same build made with VITE_HOOKS=1, which keeps window.__cf / __space / the frame counter that the desktop specs drive.
// E2E_PROD_PORT / E2E_HOOKS_PORT move them; E2E_REUSE=1 uses servers that are already up (scripts/e2e-hooks-server.mjs starts the second one by hand).
// E2E_NO_BUILD=1 serves the dist that `npm run build` has just made instead of building again; E2E_SKIP_HOOKS=1 starts no hooks server (the phone and CSP specs do not need it).
const gpu = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
const PROD = Number(process.env.E2E_PROD_PORT ?? 4173), HOOKS = Number(process.env.E2E_HOOKS_PORT ?? 4174)
const prodURL = `http://127.0.0.1:${PROD}`, hooksURL = `http://127.0.0.1:${HOOKS}`
const reuse = !!process.env.E2E_REUSE
const prodCommand = `${process.env.E2E_NO_BUILD ? '' : 'npm.cmd run build && '}npx.cmd vite preview --host 127.0.0.1 --port ${PROD} --strictPort`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: prodURL,
    trace: 'retain-on-failure',
    launchOptions: { args: process.env.CI ? [] : gpu },
  },
  projects: [
    // the desktop specs drive the archive through the test hooks: the hooks build
    { name: 'desktop-1440', testMatch: /(archive|csp)\.spec/, use: { baseURL: hooksURL, viewport: { width: 1440, height: 900 } } },
    // the phone shell (a touch screen under 600 px takes it): its own spec and the CSP spec, against the production build
    { name: 'phone-390', testMatch: /(phone|csp)\.spec/, use: { viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'phone-short', testMatch: /phone\.spec/, grep: /@short/, use: { viewport: { width: 390, height: 650 }, hasTouch: true, deviceScaleFactor: 3 } },
    // Safari's engine: no GPU on Windows, so this checks rendering and flows, not frame rate
    { name: 'webkit-smoke', testMatch: /webkit\.spec/, use: { baseURL: hooksURL, browserName: 'webkit', viewport: { width: 1280, height: 800 }, launchOptions: { args: [] } } },
  ],
  webServer: [
    {
      command: prodCommand,
      url: prodURL,
      // never reuse by default: a server already on the port may be serving an older dist
      reuseExistingServer: reuse,
      timeout: 360_000,
    },
    ...(process.env.E2E_SKIP_HOOKS ? [] : [{
      command: `node ./scripts/e2e-hooks-server.mjs ${HOOKS}`,
      url: hooksURL,
      reuseExistingServer: reuse,
      timeout: 360_000,
    }]),
  ],
})
