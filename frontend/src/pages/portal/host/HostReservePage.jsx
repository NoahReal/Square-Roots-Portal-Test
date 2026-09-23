import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { dateAtTime, longDate, money, timeRange } from '../../../format'
import { usePricing } from '../../../pricing'
import PageHero from '../../../components/PageHero'
import Stepper from '../../../components/Stepper'

const TIERS = [
  { value: 'standard', label: 'Standard', priceKey: 'standard_price' },
  { value: 'at_cost', label: 'At cost', priceKey: 'at_cost_price' },
  { value: 'free', label: 'Free' },
]

// Host Site screen: reserve bundles for people your organization supports, who may not have
// email or a phone. Each gets a pickup code to hand to them; the list can be printed.
export default function HostReservePage() {
  const [data, setData] = useState(null)
  const [dropId, setDropId] = useState(null)
  const [error, setError] = useState('')

  function load() {
    return api('/host/reservations/')
      .then((found) => {
        setData(found)
        setDropId((current) => current ?? found.drops.find((d) => d.ordering_open)?.id ?? found.drops[0]?.id ?? null)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
  }, [])

  const drop = data?.drops.find((d) => d.id === dropId)

  async function cancel(reservation) {
    await api(`/host/reservations/${reservation.id}/`, { method: 'DELETE' })
    await load()
  }

  return (
    <>
      <PageHero
        title="Reserve for Someone"
        lead="Reserve bundles for people your organization supports. They don’t need an email or phone: give them the pickup code."
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
          {data?.site && data.drops.length === 0 && <p className="muted">There are no upcoming drops at {data.site.name} yet.</p>}

          {drop && (
            <>
              <div className="field drop-picker no-print">
                <label htmlFor="host-drop">Which drop?</label>
                <select id="host-drop" value={dropId} onChange={(e) => setDropId(Number(e.target.value))}>
                  {data.drops.map((d) => (
                    <option key={d.id} value={d.id}>
                      {longDate(d.drop_date)}
                    </option>
                  ))}
                </select>
                <p className="muted">
                  {timeRange(drop.starts_at, drop.ends_at)} at {data.site.name}, {data.site.address}
                  {drop.ordering_open
                    ? ` · reserve by ${dateAtTime(drop.order_cutoff)} · ${drop.bundles_left} bundles left`
                    : ' · reservations are closed'}
                </p>
              </div>

              <div className="preorder-layout">
                {drop.ordering_open ? (
                  <div className="block block-white no-print">
                    <h2>Reserve a bundle</h2>
                    <HostReserveForm key={drop.id} drop={drop} onReserved={load} />
                  </div>
                ) : (
                  <div className="block block-white no-print">
                    <p>Reservations for this drop have closed. To make a change, please talk to your Community Manager.</p>
                  </div>
                )}

                <div>
                  <div className="list-heading">
                    <h2>
                      Reserved for {longDate(drop.drop_date)} <span className="print-only">at {data.site.name}</span>
                    </h2>
                    {drop.reservations.length > 0 && (
                      <button className="btn btn-small no-print" onClick={() => window.print()}>
                        Print list
                      </button>
                    )}
                  </div>
                  {drop.reservations.length === 0 && <p className="muted">You haven’t reserved any bundles for this drop yet.</p>}
                  <ul className="preorder-list">
                    {drop.reservations.map((r) => (
                      <HostReservationRow key={r.id} reservation={r} canCancel={drop.ordering_open} onCancel={cancel} />
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  )
}

function HostReserveForm({ drop, onReserved }) {
  const pricing = usePricing()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bundles, setBundles] = useState(1)
  const [tier, setTier] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) return setError('Add a first name or initials.')
    if (!tier) return setError('Choose a price.')
    setBusy(true)
    setError('')
    try {
      await api('/host/reservations/', {
        method: 'POST',
        body: { site_drop: drop.id, customer_name: name, phone, bundles, price_tier: tier },
      })
      setName('')
      setPhone('')
      setBundles(1)
      setTier(null)
      await onReserved()
    } catch (err) {
      const data = err.data || {}
      setError([].concat(data.bundles ?? data.site_drop ?? data.customer_name ?? data.detail ?? err.message).join(' '))
    }
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="host-name">
          Name <span className="field-hint">(a first name or initials is fine)</span>
        </label>
        <input id="host-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="host-phone">
          Phone <span className="field-hint">(optional)</span>
        </label>
        <input id="host-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="host-bundles">Bundles</label>
        <Stepper id="host-bundles" value={bundles} onChange={setBundles} min={1} max={4} size="small" label="bundles" />
      </div>
      <fieldset className="choice-group choice-row">
        <legend>Price (paid at the drop)</legend>
        {TIERS.map((option) => (
          <label key={option.value} className={'choice' + (tier === option.value ? ' choice-on' : '')}>
            <input type="radio" name="host-tier" checked={tier === option.value} onChange={() => setTier(option.value)} />
            {option.label}
            {pricing && option.priceKey && ` ${money(pricing[option.priceKey])}`}
          </label>
        ))}
      </fieldset>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Reserving…' : 'Reserve'}
      </button>
    </form>
  )
}

function HostReservationRow({ reservation, canCancel, onCancel }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <li className={'preorder' + (reservation.picked_up ? ' preorder-done' : '')}>
      <div className="preorder-who">
        <strong>{reservation.customer_name}</strong>
        <span className="muted">
          {reservation.bundles} {reservation.bundles === 1 ? 'bundle' : 'bundles'} · {reservation.price_tier_label}
          {Number(reservation.amount_due) > 0 && ` (${money(reservation.amount_due)} at the drop)`}
          {reservation.phone && ` · ${reservation.phone}`}
        </span>
      </div>
      <div className="host-code">
        <span className="muted">Pickup code</span>
        <span className="code-text host-code-value">{reservation.pickup_code}</span>
      </div>
      {canCancel && !reservation.picked_up && (
        <div className="preorder-toggles no-print">
          {confirming ? (
            <>
              <button className="btn btn-small" onClick={() => onCancel(reservation)}>
                Cancel it
              </button>
              <button className="btn btn-small" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button className="link-button" onClick={() => setConfirming(true)}>
              Cancel
            </button>
          )}
        </div>
      )}
    </li>
  )
}
