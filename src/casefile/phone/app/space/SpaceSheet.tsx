// The paper under the interior's picture (P3c), in the order the plan gives it: the station's reference and title; the four step dots and the step's
// line; the result and the link to its file; the six areas; the controls and the evidence count; the profile's own body (the shared FileHead and
// FileBody, stacked); the evidence list with the baked thumbnails. Every word is the desktop's (space/content.ts); this file adds no copy.
// It reads the show's state from a store (the show writes it only when something the paper shows changes, not every frame).
import { memo, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { AREA_CONTENT } from '../../../space/content'
import { entryById } from '../../../data/entries'
import { FileBody, FileHead } from '../../../ui/file/FileBody'
import type { Visitor } from '../../../visitor'
import { STEP_AT } from './model'

const pad = (n: number) => String(n).padStart(2, '0')

/** what the paper shows of the show: the discrete state, replaced (not mutated) when it changes */
export interface SheetState {
  area: number
  step: number
  playing: boolean
  /** why it is not playing: '', 'reading', 'user', 'done' */
  reason: string
  /** the first visit's tour is running */
  tour: boolean
  /** the clips between two stations (a flight, a way through the hub): the area's words are about to change */
  travelling: boolean
  /** the result has been reached (p >= RESULT_AT) */
  result: boolean
  retained: boolean[]
  /** how many results have been produced */
  count: number
  /** the interior is on screen (the intro is over) */
  live: boolean
}
export interface SheetStore { get(): SheetState; subscribe(f: () => void): () => void }
export interface SheetActions {
  pick(i: number): void
  step(n: number): void
  toggle(): void
  replay(): void
  /** the Evidence button: to the list of what has been produced */
  evidence(): void
  /** `Open X-…`: leave the interior (the exit at 1.5x) and open that file */
  go(id: string): void
}
export interface SheetProps {
  store: SheetStore
  actions: SheetActions
  thumbs: Record<number, string>
  visitor: Visitor
  audit: [string, string][]
}

/** the profile's own body, shared with the file pages; it never re-renders (the decrypting text must not be touched by React) */
const ProfileBody = memo(function ProfileBody({ actions, visitor, audit }: { actions: SheetActions; visitor: Visitor; audit: [string, string][] }) {
  const entry = entryById.get('YW-000')!
  return (
    <div className="ph-fbody ph-sp-body">
      <FileHead entry={entry} heading={entry.title} />
      <FileBody entry={entry} layout="stacked" onJump={actions.go} session={{ visitor: visitor.id, risk: 0, audit }} />
    </div>
  )
})

export const SpaceSheet = memo(function SpaceSheet({ store, actions, thumbs, visitor, audit }: SheetProps) {
  const k = useSyncExternalStore(store.subscribe, store.get, store.get)
  const A = AREA_CONTENT[k.area]
  // The result block holds a short reserve until the result is reached (a long blank under the step line reads as a broken page); when the result comes, the block grows
  // to its words' own height once, and everything under it moves with it on the app's spring (WAAPI: nothing inline for the CSP to mind). The same when it goes back.
  const res = useRef<HTMLElement>(null), resH = useRef(0)
  useLayoutEffect(() => {
    const el = res.current; if (!el) return
    const now = el.getBoundingClientRect().height, prev = resH.current
    resH.current = now
    if (prev > 0 && Math.abs(prev - now) > 4 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.getAnimations().forEach((a) => a.cancel())
      el.animate([{ height: `${prev}px`, overflow: 'hidden' }, { height: `${now}px`, overflow: 'hidden' }], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' })
    }
  }, [k.result, A.key])
  return (
    <div className="ph-sp" data-area={A.key} data-playing={k.playing ? '1' : '0'} data-result={k.result ? '1' : '0'}>
      <section className="ph-sp-head" aria-label="This area" key={A.key}>
        <div className="ph-sp-ref">{A.ref}</div>
        <h2 className="ph-sp-title" tabIndex={-1}>{A.title}</h2>
        <ol className="ph-sp-steps" aria-label="Steps">
          {A.steps.map((s, i) => (
            <li key={i}>
              <button type="button" aria-current={k.step === i ? 'step' : undefined} aria-label={`Step ${i + 1}: ${s}`} data-state={i < k.step ? 'done' : i === k.step ? 'on' : ''} data-at={STEP_AT[i]} onClick={() => actions.step(i)}>
                <i /><span>{pad(i + 1)}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="ph-sp-cap" aria-live="polite">
          <span className="ph-sp-capv"><span>{pad(k.step + 1)}</span>{A.steps[k.step]}</span>
          {/* the four lines stacked unseen in the same cell: the block is as tall as the area's longest line at this width, whichever step is on */}
          {A.steps.map((t, i) => <span key={i} className="ph-sp-caph" aria-hidden="true"><span>{pad(i + 1)}</span>{t}</span>)}
        </p>
      </section>

      <section className="ph-sp-result" ref={res} aria-live="polite" data-on={k.result ? '1' : '0'} key={`r${A.key}`}>
        <p>{A.result}</p>
        <button type="button" className="ph-sp-go" onClick={() => actions.go(A.entry)}><b>{A.link}</b><span aria-hidden="true">→</span></button>
        <span className="ph-sp-kept">✓ Evidence · {A.evidence}</span>
      </section>

      <nav className="ph-sp-nav" aria-label="Work areas">
        {AREA_CONTENT.map((a, i) => (
          <button key={a.key} type="button" aria-pressed={(k.area === i && !k.travelling) || undefined} data-kept={k.retained[i] ? '1' : '0'} onClick={() => actions.pick(i)}>
            <span>{pad(i + 1)}</span>{a.short}<i aria-hidden="true" />
          </button>
        ))}
      </nav>

      <div className="ph-sp-ctl">
        <button type="button" onClick={actions.toggle} aria-label={k.playing ? 'Pause' : k.reason === 'reading' ? 'Resume (paused while you read)' : k.reason === 'done' ? 'Replay' : 'Play'}>
          <span aria-hidden="true">{k.playing ? '❚❚' : '▶'}</span>{k.playing ? 'Pause' : k.reason === 'reading' ? 'Paused · Resume' : k.reason === 'done' ? 'Replay' : 'Play'}
        </button>
        <button type="button" onClick={actions.replay}>↻ Replay</button>
        <button type="button" className="ph-sp-ev" onClick={actions.evidence}>Evidence <b>{k.count}</b> / 6</button>
      </div>

      <ProfileBody actions={actions} visitor={visitor} audit={audit} />

      <section className="ph-sp-evidence" id="ph-sp-evidence" aria-label="Evidence index">
        <h3 className="ph-sp-evh">Collected evidence · {k.count} of 6</h3>
        <div className="ph-sp-grid">
          {AREA_CONTENT.map((a, i) => {
            const kept = k.retained[i], src = thumbs[i]
            return (
              <article key={a.key} className="ph-sp-cell" data-kept={kept ? '1' : '0'}>
                <button type="button" className="ph-sp-thumb" onClick={() => actions.pick(i)} aria-label={`${kept ? 'Show again' : 'Watch'}: ${a.name}`}>
                  {kept && src ? <img src={src} alt={`${a.evidence}, as it stands in the space`} /> : <span>{pad(i + 1)}</span>}
                </button>
                <div>
                  <div className="ph-sp-celll">{kept ? `${a.entry} · retained` : 'Not yet viewed'}</div>
                  <h4>{a.evidence}</h4>
                  <button type="button" className="ph-sp-go" onClick={() => actions.go(a.entry)}><b>Open {a.entry}</b><span aria-hidden="true">→</span></button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
})
