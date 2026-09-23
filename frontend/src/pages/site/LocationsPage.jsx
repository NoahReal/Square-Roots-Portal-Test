import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { longDate, timeRange } from '../../format'
import { FacebookIcon, InstagramIcon } from '../../components/Icons'

// Drop dates come from the drop cycles in the portal, grouped by month like the
// live site shows them: "Oct 10 & 24".
function groupByMonth(isoDates) {
  const months = new Map()
  for (const iso of isoDates) {
    const [year, month, day] = iso.split('-').map(Number)
    const name = new Date(year, month - 1, 1).toLocaleDateString('en-CA', { month: 'short' })
    months.set(name, [...(months.get(name) ?? []), day])
  }
  // "Oct 10 & 24", or "Jan 3, 17 & 31" when a month has three drops
  const joinDays = (days) => (days.length > 1 ? `${days.slice(0, -1).join(', ')} & ${days.at(-1)}` : `${days[0]}`)
  return [...months].map(([name, days]) => `${name} ${joinDays(days)}`)
}

function directionsUrl(site) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${site.address}, ${site.name}, Nova Scotia`)
}

export default function LocationsPage() {
  const [sites, setSites] = useState(null)
  const [dropDates, setDropDates] = useState(null)

  useEffect(() => {
    api('/sites/').then(setSites).catch(() => setSites([]))
    api('/drop-dates/').then(setDropDates).catch(() => setDropDates(null))
  }, [])

  const highlights = sites?.filter((site) => site.highlight) ?? []

  return (
    <>
      <section className="locations-hero" style={{ backgroundImage: 'url(/photos/field-rows.jpg)' }}>
        <div className="locations-card">
          <div>
            <h1>Locations</h1>
            <p>Independent Community Managers operate drops bi-weekly at locations around Nova Scotia.</p>
            <Link to="/become-a-community-manager" className="btn btn-small">
              Become a Community Manager
            </Link>
          </div>
          <div className="drop-dates">
            <h2>{dropDates?.year ?? new Date().getFullYear()} Drop Dates</h2>
            {dropDates?.next && <p className="next-drop-date">Next drop: {longDate(dropDates.next)}</p>}
            <ul>
              {groupByMonth(dropDates?.dates ?? []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="find-location">
        <div className="container">
          <h2>Find a Location</h2>
          {!sites && <p>Loading locations…</p>}
          <ul className="location-list">
            {sites?.map((site) => (
              <li key={site.id}>
                <h3>{site.name}</h3>
                <p>{site.address}</p>
                {site.next_drop ? (
                  <p className="location-next">
                    <strong>Next drop:</strong> {longDate(site.next_drop.drop_date)},{' '}
                    {timeRange(site.next_drop.starts_at, site.next_drop.ends_at)}
                  </p>
                ) : (
                  <p className="location-next muted">Next drop date coming soon</p>
                )}
                <div className="location-links">
                  {site.instagram_url && (
                    <a href={site.instagram_url} target="_blank" rel="noreferrer" aria-label={`${site.name} on Instagram`}>
                      <InstagramIcon />
                    </a>
                  )}
                  {site.facebook_url && (
                    <a href={site.facebook_url} target="_blank" rel="noreferrer" aria-label={`${site.name} on Facebook`}>
                      <FacebookIcon />
                    </a>
                  )}
                  <a href={directionsUrl(site)} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {highlights.length > 0 && (
        <section className="highlights" style={{ backgroundImage: 'url(/photos/brussels-sprouts.jpg)' }}>
          <div className="container">
            <h2>Location Highlights</h2>
            {highlights.map((site) => (
              <div key={site.id} className="highlight-card">
                <h3>{site.name}</h3>
                <p>{site.highlight}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="host-cta">
        <div className="container host-cta-inner">
          <div>
            <h2>Don’t see a location near you?</h2>
            <p>
              Start one as a Community Manager, or offer a space in your community where drops can happen. We'll help
              with the rest.
            </p>
          </div>
          <div className="host-cta-actions">
            <Link to="/signup/community-manager" className="btn btn-primary">
              Start a location
            </Link>
            <Link to="/signup/host-site" className="btn">
              Host a Drop
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
