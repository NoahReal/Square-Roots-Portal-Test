import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { boxes, longDate, money } from '../../../format'
import PageHero from '../../../components/PageHero'

// For a location that runs a hub (like Fairview): what arrives for each location it takes deliveries
// for, a sorting checklist, and the hub's share.
export default function HubPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/manager/hub/')
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <>
      <PageHero title="Hub" lead="What arrives for each location you take deliveries for, and your share for sorting.">
        {user.site_name && <p className="hero-meta">{user.site_name}</p>}
      </PageHero>
      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!data && !error && <p className="muted">Loading…</p>}
          {data?.hubs.length === 0 && <p className="muted">Your location doesn’t run a hub.</p>}
          {data?.hubs.map((hub) => (
            <div key={hub.name}>
              <h2>{hub.name}</h2>
              <p className="muted">
                Your share: {hub.percent}% of what’s bought from {hub.supplier} for the locations you take deliveries for.
              </p>
              {hub.forms.length === 0 && <p className="muted">No orders yet.</p>}
              {hub.forms.map((form) => (
                <HubDelivery key={form.id} form={form} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function HubDelivery({ form }) {
  // Ticks for sorting are kept on this screen only, as a checklist while sorting.
  const [sorted, setSorted] = useState({})
  const done = form.locations.filter((l) => sorted[l.name]).length
  return (
    <article className="block block-white hub-delivery">
      <header className="order-head">
        <div>
          <h3>Delivery {longDate(form.delivery_date)}</h3>
          <p className="muted">
            {boxes(form.boxes)} for {form.locations.length} locations · your share {money(form.share)}
          </p>
        </div>
        <span className="tag">{form.ordering_open ? 'Orders still coming in' : form.status_label}</span>
      </header>
      {form.locations.length === 0 ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <>
          <p className="muted">
            Sorted: {done} of {form.locations.length}
          </p>
          <ul className="plain-list hub-locations">
            {form.locations.map((location) => (
              <li key={location.name}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={Boolean(sorted[location.name])}
                    onChange={(e) => setSorted({ ...sorted, [location.name]: e.target.checked })}
                  />
                  <strong>{location.name}</strong> ({boxes(location.boxes)})
                </label>
                <p className="hub-items">
                  {location.items.map((i) => `${i.boxes} × ${i.product}${i.box_size ? ` (${i.box_size})` : ''}`).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  )
}
