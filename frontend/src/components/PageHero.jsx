// The big yellow block at the top of each page, like "Mission" on the live site.
export default function PageHero({ title, lead, children }) {
  return (
    <section className="page-hero">
      <div className="container">
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
        {children}
      </div>
    </section>
  )
}
