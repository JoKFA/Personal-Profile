import { useEffect, useRef } from 'react'
import { createSpike } from './stage'
import './stage.css'

/** P0 spike (?phone-spike): the phone's stage built from baked stills and clips. Imports no three.js and no scene code. */
export default function Spike() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => createSpike(ref.current!), [])
  return <div className="sp-root" ref={ref} />
}
