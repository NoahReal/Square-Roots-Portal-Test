import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { longDate, pounds, timeRange } from '../../../format'
import PageHero from '../../../components/PageHero'

// Host Site screen: when Square Roots drops happen at your space, and who to contact.
export default function HostDropsPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/host/drops/')
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  const upcoming = data?.drops.filter((d) => !d.has_happened) ?? []
  const past = data?.drops.filter((d) => d.has_happened).reverse() ?? []
  const [next, ...later] = upcoming

  return (
    <>
      <PageHero
        title={`Welcome, ${user.first_name}`}
        lead={data?.site ? `Square Roots drops at ${data.site.name}, ${data.site.address}.` : 'See when Square Roots drops are happening at your location.'}
      />

      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!data && !error && <p className="muted">Loading…</p>}
          {data && !data.site && (
            <div className="block block-white">
              <p>Your account isn't linked to a location yet. Please contact the Square Roots team.</p>
            </div>
          )}

          {data?.site && (
            <div className="host-layout">
              <div>
                {next ? (
                  <article className="block block-yellow next-drop">
                    <span className="eyebrow-label">Next drop</span>
                    <h2>{longDate(next.drop_date)}</h2>
                    <p className="next-drop-time">{timeRange(next.starts_at, next.ends_at)}</p>
                    <p>
                      {next.bundles
                        ? `About ${next.bundles} bundles (${pounds(next.bundles * 10)}) of produce.`
                        : "The Community Manager hasn't ordered yet, so we don't know how many bundles to expect."}
                    </p>
                  </article>
                ) : (
                  <div className="block block-white">
                    <p className="muted">No drops scheduled right now.</p>
                  </div>
                )}

                {later.length > 0 && (
                  <section className="order-group">
                    <h2>Coming up</h2>
                    <ul className="date-list">
                      {later.map((drop) => (
                        <li key={drop.id}>
                          <strong>{longDate(drop.drop_date)}</strong>
                          <span>{timeRange(drop.starts_at, drop.ends_at)}</span>
                          <span className="muted">{drop.bundles ? `${drop.bundles} bundles` : 'Not ordered yet'}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {past.length > 0 && (
                  <section className="order-group">
                    <h2>Recent drops</h2>
                    <ul className="date-list date-list-past">
                      {past.map((drop) => (
                        <li key={drop.id}>
                          <strong>{longDate(drop.drop_date)}</strong>
                          <span>{timeRange(drop.starts_at, drop.ends_at)}</span>
                          <span className="muted">{drop.bundles ? `${drop.bundles} bundles` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              <aside className="block block-white">
                <h2>Who to contact</h2>
                {data.managers.length === 0 && (
                  <p>
                    The Square Roots team:{' '}
                    <a href="mailto:squareroots@enactussmu.ca">squareroots@enactussmu.ca</a>
                  </p>
                )}
                {data.managers.map((manager) => (
                  <div key={manager.name} className="contact-card">
                    <p>
                      <strong>{manager.name}</strong>
                      <br />
                      <span className="muted">Community Manager</span>
                    </p>
                    {manager.phone && (
                      <a className="btn btn-small" href={`tel:${manager.phone}`}>
                        Call {manager.phone}
                      </a>
                    )}
                    {manager.email && (
                      <a className="btn btn-small" href={`mailto:${manager.email}`}>
                        Email
                      </a>
                    )}
                  </div>
                ))}
                <p className="muted">
                  For anything else, email the Square Roots team at{' '}
                  <a href="mailto:squareroots@enactussmu.ca">squareroots@enactussmu.ca</a>.
                </p>
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
