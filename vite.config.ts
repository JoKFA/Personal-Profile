import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

const buildCommit = gitShortSha()
const buildDate = new Date().toISOString().slice(0, 10)

// vercel.json is the one source of the security headers; the local preview (and so every E2E
// run) serves the same CSP, so a violation shows up as a console error in the tests.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
const siteHeaders = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)')!.headers.filter((h) => h.key !== 'Strict-Transport-Security').map((h) => [h.key, h.value.replace('; upgrade-insecure-requests', '')]))
// /api is a Vercel function; locally the preview forwards it to the deployed site (override with API_ORIGIN)
const apiOrigin = process.env.API_ORIGIN || 'https://personal-profile-alpha-cyan.vercel.app'

export default defineConfig({
  plugins: [react()],
  // Honor PORT env var so launchers (Claude preview, Vercel-style) can pin the dev server.
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : undefined,
  preview: { headers: siteHeaders, proxy: { '/api': { target: apiOrigin, changeOrigin: true } } },
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
