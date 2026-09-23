// "Our Partners & Supporters" logos, as on the live home and About pages.
export default function PartnersSection({ tone = 'cream' }) {
  return (
    <section className={'partners-section partners-' + tone}>
      <h2>Our Partners &amp; Supporters</h2>
      <div className="partner-logos">
        <img src="/logos/nova-scotia.png" alt="Government of Nova Scotia" />
        <img src="/logos/saint-marys.png" alt="Saint Mary's University" />
      </div>
    </section>
  )
}
