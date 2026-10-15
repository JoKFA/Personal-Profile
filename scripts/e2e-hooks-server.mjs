// The e2e's second server: the site built with VITE_HOOKS=1 (the test hooks the desktop specs drive: window.__cf, __space, the frame counter), into dist-e2e, served by
// `vite preview` (vercel.json's headers, the real CSP). The production build in dist never contains them.
//   node scripts/e2e-hooks-server.mjs [port = 4174] [outDir = dist-e2e]
process.env.VITE_HOOKS = '1'
const port = Number(process.argv[2] ?? 4174), outDir = process.argv[3] ?? 'dist-e2e'
const { build, preview } = await import('vite')
await build({ logLevel: 'warn', build: { outDir, emptyOutDir: true } })
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port, strictPort: true } })
server.printUrls()
