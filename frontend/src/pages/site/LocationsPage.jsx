import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { usePricing } from '../../pricing'
import { FacebookIcon, InstagramIcon } from '../../components/Icons'
import { useSiteText } from '../../siteText'

// Drop dates come from the drop cycles in the portal, grouped by month like the
// live site shows them: "Oct 10 & 24" (in French, "10 et 24 oct.").
function groupByMonth(isoDates, lang, and) {
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const months = new Map()
  for (const iso of isoDates) {
    const [year, month, day] = iso.split('-').map(Number)
    const name = new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'short' })
    months.set(name, [...(months.get(name) ?? []), day])
  }
  // "Oct 10 & 24", or "Jan 3, 17 & 31" when a month has three drops
  const joinDays = (days) => (days.length > 1 ? `${days.slice(0, -1).join(', ')} ${and} ${days.at(-1)}` : `${days[0]}`)
  return [...months].map(([name, days]) => (lang === 'fr' ? `${joinDays(days)} ${name}` : `${name} ${joinDays(days)}`))
}

function directionsUrl(site) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${site.address}, ${site.name}, Nova Scotia`)
}

export default function LocationsPage() {
  const text = useSiteText()
  const { lang, t, format } = useLanguage()
  const words = t.locationsPage
  const [sites, setSites] = useState(null)
  const [dropDates, setDropDates] = useState(null)

  useEffect(() => {
    api('/sites/').then(setSites).catch(() => setSites([]))
    api('/drop-dates/').then(setDropDates).catch(() => setDropDates(null))
  }, [])

  const pricing = usePricing()
  const highlights = sites?.filter((site) => site.highlight) ?? []

  return (
    <>
      <section className="locations-hero" style={{ backgroundImage: 'url(/photos/field-rows.jpg)' }}>
        <div className="locations-card">
          <div>
            <h1>{words.title}</h1>
            <p>{text('locations.intro')}</p>
            <Link to="/become-a-community-manager" className="btn btn-small">
              {words.becomeCm}
            </Link>
          </div>
          <div className="drop-dates">
            <h2>{words.dropDates(dropDates?.year ?? new Date().getFullYear())}</h2>
            {dropDates?.next && <p className="next-drop-date">{words.nextDrop(format.longDate(dropDates.next))}</p>}
            <ul>
              {groupByMonth(dropDates?.dates ?? [], lang, words.and).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {pricing && (
        <section className="pricing-band">
          <div className="container pricing-inner">
            <h2>{words.payWhatWorks}</h2>
            <p>{words.bundleSize}</p>
            <ul className="price-list">
              <li>
                <strong>{format.money(pricing.standard_price)}</strong>
                <span>{words.payItForward}</span>
              </li>
              <li>
                <strong>{format.money(pricing.at_cost_price)}</strong>
                <span>{words.atCost}</span>
              </li>
              <li>
                <strong>{words.free}</strong>
                <span>{words.freeText}</span>
              </li>
            </ul>
            <Link to="/reserve" className="btn btn-primary">
              {words.reserve}
            </Link>
            {pricing.delivery.length > 0 && (
              <p className="delivery-note">
                {words.delivery(
                  pricing.delivery.map((d) => words.deliveryPlace(d.site, d.partner)).join(', '),
                  format.money(pricing.delivery_fee),
                )}
              </p>
            )}
          </div>
        </section>
      )}

      <section className="find-location">
        <div className="container">
          <h2>{words.findLocation}</h2>
          {!sites && <p>{words.loading}</p>}
          <ul className="location-list">
            {sites?.map((site) => (
              <li key={site.id}>
                <h3>{site.name}</h3>
                <p>{site.address}</p>
                {site.next_drop ? (
                  <p className="location-next">
                    <strong>{words.nextDropLabel}</strong> {format.longDate(site.next_drop.drop_date)},{' '}
                    {format.timeRange(site.next_drop.starts_at, site.next_drop.ends_at)}
                  </p>
                ) : (
                  <p className="location-next muted">{words.comingSoon}</p>
                )}
                {site.online_reservations && site.next_drop && (
                  <Link to={`/reserve?site=${site.id}`} className="btn btn-primary btn-small location-reserve">
                    {words.reserveAt(site.name)}
                  </Link>
                )}
                <div className="location-links">
                  {site.instagram_url && (
                    <a href={site.instagram_url} target="_blank" rel="noreferrer" aria-label={words.onInstagram(site.name)}>
                      <InstagramIcon />
                    </a>
                  )}
                  {site.facebook_url && (
                    <a href={site.facebook_url} target="_blank" rel="noreferrer" aria-label={words.onFacebook(site.name)}>
                      <FacebookIcon />
                    </a>
                  )}
                  <a href={directionsUrl(site)} target="_blank" rel="noreferrer">
                    {words.directions}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {highlights.length > 0 && (
        <>
          <div className="highlights-heading container">
            <h2>{words.highlights}</h2>
          </div>
          <section className="highlights" style={{ backgroundImage: 'url(/photos/brussels-sprouts.jpg)' }}>
            <div className="container">
              {highlights.map((site) => (
                <div key={site.id} className="highlight-card">
                  <h3>{site.name}</h3>
                  <p>{site.highlight}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="host-cta">
        <div className="container host-cta-inner">
          <div>
            <h2>{words.noneNearTitle}</h2>
            <p>{words.noneNearText}</p>
          </div>
          <div className="host-cta-actions">
            <Link to="/signup/community-manager" className="btn btn-primary">
              {words.startLocation}
            </Link>
            <Link to="/signup/host-site" className="btn">
              {words.hostDrop}
            </Link>
            <Link to="/request-a-location" className="btn">
              {words.askForOne}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
