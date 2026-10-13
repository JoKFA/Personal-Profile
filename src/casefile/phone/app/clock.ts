// The two clocks of the page layer (plan §2.4). While a clip plays, the page layer reads the clip's own media time
// (requestVideoFrameCallback) and is driven ONE frame ahead of the presented frame: P0 measured that the compositor
// shows DOM changes one frame later than the video frame of the same callback. Otherwise the app clock runs.

/** DOM runs this many clip frames ahead of the presented one (P0: 42/53 frames on target at 1, none worse than ±1) */
export const LEAD_FRAMES = 1

/** the app clock, seconds */
export const appNow = () => performance.now() / 1000

/** media time + lead -> the time the page layer should show, capped at the clip's end */
export const pageTime = (mediaTime: number, fps: number, duration: number) => Math.min(duration, mediaTime + LEAD_FRAMES / fps)
/** frame index the presented media time stands for, + the lead, capped at the last frame */
export const pageIndex = (mediaTime: number, fps: number, last: number) => Math.min(last, Math.max(0, Math.round(mediaTime * fps) + LEAD_FRAMES))
