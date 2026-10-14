import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// The phone shell's pieces, asked for from the first byte of index.html on a phone (a touch screen under 600 px wide) and by nothing else: the entry chunk is
// ~100 KB, and on a slow network the shell's own chunks would otherwise wait behind it (their request is made by code in the entry chunk).
// `media` keeps every other device from fetching a byte. Names are the build's own, found in the bundle. (Not the manifest: the entry page does not need it, and
// on a slow network its 10 KB would delay the entry page by 0.2 s.)
const PHONE = '(pointer: coarse) and (max-width: 599px)'
function phonePreload(): Plugin {
  return {
    name: 'phone-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return
        const chunks = Object.values(bundle).filter((c) => c.type === 'chunk')
        const byFile = new Map(chunks.map((c) => [c.fileName, c]))
        const entry = chunks.find((c) => c.isEntry)
        const skip = new Set<string>()
        const walk = (c: (typeof chunks)[number], into: Set<string>) => { for (const f of c.imports) { const d = byFile.get(f); if (d && !into.has(f)) { into.add(f); walk(d, into) } } }
        if (entry) { skip.add(entry.fileName); walk(entry, skip) }
        const want = new Set<string>(), css = new Set<string>()
        for (const name of ['PhoneApp', 'PhoneGate']) {
          const c = chunks.find((x) => x.name === name)
          if (!c) continue
          want.add(c.fileName); walk(c, want)
        }
        for (const f of want) if (skip.has(f)) want.delete(f)
        for (const f of want) for (const k of (byFile.get(f)?.viteMetadata?.importedCss ?? [])) css.add(k)
        const tag = (attrs: Record<string, string | boolean>) => ({ tag: 'link', attrs: { ...attrs, media: PHONE }, injectTo: 'head' as const })
        return [
          ...[...want].map((f) => tag({ rel: 'preload', as: 'script', crossorigin: '', href: `/${f}` })),
          // (crossorigin like the stylesheet links Vite adds when a chunk loads: without it the preload is not reused and the sheet is fetched twice)
          ...[...css].map((f) => tag({ rel: 'preload', as: 'style', crossorigin: '', href: `/${f}` })),
        ]
      },
    },
  }
}

const buildCommit = gitShortSha()
const buildDate = new Date().toISOString().slice(0, 10)

// vercel.json is the one source of the security headers; the local preview (and so every E2E
// run) serves the same CSP, so a violation shows up as a console error in the tests.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
const siteHeaders = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)')!.headers.filter((h) => h.key !== 'Strict-Transport-Security').map((h) => [h.key, h.value.replace('; upgrade-insecure-requests', '')]))
// /api is a Vercel function; locally the preview forwards it to the deployed site (override with API_ORIGIN)
const apiOrigin = process.env.API_ORIGIN || 'https://yaotingw.com'

export default defineConfig({
  plugins: [react(), phonePreload()],
  // Honor PORT env var so launchers (Claude preview, Vercel-style) can pin the dev server.
  // (a worktree's node_modules is a junction to the main checkout's: let the dev server read it)
  server: { ...(process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {}), fs: { allow: ['.', '../../node_modules'] } },
  preview: { headers: siteHeaders, proxy: { '/api': { target: apiOrigin, changeOrigin: true } } },
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
