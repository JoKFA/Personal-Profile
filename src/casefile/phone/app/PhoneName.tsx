// The name, from the moment React replaces the prerendered page until the shell's own top bar has the same name on the same pixels (styles: public/prerender.css,
// which is loaded before anything else; it is hidden on every device but a phone, and as soon as the bar exists). Rendered by App.tsx while the shell loads and by the shell itself.
export default function PhoneName() {
  return <div className="ph-prename" aria-hidden="true"><span className="n">Yaoting Wang</span><span className="r">Security Analyst</span></div>
}
