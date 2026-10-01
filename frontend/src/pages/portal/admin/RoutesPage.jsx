import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import PageHero from '../../../components/PageHero'

// Admin screen: the delivery routes, their weekly days, suppliers, and where each location's produce goes.
// Phase 0 of the ordering work (see docs/ORDERING-MODEL.md): for checking the setup with the team.
export default function RoutesPage() {
  const [data, setData] = useState(null)
  const [setup, setSetup] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/admin/routes/')
      .then(setData)
      .catch((err) => setError(err.message))
    api('/admin/ordering/').then(setSetup)
  }, [])

  async function changeRoute(routeId, changes) {
    setSetup(await api(`/admin/ordering/routes/${routeId}/`, { method: 'PATCH', body: changes }))
  }

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

              {setup && (
                <RouteOrdering
                  route={setup.routes.find((r) => r.id === route.id)}
                  companies={setup.transport_companies}
                  onChange={(changes) => changeRoute(route.id, changes)}
                />
              )}

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

          {setup && <AddCompany onAdded={async () => setSetup(await api('/admin/ordering/'))} />}

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

// How a route orders (bundles, or boxes from order forms) and who drives its trucks.
function RouteOrdering({ route, companies, onChange }) {
  return (
    <div className="route-ordering">
      <label className="check">
        <input type="checkbox" checked={route.uses_order_forms} onChange={(e) => onChange({ uses_order_forms: e.target.checked })} />
        <span>
          <strong>Orders from order forms</strong>
          <span className="field-hint">
            {' '}
            {route.uses_order_forms
              ? 'Its locations order boxes of each item on the Order Forms screen.'
              : 'Its locations still order a number of bundles. Switch on when the route is ready.'}
          </span>
        </span>
      </label>
      <div className="field">
        <label htmlFor={`transport-${route.id}`}>Trucks driven by</label>
        <select id={`transport-${route.id}`} value={route.transport ?? ''} onChange={(e) => onChange({ transport: Number(e.target.value) || null })}>
          <option value="">Not set</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function AddCompany({ onAdded }) {
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '' })
  const [error, setError] = useState('')
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function add(event) {
    event.preventDefault()
    setError('')
    try {
      await api('/admin/transport-companies/', { method: 'POST', body: form })
      setForm({ name: '', contact_name: '', email: '', phone: '' })
      onAdded()
    } catch (err) {
      setError([].concat(err.data?.name ?? err.data?.email ?? err.message).join(' '))
    }
  }

  return (
    <form className="block block-white" onSubmit={add} noValidate>
      <h2>Add a transport company</h2>
      <p className="muted">They get a link to confirm each run. Their email is where the link goes.</p>
      <div className="field-row">
        {[
          ['name', 'Company name'],
          ['contact_name', 'Contact person'],
          ['email', 'Email'],
          ['phone', 'Phone'],
        ].map(([name, label]) => (
          <div className="field" key={name}>
            <label htmlFor={`company-${name}`}>{label}</label>
            <input id={`company-${name}`} name={name} value={form[name]} onChange={update} />
          </div>
        ))}
      </div>
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-small" disabled={!form.name.trim()}>
        Add company
      </button>
    </form>
  )
}
