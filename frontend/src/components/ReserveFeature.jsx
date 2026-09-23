import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { dateAtTime, longDate, money } from '../format'
import { savedDetails } from '../reservations'

// "Reserve your bundle" on the home page, right under the hero: the next drop, and a quick way in.
export default function ReserveFeature() {
  const navigate = useNavigate()
  const [options, setOptions] = useState(null)
  const [siteId, setSiteId] = useState(() => savedDetails()?.site ?? '')

  useEffect(() => {
    api('/reserve/options/').then(setOptions).catch(() => setOptions(null))
  }, [])

  // The soonest drop anyone can still reserve for.
  const next = options?.sites
    .flatMap((site) => site.drops.slice(0, 1))
    .sort((a, b) => a.drop_date.localeCompare(b.drop_date))[0]

  function go(event) {
    event.preventDefault()
    navigate(siteId ? `/reserve?site=${siteId}` : '/reserve')
  }

  return (
    <section className="reserve-feature" aria-labelledby="reserve-feature-title">
      <div className="reserve-feature-inner">
        <div>
          <h2 id="reserve-feature-title">Reserve Your Bundle</h2>
          {next ? (
            <>
              <p className="reserve-feature-next">Next drop: {longDate(next.drop_date)}</p>
              <p>Pay at the drop. Reserve by {dateAtTime(next.order_cutoff)}</p>
            </>
          ) : (
            <p>10 lbs of fresh Nova Scotia produce. Reserve ahead and pay at the drop.</p>
          )}
          {options && (
            <p className="muted">
              Pay what works for you: {money(options.prices.standard)}, {money(options.prices.at_cost)} or free.
            </p>
          )}
        </div>
        <form className="reserve-feature-form" onSubmit={go}>
          <label htmlFor="reserve-feature-site" className="visually-hidden">
            Your location
          </label>
          <select id="reserve-feature-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Choose your location…</option>
            {options?.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-large">Reserve a bundle</button>
        </form>
      </div>
    </section>
  )
}
