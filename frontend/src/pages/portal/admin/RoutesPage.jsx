import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import PageHero from '../../../components/PageHero'

// Admin screen: the delivery routes, their weekly days, suppliers, and where each location's produce goes.
// Phase 0 of the ordering work (see docs/ORDERING-MODEL.md): for checking the setup with the team.
export default function RoutesPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/admin/routes/')
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <>
      <PageHero
        title="Routes"
        lead="Each route has its own order form, deadline and trucks. Locations get their produce at a drop-off point: their own, or a hub that sorts for several."
      />
      <section className="section">
        <div className="container">
          <div className="notice notice-info">
            The routes, their days and suppliers come from what the Square Roots team described. Which location is on
            which route, and which five places the Fairview hub serves, are guesses to check with the team. Change a
            location’s route on the <Link to="/portal/admin/locations">Locations</Link> screen.
          </div>
          {error && <div className="notice notice-error">{error}</div>}
          {!data && !error && <p className="muted">Loading…</p>}

          {data?.routes.map((route) => (
            <article key={route.id} className="block block-white route-card">
              <header className="order-head">
                <div>
                  <h2>{route.name}</h2>
                  {route.description && <p className="muted">{route.description}</p>}
                </div>
                <span className="tag">{route.sites.length} locations</span>
              </header>

              <div className="stat-tiles stat-tiles-4">
                <Day label="Order form goes out" day={route.form_sent_on} />
                <Day label="Orders due" day={route.orders_due_on} />
                <Day label="Trucks deliver" day={route.trucks_on} />
                <Day label="Markets, usually" day={route.markets_usually_on} />
              </div>

              <p>
                <strong>Buys from:</strong>{' '}
                {route.suppliers.map((s) => `${s.name} (${s.kind.toLowerCase()})`).join(', ') || 'no suppliers yet'}
                {route.shares_form_with && (
                  <>
                    {' '}
                    · <strong>Same order form as {route.shares_form_with}</strong>
                  </>
                )}
              </p>

              {route.drop_off_points.length === 0 ? (
                <p className="muted">No locations on this route yet.</p>
              ) : (
                <ul className="drop-off-list">
                  {route.drop_off_points.map((point) => (
                    <li key={point.id} className={point.hub_site ? 'drop-off-hub' : ''}>
                      <strong>{point.name}</strong>
                      {point.hub_site && (
                        <span className="tag">
                          Hub · {point.hub_share_percent}% of {point.hub_share_supplier ?? 'orders'}
                        </span>
                      )}
                      {point.hub_site && (
                        <p className="muted">
                          Delivers for: {point.sites.join(', ')}
                          {point.notes && ` · ${point.notes}`}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}

          {data?.unassigned_sites.length > 0 && (
            <div className="notice notice-info">
              Not on a route yet: {data.unassigned_sites.map((s) => s.name).join(', ')}.
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function Day({ label, day }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{day}</span>
    </div>
  )
}
