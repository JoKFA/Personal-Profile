// The two clocks of the page layer (plan §2.4). While a clip plays, the page layer reads the clip's own media time
// (requestVideoFrameCallback) and is driven ONE frame ahead of the presented frame: P0 measured that the compositor
// shows DOM changes one frame later than the video frame of the same callback. Otherwise the app clock runs.

/** DOM runs this many clip frames ahead of the presented one. P0 measured a 1-frame lead (42/53 on target); P2 found 52% exact with it, so P3b samples at half a frame, interpolating between the per-frame quads */
export const LEAD_FRAMES = 0.5

/** the app clock, seconds */
export const appNow = () => performance.now() / 1000

/** media time + lead -> the time the page layer should show, capped at the clip's end */
export const pageTime = (mediaTime: number, fps: number, duration: number) => Math.min(duration, mediaTime + LEAD_FRAMES / fps)
/** the (fractional) frame position the presented media time stands for, + the lead, capped at the last frame */
export const pageIndex = (mediaTime: number, fps: number, last: number) => Math.min(last, Math.max(0, mediaTime * fps + LEAD_FRAMES))
/** a per-frame table sampled at a fractional frame position, linearly between the two frames around it */
export const sampleAt = (table: readonly number[], pos: number) => { const i = Math.max(0, Math.min(table.length - 1, Math.floor(pos))), j = Math.min(table.length - 1, i + 1), f = Math.max(0, Math.min(1, pos - i)); return table[i] + (table[j] - table[i]) * f }
