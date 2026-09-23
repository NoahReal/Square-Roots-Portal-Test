import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { FacebookIcon, InstagramIcon } from '../../components/Icons'

// Copied from the live site. Once drop cycles are built (step 2), these can come from the portal instead.
const DROP_DATES_YEAR = 2024
const DROP_DATES = [
  'Jan 13 & 27', 'Feb 10 & 24', 'Mar 9 & 23', 'Apr 6 & 20', 'May 4 & 25', 'Jun 8 & 22',
  'Jul 13 & 27', 'Aug 10 & 24', 'Sep 7 & 21', 'Oct 5 & 19', 'Nov 2 & 23', 'Dec 7 & 21',
]

function directionsUrl(site) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${site.address}, ${site.name}, Nova Scotia`)
}

export default function LocationsPage() {
  const [sites, setSites] = useState(null)

  useEffect(() => {
    api('/sites/').then(setSites).catch(() => setSites([]))
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
            <h2>{DROP_DATES_YEAR} Drop Dates</h2>
            <ul>
              {DROP_DATES.map((date) => (
                <li key={date}>{date}</li>
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
