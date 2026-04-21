interface SectionHeadingProps {
  id: string
  label: string
  title: string
  intro?: string
}

export function SectionHeading({ id, label, title, intro }: SectionHeadingProps) {
  return (
    <div id={id} className="section-heading-block">
      <p className="section-label">{label}</p>
      <div className="section-title-row">
        <h2 className="section-title">{title}</h2>
        <span className="section-line" aria-hidden="true" />
      </div>
      {intro ? <p className="section-intro">{intro}</p> : null}
    </div>
  )
}
