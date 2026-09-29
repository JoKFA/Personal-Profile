import { useEffect, useRef } from 'react'
import { useCtx } from '../context'

/** Run an async script until unmount. `wait` resolves early (0 ms) under reduced motion. */
export function useScript(script: (wait: (ms: number) => Promise<boolean>, reduced: boolean) => Promise<void>, deps: unknown[] = []) {
  const { reduced } = useCtx()
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    const wait = (ms: number) => new Promise<boolean>((r) => setTimeout(() => r(alive.current), reduced ? 0 : ms))
    void script(wait, reduced)
    return () => { alive.current = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return alive
}
