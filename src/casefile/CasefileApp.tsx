// The Encrypted Archive: one canvas (the archive), one HUD, one file view.
// Routes: "/" archive · "/projects/:slug" archive with that drive opened.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { entryById, entryBySlug, ENTRIES } from './data/entries'
import { SELECTED } from './data/story'
import type { Entry } from './data/types'
import type { Archive, Handoff } from './scene/archive'
import type { Clock } from './space/clock'
import type { Runtime } from './space/runtime'
import type { Space } from './space/scene'
import type { Pick } from './ui/Landing'
import { ArchiveContext, type Ctx } from './ui/context'
import { Hud } from './ui/Hud'
import { NoWebGL } from './ui/NoWebGL'
import { Verify } from './ui/Verify'
import { reconVisitor } from './visitor'
import './styles/tokens.css'
import './styles/archive.css'

// three.js and the file view (GSAP, demos) load after first paint, while the entry plays
const FileView = lazy(() => import('./ui/FileView').then((m) => ({ default: m.FileView })))
// the interior (its modules are fetched once the archive is up, never before)
const loadSpace = () => import('./space/boot')
// the entry (and GSAP with it) only loads for a first visit
const Gate = lazy(() => import('./ui/Gate').then((m) => ({ default: m.Gate })))
// entry prototypes, plan §S2: `?entry=a|c` meets the reader with Yaoting's page instead of the browser readout
const Landing = lazy(() => import('./ui/Landing').then((m) => ({ default: m.Landing })))

const sha256 = async (s: string) => {
  try { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('') } catch { return '' }
}
const slugFromPath = (p: string) => p.match(/^\/projects\/([^/]+)/)?.[1] ?? null
/** Files with their own URL; the subject and visitor files open in place at "/". */
const routed = (e: Entry) => e.kind === 'case' || e.kind === 'service' || e.kind === 'education' || e.kind === 'restricted'
const noSubscribe = () => () => {}

