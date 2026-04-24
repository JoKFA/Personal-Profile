import { buildCommit, buildDate } from '../lib/buildInfo'

export function StatusStrip() {
  return (
    <div className="status-strip" aria-label="site status">
      <div className="site-shell status-strip-row">
        <span className="status-strip-item">
          <span className="status-strip-dot" aria-hidden="true" />
          <span className="status-strip-key">status</span>
          <span className="status-strip-val">live</span>
        </span>
        <div className="status-strip-meta">
          <span className="status-strip-item">
            <span className="status-strip-key">shipped</span>
            <span className="status-strip-val">{buildDate}</span>
          </span>
          <span className="status-strip-item">
            <span className="status-strip-key">tz</span>
            <span className="status-strip-val">America/Vancouver</span>
          </span>
          <span className="status-strip-item">
            <span className="status-strip-key">commit</span>
            <span className="status-strip-val">{buildCommit}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
