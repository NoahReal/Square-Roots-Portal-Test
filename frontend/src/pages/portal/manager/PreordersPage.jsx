import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { longDate, timeRange } from '../../../format'
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
    setPreorders(preorders.filter((p) => p.id !== preorder.id))
  }

  const shown = (preorders ?? [])
    .filter((p) => p.customer_name.toLowerCase().includes(search.trim().toLowerCase()))
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

              {drop && bundles > (drop.bundles ?? 0) && drop.bundles !== null && (
                <div className="notice notice-error">
                  You've reserved {bundles} bundles but only ordered {drop.bundles}. Order more on the Order screen if
                  ordering is still open.
                </div>
              )}

              <div className="preorder-layout">
                <div className="block block-white">
                  <h2>Add a preorder</h2>
                  <AddPreorderForm onAdd={add} />
                </div>

                <div>
                  <div className="list-heading">
                    <h2>Customers</h2>
                    {preorders.length > 5 && (
                      <input
                        className="search-box"
                        type="search"
                        placeholder="Find a name"
                        aria-label="Find a customer"
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
                </div>
              </div>
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

function AddPreorderForm({ onAdd }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bundles, setBundles] = useState(1)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (!name.trim()) {
      setError("Please add the customer's name.")
      return
    }
    try {
      await onAdd({ customer_name: name, phone, bundles })
      setName('')
      setPhone('')
      setBundles(1)
      setError('')
    } catch (err) {
      setError([].concat(err.data?.customer_name ?? err.data?.bundles ?? err.message).join(' '))
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
        <span className="muted">
          {preorder.bundles} {preorder.bundles === 1 ? 'bundle' : 'bundles'}
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
