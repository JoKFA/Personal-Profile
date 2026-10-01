// The Encrypted Archive: one canvas (the archive), one HUD, one file view.
// Routes: "/" archive · "/projects/:slug" archive with that drive opened.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { entryById, entryBySlug, ENTRIES } from './data/entries'
import { roleById } from './data/roles'
import type { Entry } from './data/types'
import type { Archive } from './scene/archive'
import { ArchiveContext, type Ctx } from './ui/context'
import { Hud } from './ui/Hud'
import { NoWebGL } from './ui/NoWebGL'
import { Verify } from './ui/Verify'
import { reconVisitor } from './visitor'
import './styles/tokens.css'
import './styles/archive.css'

// three.js and the file view (GSAP, demos) load after first paint, while the entry plays
const FileView = lazy(() => import('./ui/FileView').then((m) => ({ default: m.FileView })))
// the entry (and GSAP with it) only loads for a first visit
const Gate = lazy(() => import('./ui/Gate').then((m) => ({ default: m.Gate })))

const sha256 = async (s: string) => {
  try { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('') } catch { return '' }
}
const slugFromPath = (p: string) => p.match(/^\/projects\/([^/]+)/)?.[1] ?? null
/** Files with their own URL; the subject and visitor files open in place at "/". */
const routed = (e: Entry) => e.kind === 'case' || e.kind === 'service' || e.kind === 'education' || e.kind === 'restricted'
const noSubscribe = () => () => {}

