import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { longDate, money, timeRange } from '../../../format'
import { usePricing } from '../../../pricing'
import PageHero from '../../../components/PageHero'
import Stepper from '../../../components/Stepper'

// Community Manager screen: the list of customers who reserved bundles, used at the drop to tick people off.
export default function PreordersPage() {
  const { user } = useAuth()
  const [drops, setDrops] = useState(null)
  const [dropId, setDropId] = useState(null)
  const [preorders, setPreorders] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api('/manager/drops/')
      .then((all) => {
        // The next drop that hasn't happened yet, and the most recent one, are the ones people need here.
        const upcoming = all.filter((d) => !d.has_happened)
        const recent = all.filter((d) => d.has_happened).slice(-1)
        const choices = [...recent, ...upcoming.slice(0, 3)]
        setDrops(choices)
        setDropId((upcoming[0] ?? recent[0])?.id ?? null)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!dropId) return
    setPreorders(null)
    api(`/manager/drops/${dropId}/preorders/`).then(setPreorders)
  }, [dropId])

  // Reloads the drop (for its waitlist) and its preorders after something that can change both.
  async function reload() {
    const [all, list] = await Promise.all([api('/manager/drops/'), api(`/manager/drops/${dropId}/preorders/`)])
    setDrops((current) => current.map((d) => all.find((fresh) => fresh.id === d.id) ?? d))
    setPreorders(list)
  }

  const drop = drops?.find((d) => d.id === dropId)

  async function add(form) {
    const created = await api(`/manager/drops/${dropId}/preorders/`, { method: 'POST', body: form })
    setPreorders([...preorders, created])
  }

  async function update(preorder, changes) {
    // Show the change straight away; put it back if the server says no.
    setPreorders((list) => list.map((p) => (p.id === preorder.id ? { ...p, ...changes } : p)))
    try {
      await api(`/manager/preorders/${preorder.id}/`, { method: 'PATCH', body: changes })
    } catch (err) {
      setPreorders((list) => list.map((p) => (p.id === preorder.id ? preorder : p)))
      setError(err.message)
    }
  }

  async function remove(preorder) {
    await api(`/manager/preorders/${preorder.id}/`, { method: 'DELETE' })
    // The freed bundles may have gone to someone on the waitlist.
    await reload()
  }

  const shown = (preorders ?? [])
    .filter((p) => {
      const term = search.trim().toLowerCase()
      return p.customer_name.toLowerCase().includes(term) || p.pickup_code.toLowerCase() === term
    })
    // People still to collect go first, then alphabetical.
    .sort((a, b) => a.picked_up - b.picked_up || a.customer_name.localeCompare(b.customer_name))
  const total = (key) => (preorders ?? []).filter((p) => p[key]).length
  const bundles = (preorders ?? []).reduce((sum, p) => sum + p.bundles, 0)

  return (
    <>
      <PageHero title="Preorders" lead="Keep a list of customers who have reserved a bundle.">
        {user.site_name && <p className="hero-meta">{user.site_name}</p>}
      </PageHero>

      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!drops && !error && <p className="muted">Loading…</p>}
          {drops?.length === 0 && <p className="muted">There are no drops to take preorders for yet.</p>}

          {drops?.length > 0 && (
            <div className="field drop-picker">
              <label htmlFor="drop">Which drop?</label>
              <select id="drop" value={dropId ?? ''} onChange={(e) => setDropId(Number(e.target.value))}>
                {drops.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.cycle_name}
                    {d.has_happened ? ' (past)' : ''}
                  </option>
                ))}
              </select>
              {drop && (
                <p className="muted">
                  {longDate(drop.drop_date)} · {timeRange(drop.starts_at, drop.ends_at)}
                  {drop.bundles !== null && ` · you ordered ${drop.bundles} bundles`}
                </p>
              )}
            </div>
          )}

          {preorders && (
            <>
              <div className="stat-tiles stat-tiles-4">
                <Tile label="Customers" value={preorders.length} />
                <Tile label="Bundles reserved" value={bundles} />
                <Tile label="Paid" value={`${total('paid')} of ${preorders.length}`} />
                <Tile label="Picked up" value={`${total('picked_up')} of ${preorders.length}`} />
              </div>

              {drop && !drop.has_happened && (
                <CheckIn dropId={dropId} onCheckedIn={(done) => setPreorders((list) => list.map((p) => (p.id === done.id ? done : p)))} />
              )}

              {drop && bundles > (drop.bundles ?? 0) && drop.bundles !== null && (
                <div className="notice notice-error">
                  You've reserved {bundles} bundles but only ordered {drop.bundles}. Order more on the Order screen if
                  ordering is still open.
                </div>
              )}

              <div className="preorder-layout">
                <div className="block block-white">
                  <h2>Add a preorder</h2>
                  <AddPreorderForm key={dropId} drop={drop} onAdd={add} />
                </div>

                <div>
                  <div className="list-heading">
                    <h2>Customers</h2>
                    {preorders.length > 5 && (
                      <input
                        className="search-box"
                        type="search"
                        placeholder="Find a name or code"
                        aria-label="Find a customer by name or pickup code"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    )}
                  </div>
                  {preorders.length === 0 && <p className="muted">No preorders yet for this drop.</p>}
                  <ul className="preorder-list">
                    {shown.map((preorder) => (
                      <PreorderRow key={preorder.id} preorder={preorder} onUpdate={update} onRemove={remove} />
                    ))}
                  </ul>
                  {drop?.waitlist.length > 0 && (
                    <div className="waitlist">
                      <h3>Waitlist</h3>
                      <p className="muted">
                        When a spot opens up before ordering closes, the next person gets it automatically and is emailed.
                      </p>
                      <ol>
                        {drop.waitlist.map((w, index) => (
                          <li key={index}>
                            {w.customer_name}: {w.bundles} {w.bundles === 1 ? 'bundle' : 'bundles'}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>

              {drop && !drop.has_happened && preorders.length + drop.waitlist.length > 0 && (
                <MessageCustomers key={drop.id} drop={drop} count={preorders.length + drop.waitlist.length} />
              )}
              {drop && <ReservationSettings drop={drop} reserved={bundles} onSaved={reload} />}
            </>
          )}
        </div>
      </section>
    </>
  )
}

function Tile({ label, value }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

const TIERS = [
  { value: 'standard', label: 'Standard', priceKey: 'standard_price' },
  { value: 'at_cost', label: 'At cost', priceKey: 'at_cost_price' },
  { value: 'free', label: 'Free' },
]

function AddPreorderForm({ drop, onAdd }) {
  const pricing = usePricing()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bundles, setBundles] = useState(1)
  const [tier, setTier] = useState('standard')
  const [delivery, setDelivery] = useState(false)
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError("Please add the customer's name.")
      return
    }
    if (delivery && !address.trim()) {
      setError('Add the address to deliver to.')
      return
    }
    try {
      await onAdd({ customer_name: name, phone, bundles, price_tier: tier, delivery, delivery_address: delivery ? address : '' })
      setName('')
      setPhone('')
      setBundles(1)
      setTier('standard')
      setDelivery(false)
      setAddress('')
      setError('')
    } catch (err) {
      const data = err.data || {}
      setError([].concat(data.customer_name ?? data.bundles ?? data.delivery ?? data.delivery_address ?? err.message).join(' '))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="customer-name">Customer name *</label>
        <input id="customer-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="customer-phone">
          Phone <span className="field-hint">(optional)</span>
        </label>
        <input id="customer-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="customer-bundles">Bundles</label>
        <Stepper id="customer-bundles" value={bundles} onChange={setBundles} min={1} max={20} size="small" label="bundles" />
      </div>
      <fieldset className="choice-group choice-row">
        <legend>Price</legend>
        {TIERS.map((option) => (
          <label key={option.value} className={'choice' + (tier === option.value ? ' choice-on' : '')}>
            <input type="radio" name="price-tier" checked={tier === option.value} onChange={() => setTier(option.value)} />
            {option.label}
            {pricing && option.priceKey && ` ${money(pricing[option.priceKey])}`}
          </label>
        ))}
      </fieldset>
      {drop?.delivery_partner && (
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
            Home delivery with {drop.delivery_partner}
            {pricing && ` (${money(pricing.delivery_fee)} fee)`}
          </label>
          {delivery && (
            <>
              <label htmlFor="customer-address" className="visually-hidden">
                Delivery address
              </label>
              <input
                id="customer-address"
                placeholder="Delivery address"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </>
          )}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary btn-block">Add preorder</button>
    </form>
  )
}

function PreorderRow({ preorder, onUpdate, onRemove }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <li className={'preorder' + (preorder.picked_up ? ' preorder-done' : '')}>
      <div className="preorder-who">
        <strong>{preorder.customer_name}</strong>
        <span className="preorder-badges">
          {preorder.source === 'online' && <span className="tag">Online</span>}
          {preorder.every_drop && <span className="tag">Every drop</span>}
          {Number(preorder.pay_it_forward) > 0 && <span className="tag">+{money(preorder.pay_it_forward)} gift</span>}
          {preorder.price_tier !== 'standard' && <span className="tag">{preorder.price_tier_label}</span>}
          {preorder.delivery && <span className="tag tag-waiting">Delivery</span>}
        </span>
        {preorder.delivery && <span className="muted">Deliver to {preorder.delivery_address}</span>}
        <span className="muted">
          {preorder.bundles} {preorder.bundles === 1 ? 'bundle' : 'bundles'}
          {' · code '}
          <span className="code-text">{preorder.pickup_code}</span>
          {preorder.phone && (
            <>
              {' · '}
              <a href={`tel:${preorder.phone}`}>{preorder.phone}</a>
            </>
          )}
        </span>
      </div>
      <div className="preorder-toggles">
        <Toggle on={preorder.paid} onClick={() => onUpdate(preorder, { paid: !preorder.paid })} label="Paid" />
        <Toggle
          on={preorder.picked_up}
          onClick={() => onUpdate(preorder, { picked_up: !preorder.picked_up })}
          label="Picked up"
        />
        {confirming ? (
          <>
            <button className="btn btn-small" onClick={() => onRemove(preorder)}>
              Remove
            </button>
            <button className="btn btn-small" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        ) : (
          <button className="link-button" onClick={() => setConfirming(true)} aria-label={`Remove ${preorder.customer_name}`}>
            Remove
          </button>
        )}
      </div>
    </li>
  )
}

function Toggle({ on, onClick, label }) {
  return (
    <button className={'toggle' + (on ? ' toggle-on' : '')} aria-pressed={on} onClick={onClick}>
      <span aria-hidden="true">{on ? '✓' : ''}</span> {label}
    </button>
  )
}

// At the drop: type the customer's pickup code, see what to collect, and tick them off in one tap.
function CheckIn({ dropId, onCheckedIn }) {
  const [code, setCode] = useState('')
  const [found, setFound] = useState(null)
  const [error, setError] = useState('')

  async function find(event) {
    event.preventDefault()
    setFound(null)
    setError('')
    if (!code.trim()) return
    try {
      setFound(await api(`/manager/drops/${dropId}/pickup/${encodeURIComponent(code.trim())}/`))
    } catch (err) {
      setError(err.message)
    }
  }

  async function checkIn() {
    const done = await api(`/manager/preorders/${found.id}/`, { method: 'PATCH', body: { paid: true, picked_up: true } })
    onCheckedIn(done)
    setFound(done)
    setCode('')
  }

  return (
    <div className="block block-white check-in">
      <form className="check-in-form" onSubmit={find}>
        <label htmlFor="pickup-code">Pickup code</label>
        <input
          id="pickup-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={4}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="K7M4"
        />
        <button className="btn btn-primary">Find</button>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {found && (
        <div className="check-in-result" role="status">
          <p>
            <strong>{found.customer_name}</strong>: {found.bundles} {found.bundles === 1 ? 'bundle' : 'bundles'}
            {found.price_tier !== 'standard' && ` (${found.price_tier_label})`}
            {Number(found.pay_it_forward) > 0 && `, with a ${money(found.pay_it_forward)} gift for a neighbour`}
          </p>
          {found.picked_up ? (
            <p className="check-in-done">✓ Paid and picked up</p>
          ) : (
            <button className="btn btn-primary btn-block" onClick={checkIn}>
              {Number(found.amount_due) > 0 ? `Collected ${money(found.amount_due)}: mark picked up` : 'Mark picked up'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Whether customers can reserve this location online, and how many bundles are set aside for reservations.
function ReservationSettings({ drop, reserved, onSaved }) {
  const [on, setOn] = useState(drop.online_reservations)
  const [limit, setLimit] = useState(drop.reservation_limit)
  const [saved, setSaved] = useState(false)
  const changed = on !== drop.online_reservations || limit !== drop.reservation_limit

  async function save() {
    await api('/manager/reservations/', { method: 'PATCH', body: { online_reservations: on, reservation_limit: limit } })
    await onSaved()
    setSaved(true)
  }

  return (
    <div className="block block-white reservation-settings">
      <h2>Online reservations</h2>
      <p className="muted">
        {drop.online_reservations
          ? `${reserved} of ${drop.reservation_limit} bundles set aside for reservations are taken for this drop, ${drop.online_count} of them reserved online.`
          : 'Customers can’t reserve your location on the website right now.'}
      </p>
      <label className="check">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setSaved(false) }} />
        Let customers reserve bundles on the website
      </label>
      <div className="field">
        <label htmlFor="reservation-limit">Bundles to set aside for reservations at each drop</label>
        <Stepper id="reservation-limit" value={limit} onChange={(v) => { setLimit(v); setSaved(false) }} min={0} max={300} size="small" label="bundles set aside" />
        <p className="field-hint">Includes the ones you add here. When they’re gone, customers can join a waitlist.</p>
      </div>
      <button className="btn btn-primary" onClick={save} disabled={!changed}>
        Save
      </button>
      {saved && <span className="saved-note"> Saved.</span>}
    </div>
  )
}

// Email everyone who reserved this drop (e.g. "We're moving indoors because of rain").
function MessageCustomers({ drop, count }) {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function send(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      setResult(await api(`/manager/drops/${drop.id}/message/`, { method: 'POST', body: { message } }))
      setMessage('')
    } catch (err) {
      setError([].concat(err.data?.message ?? err.message).join(' '))
    }
    setBusy(false)
  }

  return (
    <div className="block block-white message-customers">
      <h2>Message your customers</h2>
      <p className="muted">
        Emails everyone with a reservation or on the waitlist for this drop ({count} {count === 1 ? 'person' : 'people'}), for
        example about weather or a change of room.
      </p>
      <form onSubmit={send} noValidate>
        <div className="field">
          <label htmlFor="customer-message">Message</label>
          <textarea
            id="customer-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Because of the rain, Saturday's drop will be inside the community centre, in the gym."
          />
          {error && <p className="field-error">{error}</p>}
        </div>
        <button className="btn btn-primary" disabled={busy || !message.trim()}>
          {busy ? 'Sending…' : 'Send email'}
        </button>
      </form>
      {result && (
        <div className="notice notice-success message-result" role="status">
          Sent to {result.emailed} {result.emailed === 1 ? 'person' : 'people'}.
          {result.phone_only.length > 0 && (
            <>
              {' '}
              These people have no email, so please call or text them:
              <ul>
                {result.phone_only.map((p, i) => (
                  <li key={i}>
                    {p.customer_name}
                    {p.phone ? `: ${p.phone}` : ' (no phone number either)'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