export default function CasefileApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null), veilRef = useRef<HTMLCanvasElement>(null)
  const [archive, setArchive] = useState<Archive | null>(null)
  const [noGL, setNoGL] = useState(false)
  const visitor = useMemo(() => reconVisitor(), [])
  const reduced = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const location = useLocation(), navigate = useNavigate()
  const landing = useMemo(() => { const v = new URLSearchParams(location.search).get('entry'); return v === 'a' || v === 'c' ? v : null }, [location.search])
  /** the landing's choice, read when the entrance starts (synchronously, so a ref): 'profile' opens the subject file after it */
  const picked = useRef<Pick['to'] | null>(null)
  /** the reader asked for the browser readout: the original entry plays instead */
  const [readout, setReadout] = useState(false)
  const [gate, setGate] = useState(() => {
    try { return new URLSearchParams(location.search).has('intro') || localStorage.getItem('yw.entry') !== '1' } catch { return true }
  })
  const [file, setFile] = useState<Entry | null>(null)
  const [sceneReady, setSceneReady] = useState(false)
  /** the interior: built once the archive is on screen, a frame at a time */
  const [space, setSpace] = useState<{ space: Space; clock: Clock } | null>(null)
  const spaceRef = useRef<{ space: Space; clock: Clock } | null>(null)
  const spaceBoot = useRef<Promise<{ space: Space; clock: Clock } | null> | null>(null)
  const runtimeRef = useRef<Runtime | null>(null)
  /** what the drive's last frame looked like at the cut: present while the interior is the exhibit */
  const [cut, setCut] = useState<Handoff | null>(null)
  /** the entrance whip: the file panel waits until the camera has settled (after the PV) */
  const [arriving, setArriving] = useState(true)
  /** the entry page is clearing over the archive (the hand-over of the visitor's request) */
  const [gateLeaving, setGateLeaving] = useState(false)
  // building the scene blocks the main thread for about two seconds (setup, then shader
  // precompile), which would stall any animation it ran under. A first visit builds it once the
  // entry has reached its last, still frame (the sealed profile, held to be read); return visits
  // build it at once.
  const [loadScene, setLoadScene] = useState(() => !gate)
  const [verify, setVerify] = useState<{ hash: string; restricted: boolean } | null>(null)
  const [statusLine, setStatusLine] = useState<{ html: string; key: number } | null>(null)
  // one mutable log for the session, read by the Access log tab
  const [auditLog] = useState<[string, string][]>(() => [])
  const busy = useRef(false)
  const pendingSlug = useRef(slugFromPath(location.pathname))
  const firstVisit = useRef(gate)
  /** the entrance opens the subject file by itself once (a first visit) */
  const autoOpen = useRef(false)
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
    a.veil = veilRef.current
    setArchive(a)
    ;(window as unknown as { __cf: Archive }).__cf = a
    // if the scene cannot finish preparing (context loss, driver error) fall back to the readable
    // index instead of leaving the entry waiting on its title frame
    void a.ready.then(() => { if (!dead) setSceneReady(true) }, () => { if (!dead) { setNoGL(true); setSceneReady(true) } })
    })
    return () => { dead = true; a?.dispose(); setArchive(null) }
  }, [loadScene, reduced, status, audit, visitor.id])

  // the interior: built a frame at a time once the archive is on screen (it never holds the main thread for one step)
  useEffect(() => {
    if (!archive || !sceneReady || noGL) return
    let dead = false
    // the open flow waits for this (briefly) rather than falling back while the interior is merely still being built
    spaceBoot.current = loadSpace().then((m) => m.bootSpace(archive, reduced)).then((s) => {
      if (dead) { s.space.dispose(); return null }
      spaceRef.current = s; ;(window as unknown as { __space?: typeof s }).__space = s   // for the tests and the lab, like __cf
      setSpace(s); return s
    }).catch((err) => { console.warn('Interior unavailable; the file opens on the archive instead', err); return null })
    void import('./ui/FileView')   // the file view too, so the cut never waits on a download
    void import('./space/runtime')
    return () => { dead = true; runtimeRef.current?.stop(); runtimeRef.current = null; spaceRef.current?.space.dispose(); spaceRef.current = null; spaceBoot.current = null; setSpace(null) }
  }, [archive, sceneReady, noGL, reduced])

  // ── open / close flow ──
  // The URL says which project file should be open; reconcile() makes the scene agree once any
  // running transition has settled. Clicks, related links and back/forward only change the URL.
  const shredNext = useRef(false)
  const exitRef = useRef<null | (() => Promise<void>)>(null)
  // bumped when a transition releases the lock, so reconcile() looks again (the mode may have
  // settled while the lock was still held)
  const [settled, setSettled] = useState(0)
  const mode = useSyncExternalStore(archive?.subscribe ?? noSubscribe, () => archive?.getSnapshot().mode ?? 'entry', () => 'entry')
  const doorOpen = useSyncExternalStore(archive?.subscribe ?? noSubscribe, () => archive?.getSnapshot().door ?? false, () => false)

  const openEntry = useCallback(async (e: Entry) => {
    if (!archive || busy.current) return
    busy.current = true
    setArriving(false)   // opening a file ends the entrance's "Selecting files"
    try {
      // the drive that rises must be the file that opens (a key may have moved the selection meanwhile)
      if (archive.selected?.id !== e.id) archive.jumpTo(e.id)
      if (e.kind === 'subject') {
        // the subject file's exhibit is the drive's own work space: the drive opens like any other, then the door
        // takes the camera into it (docs/subject-space-spec.md)
        // first it opens and decrypts like any other drive; the light has crossed the face and flashed the die
        // when the door starts (the seam's last flicker plays under the first turn): nothing stands waiting
        await archive.beginOpen()
        const read = archive.readDrive()
        const lead = reduced ? read : new Promise((r) => setTimeout(r, 1050))
        // (the interior may still be building on a slow machine: give it a few seconds before the file opens without it)
        const inside = spaceRef.current ?? await Promise.race([spaceBoot.current ?? Promise.resolve(null), new Promise<null>((r) => setTimeout(() => r(null), 8000))])
        await lead
        if (inside) {
          const rt = await import('./space/runtime')   // before the door opens: nothing after it may fail to load
          // the drive stands to face the reader, the camera closes in on its die, and the interior takes the canvas
          // from the very next frame (docs/subject-space-spec.md §3); the file column arrives with it
          const handoff = await archive.beginDoor()
          let toured = false
          try { toured = sessionStorage.getItem('yw.space') === '1'; sessionStorage.setItem('yw.space', '1') } catch { /* private mode */ }
          inside.clock.restart(!toured)
          const run = rt.startRuntime(inside.space, inside.clock, { handoff, layout: rt.defaultLayout(), reduced })
          runtimeRef.current = run; archive.interior = { exit: () => run.exit() }
          setCut(handoff); setFile(e); audit(`key issued · ${e.id} decrypted`)
          return
        }
        // no interior (it could not be built): the file opens like any other, on the archive
        await read
        setFile(e); audit(`key issued · ${e.id} decrypted`)
        return
      }
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
  }, [archive, audit, reduced])

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
      runtimeRef.current?.stop(); runtimeRef.current = null; archive.interior = null; setCut(null)
      // leaving the briefing early still issues read access (nobody is left in a sealed archive)
      archive.grant()
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
      status('<b>Sealed</b> · your read access is issued at the end of the briefing', 4200)
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

  const archiveRef = useRef<Archive | null>(null)
  useEffect(() => { archiveRef.current = archive }, [archive])
  // the entry hands over (spec §26.10): the archive appears, held at its first frame, while the
  // profile, now a point of light, flies into it; where it strikes, the wave starts
  const onReveal = useCallback(() => { archiveRef.current?.holdEntrance(); setGateLeaving(true); onEnteredRef.current() }, [])
  const originAt = useCallback(() => archiveRef.current?.entranceOrigin() ?? null, [])
  const onStrike = useCallback(() => archiveRef.current?.releaseEntrance(), [])
  const onGateDone = useCallback(() => setGateLeaving(false), [])
  const onPick = useCallback((p: Pick) => {
    picked.current = p.to
    if (p.to === 'readout') setReadout(true)
    if (p.to === 'file') { pendingSlug.current = p.slug; navigate({ pathname: `/projects/${p.slug}`, search: location.search }) }
  }, [navigate, location.search])
  // entry finished → archive
  const onEntered = useCallback(() => {
    setGate(false)
    try { localStorage.setItem('yw.entry', '1') } catch { /* private mode */ }
    if (!archive) return
    const target = entryBySlug.get(pendingSlug.current ?? '')
    // a first visit without a deep link: the archive stays sealed, the entrance finds the subject
    // file and opens it, and read access is issued when its briefing ends (spec §26.4)
    const first = firstVisit.current && !target
    // the landing has already introduced Yaoting: the archive opens on the first selected file,
    // unless the reader asked for the full profile (or watched the browser readout instead)
    const met = landing !== null && picked.current !== 'readout' && picked.current !== 'profile'
    archive.enter(target?.id ?? (met ? SELECTED[0].id : 'YW-000'), first)
    autoOpen.current = first && !met
    pendingSlug.current = null
  }, [archive, landing])
  const onEnteredRef = useRef(onEntered)
  useEffect(() => { onEnteredRef.current = onEntered }, [onEntered])
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
      if (!archive.isReadable(want)) archive.grant()
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
      // the door is closing in: any key runs it out (Esc also asks to leave once it is open)
      if (mode === 'opening' && archive.doorActive()) { archive.skipDoor(); if (ev.key === 'Escape') escQueued.current = true; return }
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

  // the HUD waits until the wave has settled; then a first visit's read access is issued (a light
  // front runs out from the file as the labels decrypt)
  useEffect(() => {
    if (gate || !sceneReady || !arriving || !archive) return
    const h = setInterval(() => {
      if (!archive.entranceDone()) return
      setArriving(false)
      if (!archive.isGranted) { archive.grant(); audit(`access request ${visitor.id} · read only · granted`) }
    }, 100)
    return () => clearInterval(h)
  }, [gate, sceneReady, arriving, archive, audit, visitor.id])
  // ④ a first visit: once the wave has settled on the subject file, it decrypts and opens by itself
  useEffect(() => {
    if (arriving || !archive || !autoOpen.current) return
    autoOpen.current = false
    const subject = entryById.get('YW-000')!
    archive.jumpTo(subject.id); archive.decrypt(subject.id)
    const h = setTimeout(() => void openEntry(subject), reduced ? 0 : 450)
    return () => clearTimeout(h)
  }, [arriving, archive, openEntry, reduced])

  const ctx = useMemo<Ctx | null>(() => (archive ? { archive, visitor, reduced, status, open, close, auditLog, record: audit, exitRef, space, runtime: runtimeRef, cut } : null), [archive, visitor, reduced, status, open, close, auditLog, audit, space, cut])

  if (noGL) return <NoWebGL visitor={visitor} />
  return (
    <div className={`cf ${file ? 'cf--file' : ''} ${arriving && !gate && sceneReady ? 'cf--arriving' : ''} ${doorOpen ? 'cf--door' : ''}`} onPointerDown={() => { if (doorOpen) archive?.skipDoor() }}>
      <canvas ref={canvasRef} className={`cf-scene ${!gate && sceneReady ? 'on' : ''}`} aria-label="An archive of encrypted drives. Use the index to browse them as a list."
        onClick={() => { if (archive?.click() === 'hero') open() }} />
      <canvas ref={veilRef} className="cf-veil" aria-hidden="true" />
      <div className="cf-grain" aria-hidden="true" />
      {doorOpen && archive?.doorActive() && <button type="button" className="door-skip lbl" onClick={(ev) => { ev.stopPropagation(); archive?.skipDoor() }}>Skip ›</button>}
      {/* return visits: the archive prepares its shaders for a moment; say so instead of a blank page */}
      {!gate && !sceneReady && <div className="cf-boot lbl" role="status">Decrypting the portfolio</div>}
      {archive && (
        <ArchiveContext.Provider value={ctx as Ctx}>
          <Hud statusLine={statusLine} hidden={gate || !sceneReady} arriving={arriving} />
          {verify && <Verify hash={verify.hash} restricted={verify.restricted} />}
          {file && <Suspense fallback={null}><FileView entry={file} key={file.id} /></Suspense>}
        </ArchiveContext.Provider>
      )}
      {(gate || gateLeaving) && <Suspense fallback={null}>{landing && !readout
        ? <Landing variant={landing} reduced={reduced} sceneReady={sceneReady || noGL} onTitle={() => setLoadScene(true)} onPick={onPick} onReveal={onReveal} originAt={originAt} onStrike={onStrike} onDone={onGateDone} />
        : <Gate visitor={visitor} reduced={reduced} sceneReady={sceneReady || noGL} onTitle={() => setLoadScene(true)} onReveal={onReveal} originAt={originAt} onStrike={onStrike} onDone={onGateDone} />}</Suspense>}
      <noscript>{ENTRIES.map((e) => e.title).join(' · ')}</noscript>
    </div>
  )
}