export default function CasefileApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [archive, setArchive] = useState<Archive | null>(null)
  const [noGL, setNoGL] = useState(false)
  const visitor = useMemo(() => reconVisitor(), [])
  const reduced = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const location = useLocation(), navigate = useNavigate()
  const [gate, setGate] = useState(() => {
    try { return new URLSearchParams(location.search).has('intro') || localStorage.getItem('yw.entry') !== '1' } catch { return true }
  })
  const [file, setFile] = useState<Entry | null>(null)
  const [sceneReady, setSceneReady] = useState(false)
  /** the entrance whip: the file panel waits until the camera has settled (after the PV) */
  const [arriving, setArriving] = useState(true)
  // first visit: build the scene only once the entry reaches its still title frame, so
  // initialisation never freezes the animation. Return visits build it at once.
  const [loadScene, setLoadScene] = useState(() => !gate)
  const [verify, setVerify] = useState<{ hash: string; restricted: boolean } | null>(null)
  const [statusLine, setStatusLine] = useState<{ html: string; key: number } | null>(null)
  // first visit, no deep link: offer the role picker and the guided tour until the first interaction
  const [offer, setOffer] = useState(false)
  const endOffer = useCallback(() => setOffer(false), [])
  // one mutable log for the session, read by the Access log tab
  const [auditLog] = useState<[string, string][]>(() => [])
  const busy = useRef(false)
  const firstVisit = useRef(gate)
  const pendingSlug = useRef(slugFromPath(location.pathname))
  /** Esc pressed while a file is still opening: honoured the moment it is open (slow devices) */
  const escQueued = useRef(false)

  const status = useCallback((html: string, ms = 3600) => {
    const key = Date.now(); setStatusLine({ html, key })
    setTimeout(() => setStatusLine((s) => (s?.key === key ? null : s)), ms)
  }, [])
  const audit = useCallback((s: string) => { auditLog.push([new Date().toLocaleTimeString('en-GB'), s]); if (auditLog.length > 40) auditLog.shift() }, [auditLog])

  // ── the archive lives as long as the page ──
  useEffect(() => {
    if (!loadScene) return
    const canvas = canvasRef.current!
    let a: Archive | null = null, dead = false
    void import('./scene/archive').then(({ Archive }) => {
    if (dead) return
    try {
      a = new Archive(canvas, {
        reduced,
        onAlert: (al) => { status(`<span class="x">Anomaly · ${visitor.id} (you)</span> · ${al.what} · <b>${al.action}</b>`, 4200); audit(`UEBA ${visitor.id}: ${al.what} → ${al.action}`) },
      })
    // the WebGL controller is an external system: it can only be created after mount
     
    } catch { setNoGL(true); return }
    setArchive(a)
    ;(window as unknown as { __cf: Archive }).__cf = a
    // if the scene cannot finish preparing (context loss, driver error) fall back to the readable
    // index instead of leaving the entry waiting on its title frame
    void a.ready.then(() => { if (!dead) setSceneReady(true) }, () => { if (!dead) { setNoGL(true); setSceneReady(true) } })
    })
    return () => { dead = true; a?.dispose(); setArchive(null) }
  }, [loadScene, reduced, status, audit, visitor.id])

  // ── open / close flow ──
  // The URL says which project file should be open; reconcile() makes the scene agree once any
  // running transition has settled. Clicks, related links and back/forward only change the URL.
  const shredNext = useRef(false)
  const exitRef = useRef<null | (() => Promise<void>)>(null)
  // bumped when a transition releases the lock, so reconcile() looks again (the mode may have
  // settled while the lock was still held)
  const [settled, setSettled] = useState(0)
  const mode = useSyncExternalStore(archive?.subscribe ?? noSubscribe, () => archive?.getSnapshot().mode ?? 'entry', () => 'entry')

  const openEntry = useCallback(async (e: Entry) => {
    if (!archive || busy.current) return
    busy.current = true
    try {
      // the drive that rises must be the file that opens (a key may have moved the selection meanwhile)
      if (archive.selected?.id !== e.id) archive.jumpTo(e.id)
      await archive.beginOpen()
      // the integrity check runs with the read, not before it: the hash streams in while the light
      // crosses the face, and resolves as the chip lights
      const hash = await sha256(e.id + e.title)
      setVerify({ hash, restricted: archive.isLocked(e) })
      await archive.readDrive()
      setVerify(null)
      setFile(e)
      audit(`key issued · ${e.id} decrypted`)
    } finally {
      setVerify(null)
      busy.current = false
      setSettled((n) => n + 1)
    }
  }, [archive, audit])

  const closeFile = useCallback(async () => {
    if (!archive || !file || busy.current) return
    busy.current = true
    const e = file, shred = shredNext.current
    shredNext.current = false
    try {
      if (shred) { archive.shred(e.id); audit(`${e.id} crypto-shredded`) } else audit(`${e.id} re-encrypted, key revoked`)
      // the page re-encrypts while the drive's light is already retracting (shred ran its own exit)
      const gone = (shred ? Promise.resolve() : Promise.resolve(exitRef.current?.())).then(() => setFile(null))
      await archive.close(gone)
      status(shred ? `<b>${e.id}</b> <span class="x">crypto-shredded · key zeroized</span> · restore anytime` : `<b>${e.id}</b> re-encrypted · session key revoked`)
    } finally { busy.current = false; setSettled((n) => n + 1) }
  }, [archive, audit, file, status])

  /** User asked to leave the file (Esc, back button, shred, a related link). */
  const close = useCallback(async ({ shred = false, to }: { shred?: boolean; to?: string } = {}) => {
    shredNext.current = shred
    const target = to ?? '/'
    if (window.location.pathname !== target) navigate(target)
    else await closeFile()
  }, [closeFile, navigate])

  const open = useCallback(() => {
    if (!archive || archive.getSnapshot().mode !== 'archive') return
    const e = archive.selected
    if (!e) {
      const al = archive.denyFeedback()
      status(`<span class="x">Access denied</span> · this drive is not part of any file · <b>logged</b>`)
      audit(`DENIED ${visitor.id}`)
      if (al) status(`<span class="x">Anomaly · ${visitor.id} (you)</span> · ${al.what} · <b>${al.action}</b>`, 4200)
      return
    }
    if (!archive.isReadable(e)) {
      const role = e.roles === 'all' ? null : e.roles[0]
      if (role) { archive.setLens(role); status(`Viewing as <b>${roleById(role).name}</b> · ${roleById(role).seats}`, 4200) }
      return
    }
    // a skill opens the first file that proves it
    if (e.kind === 'skill' || e.kind === 'credential') {
      const ev = entryById.get(e.evidence?.[0] ?? '')
      if (ev) { archive.jumpTo(ev.id); if (routed(ev)) setTimeout(() => navigate(`/projects/${ev.slug}`), reduced ? 0 : 700) }
      return
    }
    if (archive.isShredded(e)) archive.restore(e.id)
    if (routed(e)) navigate(`/projects/${e.slug}`)
    else void openEntry(e)
  }, [archive, audit, navigate, openEntry, reduced, status, visitor.id])

  // entry finished → archive
  const onEntered = useCallback(() => {
    setGate(false)
    try { localStorage.setItem('yw.entry', '1') } catch { /* private mode */ }
    if (!archive) return
    const target = entryBySlug.get(pendingSlug.current ?? '')
    archive.enter(target?.id ?? 'YW-000')
    if (!target && firstVisit.current) setOffer(true)
    pendingSlug.current = null
  }, [archive])
  // the entrance plays from the moment the archive is first visible
  const entranceStarted = useRef(false)
  useEffect(() => {
    if (!archive || gate || !sceneReady || entranceStarted.current) return
    entranceStarted.current = true; archive.startEntrance()
  }, [archive, gate, sceneReady])
  // return visitors skip the gate: enter as soon as the controller exists
  useEffect(() => { if (archive && !gate && archive.getSnapshot().mode === 'entry') onEntered() }, [archive, gate, onEntered])

  // reconcile the scene with the URL whenever either settles
  useEffect(() => {
    // a deep link opens only once the scene can move (its first frame is on screen)
    if (!archive || gate || !sceneReady || busy.current || (mode !== 'archive' && mode !== 'file')) return
    const slug = slugFromPath(location.pathname)
    const want = slug ? entryBySlug.get(slug) ?? null : null
    if (slug && (!want || !routed(want))) { navigate('/', { replace: true }); return }
    if (mode === 'file' && file && (want ? want.id !== file.id : routed(file))) { void closeFile(); return }
    if (mode === 'archive' && want) {
      if (!archive.isReadable(want)) archive.setLens('all')
      if (archive.isShredded(want)) archive.restore(want.id)
      const here = archive.selected?.id === want.id
      if (!here) archive.jumpTo(want.id)
      const t = setTimeout(() => void openEntry(want), here || reduced ? 0 : 900)
      return () => clearTimeout(t)
    }
  }, [archive, gate, sceneReady, mode, settled, location.pathname, file, closeFile, openEntry, navigate, reduced])

  // keyboard
  useEffect(() => {
    if (!archive) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return
      const mode = archive.getSnapshot().mode
      if (mode === 'file') { if (ev.key === 'Escape') void close(); return }
      if (mode === 'opening') { if (ev.key === 'Escape') escQueued.current = true; return }
      if (mode !== 'archive') return
      const m = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[ev.key]
      if (m) { ev.preventDefault(); archive.move(...m) }
      else if (ev.key === 'Enter' && !(ev.target instanceof HTMLButtonElement)) open()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [archive, close, open])

  useEffect(() => {
    if (mode === 'file' && escQueued.current) { escQueued.current = false; void close() }
    else if (mode !== 'opening') escQueued.current = false
  }, [mode, close])

  useEffect(() => {
    if (gate || !sceneReady || !arriving) return
    const t = setTimeout(() => setArriving(false), reduced ? 0 : 2700)
    return () => clearTimeout(t)
  }, [gate, sceneReady, arriving, reduced])

  const ctx = useMemo<Ctx | null>(() => (archive ? { archive, visitor, reduced, status, open, close, auditLog, record: audit, exitRef } : null), [archive, visitor, reduced, status, open, close, auditLog, audit])

  if (noGL) return <NoWebGL visitor={visitor} />
  return (
    <div className={`cf ${file ? 'cf--file' : ''} ${arriving && !gate && sceneReady ? 'cf--arriving' : ''}`}>
      <canvas ref={canvasRef} className={`cf-scene ${!gate && sceneReady ? 'on' : ''}`} aria-label="An archive of encrypted drives. Use the index to browse them as a list."
        onClick={() => { if (archive?.click() === 'hero') open() }} />
      <div className="cf-grain" aria-hidden="true" />
      {/* return visits: the archive prepares its shaders for a moment; say so instead of a blank page */}
      {!gate && !sceneReady && <div className="cf-boot lbl" role="status">Decrypting the portfolio</div>}
      {arriving && !gate && sceneReady && <div className="cf-arrive" aria-hidden="true"><span>Selecting files</span></div>}
      {archive && (
        <ArchiveContext.Provider value={ctx as Ctx}>
          <Hud statusLine={statusLine} hidden={gate || !sceneReady} offer={offer} onOfferDone={endOffer} />
          {verify && <Verify hash={verify.hash} restricted={verify.restricted} />}
          {file && <Suspense fallback={null}><FileView entry={file} key={file.id} /></Suspense>}
        </ArchiveContext.Provider>
      )}
      {gate && <Suspense fallback={null}><Gate visitor={visitor} reduced={reduced} sceneReady={sceneReady || noGL} onTitle={() => setLoadScene(true)} onDone={onEntered} /></Suspense>}
      <noscript>{ENTRIES.map((e) => e.title).join(' · ')}</noscript>
    </div>
  )
}
