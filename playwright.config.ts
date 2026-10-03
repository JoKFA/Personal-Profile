import { defineConfig } from '@playwright/test'

// E2E runs against the production build (vite preview) on a real GPU through ANGLE, so the
// frame-rate checks measure the machine, not a software rasteriser.
const gpu = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: { args: process.env.CI ? [] : gpu },
  },
  projects: [
    { name: 'desktop-1440', testIgnore: /webkit\.spec/, use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone-390', testIgnore: /webkit\.spec/, use: { viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'phone-short', testIgnore: /webkit\.spec/, grep: /entry:|entrance:|reduced motion/, use: { viewport: { width: 390, height: 650 }, hasTouch: true, deviceScaleFactor: 3 } },
    // Safari's engine: no GPU on Windows, so this checks rendering and flows, not frame rate
    { name: 'webkit-smoke', testMatch: /webkit\.spec/, use: { browserName: 'webkit', viewport: { width: 1280, height: 800 }, launchOptions: { args: [] } } },
  ],
  webServer: {
    command: 'npm.cmd run build && npx.cmd vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    // never reuse: a server already on 4173 may be serving an older dist
    reuseExistingServer: false,
    timeout: 240_000,
  },
})
